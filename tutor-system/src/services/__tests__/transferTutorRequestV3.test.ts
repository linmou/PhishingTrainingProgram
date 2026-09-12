#!/usr/bin/env node
// Test responsible for the canonical v3 transfer tutor request contract: version fields, deterministic byte-equivalent serialization, order and duplicate independence, and the boundary that keeps private assessment material out of the production provider request.

import {
  buildTransferTutorRequestContextV3,
  buildTransferTutorRequestV3,
  buildTransferTutorUserMessageV3,
  TransferTutorRequestContextInputV3,
} from '../ecologicalTutorCall';

function baseInput(overrides: Partial<TransferTutorRequestContextInputV3> = {}): TransferTutorRequestContextInputV3 {
  return {
    room_id: 'room-1',
    checklist_id: 'checklist-1',
    focus_student_id: 'student-1',
    focus_student_message: {
      id: 'message-1',
      room_id: 'room-1',
      user_id: 'student-1',
      user_role: 'student',
      content: '  A teammate sent me a prize link.  ',
    },
    prior_participation_mode: 'tutoring',
    checklist_items: [
      {
        id: 'item-b',
        area_text: '  Spot urgent language  ',
        priority: 'important',
        status: 'partially_covered',
        understanding_level: 'basic',
        relevant_evidence_message_ids: ['msg-2', 'msg-1', 'msg-2'],
        repair_message_id: null,
      },
      {
        id: 'item-a',
        area_text: 'Verify sender identity',
        priority: 'critical',
        status: 'covered',
        understanding_level: 'good',
        relevant_evidence_message_ids: ['msg-3'],
        repair_message_id: 'repair-1',
      },
    ],
    eligible_assessment_item_ids: ['item-2', 'item-1', 'item-2'],
    unresolved_assessment: {
      id: 'assessment-1',
      selection_type: 'single',
      stem: '  Which statement is safest?  ',
      rendered_text: 'Which statement is safest?\nChoose one.',
      options: [
        { id: 'D' as const, text: ' fourth ' },
        { id: 'B' as const, text: 'second' },
        { id: 'A' as const, text: 'first' },
        { id: 'C' as const, text: 'third' },
      ],
    },
    feedback_required: false,
    progress_snapshot_hash: 'snapshot-1',
    ...overrides,
  };
}

describe('v3 transfer request contract', () => {
  it('stamps both contract versions and the transfer policy version', () => {
    const context = buildTransferTutorRequestContextV3(baseInput());
    const request = buildTransferTutorRequestV3(context);

    expect(context.contract_version).toBe('transfer_tutor_context_v3');
    expect(context.progress_policy_version).toBe('transfer_v1');
    expect(request.contract_version).toBe('transfer_tutor_request_v3');
    expect(request.context).toBe(context);
  });

  it('normalizes array order and duplicates so the output is canonical', () => {
    const context = buildTransferTutorRequestContextV3(baseInput());

    expect(context.checklist_items.map((item) => item.id)).toEqual(['item-a', 'item-b']);
    expect(context.eligible_assessment_item_ids).toEqual(['item-1', 'item-2']);
    expect(context.checklist_items[0].relevant_evidence_message_ids).toEqual(['msg-3']);
    expect(context.checklist_items[1].relevant_evidence_message_ids).toEqual(['msg-1', 'msg-2']);
    expect(context.unresolved_assessment!.options.map((option) => option.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('trims free text and forces the student role on the focus message', () => {
    const context = buildTransferTutorRequestContextV3(baseInput());

    expect(context.focus_student_message.content).toBe('A teammate sent me a prize link.');
    expect(context.focus_student_message.user_role).toBe('student');
    expect(context.unresolved_assessment!.stem).toBe('Which statement is safest?');
  });

  it('produces byte-equivalent requests for equivalent contexts with different input order', () => {
    const first = buildTransferTutorRequestV3(buildTransferTutorRequestContextV3(baseInput()));
    const second = buildTransferTutorRequestV3(
      buildTransferTutorRequestContextV3(
        baseInput({
          checklist_items: [...baseInput().checklist_items].reverse(),
          eligible_assessment_item_ids: ['item-1', 'item-2'],
        })
      )
    );

    expect(buildTransferTutorUserMessageV3(first)).toBe(buildTransferTutorUserMessageV3(second));
  });

  it('is deterministic across repeated builds of the same input', () => {
    const context = buildTransferTutorRequestContextV3(baseInput());
    const request = buildTransferTutorRequestV3(context);

    expect(buildTransferTutorUserMessageV3(request)).toBe(buildTransferTutorUserMessageV3(request));
  });

  it('accepts a null unresolved assessment and no checklist items', () => {
    const context = buildTransferTutorRequestContextV3(
      baseInput({ unresolved_assessment: null, checklist_items: [] })
    );

    expect(context.unresolved_assessment).toBeNull();
    expect(context.checklist_items).toEqual([]);
  });

  it('keeps a null repair message explicit rather than omitting the field', () => {
    const context = buildTransferTutorRequestContextV3(baseInput());
    const withoutRepair = context.checklist_items.find((item) => item.id === 'item-b');

    expect(withoutRepair!.repair_message_id).toBeNull();
    expect(JSON.stringify(context)).toContain('"repair_message_id":null');
  });

  it('carries no private assessment material into the provider request', () => {
    const request = buildTransferTutorRequestV3(buildTransferTutorRequestContextV3(baseInput()));
    const serialized = buildTransferTutorUserMessageV3(request);

    ['correct_option_ids', 'transfer_basis', 'private_payload', 'raw_model_output', 'reviewed_payload', 'rationale'].forEach(
      (field) => {
        expect(serialized).not.toContain(field);
      }
    );
    expect(serialized).toContain('unresolved_assessment');
  });

  it('does not carry learner-selected answer labels, since the request is pre-answer', () => {
    const serialized = buildTransferTutorUserMessageV3(
      buildTransferTutorRequestV3(buildTransferTutorRequestContextV3(baseInput()))
    );

    ['selected_option_ids', 'answer_message_id', 'graded', 'assessment_pass', 'assessment_fail'].forEach((field) => {
      expect(serialized).not.toContain(field);
    });
  });

  it('does not mutate the caller input', () => {
    const input = baseInput();
    const before = JSON.stringify(input);

    buildTransferTutorRequestContextV3(input);

    expect(JSON.stringify(input)).toBe(before);
  });
});

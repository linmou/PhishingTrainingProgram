#!/usr/bin/env node
// Test responsible for the public message result projection through the browser facade (T014):
// `sendReviewed` and `processMessage` must expose typed public DTOs carrying no assessment key, no
// transfer basis, and no private draft or feedback material, and the projection must be an
// allowlist so a newly added private column cannot leak by default. There is no question table any
// more, so the assessment travels on the tutor message and this file asserts that boundary.

import {
  PUBLIC_ASSESSMENT_FORBIDDEN_KEYS,
  PUBLIC_MESSAGE_DTO_KEYS,
  TransferAssessmentService,
  toPublicMessageDTO,
} from '../transferAssessmentService';

const OPTIONS = [
  { id: 'A' as const, text: 'The familiar account proves the link is safe' },
  { id: 'B' as const, text: 'The account could have been compromised' },
  { id: 'C' as const, text: 'Every prize message is necessarily a scam' },
  { id: 'D' as const, text: 'Opening the link proves the sender identity' },
];

/**
 * A stored tutor message row as the collapsed model holds it: the assessment, its key, and the
 * transfer basis all live on the message, and every private column is marked so a leak is visible.
 */
function storedMessageRow(): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: 'message-2',
    room_id: 'room-1',
    user_id: 'tutor-1',
    content: 'Which statement best describes the risk?',
    user_role: 'tutor',
    is_ai_generated: true,
    parent_message_id: 'message-1',
    response_mode: 'assessment',
    created_at: '2026-09-12T00:00:00.000Z',
    assessment_options: OPTIONS,
    assessment_lifecycle: 'delivered',
    assessment_checklist_id: 'checklist-1',
    assessment_item_id: 'item-1',
    assessment_key: ['B'],
    assessment_answer_message_id: null,
    assessment_selected_option_ids: null,
    assessment_result: null,
    assessment_closed_at: null,
  };
  PUBLIC_ASSESSMENT_FORBIDDEN_KEYS.forEach((name, index) => {
    row[name] = `leaked-${index}`;
  });
  row.raw_model_output = 'leaked-raw';
  return row;
}

function createService(response: unknown) {
  return new TransferAssessmentService({
    requestId: () => 'request-fixed-1',
    api: { invoke: async () => ({ data: { ok: true, data: response } as never, error: null }) },
  });
}

const REVIEWED_INPUT = {
  reviewedPayload: {
    reason: 'the learner has not transferred the rule yet',
    decision: { mode: 'assessment' as const, instruction: 'transfer_assess' as const, target_item_id: 'item-1' },
    response: 'Which statement best describes the risk?',
    assessment: {
      selection_type: 'single' as const,
      options: OPTIONS,
      stem: 'Which statement best describes the risk?',
      rendered_text: 'Which statement best describes the risk?',
      correct_option_ids: ['B' as const],
      transfer_basis: {
        concept_rule: 'identity is not authentication',
        source_context: 'the learner trusted a familiar sender',
        changed_context: 'a prize message from a familiar account',
        source_evidence_message_ids: ['message-1'],
      },
    },
  },
  roomId: 'room-1',
  studentId: 'student-1',
  checklistId: 'checklist-1',
  itemId: 'item-1',
  focusStudentMessageId: 'message-1',
};

describe('public message result projection', () => {
  it('projects a stored assessment message onto exactly the public allowlist', () => {
    const dto = toPublicMessageDTO(storedMessageRow());
    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_MESSAGE_DTO_KEYS].sort());
  });

  it('drops the assessment key and every forbidden private key from a message, by name and by value', () => {
    const dto = toPublicMessageDTO(storedMessageRow());

    expect(JSON.stringify(dto)).not.toContain('leaked-');
    expect(dto).not.toHaveProperty('assessment_key');
    expect(dto).not.toHaveProperty('raw_model_output');
    PUBLIC_ASSESSMENT_FORBIDDEN_KEYS.forEach((name) => {
      expect(dto).not.toHaveProperty(name);
    });
  });

  it('keeps the learner-visible message fields and normalizes absent ones to null', () => {
    const dto = toPublicMessageDTO(storedMessageRow());
    expect(dto.content).toBe('Which statement best describes the risk?');
    expect(dto.user_role).toBe('tutor');
    expect(dto.response_mode).toBe('assessment');

    const sparse = toPublicMessageDTO({ id: 'message-9' });
    PUBLIC_MESSAGE_DTO_KEYS.forEach((key) => {
      expect(sparse[key]).not.toBeUndefined();
    });
  });

  it('projects sendReviewed into a typed delivery with only the public message and room', async () => {
    const service = createService({
      message: storedMessageRow(),
      room: { id: 'room-1', name: 'Room' },
    });

    const delivery = await service.sendReviewed(REVIEWED_INPUT);

    expect(Object.keys(delivery).sort()).toEqual(['message', 'room']);
    expect(Object.keys(delivery.message).sort()).toEqual([...PUBLIC_MESSAGE_DTO_KEYS].sort());
    expect(JSON.stringify(delivery)).not.toContain('leaked-');
    expect(delivery.message).not.toHaveProperty('assessment_key');
    expect((delivery.room as unknown as { id: string }).id).toBe('room-1');
  });

  it('surfaces a tutoring delivery with no assessment key as plain content', async () => {
    const service = createService({
      message: { ...storedMessageRow(), response_mode: 'tutoring', assessment_key: null, assessment_lifecycle: null },
      room: {},
    });

    const delivery = await service.sendReviewed(REVIEWED_INPUT);

    expect(delivery.message).not.toHaveProperty('assessment_key');
    expect(delivery.message.content).toBe('Which statement best describes the risk?');
  });

  it('projects processMessage into a typed grading outcome', async () => {
    const service = createService({
      message_id: 'message-2',
      result: 'fail',
      selected_option_ids: ['C'],
      transition: { status: 'needs_review' },
      feedback_required: true,
    });

    const processed = await service.processMessage('message-3');

    // `message_id` is the key the RPC returns; an earlier shape read `question_id`, which the
    // server never sends, so the identity was empty on every answer. The three extra flags carry
    // the unresolved-answer and replay variants that the same operation can return.
    expect(Object.keys(processed).sort()).toEqual([
      'already_processed',
      'clarification_required',
      'code',
      'feedback_required',
      'message_id',
      'result',
      'selected_option_ids',
      'transition',
    ]);
    expect(processed.message_id).toBe('message-2');
    expect(processed.result).toBe('fail');
    expect(processed.selected_option_ids).toEqual(['C']);
    expect(processed.feedback_required).toBe(true);
  });

  it('defaults a malformed processMessage result rather than forwarding unknown keys', async () => {
    const service = createService({ message_id: 'message-2', correct_option_ids: ['B'], transfer_basis: { x: 1 } });
    const processed = await service.processMessage('message-3');
    expect(processed).not.toHaveProperty('correct_option_ids');
    expect(processed).not.toHaveProperty('transfer_basis');
    expect(processed.result).toBeNull();
    expect(processed.feedback_required).toBe(false);
  });
});

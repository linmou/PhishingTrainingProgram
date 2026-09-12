#!/usr/bin/env node
// Test responsible for the public question/message result projection through the browser facade
// (T014): `sendReviewed` and `processMessage` must expose typed public DTOs carrying no
// `correct_option_ids`, no transfer basis, and no private draft or feedback material, and the
// projection must be an allowlist so a newly added private column cannot leak by default.

import {
  PUBLIC_ASSESSMENT_FORBIDDEN_KEYS,
  PUBLIC_MESSAGE_DTO_KEYS,
  PUBLIC_QUESTION_DTO_KEYS,
  TransferAssessmentService,
  toPublicMessageDTO,
  toPublicQuestionDTO,
} from '../transferAssessmentService';

const OPTIONS = [
  { id: 'A' as const, text: 'The familiar account proves the link is safe' },
  { id: 'B' as const, text: 'The account could have been compromised' },
  { id: 'C' as const, text: 'Every prize message is necessarily a scam' },
  { id: 'D' as const, text: 'Opening the link proves the sender identity' },
];

/** A stored question row with every private column populated and marked. */
function storedQuestionRow(): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: 'question-1',
    room_id: 'room-1',
    student_id: 'student-1',
    checklist_id: 'checklist-1',
    item_id: 'item-1',
    tutor_message_id: 'message-2',
    source_student_message_id: 'message-1',
    selection_type: 'single',
    stem: 'Which statement best describes the risk?',
    rendered_text: 'Which statement best describes the risk?',
    options: OPTIONS,
    lifecycle: 'open',
    answer_message_id: null,
    selected_option_ids: null,
    result: null,
    closed_reason: null,
    feedback_message_id: null,
  };
  PUBLIC_ASSESSMENT_FORBIDDEN_KEYS.forEach((name, index) => {
    row[name] = `leaked-${index}`;
  });
  return row;
}

function storedMessageRow(): Record<string, unknown> {
  const row: Record<string, unknown> = {
    id: 'message-2',
    room_id: 'room-1',
    user_id: 'tutor-1',
    content: 'Let us look at how you checked the sender.',
    user_role: 'tutor',
    is_ai_generated: true,
    parent_message_id: 'message-1',
    response_mode: 'tutoring',
    created_at: '2026-09-12T00:00:00.000Z',
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

describe('public assessment result projection', () => {
  it('projects a stored question onto exactly the public allowlist', () => {
    const dto = toPublicQuestionDTO(storedQuestionRow());
    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_QUESTION_DTO_KEYS].sort());
  });

  it('drops every forbidden private key from a question, by name and by value', () => {
    const dto = toPublicQuestionDTO(storedQuestionRow());
    expect(JSON.stringify(dto)).not.toContain('leaked-');
    PUBLIC_ASSESSMENT_FORBIDDEN_KEYS.forEach((name) => {
      expect(dto).not.toHaveProperty(name);
    });
  });

  it('projects a stored message onto exactly the public allowlist', () => {
    const dto = toPublicMessageDTO(storedMessageRow());
    expect(Object.keys(dto).sort()).toEqual([...PUBLIC_MESSAGE_DTO_KEYS].sort());
    expect(JSON.stringify(dto)).not.toContain('leaked-');
    expect(dto).not.toHaveProperty('raw_model_output');
  });

  it('preserves learner-visible grading fields while withholding the key', () => {
    const dto = toPublicQuestionDTO({
      ...storedQuestionRow(),
      lifecycle: 'closed',
      selected_option_ids: ['B'],
      result: { correct: true },
      answer_message_id: 'message-3',
    });

    expect(dto.lifecycle).toBe('closed');
    expect(dto.selected_option_ids).toEqual(['B']);
    expect(dto.result).toEqual({ correct: true });
    expect(dto.answer_message_id).toBe('message-3');
    expect(dto).not.toHaveProperty('correct_option_ids');
  });

  it('normalizes absent question fields to null so the shape is stable', () => {
    const dto = toPublicQuestionDTO({ id: 'question-1', selection_type: 'single', stem: 's', rendered_text: 's', options: OPTIONS });
    PUBLIC_QUESTION_DTO_KEYS.forEach((key) => {
      expect(dto[key]).not.toBeUndefined();
    });
  });

  it('projects sendReviewed into a typed delivery with a public question and message', async () => {
    const service = createService({
      message: storedMessageRow(),
      question: storedQuestionRow(),
      room: { id: 'room-1', name: 'Room' },
      feedback_id: 'feedback-1',
    });

    const delivery = await service.sendReviewed({ draftId: 'draft-1', expectedRevision: 2, expectedHash: 'a'.repeat(64) });

    expect(Object.keys(delivery).sort()).toEqual(['feedback_id', 'message', 'question', 'room']);
    expect(Object.keys(delivery.message).sort()).toEqual([...PUBLIC_MESSAGE_DTO_KEYS].sort());
    expect(Object.keys(delivery.question!).sort()).toEqual([...PUBLIC_QUESTION_DTO_KEYS].sort());
    expect(JSON.stringify(delivery)).not.toContain('leaked-');
    expect(delivery.feedback_id).toBe('feedback-1');
  });

  it('surfaces a tutoring delivery with no assessment question as a null question', async () => {
    const service = createService({ message: storedMessageRow(), question: null, room: {}, feedback_id: 'feedback-2' });
    const delivery = await service.sendReviewed({ draftId: 'draft-1', expectedRevision: 2, expectedHash: 'a'.repeat(64) });
    expect(delivery.question).toBeNull();
    expect(delivery.message.content).toBe('Let us look at how you checked the sender.');
  });

  it('projects processMessage into a typed grading outcome', async () => {
    const service = createService({
      question_id: 'question-1',
      result: { correct: false },
      selected_option_ids: ['C'],
      transition: { status: 'needs_review' },
      feedback_required: true,
    });

    const processed = await service.processMessage('message-3');

    expect(Object.keys(processed).sort()).toEqual([
      'feedback_required',
      'question_id',
      'result',
      'selected_option_ids',
      'transition',
    ]);
    expect(processed.result).toEqual({ correct: false });
    expect(processed.selected_option_ids).toEqual(['C']);
    expect(processed.feedback_required).toBe(true);
  });

  it('defaults a malformed processMessage result rather than forwarding unknown keys', async () => {
    const service = createService({ question_id: 'question-1', correct_option_ids: ['B'], transfer_basis: { x: 1 } });
    const processed = await service.processMessage('message-3');
    expect(processed).not.toHaveProperty('correct_option_ids');
    expect(processed).not.toHaveProperty('transfer_basis');
    expect(processed.result).toBeNull();
    expect(processed.feedback_required).toBe(false);
  });
});

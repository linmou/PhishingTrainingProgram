// Test responsibility: verify exact facade projections for delivery and persisted two-attempt outcomes.

import { TransferAssessmentService, type TransferAssessmentApi } from '../transferAssessmentService';

function serviceWith(data: unknown): TransferAssessmentService {
  const api: TransferAssessmentApi = { invoke: async () => ({ data: { ok: true, data }, error: null }) };
  return new TransferAssessmentService({ api, requestId: () => 'request-1' });
}

const assessment = {
  id: 'assessment-1', student_id: 'learner-1', selection_type: 'single', stem: 'Safest action?',
  options: [{ id: 'A', text: 'Click' }, { id: 'B', text: 'Verify' }, { id: 'C', text: 'Reply' }, { id: 'D', text: 'Forward' }],
};

describe('transfer assessment DTO projections', () => {
  it('returns a stem-only public delivery with exact target metadata', async () => {
    const result = await serviceWith({
      message: {
        id: 'question-1', room_id: 'room-1', user_id: 'teacher-1', content: assessment.stem,
        user_role: 'tutor', parent_message_id: 'focus-1', response_mode: 'assessment',
        assessment, created_at: '2026-09-22T00:00:00Z', assessment_key: ['B'],
      },
      room: { id: 'room-1' },
    }).sendReviewed({
      reviewedPayload: {} as never, roomId: 'room-1', studentId: 'learner-1', checklistId: 'checklist-1',
      itemId: 'item-1', focusStudentMessageId: 'focus-1',
    });
    expect(result.message.content).toBe(assessment.stem);
    expect(result.message.assessment).toEqual(assessment);
    expect(Object.keys(result.message.assessment || {})).toEqual(['id', 'student_id', 'selection_type', 'stem', 'options']);
    expect(JSON.stringify(result)).not.toContain('assessment_key');
  });

  it.each([
    ['first wrong', 'retry', 1, 1, false],
    ['first pass', 'passed', 1, 0, true],
    ['second pass', 'passed', 2, 0, true],
  ])('keeps private feedback absent for %s', async (_name, outcome, used, remaining, terminal) => {
    const result = await serviceWith({
      message_id: 'answer-1', assessment_id: 'assessment-1', processing_state: 'applied',
      answer_outcome: outcome, attempt_number: used, attempts_used: used, attempts_remaining: remaining,
      selected_option_ids: ['A'], terminal, transition: terminal ? { disposition: 'applied' } : null,
      feedback_required: terminal, code: null, already_processed: false, terminal_failure_feedback: null,
      correct_option_ids: ['B'], learner_safe_explanation: 'must not leak',
    }).processMessage('answer-1', 'assessment-1');
    expect(result.terminal_failure_feedback).toBeNull();
    expect(JSON.stringify(result)).not.toContain('must not leak');
  });

  it('returns role-safe key and explanation only for committed terminal failure', async () => {
    const result = await serviceWith({
      message_id: 'answer-2', assessment_id: 'assessment-1', processing_state: 'applied',
      answer_outcome: 'failed', attempt_number: 2, attempts_used: 2, attempts_remaining: 0,
      selected_option_ids: ['A'], terminal: true, transition: { disposition: 'applied' },
      feedback_required: true, code: null, already_processed: false,
      terminal_failure_feedback: { correct_option_ids: ['B'], learner_safe_explanation: 'Verify independently.' },
    }).processMessage('answer-2', 'assessment-1');
    expect(result.terminal_failure_feedback).toEqual({
      correct_option_ids: ['B'], learner_safe_explanation: 'Verify independently.',
    });
  });

  it('preserves authoritative duplicate and terminal counts', async () => {
    const result = await serviceWith({
      message_id: 'answer-2', assessment_id: 'assessment-1', processing_state: 'duplicate',
      answer_outcome: 'failed', attempt_number: 2, attempts_used: 2, attempts_remaining: 0,
      selected_option_ids: ['A'], terminal: true, transition: { disposition: 'applied' },
      feedback_required: true, code: null, already_processed: true,
      terminal_failure_feedback: { correct_option_ids: ['B'], learner_safe_explanation: 'Verify independently.' },
    }).processMessage('answer-2', 'assessment-1');
    expect(result).toMatchObject({ processing_state: 'duplicate', attempts_used: 2, attempts_remaining: 0, already_processed: true });
  });
});

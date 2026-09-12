#!/usr/bin/env node
// Test responsible for the `process_message` result projection through the browser facade.
// `process_assessment_message_v1` returns THREE distinct shapes and the facade must reproduce each
// one faithfully rather than collapsing them into one:
//   1. graded      - { message_id, result, selected_option_ids, transition, feedback_required }
//   2. unresolved  - { message_id, code: 'ANSWER_FORMAT_UNRESOLVED', clarification_required: true }
//   3. replayed    - { message_id, result, already_processed: true }
// The key the server returns is `message_id`, verified against the live function definition, so a
// facade that reads `question_id` reports an empty assessment identity on every learner answer and
// silently drops the server's clarification signal. Both are asserted here.

import { TransferAssessmentService } from '../transferAssessmentService';

const MESSAGE_ID = '8f14e45f-ceea-467a-9c1e-1a1b2c3d4e5f';

function serviceReturning(response: Record<string, unknown>): TransferAssessmentService {
  return new TransferAssessmentService({
    requestId: () => 'request-fixed-1',
    api: { invoke: async () => ({ data: { ok: true, data: response } as never, error: null }) },
  });
}

describe('process_message projection', () => {
  it('reports the assessment message identity the server actually returns', async () => {
    const processed = await serviceReturning({
      message_id: MESSAGE_ID,
      result: 'pass',
      selected_option_ids: ['B'],
      transition: { applied: true },
      feedback_required: true,
    }).processMessage('answer-message-1');

    expect(processed.message_id).toBe(MESSAGE_ID);
    expect(processed.result).toBe('pass');
    expect(processed.selected_option_ids).toEqual(['B']);
    expect(processed.transition).toEqual({ applied: true });
    expect(processed.feedback_required).toBe(true);
    expect(processed.clarification_required).toBe(false);
    expect(processed.already_processed).toBe(false);
  });

  it('surfaces the unresolved-answer clarification signal instead of dropping it', async () => {
    const processed = await serviceReturning({
      message_id: MESSAGE_ID,
      code: 'ANSWER_FORMAT_UNRESOLVED',
      clarification_required: true,
    }).processMessage('answer-message-2');

    // The learner submitted something the exact-set parser could not resolve, such as
    // "B or D" or content help. The UI must be able to show a neutral clarification state
    // rather than inventing a selection or reporting a failure.
    expect(processed.clarification_required).toBe(true);
    expect(processed.code).toBe('ANSWER_FORMAT_UNRESOLVED');
    expect(processed.message_id).toBe(MESSAGE_ID);
    expect(processed.result).toBeNull();
    expect(processed.feedback_required).toBe(false);
  });

  it('marks a replayed answer as already processed rather than grading it twice', async () => {
    const processed = await serviceReturning({
      message_id: MESSAGE_ID,
      result: 'pass',
      already_processed: true,
    }).processMessage('answer-message-3');

    expect(processed.already_processed).toBe(true);
    expect(processed.message_id).toBe(MESSAGE_ID);
    expect(processed.result).toBe('pass');
  });

  it('tolerates a response that omits every optional field without inventing values', async () => {
    const processed = await serviceReturning({ message_id: MESSAGE_ID }).processMessage('answer-message-4');

    expect(processed.message_id).toBe(MESSAGE_ID);
    expect(processed.result).toBeNull();
    expect(processed.selected_option_ids).toBeNull();
    expect(processed.transition).toBeNull();
    expect(processed.feedback_required).toBe(false);
    expect(processed.clarification_required).toBe(false);
    expect(processed.already_processed).toBe(false);
    expect(processed.code).toBeNull();
  });
});

// Test responsibility: prove the browser service is a trusted-API facade with no local authority.

import fs from 'fs';
import path from 'path';
import { TransferAssessmentService, type TransferAssessmentApi } from '../transferAssessmentService';

function transport(result: unknown): { api: TransferAssessmentApi; invoke: jest.Mock } {
  const invoke = jest.fn(async () => ({ data: { ok: true as const, data: result }, error: null }));
  return { api: { invoke }, invoke };
}

describe('transfer assessment browser facade', () => {
  it('contains no table access, provider call, browser identity, grading, or fallback model', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/transferAssessmentService.ts'), 'utf8');
    expect(source).not.toMatch(/\.from\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/localStorage|REACT_APP_OAI|TRANSFER_V3_SYSTEM_PROMPT/);
    expect(source).not.toMatch(/resolveTransferAnswer|gradeSelection|parseAssessmentAnswer/);
    expect(source).not.toContain("|| 'qwen3.5-flash'");
  });

  it('sends structured option IDs and never accepts a client attempt number', async () => {
    const { api, invoke } = transport({ message: { id: 'answer-1' }, analysis_pending: true });
    const service = new TransferAssessmentService({ api, requestId: () => 'request-1' });
    await service.postMessage({
      roomId: 'room-1', content: 'B', replyToMessageId: 'question-1',
      assessmentId: 'assessment-1', selectedOptionIds: ['B'],
    });
    expect(invoke).toHaveBeenCalledWith({
      operation: 'post_message', request_id: 'request-1', room_id: 'room-1', content: 'B',
      parent_message_id: 'question-1', assessment_id: 'assessment-1', selected_option_ids: ['B'],
    });
    expect(JSON.stringify(invoke.mock.calls[0][0])).not.toContain('attempt_number');
  });

  it('routes processing through the trusted operation with both causal identities', async () => {
    const { api, invoke } = transport({
      message_id: 'answer-1', assessment_id: 'assessment-1', processing_state: 'applied',
      answer_outcome: 'retry', attempt_number: 1, attempts_used: 1, attempts_remaining: 1,
      selected_option_ids: ['A'], terminal: false, transition: null, feedback_required: false,
      code: null, already_processed: false, terminal_failure_feedback: null,
    });
    const service = new TransferAssessmentService({ api, requestId: () => 'request-2' });
    const result = await service.processMessage('answer-1', 'assessment-1');
    expect(invoke).toHaveBeenCalledWith({
      operation: 'process_message', request_id: 'request-2',
      message_id: 'answer-1', assessment_id: 'assessment-1',
    });
    expect(result.attempts_remaining).toBe(1);
  });
});

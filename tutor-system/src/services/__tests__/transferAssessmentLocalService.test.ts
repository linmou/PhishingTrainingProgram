// Test responsibility: prove the browser service is a trusted-API facade with no local authority.

import fs from 'fs';
import path from 'path';
import { TransferAssessmentService, type TransferAssessmentApi } from '../transferAssessmentService';
import { supabase } from '../supabase';
import { processedFirstIncorrectRetry } from '../../test-support/transferRoomFixtures';

jest.mock('../supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

function transport(result: unknown): { api: TransferAssessmentApi; invoke: jest.Mock } {
  const invoke = jest.fn(async () => ({ data: { ok: true as const, data: result }, error: null }));
  return { api: { invoke }, invoke };
}

describe('transfer assessment browser facade', () => {
  afterEach(() => localStorage.removeItem('tutor_system_user'));

  it.each([
    [JSON.stringify({ id: 'learner-1', current_role: 'student' }), { 'x-application-user-id': 'learner-1' }],
    ['malformed JSON', {}],
    [JSON.stringify({ current_role: 'tutor' }), {}],
  ])('forwards the stored identity hint while leaving authorization to assessment-api (%s)', async (stored, headers) => {
    localStorage.setItem('tutor_system_user', stored);
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({ data: { ok: true, data: { room_id: 'room-1', room_role: 'observer', learner_id: null } }, error: null });
    const service = new TransferAssessmentService({ requestId: () => 'join-1' });
    expect(await service.joinRoom('room-1')).toMatchObject({ room_role: 'observer' });
    expect(invoke).toHaveBeenCalledWith('assessment-api', {
      body: { operation: 'join_room', request_id: 'join-1', room_id: 'room-1' }, headers,
    });
  });

  it('delegates storage and grading to the trusted API without a browser provider', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/transferAssessmentService.ts'), 'utf8');
    expect(source).not.toMatch(/\.from\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/REACT_APP_OAI|TRANSFER_V3_SYSTEM_PROMPT/);
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
    }, undefined);
    expect(JSON.stringify(invoke.mock.calls[0][0])).not.toContain('attempt_number');
  });

  it('routes processing through the trusted operation with both causal identities', async () => {
    const { message_id, assessment_id } = processedFirstIncorrectRetry;
    const { api, invoke } = transport(processedFirstIncorrectRetry);
    const service = new TransferAssessmentService({ api, requestId: () => 'request-2' });
    const result = await service.processMessage(message_id, assessment_id, 'room-1');
    expect(invoke).toHaveBeenCalledWith({
      operation: 'process_message', request_id: 'request-2',
      message_id, assessment_id,
      room_id: 'room-1',
    }, undefined);
    expect(result.attempts_remaining).toBe(1);
  });
});

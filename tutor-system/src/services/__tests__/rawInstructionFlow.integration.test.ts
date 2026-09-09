#!/usr/bin/env node
/**
 * Test responsible for aiService.ts and guardModeService.ts preserving a parsed v2 instruction across the reviewed-response Supabase RPC handoff.
 */

jest.mock('../supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn()
  }
}));

import { parseTutorActionDecision } from '../aiService';
import { sendReviewedTutorResponse } from '../guardModeService';
import { supabase } from '../supabase';

describe('raw tutor instruction integration flow', () => {
  beforeEach(() => jest.clearAllMocks());

  it('carries the parsed tutoring instruction into the atomic reviewed-send RPC', async () => {
    const rawOutput = JSON.stringify({
      reason: 'The learner incorrectly treats the lock icon as proof that the site is real.',
      decision: { mode: 'tutoring', instruction: 'correction' },
      response: 'A lock protects the connection, not the site identity. Open the real app instead.'
    });
    const parsedDecision = parseTutorActionDecision(rawOutput);
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: {
        message: { id: 'message-1', response_mode: 'tutoring' },
        room: { id: 'room-1', active_response_mode: 'tutoring' }
      },
      error: null
    });

    await sendReviewedTutorResponse({
      roomId: 'room-1',
      tutorId: 'tutor-1',
      parentMessageId: 'student-message-1',
      rawDecision: parsedDecision,
      finalMode: 'tutoring',
      finalResponse: parsedDecision.suggested_response,
      tutorAction: 'accepted',
      responseTimeMs: 250,
      contextMessages: ['student-message-1']
    });

    expect(parsedDecision.instruction).toBe('correction');
    expect(supabase.rpc).toHaveBeenCalledWith('send_reviewed_tutor_response',
      expect.objectContaining({
        p_raw_mode: 'tutoring',
        p_raw_instruction: 'correction',
        p_mode_reason: parsedDecision.mode_reason,
        p_final_mode: 'tutoring'
      })
    );
  });
});

#!/usr/bin/env node
/**
 * Test responsible for atomic reviewed-send parameters, returned state adoption, and manual room-mode changes.
 */

jest.mock('../supabase', () => ({
    supabase: {
        rpc: jest.fn(),
        from: jest.fn()
    }
}));

import { sendReviewedTutorResponse, setRoomResponseMode } from '../guardModeService';
import { supabase } from '../supabase';

describe('guardModeService', () => {
    beforeEach(() => jest.clearAllMocks());

    it('uses one RPC for the message, feedback, and room-mode transaction', async () => {
        const response = {
            message: { id: 'message-1', response_mode: 'guard' },
            room: { id: 'room-1', active_response_mode: 'guard' }
        };
        (supabase.rpc as jest.Mock).mockResolvedValue({ data: response, error: null });

        await expect(sendReviewedTutorResponse({
            roomId: 'room-1',
            tutorId: 'tutor-1',
            parentMessageId: 'student-message-1',
            rawDecision: {
                mode: 'guard',
                mode_reason: 'Deliberate unsafe repetition after correction.',
                suggested_response: 'Stop and verify the destination.'
            },
            finalMode: 'guard',
            finalResponse: 'Stop and verify the destination.',
            tutorAction: 'accepted',
            responseTimeMs: 321,
            contextMessages: ['student-message-1']
        })).resolves.toEqual(response);

        expect(supabase.rpc).toHaveBeenCalledWith('send_reviewed_tutor_response', expect.objectContaining({
            p_room_id: 'room-1',
            p_tutor_id: 'tutor-1',
            p_raw_mode: 'guard',
            p_final_mode: 'guard',
            p_tutor_action: 'accepted'
        }));
    });

    it('keeps the draft failure visible when the atomic send fails', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: null,
            error: { message: 'transaction failed' }
        });

        await expect(sendReviewedTutorResponse({
            roomId: 'room-1',
            tutorId: 'tutor-1',
            parentMessageId: null,
            rawDecision: {
                mode: 'tutoring',
                mode_reason: 'The learner is asking for clarification.',
                suggested_response: 'Which part feels unclear?'
            },
            finalMode: 'guard',
            finalResponse: 'Please stop and verify first.',
            tutorAction: 'modified',
            responseTimeMs: 100,
            contextMessages: []
        })).rejects.toThrow('transaction failed');
    });

    it('updates only the current room mode for a manual override', async () => {
        const chain: any = {
            eq: jest.fn(() => chain),
            select: jest.fn(() => chain),
            single: jest.fn().mockResolvedValue({
                data: { id: 'room-1', active_response_mode: 'tutoring', mode_change_source: 'manual_override' },
                error: null
            })
        };
        (supabase.from as jest.Mock).mockReturnValue({ update: jest.fn(() => chain) });

        await expect(setRoomResponseMode('room-1', 'tutor-1', 'tutoring')).resolves.toMatchObject({
            active_response_mode: 'tutoring',
            mode_change_source: 'manual_override'
        });
        expect(supabase.from).toHaveBeenCalledWith('rooms');
    });
});

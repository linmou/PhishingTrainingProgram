#!/usr/bin/env node
/**
 * Test responsible for RoomContext.tsx multi-agent draft handling: decoding one Multi-agent
 * decision into a two-message draft, stale-parent approval rejection, the T / T+2s pair insert,
 * rejection, and regeneration back into either reviewer UI.
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { generateTutorSuggestion, getAIConfig } from '../../services/aiService';
import { Room, User } from '../../types';

jest.mock('../../services/supabase', () => ({
    supabase: {
        channel: jest.fn(),
        from: jest.fn(),
        storage: { from: jest.fn() }
    },
    validateRoomPassword: jest.fn(),
    submitMessageFeedback: jest.fn(),
    getMessageFeedbackStats: jest.fn(),
    getUserMessageFeedback: jest.fn(),
    getRoomFeedbackSummary: jest.fn(),
    clearChatHistory: jest.fn()
}));

jest.mock('../../services/aiService', () => ({
    generateTutorSuggestion: jest.fn(),
    recordAISuggestionFeedback: jest.fn(),
    updateAIConfig: jest.fn(),
    getAIConfig: jest.fn()
}));

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

const TestRoomHelper: React.FC<{ onReady: (roomApi: ReturnType<typeof useRoom>) => void }> = ({ onReady }) => {
    const roomApi = useRoom();
    React.useEffect(() => { onReady(roomApi); }, [onReady, roomApi]);
    return null;
};

const tutor: User = {
    id: 'tutor-1', email: 'tutor@example.com', display_name: 'Tutor', current_role: 'tutor',
    status: 'active', created_at: '2026-03-20T00:00:00Z', updated_at: '2026-03-26T00:00:00Z'
};

const learnerMessage = (id: string, content: string) => ({
    id, room_id: 'room-1', user_id: 'student-1', content, user_role: 'student',
    ai_model_used: null, ai_response_time_ms: null,
    parent_message_id: null, created_at: '2026-03-26T10:00:00Z'
});

const room: Room = {
    id: 'room-1', tutor_id: 'tutor-1', title: 'Room', description: 'Test room', image_url: null,
    is_active: true, ai_assistant_enabled: true, ai_assistant_model: 'qwen3.5-flash',
    ai_assistant_prompt: 'Prompt', op_id: null, op_display_name: null, op_avatar_url: null,
    password: null, created_at: '2026-03-20T00:00:00Z', updated_at: '2026-03-26T00:00:00Z'
};

const multiAgentDecision = {
    mode: 'multiagent',
    instruction: 'multiagent',
    mode_reason: 'Familiar branding is the live assumption.',
    suggested_response: '[agent:riley] The logo looks official, so I would trust it.\n[agent:tutor] A logo does not prove the sender. What could you verify yourself?'
};

const rileyOnlyMultiAgentDecision = {
    mode: 'multiagent',
    instruction: 'multiagent',
    mode_reason: 'The tempting shortcut is the useful target.',
    suggested_response: '[agent:riley] The logo looks official, so I would trust it.'
};

const tutorOnlyMultiAgentDecision = {
    mode: 'multiagent',
    instruction: 'multiagent',
    mode_reason: 'An accurate check is the useful target.',
    suggested_response: '[agent:tutor] A logo can be copied. Check the sender independently.'
};

describe('RoomContext multi-agent draft', () => {
    let storedMessages: ReturnType<typeof learnerMessage>[];
    let insertMock: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        storedMessages = [learnerMessage('message-1', 'Is this email fake?')];
        insertMock = jest.fn();

        (useAuth as jest.Mock).mockReturnValue({ user: tutor, loading: false });
        (getAIConfig as jest.Mock).mockResolvedValue(null);

        (supabase.channel as jest.Mock).mockReturnValue({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
            unsubscribe: jest.fn()
        });

        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'rooms') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: room, error: null }) })
                        })
                    })
                };
            }
            if (table === 'messages') {
                return {
                    select: jest.fn().mockReturnValue({
                        eq: jest.fn().mockReturnValue({
                            order: jest.fn().mockImplementation(async () => ({ data: storedMessages, error: null }))
                        })
                    }),
                    insert: insertMock.mockImplementation((rows: any) => ({
                        select: jest.fn().mockResolvedValue({
                            data: rows.map((row: any, index: number) => ({ id: `ai-${index}`, ...row })),
                            error: null
                        })
                    }))
                };
            }
            if (table === 'users') {
                return {
                    select: jest.fn().mockReturnValue({
                        in: jest.fn().mockResolvedValue({
                            data: [
                                tutor,
                                { id: 'student-1', display_name: 'Student', current_role: 'student', status: 'active', created_at: '2026-03-20T00:00:00Z', updated_at: '2026-03-26T00:00:00Z' }
                            ],
                            error: null
                        })
                    })
                };
            }
            throw new Error(`Unexpected table mock: ${table}`);
        });
    });

    const renderRoom = async () => {
        let roomApi: ReturnType<typeof useRoom> | undefined;
        render(<RoomProvider><TestRoomHelper onReady={(api) => { roomApi = api; }} /></RoomProvider>);
        await waitFor(() => expect(roomApi).toBeDefined());
        await act(async () => { await roomApi!.joinRoom('room-1'); });
        return () => roomApi!;
    };

    const mockGeneration = (decision: any) => {
        (generateTutorSuggestion as jest.Mock).mockResolvedValueOnce({
            suggestion: decision.suggested_response,
            decision,
            success: true,
            contextMessages: ['message-1'],
            appliedConfig: { model_name: 'qwen3.5-flash', system_prompt: 'Prompt', prompt_config: null, temperature: 0.3, max_tokens: 100, is_active: true }
        });
    };

    it('decodes a multiagent decision into exactly two draft messages without a single-response suggestion', async () => {
        mockGeneration(multiAgentDecision);
        const api = await renderRoom();

        await act(async () => { await api().generateAIResponse(); });

        expect(api().aiSuggestion).toBeNull();
        expect(api().multiAgentDraft?.parentMessageId).toBe('message-1');
        expect(api().multiAgentDraft?.generatedMessages).toEqual([
            { character: 'riley', content: 'The logo looks official, so I would trust it.' },
            { character: 'tutor', content: 'A logo does not prove the sender. What could you verify yourself?' }
        ]);
    });

    it('keeps a Riley-only multiagent decision as a one-message draft', async () => {
        mockGeneration(rileyOnlyMultiAgentDecision);
        const api = await renderRoom();

        await act(async () => { await api().generateAIResponse(); });

        expect(api().multiAgentDraft?.rawDecision).toMatchObject({ mode: 'multiagent', instruction: 'multiagent' });
        expect(api().multiAgentDraft?.generatedMessages).toEqual([
            { character: 'riley', content: 'The logo looks official, so I would trust it.' }
        ]);
        expect(api().aiSuggestion).toBeNull();
    });

    it('keeps a Tutor-only multiagent decision as a one-message draft', async () => {
        mockGeneration(tutorOnlyMultiAgentDecision);
        const api = await renderRoom();

        await act(async () => { await api().generateAIResponse(); });

        expect(api().multiAgentDraft?.generatedMessages).toEqual([
            { character: 'tutor', content: 'A logo can be copied. Check the sender independently.' }
        ]);
        expect(api().aiSuggestion).toBeNull();
    });

    it('stores an approved Riley-only response as one tagged tutor row', async () => {
        mockGeneration(rileyOnlyMultiAgentDecision);
        const api = await renderRoom();
        await act(async () => { await api().generateAIResponse(); });

        await act(async () => { await api().approveMultiAgentDraft(['Trust the logo.']); });

        expect(insertMock).toHaveBeenCalledTimes(1);
        const rows = insertMock.mock.calls[0][0];
        expect(rows).toEqual([expect.objectContaining({
            content: '[agent:riley] Trust the logo.',
            user_role: 'tutor',
            parent_message_id: 'message-1',
            response_mode: 'multiagent'
        })]);
        expect(api().multiAgentDraft).toBeNull();
    });

    it('stores an approved pair as two tagged tutor rows at T and T plus the playback delay', async () => {
        mockGeneration(multiAgentDecision);
        const api = await renderRoom();
        await act(async () => { await api().generateAIResponse(); });

        await act(async () => { await api().approveMultiAgentDraft(['Trust the logo.', 'Check the sender.']); });

        expect(insertMock).toHaveBeenCalledTimes(1);
        const rows = insertMock.mock.calls[0][0];
        expect(rows).toHaveLength(2);
        expect(rows.map((row: any) => row.content)).toEqual([
            '[agent:riley] Trust the logo.',
            '[agent:tutor] Check the sender.'
        ]);
        expect(rows.map((row: any) => row.user_role)).toEqual(['tutor', 'tutor']);
        expect(rows.every((row: any) => row.parent_message_id === 'message-1')).toBe(true);
        expect(rows.every((row: any) => row.response_mode === 'multiagent')).toBe(true);
        expect(new Date(rows[1].created_at).getTime() - new Date(rows[0].created_at).getTime()).toBe(2000);
        expect(api().multiAgentDraft).toBeNull();
    });

    it('rejects approval when the learner moved the conversation forward and inserts nothing', async () => {
        mockGeneration(multiAgentDecision);
        const api = await renderRoom();
        await act(async () => { await api().generateAIResponse(); });

        storedMessages = [
            ...storedMessages,
            { ...learnerMessage('message-2', 'I already clicked it.'), created_at: '2026-03-26T10:05:00Z' }
        ];
        await act(async () => { await api().joinRoom('room-1'); });

        let approvalError: unknown = null;
        await act(async () => {
            try {
                await api().approveMultiAgentDraft(['Trust the logo.', 'Check the sender.']);
            } catch (error) {
                approvalError = error;
            }
        });
        expect(String(approvalError)).toMatch(/stale/i);
        expect(insertMock).not.toHaveBeenCalled();
        expect(api().multiAgentDraft).not.toBeNull();

        mockGeneration({
            mode: 'tutoring',
            instruction: 'protective_instruction',
            mode_reason: 'The learner already acted.',
            suggested_response: 'Stop and check the sender another way.'
        });
        let regenerateError: unknown = null;
        await act(async () => {
            try { await api().regenerateMultiAgentDraft(); } catch (error) { regenerateError = error; }
        });
        expect(regenerateError).toBeNull();
        expect(generateTutorSuggestion).toHaveBeenLastCalledWith(
            'room-1', 'tutor-1', undefined,
            expect.objectContaining({ focusStudentMessage: 'I already clicked it.' })
        );
        await waitFor(() => expect(api().multiAgentDraft).toBeNull());
        expect(api().aiSuggestion).toBe('Stop and check the sender another way.');
    });

    it('replaces the draft with the ordinary reviewer UI when regeneration returns a single-Tutor decision', async () => {
        mockGeneration(multiAgentDecision);
        const api = await renderRoom();
        await act(async () => { await api().generateAIResponse(); });

        mockGeneration({
            mode: 'tutoring',
            instruction: 'explanation',
            mode_reason: 'The learner relies on branding.',
            suggested_response: 'A logo is not proof. Check the sender another way.'
        });
        await act(async () => { await api().regenerateMultiAgentDraft(); });

        expect(api().multiAgentDraft).toBeNull();
        expect(api().aiSuggestion).toBe('A logo is not proof. Check the sender another way.');
        expect(api().finalMode).toBe('tutoring');
    });

    it('clears the draft on reject', async () => {
        mockGeneration(multiAgentDecision);
        const api = await renderRoom();
        await act(async () => { await api().generateAIResponse(); });
        expect(api().multiAgentDraft).not.toBeNull();

        await act(async () => { await api().rejectMultiAgentDraft(); });

        expect(api().multiAgentDraft).toBeNull();
    });
});

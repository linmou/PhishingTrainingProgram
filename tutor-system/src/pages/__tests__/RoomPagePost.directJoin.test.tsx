#!/usr/bin/env node
/**
 * Test responsible for src/pages/RoomPagePost.tsx direct room URL entry: a learner must claim the
 * learner seat through the trusted join operation, while an observer must remain read-only.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../RoomPagePost';
import { findFirstPersistedStudentId, resolveTransferLearnerId } from '../RoomPagePost';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import { transferAssessmentService } from '../../services/transferAssessmentService';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/RoomContext', () => ({ useRoom: jest.fn() }));
jest.mock('../../services/transferAssessmentService', () => ({
    transferAssessmentService: { joinRoom: jest.fn() },
}));

describe('RoomPagePost direct learner entry', () => {
    const joinRoom = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        joinRoom.mockResolvedValue(undefined);
        (transferAssessmentService.joinRoom as jest.Mock).mockResolvedValue({
            room_id: 'room-1',
            learner_id: 'learner-1',
            room_role: 'student',
        });
        (useRoom as jest.Mock).mockReturnValue({
            currentRoom: null,
            messages: [],
            participants: [],
            loading: false,
            typingUsers: [],
            joinRoom,
            leaveRoom: jest.fn(),
            sendMessage: jest.fn(),
            generateAIResponse: jest.fn(),
            regenerateAIResponse: jest.fn(),
            startTyping: jest.fn(),
            stopTyping: jest.fn(),
            aiConfig: null,
            loadingAI: false,
            downloadChatHistory: jest.fn(),
            clearChatHistory: jest.fn(),
            aiSuggestion: null,
            transferDraft: null,
            confirmTransferDraft: jest.fn(),
            finalMode: 'tutoring',
            updateFinalMode: jest.fn(),
            setResponseMode: jest.fn(),
            clearAISuggestion: jest.fn(),
            recordAIFeedback: jest.fn(),
            currentSuggestionContext: null,
            multiAgentDraft: null,
            approveMultiAgentDraft: jest.fn(),
            regenerateMultiAgentDraft: jest.fn(),
            rejectMultiAgentDraft: jest.fn(),
            submitMessageFeedback: jest.fn(),
            messageFeedbackStats: {},
        });
    });

    const mount = (role: 'student' | 'observer') => {
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: `${role}-1`, current_role: role },
            loading: false,
        });
        return render(
            <MemoryRouter initialEntries={['/room/room-1']}>
                <Routes>
                    <Route path="/room/:roomId" element={<RoomPagePost />} />
                </Routes>
            </MemoryRouter>
        );
    };

    it('claims the learner seat when a student opens the room URL directly', async () => {
        mount('student');

        await waitFor(() => expect(joinRoom).toHaveBeenCalledWith('room-1', undefined));
        await waitFor(() => expect(transferAssessmentService.joinRoom).toHaveBeenCalledWith('room-1'));
    });

    it('does not claim the learner seat for an observer opening the room URL', async () => {
        mount('observer');

        await waitFor(() => expect(joinRoom).toHaveBeenCalledWith('room-1', undefined));
        expect(transferAssessmentService.joinRoom).not.toHaveBeenCalled();
    });

    // RoomPagePost.tsx: fallback learner identity comes from the first persisted real student message.
    it('selects the first persisted student message and ignores setup-only messages', () => {
        expect(findFirstPersistedStudentId([
            { id: 'prepop-room-1-0', room_id: 'room-1', user_id: 'setup-student', content: 'Example', user_role: 'student', ai_model_used: null, ai_response_time_ms: null, parent_message_id: null, created_at: '2026-09-12T08:00:00Z' },
            { id: 'temp-123', room_id: 'room-1', user_id: 'temporary-student', content: 'Pending', user_role: 'student', ai_model_used: null, ai_response_time_ms: null, parent_message_id: null, created_at: '2026-09-12T08:01:00Z' },
            { id: 'message-2', room_id: 'room-1', user_id: 'learner-b', content: 'Later', user_role: 'student', ai_model_used: null, ai_response_time_ms: null, parent_message_id: null, created_at: '2026-09-12T08:03:00Z' },
            { id: 'message-1', room_id: 'room-1', user_id: 'learner-a', content: 'First', user_role: 'student', ai_model_used: null, ai_response_time_ms: null, parent_message_id: null, created_at: '2026-09-12T08:02:00Z' },
        ])).toBe('learner-a');
    });

    // RoomPagePost.tsx: an active learner session wins over message fallback, while ambiguity is rejected.
    it('prefers the active session identity over the message fallback', () => {
        expect(resolveTransferLearnerId(['session-learner'], 'message-learner')).toBe('session-learner');
        expect(resolveTransferLearnerId([], 'message-learner')).toBe('message-learner');
        expect(resolveTransferLearnerId(['learner-a', 'learner-b'], 'message-learner')).toBeNull();
    });
});

#!/usr/bin/env node
/**
 * Test responsible for RoomPagePost password prompt submission and retry behavior.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../RoomPagePost';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';

jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/RoomContext', () => ({ useRoom: jest.fn() }));

describe('RoomPagePost password prompt', () => {
    const mount = (joinRoom: jest.Mock) => {
        (useAuth as jest.Mock).mockReturnValue({ user: null, loading: false });
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

        return render(
            <MemoryRouter initialEntries={['/room/room-1']}>
                <Routes>
                    <Route path="/room/:roomId" element={<RoomPagePost />} />
                </Routes>
            </MemoryRouter>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('keeps the password prompt open after an incorrect password so the learner can retry', async () => {
        const joinRoom = jest.fn()
            .mockRejectedValueOnce(new Error('This room is password protected'))
            .mockRejectedValueOnce(new Error('Incorrect password'));
        mount(joinRoom);

        await screen.findByRole('heading', { name: /Password Required/i });
        const input = screen.getByLabelText('Room Password');
        fireEvent.change(input, { target: { value: 'wrong-password' } });
        fireEvent.submit(input.closest('form') as HTMLFormElement);

        await waitFor(() => {
            expect(screen.getByText('Incorrect password. Please try again.')).toBeInTheDocument();
        });
        expect(screen.getByRole('heading', { name: /Password Required/i })).toBeInTheDocument();
        expect(input).toHaveValue('wrong-password');
        expect(joinRoom).toHaveBeenCalledTimes(2);
    });

    it('does not call join again when the password field is empty', async () => {
        const joinRoom = jest.fn().mockRejectedValueOnce(new Error('This room is password protected'));
        mount(joinRoom);

        await screen.findByRole('heading', { name: /Password Required/i });
        const input = screen.getByLabelText('Room Password');
        fireEvent.submit(input.closest('form') as HTMLFormElement);

        expect(screen.getByText('Please enter a password')).toBeInTheDocument();
        expect(joinRoom).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('heading', { name: /Password Required/i })).toBeInTheDocument();
    });

    it('closes the password prompt after the room join succeeds', async () => {
        const joinRoom = jest.fn()
            .mockRejectedValueOnce(new Error('This room is password protected'))
            .mockResolvedValueOnce(undefined);
        mount(joinRoom);

        await screen.findByRole('heading', { name: /Password Required/i });
        const input = screen.getByLabelText('Room Password');
        fireEvent.change(input, { target: { value: 'correct-password' } });
        fireEvent.submit(input.closest('form') as HTMLFormElement);

        await waitFor(() => {
            expect(screen.queryByRole('heading', { name: /Password Required/i })).not.toBeInTheDocument();
        });
        expect(joinRoom).toHaveBeenCalledTimes(2);
    });
});

/**
 * Test responsibility: src/pages/RoomPagePost.tsx room entry. The learner seat is taken only by an
 * explicit Join (FR-12). Opening the room page, including by a direct link, resolves the student's room
 * role from the room's records without claiming the seat; the seated learner's page open records one
 * visit; and an identity change in another tab never triggers a join (it signs the tab out instead).
 */

import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../RoomPagePost';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import SessionEndedRedirect from '../../components/SessionEndedRedirect';
import { useRoom } from '../../contexts/RoomContext';
import { supabase } from '../../services/supabase';
import { readRoomLearnerIds } from '../../services/roomSeatService';

jest.mock('../../contexts/RoomContext', () => ({ useRoom: jest.fn() }));
jest.mock('../../services/roomSeatService', () => ({ readRoomLearnerIds: jest.fn() }));
jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(),
        functions: { invoke: jest.fn() },
        channel: jest.fn(() => ({ on: jest.fn().mockReturnThis(), subscribe: jest.fn() })),
        removeChannel: jest.fn(),
    },
}));

const USER_KEY = 'tutor_system_user';
const room = { id: 'room-1', tutor_id: 'tutor-1', title: 'Room', description: '', is_active: true, guard_mode: false, practice_type: 'phishing' };
const tutor = { id: 'tutor-1', display_name: 'T', current_role: 'tutor', status: 'active' };
const student = { id: 'student-9', display_name: 'Test Student', current_role: 'student', status: 'active' };

const invoke = supabase.functions.invoke as jest.Mock;
const joinCalls = () => invoke.mock.calls.filter(call => call[1]?.body?.operation === 'join_room');

function roomState(overrides: Record<string, unknown> = {}) {
    return {
        currentRoom: room, messages: [], participants: [], loading: false, typingUsers: [],
        joinRoom: jest.fn().mockResolvedValue(undefined), leaveRoom: jest.fn(), sendMessage: jest.fn(),
        generateAIResponse: jest.fn(), regenerateAIResponse: jest.fn(), startTyping: jest.fn(), stopTyping: jest.fn(),
        aiConfig: null, loadingAI: false, downloadChatHistory: jest.fn(), clearChatHistory: jest.fn(), aiSuggestion: null,
        transferDraft: null, confirmTransferDraft: jest.fn(), finalGuardMode: false, updateFinalGuardMode: jest.fn(),
        setGuardMode: jest.fn(), clearAISuggestion: jest.fn(), recordAIFeedback: jest.fn(), currentSuggestionContext: null,
        submitMessageFeedback: jest.fn(), messageFeedbackStats: {},
        ...overrides,
    };
}

const SignIn: React.FC = () => {
    const { user } = useAuth();
    return <div data-testid="sign-in">{user ? user.id : 'signed-out'}</div>;
};

function openRoomPage(signedIn: object) {
    localStorage.setItem(USER_KEY, JSON.stringify(signedIn));
    const usersQuery: any = { select: () => usersQuery, eq: () => usersQuery, single: async () => ({ data: signedIn, error: null }) };
    (supabase.from as jest.Mock).mockReturnValue(usersQuery);
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={['/room/room-1']}>
                <SessionEndedRedirect />
                <Routes>
                    <Route path="/" element={<SignIn />} />
                    <Route path="/room/:roomId" element={<RoomPagePost />} />
                </Routes>
            </MemoryRouter>
        </AuthProvider>
    );
}

function joinResult(roomRole: 'student' | 'observer', learnerId: string | null = student.id) {
    return { data: { ok: true, data: { room_id: 'room-1', learner_id: learnerId, room_role: roomRole } }, error: null };
}

beforeEach(() => {
    localStorage.clear();
    window.sessionStorage.clear();
    jest.clearAllMocks();
    invoke.mockResolvedValue(joinResult('student'));
    (useRoom as jest.Mock).mockReturnValue(roomState());
});

describe('opening the room page does not claim the learner seat', () => {
    it('a direct-link student in a room with no learner enters read-only and is offered an explicit Join', async () => {
        (readRoomLearnerIds as jest.Mock).mockResolvedValue([]);
        openRoomPage(student);

        expect(await screen.findByRole('button', { name: /join as learner/i })).toBeEnabled();
        expect(screen.getByText(/you are in observer mode/i)).toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Write a comment...')).not.toBeInTheDocument();
        expect(readRoomLearnerIds).toHaveBeenCalledWith('room-1');
        expect(joinCalls()).toHaveLength(0);
    });

    it('the explicit Join claims the seat once, records this page open as the visit and opens the composer', async () => {
        (readRoomLearnerIds as jest.Mock).mockResolvedValue([]);
        openRoomPage(student);

        await userEvent.click(await screen.findByRole('button', { name: /join as learner/i }));

        await waitFor(() => expect(joinCalls()).toHaveLength(1));
        const [, request] = joinCalls()[0];
        expect(request.body).toEqual(expect.objectContaining({ room_id: 'room-1', visit_key: expect.any(String) }));
        expect(request.headers).toEqual({ 'x-application-user-id': student.id });
        expect(await screen.findByPlaceholderText('Write a comment...')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /join as learner/i })).not.toBeInTheDocument();
    });

    it('stays read-only when another student took the seat before the explicit Join', async () => {
        (readRoomLearnerIds as jest.Mock).mockResolvedValue([]);
        invoke.mockResolvedValue(joinResult('observer', 'student-2'));
        openRoomPage(student);

        await userEvent.click(await screen.findByRole('button', { name: /join as learner/i }));

        expect(await screen.findByText(/another student is now this room's learner/i)).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /join as learner/i })).not.toBeInTheDocument();
        expect(screen.queryByPlaceholderText('Write a comment...')).not.toBeInTheDocument();
    });

    it('a student opening a room that has another learner enters as observer with no join and no offer', async () => {
        (readRoomLearnerIds as jest.Mock).mockResolvedValue(['student-2']);
        openRoomPage(student);

        expect(await screen.findByText(/you are in observer mode/i)).toBeInTheDocument();
        await waitFor(() => expect(readRoomLearnerIds).toHaveBeenCalled());
        expect(screen.queryByRole('button', { name: /join as learner/i })).not.toBeInTheDocument();
        expect(joinCalls()).toHaveLength(0);
    });

    it('the seated learner opening the page (after Join or Rejoin) records exactly one visit', async () => {
        (readRoomLearnerIds as jest.Mock).mockResolvedValue([student.id]);
        openRoomPage(student);

        await waitFor(() => expect(joinCalls()).toHaveLength(1));
        expect(joinCalls()[0][1].body).toEqual(expect.objectContaining({ room_id: 'room-1', visit_key: expect.any(String) }));
        expect(await screen.findByPlaceholderText('Write a comment...')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /join as learner/i })).not.toBeInTheDocument();
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
        expect(joinCalls()).toHaveLength(1);
    });

    it('offers the explicit Join with a notice when the room records cannot be read', async () => {
        (readRoomLearnerIds as jest.Mock).mockRejectedValue(new Error('network down'));
        openRoomPage(student);

        expect(await screen.findByText(/could not check whether this room has a learner/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /join as learner/i })).toBeEnabled();
        expect(joinCalls()).toHaveLength(0);
    });

    it('never offers the learner seat to the room owner', async () => {
        (readRoomLearnerIds as jest.Mock).mockResolvedValue([]);
        openRoomPage({ ...student, id: room.tutor_id });

        expect(await screen.findByText(/you are in observer mode/i)).toBeInTheDocument();
        await waitFor(() => expect(readRoomLearnerIds).toHaveBeenCalled());
        expect(screen.queryByRole('button', { name: /join as learner/i })).not.toBeInTheDocument();
        expect(joinCalls()).toHaveLength(0);
    });
});

describe('identity change in another tab', () => {
    it('a tutor tab viewing a room never joins as the student another tab signed in; it signs out', async () => {
        (readRoomLearnerIds as jest.Mock).mockResolvedValue([]);
        const roomContext = roomState();
        (useRoom as jest.Mock).mockReturnValue(roomContext);
        openRoomPage(tutor);
        await waitFor(() => expect(roomContext.joinRoom).toHaveBeenCalled());
        expect(joinCalls()).toHaveLength(0);

        localStorage.setItem(USER_KEY, JSON.stringify(student));
        act(() => {
            window.dispatchEvent(new StorageEvent('storage', { key: USER_KEY, newValue: JSON.stringify(student), storageArea: localStorage }));
        });

        expect(await screen.findByTestId('sign-in')).toHaveTextContent('signed-out');
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
        expect(joinCalls()).toHaveLength(0);
        expect(readRoomLearnerIds).not.toHaveBeenCalled();
        expect(roomContext.joinRoom).toHaveBeenCalledTimes(1);
    });
});

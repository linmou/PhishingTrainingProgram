/**
 * Mocked RoomPagePost integration test responsible for the Reply button inserting the
 * visible author name as "@name " in the composer, swapping targets, cancelling, and
 * refusing to send a mention with no other content.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import type { Message, Room, User } from '../types';

jest.mock('../services/roomSeatService', () => require('../test-support/seatSignedInStudent'));
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../contexts/RoomContext', () => ({ useRoom: jest.fn() }));
jest.mock('../components/RoomPost', () => () => <div data-testid="room-post" />);
jest.mock('../components/PostComment', () => (props: { message: { id: string }; onReply?: (id: string) => void }) => (
  <button data-testid={`reply-${props.message.id}`} onClick={() => props.onReply?.(props.message.id)}>Reply</button>
));
jest.mock('../components/AIAssistantSettings', () => () => <div />);
jest.mock('../components/StudentAIToneControl', () => () => <div />);
jest.mock('../components/ChecklistPanel', () => () => <div />);

const user = (id: string, display_name: string, current_role: 'tutor' | 'student'): User => ({
  id, display_name, current_role, email: `${id}@example.test`, avatar_url: null, status: 'active',
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
});
const tutor = user('tutor-1', 'Taylor Tutor', 'tutor');
const student = user('student-1', 'Sam Student', 'student');

const room: Room = {
  id: 'room-1', tutor_id: tutor.id, title: 'Reply room', description: 'Reply mention test', image_url: null,
  is_active: true, ai_assistant_enabled: false, ai_assistant_model: 'm', ai_assistant_prompt: 'p', op_id: null,
  op_display_name: null, op_avatar_url: null, password: null, guard_mode: false,
  created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
};

const message = (id: string, from: User, extra: Partial<Message> = {}): Message => ({
  id, room_id: room.id, user_id: from.id, content: `content ${id}`, user_role: from.current_role,
  ai_model_used: null, ai_response_time_ms: null, parent_message_id: null,
  created_at: '2026-09-01T00:00:00Z', display_name: from.display_name, avatar_url: null, ...extra,
} as Message);

const renderRoom = (viewer: User, messages: Message[], aiSuggestion: string | null = null) => {
  const sendMessage = jest.fn().mockResolvedValue(undefined);
  (useAuth as jest.Mock).mockReturnValue({ user: viewer, loading: false });
  (useRoom as jest.Mock).mockReturnValue({
    currentRoom: room, messages, participants: [tutor, student], loading: false, typingUsers: [],
    joinRoom: jest.fn(), leaveRoom: jest.fn(), sendMessage, generateAIResponse: jest.fn(),
    regenerateAIResponse: jest.fn(), startTyping: jest.fn(), stopTyping: jest.fn(), aiConfig: null,
    loadingAI: false, downloadChatHistory: jest.fn(), clearChatHistory: jest.fn(), aiSuggestion,
    aiDecision: null, finalGuardMode: false, updateFinalResponse: jest.fn(), updateFinalGuardMode: jest.fn(),
    setGuardMode: jest.fn(), clearAISuggestion: jest.fn(), recordAIFeedback: jest.fn(),
    currentSuggestionContext: null, submitMessageFeedback: jest.fn(), messageFeedbackStats: {},
  });
  render(
    <MemoryRouter initialEntries={['/room/room-1']}>
      <Routes><Route path="/room/:roomId" element={<RoomPagePost />} /></Routes>
    </MemoryRouter>
  );
  return { sendMessage, composer: () => screen.getByPlaceholderText('Write a comment...') as HTMLTextAreaElement };
};

describe('Reply button mention', () => {
  afterEach(() => { cleanup(); jest.restoreAllMocks(); });

  it('inserts "@name " for the replied author and keeps text already typed', () => {
    const { composer } = renderRoom(tutor, [message('m1', student)]);
    fireEvent.change(composer(), { target: { value: 'Good point' } });
    fireEvent.click(screen.getByTestId('reply-m1'));
    expect(composer().value).toBe('@Sam Student Good point');
    expect(screen.getByText('Replying to Sam Student')).toBeInTheDocument();
  });

  it('uses the visible Guard name instead of the tutor account name', () => {
    const { composer } = renderRoom(student, [message('g1', tutor, { response_mode: 'guard', guard_mode: true } as Partial<Message>)]);
    fireEvent.click(screen.getByTestId('reply-g1'));
    expect(composer().value).toBe('@Security Supervisor ');
    expect(composer().value).not.toContain('Taylor');
  });

  it('uses the persona name for a character reply', () => {
    const { composer } = renderRoom(student, [message('c1', tutor, { character: 'bully', persona_name: 'Jordan' } as Partial<Message>)]);
    fireEvent.click(screen.getByTestId('reply-c1'));
    expect(composer().value).toBe('@Jordan ');
  });

  it('swaps the mention when replying to a different comment and removes it on cancel', () => {
    const { composer } = renderRoom(tutor, [message('m1', student), message('m2', tutor)]);
    fireEvent.click(screen.getByTestId('reply-m1'));
    fireEvent.change(composer(), { target: { value: '@Sam Student hi' } });
    fireEvent.click(screen.getByTestId('reply-m2'));
    expect(composer().value).toBe('@Taylor Tutor hi');
    fireEvent.click(screen.getByTitle('Cancel reply'));
    expect(composer().value).toBe('hi');
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument();
  });

  it('blocks Send while only the mention is present, even after its trailing space is deleted', () => {
    const { composer, sendMessage } = renderRoom(tutor, [message('m1', student)]);
    fireEvent.click(screen.getByTestId('reply-m1'));
    const send = screen.getByTitle('Add a message after the mention');
    expect(send).toBeDisabled();
    fireEvent.change(composer(), { target: { value: '@Sam Student' } });
    expect(send).toBeDisabled();
    fireEvent.keyDown(composer(), { key: 'Enter' });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('does not remove a mention the user typed themselves when the reply is cancelled', () => {
    const { composer } = renderRoom(tutor, [message('m1', student)]);
    fireEvent.change(composer(), { target: { value: '@Sam Student thanks' } });
    fireEvent.click(screen.getByTestId('reply-m1'));
    expect(composer().value).toBe('@Sam Student thanks');
    fireEvent.click(screen.getByTitle('Cancel reply'));
    expect(composer().value).toBe('@Sam Student thanks');
  });

  it('drops the reply target and mention when the tutor copies an AI suggestion', () => {
    const { composer } = renderRoom(tutor, [message('m1', student)], 'Look at the sender address.');
    fireEvent.click(screen.getByTestId('reply-m1'));
    fireEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(composer().value).toBe('Look at the sender address.');
    expect(screen.queryByText(/Replying to/)).not.toBeInTheDocument();
  });

  it('does not send a mention with no other content, and sends the full text otherwise', async () => {
    const { composer, sendMessage } = renderRoom(tutor, [message('m1', student)]);
    fireEvent.click(screen.getByTestId('reply-m1'));
    const form = composer().closest('form') as HTMLFormElement | null;
    const submit = () => form ? fireEvent.submit(form) : fireEvent.keyDown(composer(), { key: 'Enter' });
    submit();
    expect(sendMessage).not.toHaveBeenCalled();
    fireEvent.change(composer(), { target: { value: '@Sam Student look at the sender' } });
    submit();
    expect(sendMessage).toHaveBeenCalledWith('@Sam Student look at the sender', { replyToMessageId: 'm1' });
    await waitFor(() => expect(composer().value).toBe(''));
  });
});

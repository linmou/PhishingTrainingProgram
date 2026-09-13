#!/usr/bin/env node
/**
 * File: src/pages/RoomPagePost.tsx
 * Purpose: verify students must rate the latest AI/Tutor response before sending their next reply.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { readFileSync } from 'fs';
import * as path from 'path';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import type { Message, MessageFeedbackStats, Room, User, UserRole } from '../types';

jest.mock('../contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../contexts/RoomContext', () => ({
  useRoom: jest.fn(),
}));

jest.mock('../components/RoomPost', () => () => <div data-testid="room-post">Room post</div>);
jest.mock('../components/PostComment', () => () => <div data-testid="post-comment">Comment</div>);
jest.mock('../components/StudentAIToneControl', () => () => null);
jest.mock('../components/ChecklistPanel', () => () => null);
jest.mock('../components/AISuggestionBox', () => () => null);
jest.mock('../components/AIAssistantSettings', () => () => null);

const buildUser = (role: UserRole): User => ({
  id: `${role}-1`,
  email: `${role}@test.com`,
  display_name: role === 'tutor' ? 'Tutor' : 'Student',
  current_role: role,
  status: 'active',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

const buildMessage = (
  id: string,
  role: UserRole,
  content: string,
  isAI = false,
  createdAt = '2026-01-01T00:00:00.000Z'
): Message => ({
  id,
  room_id: 'room-1',
  user_id: `${role}-${id}`,
  content,
  user_role: role,
  ai_model_used: isAI ? 'test-model' : null,
  ai_response_time_ms: isAI ? 250 : null,
  parent_message_id: null,
  response_mode: null,
  created_at: createdAt,
  display_name: role === 'tutor' ? 'Tutor' : 'Student',
});

const room = {
  id: 'room-1',
  tutor_id: 'tutor-1',
  title: 'Rating Gate Room',
  description: 'Test room',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: false,
  ai_assistant_model: null,
  ai_assistant_prompt: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
} as Room;

const feedbackStats = (
  messageId: string,
  userFeedback: MessageFeedbackStats['user_feedback']
): MessageFeedbackStats => ({
  message_id: messageId,
  total_feedback_count: 4,
  like_count: 3,
  dislike_count: 1,
  average_like_rating: 4,
  average_dislike_rating: 2,
  overall_average_rating: 3.5,
  user_feedback: userFeedback,
});

describe('student Tutor-response rating gate', () => {
  let currentUser: User;
  let messages: Message[];
  let messageFeedbackStats: Record<string, MessageFeedbackStats>;
  let sendMessage: jest.Mock;
  let submitMessageFeedback: jest.Mock;

  const bindContext = () => {
    (useAuth as jest.Mock).mockReturnValue({ user: currentUser, loading: false });
    (useRoom as jest.Mock).mockReturnValue({
      currentRoom: room,
      messages,
      participants: [buildUser('tutor'), buildUser('student')],
      loading: false,
      typingUsers: [],
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn(),
      sendMessage,
      generateAIResponse: jest.fn(),
      regenerateAIResponse: jest.fn(),
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      aiConfig: null,
      loadingAI: false,
      downloadChatHistory: jest.fn(),
      clearChatHistory: jest.fn(),
      aiSuggestion: null,
      clearAISuggestion: jest.fn(),
      recordAIFeedback: jest.fn(),
      currentSuggestionContext: null,
      submitMessageFeedback,
      messageFeedbackStats,
    });
  };

  const renderRoom = () => {
    bindContext();
    return render(
      <MemoryRouter initialEntries={['/room/room-1']}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomPagePost />} />
        </Routes>
      </MemoryRouter>
    );
  };

  const enterReplyAndSubmit = (reply: string) => {
    fireEvent.change(screen.getByPlaceholderText('Write a comment...'), {
      target: { value: reply },
    });
    fireEvent.click(screen.getByTitle('Send comment'));
  };

  beforeEach(() => {
    jest.clearAllMocks();
    currentUser = buildUser('student');
    messages = [];
    messageFeedbackStats = {};
    sendMessage = jest.fn().mockResolvedValue(undefined);
    submitMessageFeedback = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
  });

  it('blocks the reply, animates a mandatory prompt for the latest response, and unlocks only after feedback succeeds', async () => {
    messages = [
      buildMessage('ai-old', 'student', 'Earlier AI response', true, '2026-01-01T00:01:00.000Z'),
      buildMessage('student-mid', 'student', 'Student follow-up', false, '2026-01-01T00:02:00.000Z'),
      buildMessage('tutor-latest', 'tutor', 'Latest Tutor response', false, '2026-01-01T00:03:00.000Z'),
      buildMessage('student-trailing', 'student', 'Later nonqualifying message', false, '2026-01-01T00:04:00.000Z'),
    ];
    messageFeedbackStats = {
      'tutor-latest': feedbackStats('tutor-latest', null),
    };

    let resolveFeedback: (() => void) | undefined;
    submitMessageFeedback.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveFeedback = resolve;
      })
    );

    renderRoom();
    enterReplyAndSubmit('My preserved reply');

    expect(sendMessage).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue('My preserved reply')).toBeInTheDocument();

    const dialog = screen.getByRole('alertdialog', { name: /rate the previous response/i });
    expect(dialog).toHaveClass('rating-reminder-animated');
    expect(within(dialog).getByText('Latest Tutor response')).toBeInTheDocument();
    expect(within(dialog).queryByText('Earlier AI response')).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Helpful',
      'Not helpful',
    ]);

    const ratingStyles = readFileSync(
      path.resolve(__dirname, '../components/RoomPagePost.css'),
      'utf8'
    );
    expect(ratingStyles).toMatch(
      /\.rating-reminder-animated\s*\{[^}]*animation:\s*ratingReminderPop\s+(?=[\d.]*[1-9])(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s)\b[^;}]*[;}]/s
    );
    expect(ratingStyles).toMatch(
      /@keyframes\s+ratingReminderPop\s*\{\s*(?:from|0%)\s*\{[^}]*opacity\s*:\s*0\s*;[^}]*\}\s*(?:to|100%)\s*\{[^}]*opacity\s*:\s*1\s*;[^}]*\}\s*\}/s
    );

    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('rating-reminder-backdrop'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Helpful' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '5 stars' }));
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') || button.textContent)
    ).toEqual([
      'Helpful',
      'Not helpful',
      '1 star',
      '2 stars',
      '3 stars',
      '4 stars',
      '5 stars',
      'Submit rating',
    ]);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('rating-reminder-backdrop'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Submit rating' }));

    await waitFor(() => {
      expect(submitMessageFeedback).toHaveBeenCalledWith('tutor-latest', 'like', 5);
    });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(
      within(dialog)
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') || button.textContent)
    ).toEqual([
      'Helpful',
      'Not helpful',
      '1 star',
      '2 stars',
      '3 stars',
      '4 stars',
      '5 stars',
      'Submit rating',
    ]);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('rating-reminder-backdrop'));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Send comment'));
    expect(sendMessage).not.toHaveBeenCalled();

    await act(async () => {
      resolveFeedback?.();
    });
    await waitFor(() => {
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Send comment'));
    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('My preserved reply', { replyToMessageId: undefined });
    });
  });

  it('does not apply the student-only gate to a Tutor', async () => {
    currentUser = buildUser('tutor');
    messages = [buildMessage('tutor-latest', 'tutor', 'Unrated Tutor response')];
    messageFeedbackStats = { 'tutor-latest': feedbackStats('tutor-latest', null) };

    renderRoom();
    enterReplyAndSubmit('Tutor follow-up');

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Tutor follow-up', { replyToMessageId: undefined });
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('does not gate a student-authored row based on model diagnostics', async () => {
    messages = [buildMessage('ai-only', 'student', 'Student-authored response with diagnostics', true)];
    messageFeedbackStats = { 'ai-only': feedbackStats('ai-only', null) };

    renderRoom();
    enterReplyAndSubmit('Student reply');

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Student reply', { replyToMessageId: undefined });
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lets a student send when that student already rated the latest response', async () => {
    messages = [buildMessage('tutor-rated', 'tutor', 'Already rated response')];
    messageFeedbackStats = {
      'tutor-rated': feedbackStats('tutor-rated', {
        feedback_type: 'dislike',
        rating: 2,
      }),
    };

    renderRoom();
    enterReplyAndSubmit('Reply after stored rating');

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Reply after stored rating', { replyToMessageId: undefined });
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lets a student send when no AI or Tutor response exists', async () => {
    messages = [buildMessage('student-only', 'student', 'Student started the discussion')];

    renderRoom();
    enterReplyAndSubmit('Another student message');

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('Another student message', { replyToMessageId: undefined });
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('lets a student send when the only Tutor turn is a pre-populated transcript line', async () => {
    messages = [buildMessage('prepop-room-1-1', 'tutor', 'Pre-populated Tutor line')];

    renderRoom();
    enterReplyAndSubmit('Student answer to the seeded discussion');

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledTimes(1);
    });
    expect(sendMessage.mock.calls[0][0]).toBe('Student answer to the seeded discussion');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('still gates on the latest persisted response when a pre-populated line coexists', () => {
    messages = [
      buildMessage('prepop-room-1-1', 'tutor', 'Pre-populated Tutor line', false, '2026-01-01T00:00:30.000Z'),
      buildMessage('tutor-persisted', 'tutor', 'Persisted Tutor response', false, '2026-01-01T00:03:00.000Z'),
    ];
    messageFeedbackStats = {
      'tutor-persisted': feedbackStats('tutor-persisted', null),
    };

    renderRoom();
    enterReplyAndSubmit('Student reply after the persisted turn');

    expect(sendMessage).not.toHaveBeenCalled();
    const dialog = screen.getByRole('alertdialog', { name: /rate the previous response/i });
    expect(within(dialog).getByText('Persisted Tutor response')).toBeInTheDocument();
    expect(within(dialog).queryByText('Pre-populated Tutor line')).not.toBeInTheDocument();
  });
});

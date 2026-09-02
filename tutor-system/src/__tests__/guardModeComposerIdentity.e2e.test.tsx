#!/usr/bin/env node
/**
 * Test responsible for the room composer showing a tutor name normally and
 * the Security Supervisor profile only for tutors in persisted Guard Mode.
 */

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { useAuth } from '../contexts/AuthContext';
import { useRoom } from '../contexts/RoomContext';
import type { Room, User } from '../types';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../contexts/RoomContext', () => ({ useRoom: jest.fn() }));
jest.mock('../components/RoomPost', () => () => <div data-testid="room-post" />);
jest.mock('../components/PostComment', () => () => <div data-testid="post-comment" />);
jest.mock('../components/AIAssistantSettings', () => () => <div data-testid="ai-settings" />);
jest.mock('../components/StudentAIToneControl', () => () => <div data-testid="student-tone" />);
jest.mock('../components/ChecklistPanel', () => () => <div data-testid="checklist" />);

const tutor: User = {
  id: 'tutor-1',
  display_name: 'Taylor Tutor',
  current_role: 'tutor',
  email: 'taylor@example.test',
  avatar_url: 'https://example.test/taylor.png',
  status: 'active',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z'
};

const student: User = {
  id: 'student-1',
  display_name: 'Sam Student',
  current_role: 'student',
  email: 'sam@example.test',
  avatar_url: 'https://example.test/sam.png',
  status: 'active',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z'
};

const room = (mode: 'tutoring' | 'guard'): Room => ({
  id: 'room-1',
  tutor_id: tutor.id,
  title: 'Guard composer room',
  description: 'Identity behavior test',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: true,
  ai_assistant_model: 'qwen3.5-flash',
  ai_assistant_prompt: 'prompt',
  active_response_mode: mode,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z'
});

const renderRoom = (user: User, mode: 'tutoring' | 'guard', suggestion: string | null = null) => {
  const setResponseMode = jest.fn();

  (useAuth as jest.Mock).mockReturnValue({ user, loading: false });
  (useRoom as jest.Mock).mockReturnValue({
    currentRoom: room(mode),
    messages: [],
    participants: [tutor, student],
    loading: false,
    typingUsers: [],
    joinRoom: jest.fn(),
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
    aiSuggestion: suggestion,
    aiDecision: null,
    finalMode: 'tutoring',
    updateFinalResponse: jest.fn(),
    updateFinalMode: jest.fn(),
    setResponseMode,
    clearAISuggestion: jest.fn(),
    recordAIFeedback: jest.fn(),
    currentSuggestionContext: null,
    submitMessageFeedback: jest.fn(),
    messageFeedbackStats: {}
  });

  const renderResult = render(
    <MemoryRouter initialEntries={['/room/room-1']}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPagePost />} />
      </Routes>
    </MemoryRouter>
  );

  return { ...renderResult, setResponseMode };
};

describe('Guard Mode composer identity', () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('shows the tutor name beside the normal composer profile', () => {
    renderRoom(tutor, 'tutoring');

    expect(screen.getByText('Taylor Tutor')).toBeInTheDocument();
    expect(screen.getByTitle('Taylor Tutor')).toBeInTheDocument();
    expect(screen.queryByText('Security Supervisor')).not.toBeInTheDocument();
  });

  it('shows Security Supervisor for a tutor after Guard activates', () => {
    renderRoom(tutor, 'guard');

    expect(screen.getByText('Security Supervisor')).toBeInTheDocument();
    expect(screen.getByTitle('Security Supervisor')).toBeInTheDocument();
    expect(screen.queryByText('Taylor Tutor')).not.toBeInTheDocument();
  });

  it('keeps the student profile when Guard Mode is active', () => {
    renderRoom(student, 'guard');

    expect(screen.getByText('Sam Student')).toBeInTheDocument();
    expect(screen.getByTitle('Sam Student')).toBeInTheDocument();
    expect(screen.queryByText('Security Supervisor')).not.toBeInTheDocument();
  });

  it('activates Guard from the AI suggestion card using the existing room transition', () => {
    const { setResponseMode } = renderRoom(tutor, 'tutoring', 'Guard suggestion');
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    const suggestionCard = screen.getByText('Guard suggestion').closest('.ai-suggestion-box');
    expect(suggestionCard).not.toBeNull();
    fireEvent.click(within(suggestionCard as HTMLElement).getByRole('button', { name: 'Activate Guard' }));

    expect(window.confirm).toHaveBeenCalledWith('Activate Guard Mode?');
    expect(setResponseMode).toHaveBeenCalledWith('guard');
  });

  it('deactivates Guard from the AI suggestion card using the existing room transition', () => {
    const { setResponseMode } = renderRoom(tutor, 'guard', 'Guard suggestion');
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    const suggestionCard = screen.getByText('Guard suggestion').closest('.ai-suggestion-box');
    expect(suggestionCard).not.toBeNull();
    fireEvent.click(within(suggestionCard as HTMLElement).getByRole('button', { name: 'Deactivate Guard' }));

    expect(window.confirm).toHaveBeenCalledWith('Deactivate Guard Mode?');
    expect(setResponseMode).toHaveBeenCalledWith('tutoring');
  });

  it('does not change Guard Mode when the card confirmation is cancelled', () => {
    const { setResponseMode } = renderRoom(tutor, 'tutoring', 'Guard suggestion');
    jest.spyOn(window, 'confirm').mockReturnValue(false);

    const suggestionCard = screen.getByText('Guard suggestion').closest('.ai-suggestion-box');
    expect(suggestionCard).not.toBeNull();
    fireEvent.click(within(suggestionCard as HTMLElement).getByRole('button', { name: 'Activate Guard' }));

    expect(window.confirm).toHaveBeenCalledWith('Activate Guard Mode?');
    expect(setResponseMode).not.toHaveBeenCalled();
  });
});

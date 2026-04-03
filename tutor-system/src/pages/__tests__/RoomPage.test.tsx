#!/usr/bin/env node
/**
 * Test responsible for RoomPage.tsx covering the current page-level contract for room loading, messaging, role-based UI, and AI error surfacing.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPage from '../RoomPage';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import { useRoomFeatures } from '../../hooks/useRoomFeatures';
import { AIAssistantConfig, Message, Room, User } from '../../types';

jest.mock('../../contexts/AuthContext');
jest.mock('../../contexts/RoomContext');
jest.mock('../../hooks/useRoomFeatures');
jest.mock('../../components/AvatarDisplay', () => {
  return function MockAvatarDisplay({ displayName }: { displayName: string }) {
    return <div data-testid={`avatar-${displayName}`}>{displayName}</div>;
  };
});
jest.mock('../../components/ChecklistPanel', () => {
  return function MockChecklistPanel() {
    return <div data-testid="checklist-panel">Checklist</div>;
  };
});
jest.mock('../../components/ChatMessage', () => {
  return function MockChatMessage({ message, onGenerateAIResponse, canGenerateAI, isGeneratingAI }: any) {
    return (
      <div data-testid={`message-${message.id}`}>
        <span>{message.content}</span>
        {canGenerateAI && onGenerateAIResponse && (
          <button
            data-testid={`generate-ai-for-${message.id}`}
            disabled={isGeneratingAI}
            onClick={() => onGenerateAIResponse(message.id)}
          >
            Generate AI For Message
          </button>
        )}
      </div>
    );
  };
});
jest.mock('../../components/AIAssistantSettings', () => {
  return function MockAIAssistantSettings({ onClose }: { onClose: () => void }) {
    return (
      <div data-testid="ai-settings-modal">
        <button onClick={onClose}>Close AI Settings</button>
      </div>
    );
  };
});

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseRoom = useRoom as jest.MockedFunction<typeof useRoom>;
const mockUseRoomFeatures = useRoomFeatures as jest.MockedFunction<typeof useRoomFeatures>;

const buildUser = (overrides: Partial<User> = {}): User => ({
  id: 'tutor-1',
  email: 'tutor@example.com',
  display_name: 'Tutor User',
  current_role: 'tutor',
  status: 'active',
  created_at: '2026-04-02T00:00:00Z',
  updated_at: '2026-04-02T00:00:00Z',
  ...overrides
});

const buildRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-1',
  tutor_id: 'tutor-1',
  title: 'Test Room',
  description: 'Room description',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: false,
  ai_assistant_model: null,
  ai_assistant_prompt: null,
  created_at: '2026-04-02T00:00:00Z',
  updated_at: '2026-04-02T00:00:00Z',
  ...overrides
});

const buildMessage = (overrides: Partial<Message> = {}): Message => ({
  id: 'message-1',
  room_id: 'room-1',
  user_id: 'student-1',
  content: 'Student question',
  user_role: 'student',
  display_name: 'Student User',
  is_ai_generated: false,
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: null,
  created_at: '2026-04-02T00:01:00Z',
  ...overrides
});

const buildAIConfig = (overrides: Partial<AIAssistantConfig> = {}): AIAssistantConfig => ({
  id: 'ai-config-1',
  room_id: 'room-1',
  model_name: 'gpt-4o',
  system_prompt: 'Test system prompt',
  prompt_config: null,
  temperature: 0.7,
  max_tokens: 150,
  is_active: true,
  created_at: '2026-04-02T00:00:00Z',
  updated_at: '2026-04-02T00:00:00Z',
  ...overrides
});

const renderRoomPage = (roomId = 'room-1') => {
  return render(
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('RoomPage', () => {
  let joinRoom: jest.Mock;
  let leaveRoom: jest.Mock;
  let sendMessage: jest.Mock;
  let generateAIResponse: jest.Mock;
  let startTyping: jest.Mock;
  let stopTyping: jest.Mock;

  beforeAll(() => {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn()
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();

    joinRoom = jest.fn().mockResolvedValue(undefined);
    leaveRoom = jest.fn();
    sendMessage = jest.fn().mockResolvedValue(undefined);
    generateAIResponse = jest.fn().mockResolvedValue(undefined);
    startTyping = jest.fn();
    stopTyping = jest.fn();

    mockUseAuth.mockReturnValue({
      user: buildUser(),
      loading: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      setUserRole: jest.fn()
    });

    mockUseRoom.mockReturnValue({
      currentRoom: buildRoom(),
      messages: [
        buildMessage(),
        buildMessage({
          id: 'message-2',
          user_id: 'tutor-1',
          user_role: 'tutor',
          display_name: 'Tutor User',
          content: 'Tutor response'
        })
      ],
      participants: [buildUser(), buildUser({ id: 'student-1', display_name: 'Student User', current_role: 'student' })],
      loading: false,
      loadingAI: false,
      typingUsers: [],
      joinRoom,
      leaveRoom,
      sendMessage,
      generateAIResponse,
      startTyping,
      stopTyping,
      aiConfig: null,
      downloadChatHistory: jest.fn()
    } as any);

    mockUseRoomFeatures.mockReturnValue({
      checklist: {
        data: null,
        loading: false,
        error: null,
        refresh: jest.fn(),
        initialize: jest.fn(),
        updateItem: jest.fn(),
        addCustomArea: jest.fn(),
        deleteArea: jest.fn(),
        exportReport: jest.fn(),
        startSmartGeneration: jest.fn(),
        clear: jest.fn()
      }
    } as any);
  });

  it('shows loading state', () => {
    mockUseRoom.mockReturnValue({
      ...(mockUseRoom() as any),
      loading: true,
      currentRoom: null
    });

    renderRoomPage();

    expect(screen.getByText('Loading room...')).toBeInTheDocument();
  });

  it('renders room details and joins on mount', () => {
    renderRoomPage();

    expect(screen.getByText('Test Room')).toBeInTheDocument();
    expect(screen.getByText('Room description')).toBeInTheDocument();
    expect(screen.getByText('AI Settings')).toBeInTheDocument();
    expect(screen.getByText('Download History')).toBeInTheDocument();
    expect(joinRoom).toHaveBeenCalledWith('room-1', undefined);
  });

  it('leaves the room on unmount', () => {
    const view = renderRoomPage();

    view.unmount();

    expect(leaveRoom).toHaveBeenCalled();
  });

  it('sends the current input value as a message', async () => {
    renderRoomPage();

    const input = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(input, { target: { value: 'New tutor message' } });
    fireEvent.click(screen.getByText('Send'));

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith('New tutor message');
    });
  });

  it('shows observer mode and hides the message composer for observers', () => {
    mockUseAuth.mockReturnValue({
      ...(mockUseAuth() as any),
      user: buildUser({ id: 'observer-1', current_role: 'observer', display_name: 'Observer User' })
    });

    renderRoomPage();

    expect(screen.getByTestId('observer-mode-indicator')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Type a message...')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Settings')).not.toBeInTheDocument();
  });

  it('shows AI model information and enables AI actions for tutors when AI is on', () => {
    mockUseRoom.mockReturnValue({
      ...(mockUseRoom() as any),
      currentRoom: buildRoom({ ai_assistant_enabled: true }),
      aiConfig: buildAIConfig()
    });

    renderRoomPage();

    expect(screen.getByText('🤖 AI: On')).toBeInTheDocument();
    expect(screen.getByText('(gpt-4o)')).toBeInTheDocument();
    expect(screen.getByText('🤖 Generate')).toBeInTheDocument();
  });

  it('opens and closes the AI settings modal', () => {
    renderRoomPage();

    fireEvent.click(screen.getByText('AI Settings'));
    expect(screen.getByTestId('ai-settings-modal')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close AI Settings'));
    expect(screen.queryByTestId('ai-settings-modal')).not.toBeInTheDocument();
  });

  it('passes the selected student message content into AI generation', async () => {
    mockUseRoom.mockReturnValue({
      ...(mockUseRoom() as any),
      currentRoom: buildRoom({ ai_assistant_enabled: true }),
      aiConfig: buildAIConfig()
    });

    renderRoomPage();

    fireEvent.click(screen.getByTestId('generate-ai-for-message-1'));

    await waitFor(() => {
      expect(generateAIResponse).toHaveBeenCalledWith('Student question');
    });
  });

  it('surfaces non-auth AI failures in the alert', async () => {
    generateAIResponse.mockRejectedValue(new Error('AI generation failed'));
    mockUseRoom.mockReturnValue({
      ...(mockUseRoom() as any),
      currentRoom: buildRoom({ ai_assistant_enabled: true }),
      aiConfig: buildAIConfig(),
      generateAIResponse
    });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    renderRoomPage();

    fireEvent.click(screen.getByText('🤖 Generate'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Failed to generate AI response.\n\nAI generation failed');
    });

    alertSpy.mockRestore();
  });

  it('surfaces backend authentication failures instead of a generic alert', async () => {
    generateAIResponse.mockRejectedValue(new Error('OpenAI API error: 401 - invalid token'));
    mockUseRoom.mockReturnValue({
      ...(mockUseRoom() as any),
      currentRoom: buildRoom({ ai_assistant_enabled: true }),
      aiConfig: buildAIConfig(),
      generateAIResponse
    });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    renderRoomPage();

    fireEvent.click(screen.getByText('🤖 Generate'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Failed to generate AI response.\n\nAI backend authentication failed (401). The configured API token or gateway token is invalid.'
      );
    });

    alertSpy.mockRestore();
  });
});

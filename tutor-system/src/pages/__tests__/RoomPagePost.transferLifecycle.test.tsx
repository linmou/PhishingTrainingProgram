#!/usr/bin/env node
/**
 * Test responsible for the page-level transfer lifecycle states in src/pages/RoomPagePost.tsx:
 * preparing, unavailable capability, superseded delivery, and retention of the reviewed candidate.
 *
 * Responsibility: prove a teacher sees a named state instead of a silent no-op when preparation is
 * running or refused, and that no state is invented for a legacy suggestion.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../RoomPagePost';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import {
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  learnerAMessageRow,
  preparedCandidate,
  transferRoom,
} from '../../test-support/transferRoomFixtures';
import type { Message } from '../../types';

jest.mock('../../contexts/AuthContext');
jest.mock('../../contexts/RoomContext');
jest.mock('../../components/ChecklistPanel', () => function MockChecklistPanel() {
  return <div data-testid="checklist-panel" />;
});
jest.mock('../../components/AIAssistantSettings', () => function MockAIAssistantSettings() {
  return <div data-testid="ai-settings-modal" />;
});
jest.mock('../../components/StudentAIToneControl', () => function MockStudentAIToneControl() {
  return <div data-testid="student-ai-tone" />;
});
jest.mock('../../components/RoomPost', () => function MockRoomPost() {
  return <div data-testid="room-post" />;
});
jest.mock('../../components/CommentInput', () => function MockCommentInput() {
  return <div data-testid="comment-input" />;
});
jest.mock('../../components/AISuggestionBox', () => function MockAISuggestionBox() {
  return <div data-testid="ai-suggestion-box" />;
});

const learnerMessage: Message = {
  id: LEARNER_A_MESSAGE_ID,
  room_id: TRANSFER_ROOM_ID,
  user_id: 'learner-a',
  content: learnerAMessageRow.content,
  user_role: 'student',
  response_mode: 'tutoring',
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: null,
  created_at: learnerAMessageRow.created_at,
  display_name: 'Learner A',
};

const transferDraft = {
  decision: preparedCandidate,
  progressSnapshotHash: 'snapshot-hash-abc',
  roomId: TRANSFER_ROOM_ID,
  studentId: 'learner-a',
  checklistId: 'checklist-1',
  itemId: 'item-1' as string | null,
  focusStudentMessageId: LEARNER_A_MESSAGE_ID,
};

describe('RoomPagePost transfer lifecycle states', () => {
  let generateAIResponse: jest.Mock;
  let alertSpy: jest.SpyInstance;

  const mount = (overrides: Record<string, unknown> = {}) => {
    (useRoom as jest.Mock).mockReturnValue({
      currentRoom: { ...transferRoom, ai_assistant_enabled: true },
      messages: [learnerMessage],
      participants: [],
      loading: false,
      loadingAI: false,
      typingUsers: [],
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn(),
      sendMessage: jest.fn().mockResolvedValue(undefined),
      generateAIResponse,
      regenerateAIResponse: jest.fn(),
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      aiConfig: { model_name: 'qwen3.5-flash', prompt_config: null },
      downloadChatHistory: jest.fn(),
      clearChatHistory: jest.fn(),
      transferDraft: null,
      confirmTransferDraft: jest.fn().mockResolvedValue(undefined),
      clearAISuggestion: jest.fn(),
      aiSuggestion: null,
      finalMode: 'tutoring',
      messageFeedbackStats: {},
      ...overrides,
    });

    return render(
      <MemoryRouter initialEntries={[`/room/${TRANSFER_ROOM_ID}`]}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomPagePost />} />
        </Routes>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });
    alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    generateAIResponse = jest.fn().mockResolvedValue(undefined);
    // The generate control is the room's AI button; it is enabled for a tutor in an AI room.
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'tutor-1',
        display_name: 'Tutor',
        current_role: 'tutor',
        status: 'active',
        created_at: '2026-09-12T08:00:00Z',
        updated_at: '2026-09-12T08:00:00Z',
      },
      loading: false,
    });
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it('shows a preparing state while a transfer turn is being prepared', () => {
    mount({ loadingAI: true, transferDraft: null });

    expect(screen.getByText('Preparing the transfer turn…')).toBeInTheDocument();
    expect(screen.getByText('Preparing the transfer turn…')).toHaveAttribute('data-transfer-status', 'preparing');
  });

  it('shows an unavailable state when the capability is disabled', async () => {
    generateAIResponse.mockRejectedValue(new Error('ASSESSMENT_FEATURE_DISABLED: Transfer assessment is disabled'));
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="unavailable"]')).not.toBeNull();
    });
  });

  it('shows a superseded state when the learner already has a delivered assessment', async () => {
    generateAIResponse.mockRejectedValue(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'));
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="superseded"]')).not.toBeNull();
    });
  });

  it('shows a validation state for a refused preparation without turning the room mode', async () => {
    generateAIResponse.mockRejectedValue(new Error('WRONG_LEARNER: focus message belongs to another learner'));
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="validation"]')).not.toBeNull();
    });
    expect(screen.queryByText('Review transfer assessment')).not.toBeInTheDocument();
  });

  it('keeps the reviewed candidate instead of a lifecycle state while it is open', () => {
    mount({ transferDraft });

    expect(screen.getByRole('heading', { name: 'Review transfer assessment' })).toBeInTheDocument();
    expect(document.querySelector('[data-transfer-status]')).toBeNull();
  });

  it('clears a previous lifecycle state when a new preparation starts and succeeds', async () => {
    generateAIResponse
      .mockRejectedValueOnce(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'))
      .mockResolvedValueOnce(undefined);
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="superseded"]')).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Generate AI Response/));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status]')).toBeNull();
    });
  });
});

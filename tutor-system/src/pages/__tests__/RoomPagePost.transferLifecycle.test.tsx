#!/usr/bin/env node
/**
 * Test responsible for the page-level transfer lifecycle states and download controls in
 * src/pages/RoomPagePost.tsx: preparation and delivery outcomes, plus TXT/JSON export selection.
 *
 * Responsibility: prove a teacher sees preparation, stale, retryable, and unavailable states,
 * catches up from persisted messages after a stale conflict, and a learner sees server-reported
 * remaining chances after the room page is mounted from persisted lifecycle state.
 */

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../RoomPagePost';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import {
  answerLifecycleFromProcessed,
  projectRoomMessage,
  withAnswerLifecycle,
} from '../../contexts/transferAssessmentUiAdapter';
import {
  DELIVERED_ANSWER_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  deliveredPublicAssessment,
  deliveredQuestionRow,
  learnerAUser,
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
  is_ai_generated: false,
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
  let downloadChatHistory: jest.Mock;
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
      downloadChatHistory,
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
    downloadChatHistory = jest.fn();
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

  it('catches up from persisted room state when a transfer turn is stale', async () => {
    generateAIResponse.mockRejectedValue(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'));
    let finishCatchUp: (() => void) | null = null;
    const joinRoom = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        finishCatchUp = () => resolve();
      }));
    mount({ joinRoom });

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="catching-up"]')).not.toBeNull();
    });
    await act(async () => {
      finishCatchUp?.();
    });
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="stale"]')).not.toBeNull();
    });
    expect(screen.getByText(/refreshed after a transfer conflict/)).toBeInTheDocument();
    expect(joinRoom).toHaveBeenCalledWith(TRANSFER_ROOM_ID);
  });

  it('keeps room catch-up retryable until persisted state can be refreshed', async () => {
    const joinRoom = jest.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('temporary network failure'))
      .mockResolvedValueOnce(undefined);
    generateAIResponse.mockRejectedValue(new Error('temporary transfer service failure'));
    mount({ joinRoom });

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="retryable"]')).not.toBeNull();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh room state' }));
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="retryable"]')).not.toBeNull();
      expect(joinRoom).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Refresh room state' }));
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="caught-up"]')).not.toBeNull();
    });
    expect(joinRoom).toHaveBeenCalledTimes(3);
  });

  it('refreshes saved room state when preparation is superseded by another learner focus', async () => {
    generateAIResponse.mockRejectedValue(new Error('WRONG_LEARNER: focus message belongs to another learner'));
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="stale"]')).not.toBeNull();
    });
    expect(screen.queryByText('Review transfer assessment')).not.toBeInTheDocument();
  });

  it('keeps the reviewed candidate instead of a lifecycle state while it is open', () => {
    mount({ transferDraft });

    expect(screen.getByRole('heading', { name: 'Review transfer assessment' })).toBeInTheDocument();
    expect(document.querySelector('[data-transfer-status]')).toBeNull();
  });

  it('submits the public question parent ID and assessment ID separately', async () => {
    const questionMessageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const question = projectRoomMessage(
      { ...deliveredQuestionRow, id: questionMessageId },
      deliveredPublicAssessment
    );
    const sendMessage = jest.fn().mockResolvedValue(undefined);
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    mount({ messages: [question], sendMessage });

    fireEvent.click(screen.getByRole('radio', { name: /A\./ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }));
    });

    expect(sendMessage).toHaveBeenCalledWith('A', {
      replyToMessageId: questionMessageId,
      assessmentId: DELIVERED_QUESTION_ID,
      selectedOptionIds: ['A'],
    });
  });

  it('renders persisted remaining chances after the page is mounted from saved messages', () => {
    const question = withAnswerLifecycle(
      projectRoomMessage(deliveredQuestionRow, deliveredPublicAssessment),
      answerLifecycleFromProcessed({
        message_id: DELIVERED_ANSWER_ID,
        assessment_id: DELIVERED_QUESTION_ID,
        processing_state: 'applied',
        answer_outcome: 'retry',
        attempt_number: 1,
        attempts_used: 1,
        attempts_remaining: 1,
        selected_option_ids: ['A'],
        terminal: false,
        transition: null,
        code: null,
        feedback_required: false,
        already_processed: true,
        terminal_failure_feedback: null,
      })
    );
    (useAuth as jest.Mock).mockReturnValue({ user: learnerAUser, loading: false });
    mount({ messages: [question] });

    expect(screen.getByText('Incorrect. 1 attempt remaining.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit answer' })).toBeDisabled();
  });

  it('clears a previous lifecycle state when a new preparation starts and succeeds', async () => {
    generateAIResponse
      .mockRejectedValueOnce(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'))
      .mockResolvedValueOnce(undefined);
    mount();

    fireEvent.click(screen.getByTitle(/Generate AI Response/));
    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status="stale"]')).not.toBeNull();
    });

    await act(async () => {
      fireEvent.click(screen.getByTitle(/Generate AI Response/));
    });

    await waitFor(() => {
      expect(document.querySelector('[data-transfer-status]')).toBeNull();
    });
  });

  it('offers TXT and JSON downloads without offering PDF', () => {
    mount();

    fireEvent.click(screen.getByTitle('Download Chat History'));

    expect(screen.getByRole('heading', { name: 'Download Room Data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chat History (TXT)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete Data (JSON)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
  });

  it('requests a TXT export when the chat-history option is selected', () => {
    mount();

    fireEvent.click(screen.getByTitle('Download Chat History'));
    fireEvent.click(screen.getByRole('button', { name: 'Chat History (TXT)' }));

    expect(downloadChatHistory).toHaveBeenCalledWith('txt');
    expect(screen.queryByRole('heading', { name: 'Download Room Data' })).not.toBeInTheDocument();
  });

  it('requests a JSON export when the complete-data option is selected', () => {
    mount();

    fireEvent.click(screen.getByTitle('Download Chat History'));
    fireEvent.click(screen.getByRole('button', { name: 'Complete Data (JSON)' }));

    expect(downloadChatHistory).toHaveBeenCalledWith('json');
    expect(screen.queryByRole('heading', { name: 'Download Room Data' })).not.toBeInTheDocument();
  });
});

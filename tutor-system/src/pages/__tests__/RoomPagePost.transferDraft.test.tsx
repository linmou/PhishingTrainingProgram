#!/usr/bin/env node
/**
 * Test responsible for src/pages/RoomPagePost.tsx on the teacher transfer-review path: the review
 * surface is wired to the room context, can be discarded, and surfaces an authoritative refusal
 * without leaving a phantom learner message.
 *
 * Responsibility: prove the page-level review contract for US1 (review, one-click send, discard, send
 * failure) rather than only the editor's internal state.
 */

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  is_ai_generated: false,
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: null,
  created_at: learnerAMessageRow.created_at,
  display_name: 'Learner A',
};

describe('RoomPagePost transfer review surface', () => {
  let confirmTransferDraft: jest.Mock;
  let clearAISuggestion: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });

    confirmTransferDraft = jest.fn().mockResolvedValue(undefined);
    clearAISuggestion = jest.fn();

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
      generateAIResponse: jest.fn().mockResolvedValue(undefined),
      regenerateAIResponse: jest.fn(),
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      aiConfig: { model_name: 'qwen3.5-flash', prompt_config: null },
      downloadChatHistory: jest.fn(),
      clearChatHistory: jest.fn(),
      transferDraft: {
        decision: preparedCandidate,
        progressSnapshotHash: 'snapshot-hash-abc',
        roomId: TRANSFER_ROOM_ID,
        studentId: 'learner-a',
        checklistId: 'checklist-1',
        itemId: 'item-1',
        focusStudentMessageId: LEARNER_A_MESSAGE_ID,
      },
      confirmTransferDraft,
      clearAISuggestion,
      aiSuggestion: null,
      finalMode: 'tutoring',
      messageFeedbackStats: {},
    });
  });

  const renderPage = () => render(
    <MemoryRouter initialEntries={[`/room/${TRANSFER_ROOM_ID}`]}>
      <Routes>
        <Route path="/room/:roomId" element={<RoomPagePost />} />
      </Routes>
    </MemoryRouter>
  );

  it('shows the structured review surface for a prepared candidate', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Review transfer assessment' })).toBeInTheDocument();
    expect(screen.queryByTestId('ai-suggestion-box')).not.toBeInTheDocument();
  });

  it('discards the candidate through the room context without delivering anything', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));

    expect(clearAISuggestion).toHaveBeenCalledTimes(1);
    expect(confirmTransferDraft).not.toHaveBeenCalled();
  });

  it('surfaces an authoritative refusal and keeps the candidate for a fresh attempt', async () => {
    confirmTransferDraft.mockRejectedValue(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'));
    renderPage();

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'A caller requests a fee. What is safest?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('ASSESSMENT_ALREADY_OPEN');
    });
    expect(screen.getByLabelText('Question')).toHaveValue('A caller requests a fee. What is safest?');
    confirmTransferDraft.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));
    await waitFor(() => expect(confirmTransferDraft).toHaveBeenCalledTimes(2));
    expect(confirmTransferDraft.mock.calls[1][0]).toEqual(confirmTransferDraft.mock.calls[0][0]);
  });
});

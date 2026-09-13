#!/usr/bin/env node
/**
 * Test responsible for structured-decision consumption in src/pages/RoomPagePost.tsx: the transfer
 * candidate is handled as structured fields rather than copied suggestion text.
 *
 * Responsibility: prove the page renders the structured review surface from the candidate, forwards
 * a structured decision on confirm, and keeps the copy-only legacy suggestion path for a room with
 * no transfer candidate.
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
import type { TutorDecisionV3 } from '../../types/assessment';

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

describe('RoomPagePost structured decision consumption', () => {
  let confirmTransferDraft: jest.Mock;

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
      generateAIResponse: jest.fn().mockResolvedValue(undefined),
      regenerateAIResponse: jest.fn(),
      startTyping: jest.fn(),
      stopTyping: jest.fn(),
      aiConfig: { model_name: 'qwen3.5-flash', prompt_config: null },
      downloadChatHistory: jest.fn(),
      clearChatHistory: jest.fn(),
      transferDraft: null,
      confirmTransferDraft,
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
    confirmTransferDraft = jest.fn().mockResolvedValue(undefined);

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

  const candidateDraft = {
    decision: preparedCandidate,
    progressSnapshotHash: 'snapshot-hash-abc',
    roomId: TRANSFER_ROOM_ID,
    studentId: 'learner-a',
    checklistId: 'checklist-1',
    itemId: 'item-1' as string | null,
    focusStudentMessageId: LEARNER_A_MESSAGE_ID,
  };

  it('renders the structured candidate fields rather than a copied suggestion', () => {
    mount({ transferDraft: candidateDraft });

    expect(screen.getByText('Review transfer assessment')).toBeInTheDocument();
    expect(screen.getByDisplayValue(preparedCandidate.assessment!.stem)).toBeInTheDocument();
    const optionInputs = ['A', 'B', 'C', 'D'].map((id) => screen.getByRole('textbox', { name: `Option ${id}` }) as HTMLTextAreaElement);
    expect(optionInputs.map((input) => input.value)).toEqual(
      preparedCandidate.assessment!.options.map((option) => option.text)
    );
    expect(screen.getByRole('button', { name: 'Send assessment' })).toBeEnabled();
  });

  it('forwards a structured decision object on confirm, never suggestion text', async () => {
    mount({ transferDraft: candidateDraft });

    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'A caller asks for a fee. What is safest?' } });
    fireEvent.change(screen.getByLabelText('Option B'), { target: { value: 'Verify using the official app.' } });
    fireEvent.change(screen.getByLabelText('Option A'), { target: { value: 'End the call.' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Correct answer A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send assessment' }));

    await waitFor(() => expect(confirmTransferDraft).toHaveBeenCalledTimes(1));
    const submitted = confirmTransferDraft.mock.calls[0][0] as TutorDecisionV3;
    expect(typeof submitted).toBe('object');
    expect(submitted.decision).toEqual({
      mode: 'assessment',
      instruction: 'transfer_assess',
      target_item_id: preparedCandidate.decision.target_item_id,
    });
    expect(submitted.response).toBe('A caller asks for a fee. What is safest?');
    expect(submitted.assessment!.stem).toBe(submitted.response);
    expect(submitted.assessment!.selection_type).toBe('single');
    expect(submitted.assessment!.correct_option_ids).toEqual(['A']);
    expect(submitted.assessment!.options).toEqual([
      { id: 'A', text: 'End the call.' },
      { id: 'B', text: 'Verify using the official app.' },
      { id: 'C', text: 'Forward the offer to a friend.' },
      { id: 'D', text: 'Reply with your bank details.' },
    ]);
    expect(submitted.assessment!.rendered_text).toBe([
      'A caller asks for a fee. What is safest?',
      'Choose one.',
      'A. End the call.',
      'B. Verify using the official app.',
      'C. Forward the offer to a friend.',
      'D. Reply with your bank details.',
    ].join('\n'));
  });

  it('keeps the copy-only suggestion path for a room with no transfer candidate', () => {
    mount({ aiSuggestion: 'Try asking about the sender address.' });

    expect(screen.getByTestId('ai-suggestion-box')).toBeInTheDocument();
    expect(screen.queryByText('Review transfer assessment')).not.toBeInTheDocument();
  });

  it('does not render the copy-only suggestion box while a candidate is under review', () => {
    mount({ transferDraft: candidateDraft, aiSuggestion: 'Try asking about the sender address.' });

    expect(screen.getByText('Review transfer assessment')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-suggestion-box')).not.toBeInTheDocument();
  });
});

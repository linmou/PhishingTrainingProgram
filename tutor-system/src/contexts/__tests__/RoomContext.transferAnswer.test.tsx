#!/usr/bin/env node
/**
 * Test responsible for src/contexts/RoomContext.tsx on the learner answer path: a learner answer
 * is posted through the trusted facade with the delivered assessment identity and is graded only
 * by the server.
 *
 * Responsibility: prove the answer keeps its real parent question id, that the returned stored row
 * is projected before it enters React state (no assessment_key), and that the browser never grades
 * or writes progress.
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { getAIConfig } from '../../services/aiService';
import { ChecklistService } from '../../services/checklistService';
import { transferAssessmentService } from '../../services/transferAssessmentService';
import {
  DELIVERED_ANSWER_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_ID,
  PRIVATE_ASSESSMENT_KEY,
  TRANSFER_ROOM_ID,
  deliveredAnswerRow,
  deliveredQuestionRow,
  learnerAMessageRow,
  transferChecklist,
  transferRoom,
} from '../../test-support/transferRoomFixtures';
import { expectNoPrivateAssessmentFields } from '../../test-support/transferPrivacyAssertions';

jest.mock('../../services/supabase', () => ({
  supabase: { channel: jest.fn(), from: jest.fn(), storage: { from: jest.fn() } },
  validateRoomPassword: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn(),
  getUserMessageFeedback: jest.fn(),
  getRoomFeedbackSummary: jest.fn(),
  clearChatHistory: jest.fn(),
}));

jest.mock('../../services/aiService', () => ({
  generateTutorSuggestion: jest.fn(),
  recordAISuggestionFeedback: jest.fn(),
  updateAIConfig: jest.fn(),
  getAIConfig: jest.fn(),
  DEFAULT_AI_MODEL: 'qwen3.5-flash',
}));

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../../services/checklistService', () => ({
  ChecklistService: {
    getActiveTransferChecklistForRoom: jest.fn(),
    getChecklistForStudent: jest.fn(),
  },
}));

const RoomProbe: React.FC<{ onReady: (room: ReturnType<typeof useRoom>) => void }> = ({ onReady }) => {
  const room = useRoom();
  React.useEffect(() => {
    onReady(room);
  }, [onReady, room]);
  return null;
};

describe('RoomContext learner answer path', () => {
  let postMessage: jest.SpyInstance;
  let processMessage: jest.SpyInstance;
  let analyzeMessage: jest.SpyInstance;
  let room: ReturnType<typeof useRoom> | null;

  beforeEach(() => {
    jest.clearAllMocks();
    room = null;

    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: LEARNER_A_ID,
        email: 'learner-a@example.com',
        display_name: 'Learner A',
        current_role: 'student',
        status: 'active',
        created_at: '2026-09-12T08:00:00Z',
        updated_at: '2026-09-12T08:00:00Z',
      },
      loading: false,
    });

    (getAIConfig as jest.Mock).mockResolvedValue(null);
    (supabase.channel as jest.Mock).mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn(),
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { ...transferRoom }, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [learnerAMessageRow, deliveredQuestionRow],
                error: null,
              }),
            }),
          }),
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...learnerAMessageRow, id: 'legacy-message-1', content: 'Just chatting' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table mock: ${table}`);
    });

    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(transferChecklist);
    (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(transferChecklist);

    // The trusted boundary returns the stored row; it carries the private key, as a crafted
    // request could observe, so the browser must project it.
    postMessage = jest.spyOn(transferAssessmentService, 'postMessage').mockImplementation(async (input) => ({
      message: { ...deliveredAnswerRow, content: input.content, assessment_key: PRIVATE_ASSESSMENT_KEY },
    } as unknown as Record<string, unknown>));
    processMessage = jest.spyOn(transferAssessmentService, 'processMessage').mockResolvedValue({
      question_id: DELIVERED_QUESTION_ID,
      result: { verdict: 'pass' },
      selected_option_ids: ['B'],
      transition: { status: 'covered' },
      feedback_required: true,
    });
    analyzeMessage = jest.spyOn(transferAssessmentService, 'analyzeMessage').mockResolvedValue({ applied: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mountRoom = async () => {
    render(
      <RoomProvider>
        <RoomProbe onReady={(api) => { room = api; }} />
      </RoomProvider>
    );
    await waitFor(() => expect(room).not.toBeNull());
    await act(async () => {
      await room!.joinRoom(TRANSFER_ROOM_ID);
    });
  };

  it('posts the answer with the delivered assessment identity and the real parent question', async () => {
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B', {
        replyToMessageId: DELIVERED_QUESTION_ID,
        assessmentId: DELIVERED_QUESTION_ID,
      });
    });

    expect(postMessage).toHaveBeenCalledWith({
      roomId: TRANSFER_ROOM_ID,
      content: 'B',
      replyToMessageId: DELIVERED_QUESTION_ID,
      assessmentId: DELIVERED_QUESTION_ID,
    });
    expect(processMessage).toHaveBeenCalledWith(DELIVERED_ANSWER_ID);
    const answer = room!.messages.find((message) => message.id === DELIVERED_ANSWER_ID);
    expect(answer).toBeDefined();
    expect(answer!.parent_message_id).toBe(DELIVERED_QUESTION_ID);
  });

  it('never retains the private assessment key the stored row carried', async () => {
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B', { replyToMessageId: DELIVERED_QUESTION_ID, assessmentId: DELIVERED_QUESTION_ID });
    });

    expectNoPrivateAssessmentFields(room!.messages);
    expect(JSON.stringify(room!.messages)).not.toContain('assessment_key');
  });

  it('does not grade or write progress in the browser', async () => {
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B', { replyToMessageId: DELIVERED_QUESTION_ID, assessmentId: DELIVERED_QUESTION_ID });
    });

    // The only checklist surface the context may touch is the owner-scoped read used to detect
    // the transfer policy; the mocked module exposes nothing that could write progress.
    expect(Object.keys(ChecklistService).sort()).toEqual([
      'getActiveTransferChecklistForRoom',
      'getChecklistForStudent',
    ]);
    expect(room!.messages.filter((message) => message.id === DELIVERED_ANSWER_ID)).toHaveLength(1);
  });

  it('keeps an unresolved answer server-authoritative instead of inventing a selection', async () => {
    processMessage.mockResolvedValue({
      question_id: '',
      result: null,
      selected_option_ids: null,
      transition: null,
      feedback_required: false,
    });
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B or D', {
        replyToMessageId: DELIVERED_QUESTION_ID,
        assessmentId: DELIVERED_QUESTION_ID,
      });
    });

    const answer = room!.messages.find((message) => message.id === DELIVERED_ANSWER_ID);
    expect(answer!.content).toBe('B or D');
    expect(analyzeMessage).not.toHaveBeenCalled();
    expect(JSON.stringify(room!.messages)).not.toContain('selected_option_ids');
  });

  it('falls back to evidence analysis when no assessment is open, without duplicating the answer', async () => {
    processMessage.mockRejectedValue(new Error('ASSESSMENT_NOT_OPEN: no open assessment'));
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B', { replyToMessageId: DELIVERED_QUESTION_ID, assessmentId: DELIVERED_QUESTION_ID });
    });

    expect(analyzeMessage).toHaveBeenCalledWith(DELIVERED_ANSWER_ID, TRANSFER_ROOM_ID);
    expect(room!.messages.filter((message) => message.id === DELIVERED_ANSWER_ID)).toHaveLength(1);
  });

  it('surfaces the server clarification request instead of inventing a selection or a failure', async () => {
    processMessage.mockResolvedValue({
      message_id: DELIVERED_QUESTION_ID,
      result: null,
      selected_option_ids: null,
      transition: null,
      feedback_required: false,
      code: 'ANSWER_FORMAT_UNRESOLVED',
      clarification_required: true,
      already_processed: false,
    });
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B or D', {
        replyToMessageId: DELIVERED_QUESTION_ID,
        assessmentId: DELIVERED_QUESTION_ID,
      });
    });

    const answer = room!.messages.find((message) => message.id === DELIVERED_ANSWER_ID) as unknown as {
      answerLifecycle?: { state?: string; code?: string | null };
    };
    expect(answer.answerLifecycle?.state).toBe('clarification');
    expect(answer.answerLifecycle?.code).toBe('ANSWER_FORMAT_UNRESOLVED');
  });

  it('keeps an ordinary learner message on the legacy path when the room has no transfer checklist', async () => {
    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue({
      ...transferChecklist,
      progress_policy_version: 'legacy_v1',
    });
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('Just chatting', {});
    });

    expect(postMessage).not.toHaveBeenCalled();
  });
});

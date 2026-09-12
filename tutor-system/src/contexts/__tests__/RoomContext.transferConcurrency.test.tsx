#!/usr/bin/env node
/**
 * Test responsible for src/contexts/RoomContext.tsx under retry and duplicate-tab conditions on
 * the transfer path.
 *
 * Responsibility: prove a delivery that times out and is retried, a duplicate delivery result, a
 * duplicate learner answer, and a second tab's already-open delivery each converge to one visible
 * record without the browser inventing a second persistence call.
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
  CHECKLIST_ID,
  CHECKLIST_ITEM_ID,
  DELIVERED_ANSWER_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_ID,
  TRANSFER_ROOM_ID,
  deliveredAnswerRow,
  learnerAMessageRow,
  learnerBMessageRow,
  preparedCandidate,
  preparedTurnResult,
  reviewedDelivery,
  transferChecklist,
  transferRoom,
} from '../../test-support/transferRoomFixtures';

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

const tutorUser = {
  id: 'tutor-1',
  display_name: 'Tutor',
  current_role: 'tutor',
  status: 'active',
  created_at: '2026-09-12T08:00:00Z',
  updated_at: '2026-09-12T08:00:00Z',
};

const learnerUser = { ...tutorUser, id: LEARNER_A_ID, display_name: 'Learner A', current_role: 'student' };

describe('RoomContext transfer concurrency', () => {
  let sendReviewed: jest.SpyInstance;
  let room: ReturnType<typeof useRoom> | null;

  beforeEach(() => {
    jest.clearAllMocks();
    room = null;
    (useAuth as jest.Mock).mockReturnValue({ user: tutorUser, loading: false });

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
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: { ...transferRoom }, error: null }) }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [learnerBMessageRow, learnerAMessageRow], error: null }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      throw new Error(`Unexpected table mock: ${table}`);
    });

    (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(transferChecklist);
    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(transferChecklist);

    jest.spyOn(transferAssessmentService, 'prepareTurn').mockResolvedValue(preparedTurnResult);
    sendReviewed = jest.spyOn(transferAssessmentService, 'sendReviewed').mockResolvedValue(reviewedDelivery);
    jest.spyOn(transferAssessmentService, 'processMessage').mockResolvedValue({
      question_id: DELIVERED_QUESTION_ID,
      result: { verdict: 'pass' },
      selected_option_ids: ['B'],
      transition: null,
      feedback_required: true,
    });
    jest.spyOn(transferAssessmentService, 'analyzeMessage').mockResolvedValue({ applied: [] });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mountAsTutor = async () => {
    render(
      <RoomProvider>
        <RoomProbe onReady={(api) => { room = api; }} />
      </RoomProvider>
    );
    await waitFor(() => expect(room).not.toBeNull());
    await act(async () => {
      await room!.joinRoom(TRANSFER_ROOM_ID);
    });
    await act(async () => {
      await room!.generateAIResponse();
    });
  };

  it('lets a timed-out delivery be retried and converges to one message', async () => {
    await mountAsTutor();
    sendReviewed
      .mockRejectedValueOnce(new Error('Assessment API request failed: network timeout'))
      .mockResolvedValueOnce(reviewedDelivery);

    let firstError: unknown = null;
    await act(async () => {
      try {
        await room!.confirmTransferDraft(preparedCandidate);
      } catch (error) {
        firstError = error;
      }
    });
    expect(String(firstError)).toMatch(/timeout/);
    expect(room!.messages.filter((message) => message.id === DELIVERED_QUESTION_ID)).toHaveLength(0);
    expect(room!.transferDraft).not.toBeNull();

    let secondError: unknown = null;
    await act(async () => {
      try {
        await room!.confirmTransferDraft(preparedCandidate);
      } catch (error) {
        secondError = error;
      }
    });
    expect(String(secondError)).toBe('null');

    expect(sendReviewed).toHaveBeenCalledTimes(2);
    expect(room!.messages.filter((message) => message.id === DELIVERED_QUESTION_ID)).toHaveLength(1);
  });

  it('does not append a question when the server reports it was already delivered', async () => {
    await mountAsTutor();
    sendReviewed.mockRejectedValue(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'));

    await expect(act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    })).rejects.toThrow('ASSESSMENT_ALREADY_OPEN');

    expect(room!.messages.filter((message) => message.id === DELIVERED_QUESTION_ID)).toHaveLength(0);
    expect(room!.messages.map((message) => message.id)).toContain(learnerAMessageRow.id);
  });

  it('keeps the prepared focus identity when another learner speaks during review', async () => {
    await mountAsTutor();

    await act(async () => {
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table !== 'messages') throw new Error(`Unexpected table mock: ${table}`);
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [learnerAMessageRow, { ...learnerBMessageRow, content: 'A later message' }],
                error: null,
              }),
            }),
          }),
        };
      });
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    await act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    });

    expect(sendReviewed).toHaveBeenCalledWith(expect.objectContaining({
      focusStudentMessageId: learnerAMessageRow.id,
      studentId: LEARNER_A_ID,
      checklistId: CHECKLIST_ID,
      itemId: CHECKLIST_ITEM_ID,
    }));
  });

  it('does not reprocess a resolved answer into a second message', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: learnerUser, loading: false });
    jest.spyOn(transferAssessmentService, 'postMessage').mockResolvedValue({
      message: { ...deliveredAnswerRow },
    } as unknown as Record<string, unknown>);

    render(
      <RoomProvider>
        <RoomProbe onReady={(api) => { room = api; }} />
      </RoomProvider>
    );
    await waitFor(() => expect(room).not.toBeNull());
    await act(async () => {
      await room!.joinRoom(TRANSFER_ROOM_ID);
    });
    await act(async () => {
      await room!.sendMessage('B', { replyToMessageId: DELIVERED_QUESTION_ID, assessmentId: DELIVERED_QUESTION_ID });
    });

    expect(room!.messages.filter((message) => message.id === DELIVERED_ANSWER_ID)).toHaveLength(1);
    expect(room!.messages.filter((message) => message.content === 'B')).toHaveLength(1);
  });
});

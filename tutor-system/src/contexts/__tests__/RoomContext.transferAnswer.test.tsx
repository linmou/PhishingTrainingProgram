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
  let initialMessages: Array<Record<string, unknown>>;

  beforeEach(() => {
    jest.clearAllMocks();
    room = null;
    initialMessages = [learnerAMessageRow, deliveredQuestionRow];

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
                data: initialMessages,
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
      message: {
        ...deliveredAnswerRow,
        content: input.content,
        parent_message_id: input.replyToMessageId ?? null,
        assessment_key: PRIVATE_ASSESSMENT_KEY,
      },
    } as unknown as Record<string, unknown>));
    processMessage = jest.spyOn(transferAssessmentService, 'processMessage').mockResolvedValue({
      message_id: DELIVERED_ANSWER_ID,
      assessment_id: DELIVERED_QUESTION_ID,
      processing_state: 'applied',
      answer_outcome: 'passed',
      attempt_number: 1,
      attempts_used: 1,
      attempts_remaining: 1,
      selected_option_ids: ['B'],
      transition: { status: 'covered' },
      feedback_required: false,
      code: null,
      already_processed: false,
      terminal: false,
      terminal_failure_feedback: null,
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
        selectedOptionIds: ['B'],
      });
    });

    expect(postMessage).toHaveBeenCalledWith({
      roomId: TRANSFER_ROOM_ID,
      content: 'B',
      replyToMessageId: DELIVERED_QUESTION_ID,
      assessmentId: DELIVERED_QUESTION_ID,
      selectedOptionIds: ['B'],
    });
    expect(processMessage).toHaveBeenCalledWith(DELIVERED_ANSWER_ID, DELIVERED_QUESTION_ID);
    expect(analyzeMessage).not.toHaveBeenCalled();
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

  it('sends ordinary student messages through evidence analysis without calling assessment processing', async () => {
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('Just chatting');
    });

    expect(processMessage).not.toHaveBeenCalled();
    expect(analyzeMessage).toHaveBeenCalledWith(DELIVERED_ANSWER_ID, TRANSFER_ROOM_ID);
  });

  it('keeps an unresolved answer server-authoritative instead of inventing a selection', async () => {
    processMessage.mockResolvedValue({
      message_id: DELIVERED_ANSWER_ID,
      assessment_id: DELIVERED_QUESTION_ID,
      processing_state: 'rejected',
      answer_outcome: null,
      attempt_number: null,
      attempts_used: 0,
      attempts_remaining: 2,
      selected_option_ids: null,
      transition: null,
      feedback_required: false,
      code: 'ANSWER_FORMAT_UNRESOLVED',
      already_processed: false,
      terminal: false,
      terminal_failure_feedback: null,
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

  it('attaches the trusted result to the matching assessment question for learner feedback', async () => {
    processMessage.mockResolvedValue({
      message_id: DELIVERED_ANSWER_ID,
      assessment_id: DELIVERED_QUESTION_ID,
      processing_state: 'applied',
      answer_outcome: 'retry',
      attempt_number: 1,
      attempts_used: 1,
      attempts_remaining: 1,
      selected_option_ids: ['B'],
      transition: null,
      feedback_required: false,
      code: null,
      already_processed: false,
      terminal: false,
      terminal_failure_feedback: null,
    });
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B', {
        replyToMessageId: DELIVERED_QUESTION_ID,
        assessmentId: DELIVERED_QUESTION_ID,
      });
    });

    const question = room!.messages.find((message) => message.id === DELIVERED_QUESTION_ID) as unknown as {
      answerLifecycle?: { state?: string; assessmentId?: string; attemptsRemaining?: number };
    };
    expect(question.answerLifecycle).toMatchObject({
      state: 'retry',
      assessmentId: DELIVERED_QUESTION_ID,
      attemptsRemaining: 1,
    });
    expect(processMessage).toHaveBeenCalledTimes(1);
  });

  it('matches the trusted assessment ID to its question message and preserves the distinct parent ID', async () => {
    const questionMessageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    initialMessages = [learnerAMessageRow, { ...deliveredQuestionRow, id: questionMessageId }];
    processMessage.mockResolvedValue({
      message_id: DELIVERED_ANSWER_ID,
      assessment_id: DELIVERED_QUESTION_ID,
      processing_state: 'applied',
      answer_outcome: 'retry',
      attempt_number: 1,
      attempts_used: 1,
      attempts_remaining: 1,
      selected_option_ids: ['B'],
      transition: null,
      feedback_required: false,
      code: null,
      already_processed: false,
      terminal: false,
      terminal_failure_feedback: null,
    });
    await mountRoom();

    await act(async () => {
      await room!.sendMessage('B', {
        replyToMessageId: questionMessageId,
        assessmentId: DELIVERED_QUESTION_ID,
      });
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      replyToMessageId: questionMessageId,
      assessmentId: DELIVERED_QUESTION_ID,
    }));
    const answer = room!.messages.find((message) => message.id === DELIVERED_ANSWER_ID);
    expect(answer?.parent_message_id).toBe(questionMessageId);
    const question = room!.messages.find((message) => message.id === questionMessageId) as unknown as {
      publicQuestion?: { id?: string };
      answerLifecycle?: { state?: string; assessmentId?: string };
    };
    expect(question.publicQuestion?.id).toBe(DELIVERED_QUESTION_ID);
    expect(question.answerLifecycle).toMatchObject({
      state: 'retry',
      assessmentId: DELIVERED_QUESTION_ID,
    });
  });

  it('restores persisted learner answer feedback after joining through the idempotent processor', async () => {
    const questionMessageId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    initialMessages = [
      {
        ...deliveredQuestionRow,
        assessment: undefined,
        id: questionMessageId,
        assessment_id: DELIVERED_QUESTION_ID,
        assessment_student_id: LEARNER_A_ID,
      },
      { ...deliveredAnswerRow, parent_message_id: questionMessageId },
      {
        ...deliveredAnswerRow,
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        user_id: '44444444-4444-4444-8444-444444444444',
        parent_message_id: questionMessageId,
      },
    ];
    processMessage.mockResolvedValue({
      message_id: DELIVERED_ANSWER_ID,
      assessment_id: DELIVERED_QUESTION_ID,
      processing_state: 'applied',
      answer_outcome: 'retry',
      attempt_number: 1,
      attempts_used: 1,
      attempts_remaining: 1,
      selected_option_ids: ['B'],
      transition: null,
      feedback_required: false,
      code: null,
      already_processed: true,
      terminal: false,
      terminal_failure_feedback: null,
    });

    await mountRoom();

    expect(processMessage).toHaveBeenCalledTimes(1);
    expect(processMessage).toHaveBeenCalledWith(DELIVERED_ANSWER_ID, DELIVERED_QUESTION_ID);
    const answer = room!.messages.find((message) => message.id === DELIVERED_ANSWER_ID) as unknown as {
      answerLifecycle?: { state?: string; assessmentId?: string; attemptsRemaining?: number };
    };
    const question = room!.messages.find((message) => message.id === questionMessageId) as unknown as {
      publicQuestion?: { id?: string };
      answerLifecycle?: { state?: string; assessmentId?: string; attemptsRemaining?: number };
    };
    expect(answer.answerLifecycle).toMatchObject({
      state: 'retry',
      assessmentId: DELIVERED_QUESTION_ID,
      attemptsRemaining: 1,
    });
    expect(question.publicQuestion?.id).toBe(DELIVERED_QUESTION_ID);
    expect(question.answerLifecycle).toMatchObject({
      state: 'retry',
      assessmentId: DELIVERED_QUESTION_ID,
      attemptsRemaining: 1,
    });
  });

  it('does not route an explicit assessment answer through evidence analysis when processing rejects it', async () => {
    processMessage.mockRejectedValue(new Error('ASSESSMENT_NOT_OPEN: no open assessment'));
    await mountRoom();

    let processingError: unknown;
    await act(async () => {
      try {
        await room!.sendMessage('B', {
          replyToMessageId: DELIVERED_QUESTION_ID,
          assessmentId: DELIVERED_QUESTION_ID,
        });
      } catch (error) {
        processingError = error;
      }
    });

    expect(processingError).toEqual(expect.objectContaining({
      message: expect.stringContaining('ASSESSMENT_NOT_OPEN'),
    }));
    expect(analyzeMessage).not.toHaveBeenCalled();
    expect(room!.messages.filter((message) => message.id === DELIVERED_ANSWER_ID)).toHaveLength(1);
  });

  it('surfaces a server rejection instead of inventing a selection or a failure', async () => {
    processMessage.mockResolvedValue({
      message_id: DELIVERED_ANSWER_ID,
      assessment_id: DELIVERED_QUESTION_ID,
      processing_state: 'rejected',
      answer_outcome: null,
      attempt_number: null,
      attempts_used: 0,
      attempts_remaining: 2,
      selected_option_ids: null,
      transition: null,
      feedback_required: false,
      code: 'ANSWER_FORMAT_UNRESOLVED',
      already_processed: false,
      terminal: false,
      terminal_failure_feedback: null,
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
    expect(answer.answerLifecycle?.state).toBe('rejected');
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

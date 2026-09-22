#!/usr/bin/env node
/**
 * Test responsible for src/contexts/RoomContext.tsx on the teacher transfer-review path:
 * preparation of a candidate, local refusal of an undeliverable turn, single reviewed delivery,
 * and no phantom learner message.
 *
 * Responsibility: prove the prepared focus identity survives to `sendReviewed`, that `itemId`
 * stays a real null (never the text "null"), and that a refused or repeated delivery changes
 * nothing in the room.
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
  DELIVERED_QUESTION_ID,
  LEARNER_A_ID,
  LEARNER_A_MESSAGE_ID,
  LEARNER_B_MESSAGE_ID,
  LEARNER_B_ID,
  TRANSFER_ROOM_ID,
  learnerAMessageRow,
  learnerBMessageRow,
  preparedCandidate,
  preparedTurnResult,
  preparedTutoringTurnResult,
  reviewedDelivery,
  transferChecklist,
  transferRoom,
} from '../../test-support/transferRoomFixtures';
import type { TutorDecisionV3 } from '../../types/assessment';

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

describe('RoomContext teacher transfer review lifecycle', () => {
  let prepareTurn: jest.SpyInstance;
  let sendReviewed: jest.SpyInstance;
  let room: ReturnType<typeof useRoom> | null;

  const roomRow = {
    ...transferRoom,
  };

  const mockTables = (messages: unknown[]) => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: roomRow, error: null }) }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: messages, error: null }),
            }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                { id: 'tutor-1', display_name: 'Tutor', current_role: 'tutor' },
                { id: LEARNER_A_ID, display_name: 'Learner A', current_role: 'student' },
              ],
              error: null,
            }),
          }),
        };
      }
      throw new Error(`Unexpected table mock: ${table}`);
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    room = null;

    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'tutor-1',
        email: 'tutor@example.com',
        display_name: 'Tutor',
        current_role: 'tutor',
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

    // Learner A's message is last in the fetched list, so it is the room's latest student message.
    mockTables([learnerBMessageRow, learnerAMessageRow]);

    (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(transferChecklist);
    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(transferChecklist);

    prepareTurn = jest.spyOn(transferAssessmentService, 'prepareTurn').mockResolvedValue(preparedTurnResult);
    sendReviewed = jest.spyOn(transferAssessmentService, 'sendReviewed').mockResolvedValue(reviewedDelivery);
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

  it('prepares the candidate from the focus student message and unwraps the decision', async () => {
    await mountRoom();

    await act(async () => {
      await room!.generateAIResponse();
    });

    expect(prepareTurn).toHaveBeenCalledWith({
      roomId: TRANSFER_ROOM_ID,
      focusStudentMessageId: LEARNER_A_MESSAGE_ID,
      checklistId: CHECKLIST_ID,
    });
    expect(room!.transferDraft!.decision).toEqual(preparedCandidate);
    expect(room!.transferDraft!.studentId).toBe(LEARNER_A_ID);
    expect(room!.transferDraft!.checklistId).toBe(CHECKLIST_ID);
    expect(room!.transferDraft!.itemId).toBe(CHECKLIST_ITEM_ID);
  });

  it('uses the checklist owner message when another learner posted later', async () => {
    mockTables([learnerAMessageRow, learnerBMessageRow]);
    await mountRoom();

    await act(async () => {
      await room!.generateAIResponse();
    });

    expect(prepareTurn).toHaveBeenCalledWith(expect.objectContaining({
      focusStudentMessageId: LEARNER_A_MESSAGE_ID,
    }));
  });

  it('keeps the tutoring-turn item id as null rather than the text "null"', async () => {
    prepareTurn.mockResolvedValue(preparedTutoringTurnResult);
    await mountRoom();

    await act(async () => {
      await room!.generateAIResponse();
    });

    expect(room!.transferDraft!.itemId).toBeNull();
    expect(room!.transferDraft!.itemId as unknown).not.toBe('null');
  });

  it('sends the edited decision with the prepared scope exactly once', async () => {
    await mountRoom();
    await act(async () => {
      await room!.generateAIResponse();
    });

    const edited: TutorDecisionV3 = {
      ...preparedCandidate,
      response: 'An edited stem asks for a first step.',
      assessment: { ...preparedCandidate.assessment!, stem: 'An edited stem asks for a first step.' },
    };

    await act(async () => {
      await room!.confirmTransferDraft(edited);
    });

    expect(sendReviewed).toHaveBeenCalledTimes(1);
    expect(sendReviewed).toHaveBeenCalledWith({
      reviewedPayload: edited,
      roomId: TRANSFER_ROOM_ID,
      studentId: LEARNER_A_ID,
      checklistId: CHECKLIST_ID,
      itemId: CHECKLIST_ITEM_ID,
      focusStudentMessageId: LEARNER_A_MESSAGE_ID,
    });
    expect(room!.messages.map((message) => message.id)).toContain(DELIVERED_QUESTION_ID);
    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
  });

  it('refuses an assessment turn with no checklist item before calling the service', async () => {
    prepareTurn.mockResolvedValue({ ...preparedTurnResult, item_id: null });
    await mountRoom();
    await act(async () => {
      await room!.generateAIResponse();
    });

    await expect(act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    })).rejects.toThrow(/item/i);

    expect(sendReviewed).not.toHaveBeenCalled();
    expect(room!.messages.map((message) => message.id)).not.toContain(DELIVERED_QUESTION_ID);
    expect(room!.transferDraft).not.toBeNull();
  });

  it('does not deliver twice when a send is already in flight', async () => {
    let release: (value: unknown) => void = () => undefined;
    sendReviewed.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    await mountRoom();
    await act(async () => {
      await room!.generateAIResponse();
    });

    let first: Promise<void> = Promise.resolve();
    let second: Promise<void> = Promise.resolve();
    await act(async () => {
      first = room!.confirmTransferDraft(preparedCandidate);
      second = room!.confirmTransferDraft(preparedCandidate);
      release(reviewedDelivery);
      await Promise.allSettled([first, second]);
    });

    expect(sendReviewed).toHaveBeenCalledTimes(1);
  });

  it('keeps the candidate and adds no phantom message when the server refuses the delivery', async () => {
    sendReviewed.mockRejectedValue(new Error('ASSESSMENT_ALREADY_OPEN: assessment already delivered'));
    await mountRoom();
    await act(async () => {
      await room!.generateAIResponse();
    });

    const before = room!.messages.map((message) => message.id);

    await expect(act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    })).rejects.toThrow('ASSESSMENT_ALREADY_OPEN');

    expect(room!.messages.map((message) => message.id)).toEqual(before);
    expect(room!.transferDraft).not.toBeNull();
  });

  it('merges a repeated delivery result into one visible message', async () => {
    await mountRoom();
    await act(async () => {
      await room!.generateAIResponse();
    });
    await act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    });

    expect(room!.transferDraft).toBeNull();
    const delivered = room!.messages.filter((message) => message.id === DELIVERED_QUESTION_ID);
    expect(delivered).toHaveLength(1);
    expect(room!.messages.map((message) => message.id)).toContain(LEARNER_B_MESSAGE_ID);
    expect(room!.messages.map((message) => message.user_id)).toContain(LEARNER_B_ID);
  });
});

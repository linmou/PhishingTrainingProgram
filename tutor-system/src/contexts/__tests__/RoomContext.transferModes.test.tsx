#!/usr/bin/env node
/**
 * Test responsible for src/contexts/RoomContext.tsx mode handling on the transfer path: room
 * participation stays binary while assessment stays a turn-level concern.
 *
 * Responsibility: prove assessment stays turn-level, manual Guard changes remain room-level, and
 * recovery to tutoring is a reviewed send rather than an unreviewed room-mode mutation.
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { generateTutorSuggestion, getAIConfig } from '../../services/aiService';
import { ChecklistService } from '../../services/checklistService';
import { transferAssessmentService } from '../../services/transferAssessmentService';
import * as guardModeService from '../../services/guardModeService';
import {
  CHECKLIST_ITEM_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  learnerAMessageRow,
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

describe('RoomContext transfer turn modes', () => {
  let sendReviewed: jest.SpyInstance;
  let room: ReturnType<typeof useRoom> | null;

  beforeEach(() => {
    jest.clearAllMocks();
    room = null;
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
              order: jest.fn().mockResolvedValue({ data: [learnerAMessageRow], error: null }),
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
    jest.spyOn(transferAssessmentService, 'analyzeMessage').mockResolvedValue({ applied: [] });
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

  const mountWithCandidate = async (result: Record<string, unknown> | null) => {
    jest.spyOn(transferAssessmentService, 'prepareAssessment').mockResolvedValue(result);
    await mountRoom();
    await act(async () => {
      await room!.generateAIResponse();
    });
  };

  it('keeps the room in tutoring after delivering an assessment turn', async () => {
    await mountWithCandidate(preparedTurnResult);

    await act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    });

    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
    expect(room!.messages.map((message) => message.id)).toContain(DELIVERED_QUESTION_ID);
  });

  it('returns a named setup error when assessment is enabled without a checklist', async () => {
    (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(null);
    await mountRoom();

    await expect(room!.generateAIResponse()).rejects.toMatchObject({
      code: 'TARGET_SETUP_REQUIRED',
    });
  });

  it('does not clear Guard when an assessment delivery is refused', async () => {
    sendReviewed.mockResolvedValue({ ...reviewedDelivery, room: { ...transferRoom, active_response_mode: 'guard' } });
    await mountWithCandidate(preparedTurnResult);

    await act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    });

    expect(room!.currentRoom!.active_response_mode).toBe('guard');
  });

  it('lets a tutor manually move room participation between Guard and tutoring', async () => {
    await mountRoom();
    const setRoomMode = jest.spyOn(guardModeService, 'setRoomResponseMode').mockImplementation(
      async (_roomId, _tutorId, mode) => ({ ...transferRoom, active_response_mode: mode })
    );

    await act(async () => {
      await room!.setResponseMode('guard');
    });
    expect(room!.currentRoom!.active_response_mode).toBe('guard');

    await act(async () => {
      await room!.setResponseMode('tutoring');
    });

    expect(setRoomMode).toHaveBeenNthCalledWith(1, TRANSFER_ROOM_ID, 'tutor-1', 'guard');
    expect(setRoomMode).toHaveBeenNthCalledWith(2, TRANSFER_ROOM_ID, 'tutor-1', 'tutoring');
    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
  });

  it('recovers from Guard through a reviewed tutoring response', async () => {
    await mountRoom();
    const setRoomMode = jest.spyOn(guardModeService, 'setRoomResponseMode').mockResolvedValue({
      ...transferRoom,
      active_response_mode: 'guard',
    });
    const sendReviewed = jest.spyOn(guardModeService, 'sendReviewedTutorResponse').mockResolvedValue({
      message: {
        ...learnerAMessageRow,
        id: 'guard-recovery-message',
        user_id: 'tutor-1',
        user_role: 'tutor',
        content: 'Verify the request through the official portal.',
        parent_message_id: LEARNER_A_MESSAGE_ID,
        response_mode: 'tutoring',
      } as never,
      room: { ...transferRoom, active_response_mode: 'tutoring' },
    });
    jest.spyOn(transferAssessmentService, 'prepareAssessment').mockResolvedValue(null);
    (generateTutorSuggestion as jest.Mock).mockResolvedValue({
      success: true,
      suggestion: 'Verify the request through the official portal.',
      decision: {
        mode: 'guard',
        instruction: 'guard',
        mode_reason: 'The learner needs a protective response.',
        suggested_response: 'Verify the request through the official portal.',
      },
      contextMessages: [LEARNER_A_MESSAGE_ID],
    });

    await act(async () => {
      await room!.setResponseMode('guard');
    });
    await act(async () => {
      await room!.generateAIResponse();
    });
    expect(room!.finalMode).toBe('guard');

    await act(async () => {
      room!.updateFinalMode('tutoring');
    });
    expect(room!.currentRoom!.active_response_mode).toBe('guard');

    await act(async () => {
      await room!.sendMessage('Verify the request through the official portal.');
    });

    expect(setRoomMode).toHaveBeenCalledTimes(1);
    expect(sendReviewed).toHaveBeenCalledWith(expect.objectContaining({
      rawDecision: expect.objectContaining({ mode: 'guard' }),
      finalMode: 'tutoring',
      finalResponse: 'Verify the request through the official portal.',
    }));
    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
  });

  it('refuses an assessment draft with a changed target', async () => {
    await mountWithCandidate(preparedTurnResult);
    const incompatible = {
      ...preparedCandidate,
      target_item_id: 'another-target',
    };

    let error: unknown = null;
    await act(async () => {
      try {
        await room!.confirmTransferDraft(incompatible);
      } catch (caught) {
        error = caught;
      }
    });

    expect(String(error)).toMatch(/target/i);
    expect(sendReviewed).not.toHaveBeenCalled();
    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
  });

  it('never turns a refused assessment into a room mode', async () => {
    jest.spyOn(transferAssessmentService, 'prepareAssessment').mockResolvedValue({ ...preparedTurnResult, item_id: null });
    await mountRoom();
    await expect(act(async () => { await room!.generateAIResponse(); })).rejects.toThrow(/candidate/i);
    expect(sendReviewed).not.toHaveBeenCalled();
    expect(['tutoring', 'guard']).toContain(room!.currentRoom!.active_response_mode);
    expect(CHECKLIST_ITEM_ID).toBeTruthy();
    expect(room!.transferDraft).toBeNull();
  });
});

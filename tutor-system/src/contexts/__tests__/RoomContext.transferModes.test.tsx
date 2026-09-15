#!/usr/bin/env node
/**
 * Test responsible for src/contexts/RoomContext.tsx mode handling on the transfer path: room
 * participation stays binary while assessment stays a turn-level concern.
 *
 * Responsibility: prove a delivered assessment leaves the room in tutoring, a Guard turn sets
 * guard, a tutoring turn keeps its null item id, and an incompatible reviewed payload is refused
 * before any delivery call.
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
  CHECKLIST_ITEM_ID,
  DELIVERED_QUESTION_ID,
  LEARNER_A_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  learnerAMessageRow,
  preparedCandidate,
  preparedTurnResult,
  preparedTutoringTurnResult,
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
    sendReviewed = jest.spyOn(transferAssessmentService, 'sendReviewed').mockResolvedValue(reviewedDelivery);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const mountWithCandidate = async (result: Record<string, unknown>) => {
    jest.spyOn(transferAssessmentService, 'prepareTurn').mockResolvedValue(result);
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

  it('keeps the room in tutoring after delivering an assessment turn', async () => {
    await mountWithCandidate(preparedTurnResult);

    await act(async () => {
      await room!.confirmTransferDraft(preparedCandidate);
    });

    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
    expect(room!.messages.map((message) => message.id)).toContain(DELIVERED_QUESTION_ID);
  });

  it('adopts guard when the server returns a guard room after the turn', async () => {
    sendReviewed.mockResolvedValue({ ...reviewedDelivery, room: { ...transferRoom, active_response_mode: 'guard' } });
    await mountWithCandidate({ ...preparedTurnResult, item_id: null, decision: preparedTutoringTurnResult.decision });

    await act(async () => {
      await room!.confirmTransferDraft(preparedTutoringTurnResult.decision as never);
    });

    expect(room!.currentRoom!.active_response_mode).toBe('guard');
  });

  it('sends a tutoring turn with a real null item id, never the text "null"', async () => {
    await mountWithCandidate(preparedTutoringTurnResult);

    expect(room!.transferDraft!.itemId).toBeNull();

    await act(async () => {
      await room!.confirmTransferDraft(preparedTutoringTurnResult.decision as never);
    });

    expect(sendReviewed).toHaveBeenCalledWith(expect.objectContaining({ itemId: null }));
    expect(JSON.stringify(sendReviewed.mock.calls[0][0])).not.toContain('"null"');
  });

  it('sends an edited transfer tutoring draft as a reply to its focus learner message', async () => {
    await mountWithCandidate(preparedTutoringTurnResult);

    await act(async () => {
      await room!.sendMessage('A familiar display name can still be copied.');
    });

    expect(sendReviewed).toHaveBeenCalledWith(expect.objectContaining({
      reviewedPayload: expect.objectContaining({
        response: 'A familiar display name can still be copied.',
        decision: expect.objectContaining({ mode: 'tutoring' }),
      }),
      focusStudentMessageId: LEARNER_A_MESSAGE_ID,
      itemId: null,
    }));
    expect(room!.transferDraft).toBeNull();
  });

  it('refuses assessment mode paired with a teaching instruction', async () => {
    await mountWithCandidate(preparedTurnResult);
    const incompatible = {
      ...preparedCandidate,
      decision: { ...preparedCandidate.decision, instruction: 'scaffolding' as const },
    };

    let error: unknown = null;
    await act(async () => {
      try {
        await room!.confirmTransferDraft(incompatible);
      } catch (caught) {
        error = caught;
      }
    });

    expect(String(error)).toMatch(/transfer_assess/);
    expect(sendReviewed).not.toHaveBeenCalled();
    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
  });

  it('never turns a refused assessment into a room mode', async () => {
    await mountWithCandidate({ ...preparedTurnResult, item_id: null });

    let error: unknown = null;
    await act(async () => {
      try {
        await room!.confirmTransferDraft(preparedCandidate);
      } catch (caught) {
        error = caught;
      }
    });

    expect(String(error)).toMatch(/item/i);
    expect(sendReviewed).not.toHaveBeenCalled();
    expect(['tutoring', 'guard']).toContain(room!.currentRoom!.active_response_mode);
    expect(CHECKLIST_ITEM_ID).toBeTruthy();
    expect(LEARNER_A_MESSAGE_ID).toBe(room!.transferDraft!.focusStudentMessageId);
  });
});

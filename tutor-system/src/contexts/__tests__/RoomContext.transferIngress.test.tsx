#!/usr/bin/env node
/**
 * Test responsible for src/contexts/RoomContext.tsx room ingress on the transfer path: realtime
 * inserts, polling, reconnect catch-up, and the room participation mode.
 *
 * Responsibility: prove one visible record per persisted identity across every ingress source and
 * that an unrecognized room participation value is never adopted as a room mode.
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { getAIConfig } from '../../services/aiService';
import { ChecklistService } from '../../services/checklistService';
import {
  LEARNER_A_MESSAGE_ID,
  LEARNER_B_MESSAGE_ID,
  TRANSFER_ROOM_ID,
  learnerAMessageRow,
  learnerBMessageRow,
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

type RealtimeHandler = (payload: { new: Record<string, unknown> }) => void;

const RoomProbe: React.FC<{ onReady: (room: ReturnType<typeof useRoom>) => void }> = ({ onReady }) => {
  const room = useRoom();
  React.useEffect(() => {
    onReady(room);
  }, [onReady, room]);
  return null;
};

describe('RoomContext transfer ingress', () => {
  let room: ReturnType<typeof useRoom> | null;
  let fetchedMessages: unknown[];
  let realtimeHandlers: Record<string, RealtimeHandler>;
  let roomsUpdateHandler: RealtimeHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    room = null;
    fetchedMessages = [learnerBMessageRow];
    realtimeHandlers = {};

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

    (supabase.channel as jest.Mock).mockImplementation(() => {
      const channel: {
        on: jest.Mock;
        subscribe: jest.Mock;
        unsubscribe: jest.Mock;
        send: jest.Mock;
      } = {
        on: jest.fn((type: string, filter: { table?: string; event?: string }, handler: RealtimeHandler) => {
          const key = `${filter?.table ?? type}:${filter?.event ?? ''}`;
          realtimeHandlers[key] = handler;
          return channel;
        }),
        subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn(),
        send: jest.fn(),
      };
      return channel;
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockImplementation(async () => ({ data: { ...transferRoom }, error: null })),
              }),
            }),
          }),
        };
      }
      if (table === 'messages') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockImplementation(async () => ({ data: fetchedMessages, error: null })),
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

    (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(transferChecklist);
    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(transferChecklist);
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
    // The realtime channel is created once the room is known.
    roomsUpdateHandler = realtimeHandlers['rooms:UPDATE'];
    expect(roomsUpdateHandler).toBeDefined();
  };

  const realtimeInsert = async (row: Record<string, unknown>) => {
    const handler = realtimeHandlers['messages:INSERT'];
    expect(handler).toBeDefined();
    await act(async () => {
      handler({ new: row });
    });
  };

  it('keeps a realtime insert that arrives before the join fetch completes', async () => {
    render(
      <RoomProvider>
        <RoomProbe onReady={(api) => { room = api; }} />
      </RoomProvider>
    );
    await waitFor(() => expect(room).not.toBeNull());
    await act(async () => {
      await room!.joinRoom(TRANSFER_ROOM_ID);
    });

    await realtimeInsert(learnerAMessageRow);
    expect(room!.messages.map((message) => message.id)).toContain(LEARNER_A_MESSAGE_ID);

    // A later poll that does not know about the realtime row must not drop it.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2100));
    });

    expect(room!.messages.map((message) => message.id)).toContain(LEARNER_A_MESSAGE_ID);
  });

  it('collapses a duplicate realtime insert into one visible message', async () => {
    await mountRoom();

    await realtimeInsert(learnerAMessageRow);
    await realtimeInsert(learnerAMessageRow);

    expect(room!.messages.filter((message) => message.id === LEARNER_A_MESSAGE_ID)).toHaveLength(1);
  });

  it('converges to one record per identity across a reconnect catch-up', async () => {
    await mountRoom();
    await realtimeInsert(learnerAMessageRow);

    await act(async () => {
      await room!.joinRoom(TRANSFER_ROOM_ID);
    });

    const ids = room!.messages.map((message) => message.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(LEARNER_A_MESSAGE_ID);
    expect(ids).toContain(LEARNER_B_MESSAGE_ID);
  });

  it('never adopts an unrecognized room participation value', async () => {
    await mountRoom();
    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');

    await act(async () => {
      roomsUpdateHandler({ new: { ...transferRoom, title: 'Renamed room', active_response_mode: 'assessment' } });
    });

    expect(room!.currentRoom!.active_response_mode).toBe('tutoring');
    expect(room!.currentRoom!.title).toBe('Renamed room');
  });

  it('adopts a legitimate guard participation change', async () => {
    await mountRoom();

    await act(async () => {
      roomsUpdateHandler({ new: { ...transferRoom, active_response_mode: 'guard' } });
    });

    expect(room!.currentRoom!.active_response_mode).toBe('guard');
  });
});

/**
 * Test responsible for src/contexts/RoomContext.tsx and src/services/transferAssessmentService.ts
 * on retried learner posts (issue #111, AD-7, NFR-5, FR-38).
 *
 * Responsibility: prove that a retry of the same learner action reuses that action's request id,
 * so the server's replay lookup returns the original row instead of storing a second one, and that
 * the id is dropped once the stored row is seen by any route (response, realtime or catch-up), so a
 * later identical message is a new action. The real service runs; only the assessment-api Edge
 * Function is replaced by a fake that, like post_assessment_message_v2, replays a known request id
 * and loses one response on request.
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
  DELIVERED_QUESTION_ID,
  LEARNER_A_ID,
  TRANSFER_ROOM_ID,
  deliveredAnswerRow,
  deliveredQuestionRow,
  learnerAMessageRow,
  transferChecklist,
  transferRoom,
} from '../../test-support/transferRoomFixtures';

jest.mock('../../services/supabase', () => ({
  supabase: { channel: jest.fn(), from: jest.fn(), storage: { from: jest.fn() }, functions: { invoke: jest.fn() } },
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
  OAI_MODEL: 'qwen3.5-flash',
}));

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../../services/checklistService', () => ({
  ChecklistService: {
    analyzeStudentMessages: jest.fn(),
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

type StoredRow = Record<string, unknown> & { id: string; assessment_request_id: string };

/** A fake assessment-api: stores learner posts and replays a known request id, as M13:212-216 does. */
function createFakeServer() {
  const rows: StoredRow[] = [];
  const postRequestIds: string[] = [];
  let loseNextPostResponse = false;
  const invoke = jest.fn(async ({ body }: { body: Record<string, unknown> }) => {
    const ok = (data: unknown) => ({ data: { ok: true, data }, error: null });
    switch (body.operation) {
      case 'join_room':
        return ok({ room_id: TRANSFER_ROOM_ID, learner_id: LEARNER_A_ID, room_role: 'student' });
      case 'post_message': {
        const requestId = String(body.request_id);
        postRequestIds.push(requestId);
        let row = rows.find((candidate) => candidate.assessment_request_id === requestId);
        if (!row) {
          row = {
            ...deliveredAnswerRow,
            id: `answer-${rows.length + 1}`,
            content: String(body.content),
            parent_message_id: (body.parent_message_id as string | null) ?? null,
            assessment_id: (body.assessment_id as string | null) ?? null,
            assessment_selected_option_ids: body.selected_option_ids ?? null,
            assessment_request_id: requestId,
          } as StoredRow;
          rows.push(row);
        }
        if (loseNextPostResponse) {
          // The row committed, but the browser never hears back.
          loseNextPostResponse = false;
          return { data: null, error: { message: 'Failed to send a request to the Edge Function' } };
        }
        return ok({ message: row });
      }
      case 'process_message':
        return ok({
          message_id: body.message_id, assessment_id: body.assessment_id, processing_state: 'deferred',
          answer_outcome: null, attempt_number: null, attempts_used: 0, attempts_remaining: 2,
          selected_option_ids: null, terminal: false, transition: null, feedback_required: false,
          code: 'PROGRESSION_LOCKED', already_processed: false, terminal_failure_feedback: null, result_message: null,
        });
      default:
        return ok({});
    }
  });
  return {
    rows,
    postRequestIds,
    invoke,
    loseNextPostResponse: () => { loseNextPostResponse = true; },
  };
}

describe('RoomContext retried learner posts keep their request id', () => {
  let room: ReturnType<typeof useRoom> | null;
  let server: ReturnType<typeof createFakeServer>;
  let channel: { on: jest.Mock; subscribe: jest.Mock; unsubscribe: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    room = null;
    server = createFakeServer();
    ((supabase as unknown as { functions: { invoke: jest.Mock } }).functions.invoke)
      .mockImplementation((_name: string, options: { body: Record<string, unknown> }) => server.invoke(options));
    (ChecklistService.analyzeStudentMessages as jest.Mock).mockResolvedValue(undefined);
    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(transferChecklist);
    (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(transferChecklist);
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: LEARNER_A_ID, email: 'learner-a@example.com', display_name: 'Learner A', current_role: 'student',
        status: 'active', created_at: '2026-09-12T08:00:00Z', updated_at: '2026-09-12T08:00:00Z',
      },
      loading: false,
    });
    (getAIConfig as jest.Mock).mockResolvedValue(null);
    channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis(), unsubscribe: jest.fn() };
    (supabase.channel as jest.Mock).mockReturnValue(channel);
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rooms') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { ...transferRoom }, error: null }),
        }) }) }) };
      }
      if (table === 'messages') {
        return { select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(), gt: jest.fn().mockReturnThis(),
          // Catch-up reads see every row the server stored, including one whose response was lost.
          order: jest.fn().mockImplementation(async () => (
            { data: [learnerAMessageRow, deliveredQuestionRow, ...server.rows], error: null })),
        }) }) };
      }
      if (table === 'users') {
        return { select: jest.fn().mockReturnValue({ in: jest.fn().mockResolvedValue({ data: [], error: null }) }) };
      }
      throw new Error(`Unexpected table mock: ${table}`);
    });
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

  /** Runs one learner action and returns its error message, or null when it succeeded. */
  const attempt = async (action: () => Promise<void>): Promise<string | null> => {
    let failure: string | null = null;
    await act(async () => {
      await action().catch((error: Error) => { failure = error.message; });
    });
    return failure;
  };

  /** Delivers a stored row through the room's realtime INSERT/UPDATE subscription. */
  const realtimeDeliver = async (row: Record<string, unknown>, event: 'INSERT' | 'UPDATE' = 'INSERT') => {
    const call = channel.on.mock.calls.find(([type, filter]) =>
      type === 'postgres_changes' && filter.table === 'messages' && filter.event === event);
    expect(call).toBeDefined();
    await act(async () => { call![2]({ new: row }); });
  };

  /** Runs the subscription's catch-up read, as happens when the channel (re)subscribes. */
  const catchUp = async () => {
    const onStatus = channel.subscribe.mock.calls[channel.subscribe.mock.calls.length - 1]?.[0];
    expect(typeof onStatus).toBe('function');
    await act(async () => { onStatus('SUBSCRIBED'); });
  };

  const answer = (selected: Array<'A' | 'B' | 'C' | 'D'>) => room!.sendMessage(selected.join(','), {
    replyToMessageId: DELIVERED_QUESTION_ID,
    assessmentId: DELIVERED_QUESTION_ID,
    selectedOptionIds: selected,
  });

  it('reuses one request id when the learner retries an answer whose response was lost', async () => {
    await mountRoom();

    server.loseNextPostResponse();
    expect(await attempt(() => answer(['A']))).toMatch(/Edge Function/);
    expect(server.rows).toHaveLength(1);

    // "Your answer could not be submitted. Please try again." -> the learner presses Submit again.
    await act(async () => { await answer(['A']); });

    expect(server.postRequestIds).toHaveLength(2);
    expect(new Set(server.postRequestIds).size).toBe(1);
    expect(server.rows).toHaveLength(1);
    expect(room!.messages.filter((message) => message.user_id === LEARNER_A_ID &&
      message.parent_message_id === DELIVERED_QUESTION_ID)).toHaveLength(1);
  });

  it('mints a new request id when the learner changes the selection before resubmitting', async () => {
    await mountRoom();

    server.loseNextPostResponse();
    expect(await attempt(() => answer(['A']))).toMatch(/Edge Function/);
    await act(async () => { await answer(['C']); });

    expect(server.postRequestIds).toHaveLength(2);
    expect(server.postRequestIds[0]).not.toBe(server.postRequestIds[1]);
  });

  it('reuses one request id when a plain learner message is retried after a lost response', async () => {
    await mountRoom();

    server.loseNextPostResponse();
    expect(await attempt(() => room!.sendMessage('I would check the sender.'))).toMatch(/Edge Function/);
    await act(async () => { await room!.sendMessage('I would check the sender.'); });

    expect(new Set(server.postRequestIds).size).toBe(1);
    expect(server.rows).toHaveLength(1);
  });

  it('discards the request id after a successful post so the next action is new', async () => {
    await mountRoom();

    await act(async () => { await room!.sendMessage('ok'); });
    await act(async () => { await room!.sendMessage('ok'); });

    expect(server.postRequestIds).toHaveLength(2);
    expect(server.postRequestIds[0]).not.toBe(server.postRequestIds[1]);
    expect(server.rows).toHaveLength(2);
  });

  it('drops the id when a post whose response was lost arrives by realtime, so the next identical message is new', async () => {
    await mountRoom();

    server.loseNextPostResponse();
    expect(await attempt(() => room!.sendMessage('ok'))).toMatch(/Edge Function/);
    await realtimeDeliver(server.rows[0]);
    await waitFor(() => expect(room!.messages.map((message) => message.id)).toContain(server.rows[0].id));

    // The learner sees the first "ok" and later says "ok" again: a genuinely new message.
    await act(async () => { await room!.sendMessage('ok'); });

    expect(server.postRequestIds).toHaveLength(2);
    expect(server.postRequestIds[0]).not.toBe(server.postRequestIds[1]);
    expect(server.rows).toHaveLength(2);
  });

  it('drops the id when an answer whose response was lost arrives by catch-up, so attempt 2 is new', async () => {
    await mountRoom();

    server.loseNextPostResponse();
    expect(await attempt(() => answer(['A']))).toMatch(/Edge Function/);
    await catchUp();
    await waitFor(() => expect(room!.messages.map((message) => message.id)).toContain(server.rows[0].id));

    // Attempt 2 with the same option is a new answer, not a replay of attempt 1.
    await act(async () => { await answer(['A']); });

    expect(server.postRequestIds).toHaveLength(2);
    expect(server.postRequestIds[0]).not.toBe(server.postRequestIds[1]);
    expect(server.rows).toHaveLength(2);
  });

  it('keeps the id when only an earlier identical message is seen again before the retry', async () => {
    await mountRoom();

    await act(async () => { await room!.sendMessage('ok'); });
    server.loseNextPostResponse();
    expect(await attempt(() => room!.sendMessage('ok'))).toMatch(/Edge Function/);
    // The first "ok" was already on screen when the second was sent; seeing it again settles nothing.
    await realtimeDeliver(server.rows[0], 'UPDATE');
    await act(async () => { await room!.sendMessage('ok'); });

    expect(server.postRequestIds).toHaveLength(3);
    expect(server.postRequestIds[1]).not.toBe(server.postRequestIds[0]);
    expect(server.postRequestIds[2]).toBe(server.postRequestIds[1]);
    expect(server.rows).toHaveLength(2);
  });
});

#!/usr/bin/env node
/**
 * Test responsibility: verify simplifiedAIContext.ts combines current room data and
 * saved discussion without the retired cached ai_conversation_contexts contract.
 */

import { buildAIContextFromExistingData } from '../simplifiedAIContext';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../transferAssessmentService', () => ({
  transferAssessmentService: { readReview: jest.fn() },
}));

const room = {
  title: 'Phishing Email Detection Training',
  description: 'Learn to identify suspicious emails',
  pre_populated_dialogue: { posts: [{ content: 'Check this bank email.' }] },
  created_at: '2024-01-15T10:00:00Z',
};

function installData(
  roomData: typeof room = room,
  savedMessages: Array<{ id: string; content: string; user_role: string; created_at: string }> = [],
) {
  const roomQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: roomData, error: null }),
  };
  const messagesQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    range: jest.fn()
      .mockResolvedValueOnce({ data: savedMessages, error: null })
      .mockResolvedValue({ data: [], error: null }),
  };
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'rooms') return roomQuery;
    if (table === 'messages') return messagesQuery;
    throw new Error(`Unexpected context table: ${table}`);
  });
  return { roomQuery, messagesQuery };
}

describe('Active room and conversation context integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('combines scenario metadata, the shared example and saved discussion', async () => {
    installData(room, [{
      id: 'student-message', content: 'The domain looks unfamiliar.',
      user_role: 'student', created_at: '2024-01-15T10:05:00Z',
    }]);

    const context = await buildAIContextFromExistingData('room-1');

    expect(context).toEqual([
      {
        role: 'system',
        content: `Training scenario: ${room.title} — ${room.description}`,
        timestamp: Date.parse(room.created_at) / 1000,
      },
      {
        role: 'user', content: 'Student shared for analysis: Check this bank email.',
        timestamp: Date.parse(room.created_at) / 1000 + 1,
      },
      {
        role: 'user', content: 'Student: The domain looks unfamiliar.',
        timestamp: Date.parse('2024-01-15T10:05:00Z') / 1000,
      },
    ]);
  });

  it('preserves student, tutor and observer role attribution', async () => {
    installData(room, ['student', 'tutor', 'observer'].map((user_role, index) => ({
      id: `message-${index}`, content: `Saved ${user_role} turn`, user_role,
      created_at: `2024-01-15T10:0${index + 1}:00Z`,
    })));

    const context = await buildAIContextFromExistingData('room-1');

    expect(context.slice(2).map(({ role, content }) => ({ role, content }))).toEqual([
      { role: 'user', content: 'Student: Saved student turn' },
      { role: 'assistant', content: 'Tutor: Saved tutor turn' },
      { role: 'user', content: 'Observer: Saved observer turn' },
    ]);
  });

  it('retains room context and the shared example when discussion is empty', async () => {
    const { messagesQuery } = installData();

    const context = await buildAIContextFromExistingData('empty-room');

    expect(context).toHaveLength(2);
    expect(messagesQuery.range).toHaveBeenCalledTimes(1);
    expect(context.map(message => message.role)).toEqual(['system', 'user']);
  });

  it('reads current source tables on each call instead of using or writing a context cache', async () => {
    const { roomQuery } = installData();
    await buildAIContextFromExistingData('room-1');
    roomQuery.single.mockResolvedValueOnce({
      data: { ...room, description: 'Updated scenario' }, error: null,
    });

    const context = await buildAIContextFromExistingData('room-1');

    expect(context[0].content).toBe(`Training scenario: ${room.title} — Updated scenario`);
    expect(roomQuery.single).toHaveBeenCalledTimes(2);
    expect((supabase.from as jest.Mock).mock.calls.map(([table]) => table))
      .toEqual(['rooms', 'messages', 'rooms', 'messages']);
  });

  it('propagates room read failure before requesting discussion data', async () => {
    const { roomQuery } = installData();
    const error = { code: 'PGRST116', message: 'Room unavailable' };
    roomQuery.single.mockResolvedValueOnce({ data: null, error });

    await expect(buildAIContextFromExistingData('missing-room')).rejects.toEqual(error);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('propagates message read failure instead of returning incomplete context', async () => {
    const { messagesQuery } = installData();
    const error = { message: 'Discussion unavailable' };
    messagesQuery.range.mockReset().mockResolvedValueOnce({ data: null, error });

    await expect(buildAIContextFromExistingData('room-1')).rejects.toEqual(error);
  });
});

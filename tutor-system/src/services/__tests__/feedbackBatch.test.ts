// Responsible for supabase.ts batched feedback reads: aggregates, RLS query scope, row pagination, bounded concurrency and request benchmarks.
import { supabase, getMessagesFeedbackStats, getMessageFeedbackStats, getUserMessageFeedback } from '../supabase';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ from: jest.fn() })) }));

const from = supabase.from as jest.Mock;
let calls: any[];
let active: number;
let peak: number;
let rows: any[];
let delay = 0;
let failure: any = null;

beforeEach(() => {
  calls = []; active = 0; peak = 0; rows = []; delay = 0; failure = null;
  from.mockImplementation(() => {
    const query: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn(async (start, end) => {
        calls.push({ room: query.eq.mock.calls, ids: query.in.mock.calls[0][1], start, end });
        active++; peak = Math.max(peak, active);
        if (delay) await new Promise(done => setTimeout(done, delay));
        active--;
        return { data: rows.slice(start, end + 1), error: failure };
      }),
      single: jest.fn(async () => {
        calls.push({ legacy: true });
        if (delay) await new Promise(done => setTimeout(done, delay));
        return { data: null, error: null };
      }),
      then: (resolve: any) => {
        calls.push({ legacy: true });
        return new Promise(done => setTimeout(() => done({ data: [], error: null }), delay)).then(resolve);
      }
    };
    return query;
  });
});

it('computes all existing rating semantics including current-user ratings and explicit empty entries', async () => {
  rows = [
    { message_id: 'one', user_id: 'self', feedback_type: 'like', rating: 5 },
    { message_id: 'one', user_id: 'other', feedback_type: 'like', rating: 3 },
    { message_id: 'one', user_id: 'third', feedback_type: 'dislike', rating: 1 }
  ];
  const result = await getMessagesFeedbackStats('room', 'self', ['one', 'empty', 'one', 'prepop-1', 'temp-1']);
  expect(result.one).toEqual({
    message_id: 'one', total_feedback_count: 3, like_count: 2, dislike_count: 1,
    average_like_rating: 4, average_dislike_rating: 1, overall_average_rating: 3,
    user_feedback: { feedback_type: 'like', rating: 5 }
  });
  expect(result.empty).toMatchObject({ total_feedback_count: 0, overall_average_rating: null, user_feedback: null });
  expect(Object.keys(result)).toEqual(['one', 'empty']);
  expect(calls).toEqual([{ room: [['room_id', 'room']], ids: ['one', 'empty'], start: 0, end: 999 }]);
});

it('pages high feedback cardinality instead of truncating totals at the server row limit', async () => {
  rows = Array.from({ length: 1001 }, (_, i) => ({ message_id: 'one', user_id: `${i}`, feedback_type: 'dislike', rating: 2 }));
  const result = await getMessagesFeedbackStats('room', '1000', ['one']);
  expect(result.one).toMatchObject({ total_feedback_count: 1001, dislike_count: 1001, overall_average_rating: 2,
    user_feedback: { feedback_type: 'dislike', rating: 2 } });
  expect(calls.map(call => call.start)).toEqual([0, 1000]);
});

it('skips empty and synthetic-only batches and propagates authorization/network failures', async () => {
  expect(await getMessagesFeedbackStats('room', 'self', ['temp-1', 'prepop-1'])).toEqual({});
  expect(calls).toHaveLength(0);
  failure = { message: 'permission denied' };
  await expect(getMessagesFeedbackStats('room', 'self', ['one'])).rejects.toEqual(failure);
});

it.each([10, 100, 1000])('benchmarks actual old/new read paths for %i messages with 5ms simulated network latency', async count => {
  delay = 5;
  const ids = Array.from({ length: count }, (_, i) => `message-${i}`);
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const oldStart = performance.now();
  await Promise.all(ids.map(async id => {
    await getMessageFeedbackStats(id);
    await getUserMessageFeedback(id, 'self');
  }));
  const oldMs = performance.now() - oldStart;
  const oldCalls = calls.length;
  calls = [];
  const start = performance.now();
  await getMessagesFeedbackStats('room', 'self', ids);
  const newMs = performance.now() - start;
  log.mockRestore();
  console.info('FEEDBACK_BENCHMARK', JSON.stringify({ count, simulatedNetworkMs: delay, oldCalls, oldMs, newCalls: calls.length, newMs, peak }));
  expect(oldCalls).toBe(count * 2);
  expect(calls).toHaveLength(Math.ceil(count / 100));
  expect(peak).toBeLessThanOrEqual(3);
  expect(calls.every(call => call.ids.length <= 100)).toBe(true);
});

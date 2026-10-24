// Responsible for useMessageFeedback.ts: batching, cache isolation, overlapping invalidation and stale async reads.
import { act, renderHook, waitFor } from '@testing-library/react';
import { useMessageFeedback } from '../useMessageFeedback';
import { getMessagesFeedbackStats } from '../../services/supabase';

jest.mock('../../services/supabase', () => ({ getMessagesFeedbackStats: jest.fn() }));

const stats = (id: string, count = 0) => ({
  message_id: id, total_feedback_count: count, like_count: count, dislike_count: 0,
  average_like_rating: count ? 5 : null, average_dislike_rating: null,
  overall_average_rating: count ? 5 : null, user_feedback: null
});
const read = getMessagesFeedbackStats as jest.Mock;
const deferred = () => {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>(done => { resolve = done; });
  return { promise, resolve };
};

beforeEach(() => {
  read.mockReset().mockImplementation(async (_room, _user, ids: string[]) =>
    Object.fromEntries(ids.map(id => [id, stats(id)])));
});

it('loads empty entries once, coalesces callers and handles replacement messages of equal length', async () => {
  const messages = [{ id: 'one', room_id: 'room' }, { id: 'prepop-1' }, { id: 'temp-1' }];
  const { result, rerender } = renderHook(({ rows }) => useMessageFeedback('room', 'user', rows), {
    initialProps: { rows: messages }
  });
  await waitFor(() => expect(result.current.messageFeedbackStats.one).toEqual(stats('one')));
  await act(async () => {
    await Promise.all([result.current.getMessageFeedbackStats('one'), result.current.getMessageFeedbackStats('one')]);
  });
  rerender({ rows: [...messages] });
  expect(read).toHaveBeenCalledTimes(1);
  expect(read).toHaveBeenCalledWith('room', 'user', ['one']);
  rerender({ rows: [{ id: 'two' }, { id: 'prepop-1' }, { id: 'temp-1' }] });
  await waitFor(() => expect(result.current.messageFeedbackStats.two).toEqual(stats('two')));
  expect(read).toHaveBeenCalledTimes(2);
});

it('coalesces notifications before a read and follows an in-flight invalidation only once for the affected message', async () => {
  const { result } = renderHook(() => useMessageFeedback('room', 'user', [{ id: 'one' }, { id: 'two' }]));
  await waitFor(() => expect(result.current.messageFeedbackStats.two).toBeDefined());
  const pending = deferred();
  read.mockImplementationOnce(() => pending.promise);
  let done!: Promise<any>;
  act(() => {
    done = result.current.refreshMessageFeedbackStats('one');
    expect(result.current.refreshMessageFeedbackStats('one')).toBe(done);
  });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  act(() => {
    expect(result.current.refreshMessageFeedbackStats('one')).toBe(done);
    result.current.refreshMessageFeedbackStats('one');
  });
  read.mockResolvedValueOnce({ one: stats('one', 2) });
  await act(async () => { pending.resolve({ one: stats('one', 1) }); await done; });
  expect(read).toHaveBeenCalledTimes(3);
  expect(read.mock.calls.slice(1).map(call => call[2])).toEqual([['one'], ['one']]);
  expect(result.current.messageFeedbackStats.one.total_feedback_count).toBe(2);
});

it('isolates users and rooms and ignores old results and callbacks after rapid switches or unmount', async () => {
  const pending = deferred();
  read.mockImplementationOnce(() => pending.promise);
  const { result, rerender, unmount } = renderHook(({ room, user }) =>
    useMessageFeedback(room, user, [{ id: 'same', room_id: room }]), {
    initialProps: { room: 'a', user: 'first' }
  });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  const oldRefresh = result.current.refreshMessageFeedbackStats;
  rerender({ room: 'b', user: 'first' });
  expect(result.current.messageFeedbackStats).toEqual({});
  await waitFor(() => expect(result.current.messageFeedbackStats.same).toEqual(stats('same')));
  rerender({ room: 'b', user: 'second' });
  expect(result.current.messageFeedbackStats).toEqual({});
  await waitFor(() => expect(read).toHaveBeenCalledTimes(3));
  await act(async () => { pending.resolve({ same: stats('same', 99) }); await oldRefresh('same'); });
  expect(result.current.messageFeedbackStats.same.total_feedback_count).toBe(0);
  expect(read).toHaveBeenLastCalledWith('b', 'second', ['same']);
  const refresh = result.current.refreshMessageFeedbackStats;
  unmount();
  expect(await refresh('same')).toBeNull();
  expect(read).toHaveBeenCalledTimes(3);
});

it('keeps failed reads unloaded and permits explicit retry', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  read.mockRejectedValueOnce(new Error('denied'));
  const rows = [{ id: 'one' }];
  const { result } = renderHook(() => useMessageFeedback('room', 'user', rows));
  await waitFor(() => expect(log).toHaveBeenCalled());
  expect(result.current.messageFeedbackStats.one).toBeUndefined();
  await act(async () => { await result.current.getMessageFeedbackStats('one'); });
  expect(result.current.messageFeedbackStats.one).toEqual(stats('one'));
  log.mockRestore();
});

it('does not restore cleared feedback from a read already in flight', async () => {
  const pending = deferred();
  read.mockImplementationOnce(() => pending.promise);
  const rows = [{ id: 'one' }];
  const { result, rerender } = renderHook(({ messages }) => useMessageFeedback('room', 'user', messages), {
    initialProps: { messages: rows }
  });
  await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  act(() => { result.current.resetFeedback(); });
  rerender({ messages: [] });
  await act(async () => { pending.resolve({ one: stats('one', 1) }); });
  expect(result.current.messageFeedbackStats).toEqual({});
  await act(async () => { await result.current.getMessageFeedbackStats('one'); });
  expect(result.current.messageFeedbackStats.one).toEqual(stats('one'));
});

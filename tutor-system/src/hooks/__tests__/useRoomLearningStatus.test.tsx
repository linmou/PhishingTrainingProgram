import { act, renderHook, waitFor } from '@testing-library/react';
import { supabase } from '../../services/supabase';
import { useRoomLearningStatus } from '../useRoomLearningStatus';
import { readRoomLearningStatus } from '../../services/roomLearningStatusService';

jest.mock('../../services/supabase', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));
jest.mock('../../services/roomLearningStatusService', () => ({ readRoomLearningStatus: jest.fn() }));
const read = readRoomLearningStatus as jest.MockedFunction<typeof readRoomLearningStatus>;
const saved = { room: { learnerId: 'learner', learnerName: 'Learner', joinedAt: '2026-11-01', targetsSaved: true, hasMessages: true } };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('persisted room status polling', () => {
  beforeEach(() => {
    jest.useFakeTimers(); read.mockReset();
    (supabase.channel as jest.Mock).mockReturnValue({ on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis() });
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  it('does not read tutor-only status for an observer', () => {
    renderHook(() => useRoomLearningStatus(['room']));
    expect(read).not.toHaveBeenCalled();
  });

  it('hides prior-owner status and ignores the old response after identity changes', async () => {
    const old = deferred<typeof saved>();
    const next = deferred<typeof saved>();
    read.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    const { result, rerender } = renderHook(({ owner }) => useRoomLearningStatus(['room'], owner), { initialProps: { owner: 'old' } });
    rerender({ owner: 'next' });
    await act(async () => { old.resolve(saved); });
    expect(result.current.statuses).toEqual({});
    await act(async () => { next.resolve(saved); });
    expect(result.current.statuses).toEqual(saved);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('replaces a saved assurance with unavailable when a refresh fails', async () => {
    read.mockResolvedValueOnce(saved).mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() => useRoomLearningStatus(['room'], 'owner'));
    await waitFor(() => expect(result.current.statuses).toEqual(saved));
    await act(async () => { jest.advanceTimersByTime(15000); });
    expect(result.current.error).toBe(true);
    expect(result.current.statuses).toEqual({});
  });

  it('refreshes a committed checklist immediately and reconciles on resubscription', async () => {
    read.mockResolvedValue(saved);
    renderHook(() => useRoomLearningStatus(['room'], 'owner'));
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    const channel = (supabase.channel as jest.Mock).mock.results.at(-1).value;
    const checklistCallback = channel.on.mock.calls.find((call: any[]) => call[1].table === 'session_checklists')[2];
    await act(async () => { checklistCallback(); });
    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => { channel.subscribe.mock.calls[0][0]('SUBSCRIBED'); });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('does not overlap reads or keep polling after unmount', async () => {
    const pending = deferred<typeof saved>();
    read.mockReturnValue(pending.promise);
    const { unmount } = renderHook(() => useRoomLearningStatus(['room'], 'owner'));
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(read).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => { pending.resolve(saved); jest.advanceTimersByTime(60000); });
    expect(read).toHaveBeenCalledTimes(1);
  });
});

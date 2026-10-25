// useRoomMembership.ts and useRoomRealtime.ts: verify cancellation, ownership guards and channel lifetime independently.
import { act, renderHook } from '@testing-library/react';
import type { Room, User } from '../../types';
import { supabase, validateRoomPassword } from '../../services/supabase';
import { readRoomMessagePages, startRoomMessageSync } from '../roomMessageSync';
import { useRoomMembership } from '../useRoomMembership';
import { useRoomRealtime } from '../useRoomRealtime';

jest.mock('../../services/supabase', () => ({
    supabase: { from: jest.fn(), channel: jest.fn() }, validateRoomPassword: jest.fn(),
}));
jest.mock('../../services/transferAssessmentService', () => ({ transferAssessmentService: {} }));
jest.mock('../roomMessageSync', () => ({ readRoomMessagePages: jest.fn(), startRoomMessageSync: jest.fn() }));

const user = { id: 'student', current_role: 'student', display_name: 'Learner' } as User;
const room = { id: 'room', tutor_id: 'tutor', created_at: '2026-10-24T12:00:00Z' } as Room;

beforeEach(() => { jest.clearAllMocks(); });

it('cancels an older history load when another room joins and when membership unmounts', async () => {
    const signals: AbortSignal[] = [];
    let finishOld!: () => void;
    (readRoomMessagePages as jest.Mock).mockImplementation((id, signal) => {
        signals.push(signal);
        return id === 'old' ? new Promise<void>(resolve => { finishOld = resolve; }) : Promise.resolve();
    });
    (supabase.from as jest.Mock).mockImplementation(table => {
        const query: any = { select: jest.fn(() => query), eq: jest.fn(() => query),
            single: jest.fn(async () => ({ data: { ...room, id: query.eq.mock.calls[0][1] }, error: null })),
            in: jest.fn(async () => ({ data: [user], error: null })) };
        return query;
    });
    const setInteractions = jest.fn();
    const { result, unmount } = renderHook(() => useRoomMembership(user, setInteractions, jest.fn()));
    let oldJoin!: Promise<void>;
    await act(async () => { oldJoin = result.current.joinRoom('old'); await Promise.resolve(); });
    await act(async () => { await result.current.joinRoom('new'); });
    expect(signals[0].aborted).toBe(true);
    expect(result.current.currentRoom?.id).toBe('new');
    await act(async () => { finishOld(); await oldJoin; });
    expect(result.current.currentRoom?.id).toBe('new');
    expect(setInteractions).toHaveBeenCalledTimes(1);
    unmount();
    expect(signals[1].aborted).toBe(true);
});

it('rejects unauthorized membership commands before reading history', async () => {
    const query: any = { select: jest.fn(() => query), eq: jest.fn(() => query),
        single: jest.fn(async () => ({ data: { ...room, password: 'protected' }, error: null })) };
    (supabase.from as jest.Mock).mockReturnValue(query);
    (validateRoomPassword as jest.Mock).mockResolvedValue({ success: false, message: 'Incorrect password' });
    const { result } = renderHook(() => useRoomMembership(user, jest.fn(), jest.fn()));
    await expect(result.current.createRoom('blocked')).rejects.toThrow('Only tutors');
    await act(async () => { await expect(result.current.joinRoom(room.id)).rejects.toThrow('password protected'); });
    await act(async () => { await expect(result.current.joinRoom(room.id, 'wrong')).rejects.toThrow('Incorrect password'); });
    expect(readRoomMessagePages).not.toHaveBeenCalled();
    expect(result.current.currentRoom).toBeNull();
    expect(result.current.loading).toBe(false);
});

it('keeps one channel across presentation and feedback callback changes, and cleans up room switches', async () => {
    jest.useFakeTimers();
    const channel = { on: jest.fn().mockReturnThis(), subscribe: jest.fn().mockReturnThis(),
        unsubscribe: jest.fn(), send: jest.fn() };
    const sync = { realtime: jest.fn(), status: jest.fn(), stop: jest.fn() };
    (supabase.channel as jest.Mock).mockReturnValue(channel);
    (startRoomMessageSync as jest.Mock).mockReturnValue(sync);
    const options = {
        currentRoom: room, user, participants: [user], activeRoomId: { current: room.id as string | null },
        joinRealtimeIds: { current: new Set<string>() }, setMessages: jest.fn(), setCurrentRoom: jest.fn(),
        addDisplayNameToMessage: jest.fn(message => message), handleFeedbackRealtime: jest.fn(async () => {}),
        refreshMessageFeedbackStats: jest.fn(async () => {}),
    };
    const { result, rerender, unmount } = renderHook(props => useRoomRealtime(props), { initialProps: options });
    const refreshed = jest.fn(async () => {});
    rerender({ ...options, participants: [{ ...user, display_name: 'Updated' }], refreshMessageFeedbackStats: refreshed });
    expect(supabase.channel).toHaveBeenCalledTimes(1);
    const feedback = channel.on.mock.calls.find(([event, config]) => event === 'broadcast' && config.event === 'message_feedback_changed')![2];
    await act(async () => { feedback({ payload: { messageId: 'message' } }); });
    expect(refreshed).toHaveBeenCalledWith('message');
    act(() => { result.current.startTyping(); jest.advanceTimersByTime(3000); });
    expect(channel.send.mock.calls.map(([event]) => event.event)).toEqual(['typing_start', 'typing_stop']);
    const typing = channel.on.mock.calls.find(([event, config]) => event === 'broadcast' && config.event === 'typing_start')![2];
    act(() => { typing({ payload: { userId: 'peer', displayName: 'Peer' } }); });
    expect(result.current.typingUsers).toHaveLength(1);
    act(() => { jest.advanceTimersByTime(6000); });
    expect(result.current.typingUsers).toEqual([]);
    options.activeRoomId.current = 'next';
    rerender({ ...options, currentRoom: { ...room, id: 'next' } });
    expect(sync.stop).toHaveBeenCalledTimes(1);
    expect(channel.unsubscribe).toHaveBeenCalledTimes(1);
    act(() => { typing({ payload: { userId: 'stale', displayName: 'Stale' } }); });
    expect(result.current.typingUsers).toEqual([]);
    unmount();
    expect(sync.stop).toHaveBeenCalledTimes(2);
    expect(channel.unsubscribe).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
});

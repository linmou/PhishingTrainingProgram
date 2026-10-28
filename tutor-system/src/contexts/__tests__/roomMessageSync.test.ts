/** Responsible for roomMessageSync.ts pagination, retry/cancellation and deterministic transport measurements. */
import { supabase } from '../../services/supabase';
import { readRoomMessagePages, startRoomMessageSync } from '../roomMessageSync';

jest.mock('../../services/supabase', () => ({ supabase: { from: jest.fn() } }));

describe('room message synchronization', () => {
  let rows: Record<string, unknown>[];
  let requests: number;
  let bytes: number;
  let fail: boolean;
  let sync: ReturnType<typeof startRoomMessageSync> | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    requests = 0;
    bytes = 0;
    fail = false;
    rows = [];
    (supabase.from as jest.Mock).mockImplementation(() => {
      let cursor = '';
      const query = {
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(), abortSignal: jest.fn().mockReturnThis(),
        gt: jest.fn((_column, value) => { cursor = value; return query; }),
        order: jest.fn(async () => {
          requests += 1;
          if (fail) return { data: null, error: new Error('transport unavailable') };
          const data = rows.filter(row => String(row.id) > cursor).slice(0, 100);
          bytes += Buffer.byteLength(JSON.stringify(data));
          return { data, error: null };
        }),
      };
      return query;
    });
  });

  afterEach(() => { sync?.stop(); sync = undefined; jest.useRealTimers(); });
  const flush = async () => { for (let index = 0; index < 30; index += 1) await Promise.resolve(); };
  const records = (count: number) => Array.from({ length: count }, (_, index) => ({
    id: String(index).padStart(6, '0'), room_id: 'room', user_id: 'student', user_role: 'student',
    created_at: '2026-10-24T12:00:00.000Z', content: `Message ${index}: ${'a'.repeat(100)}`,
  }));

  it('returns complete history beyond the server page cap, including tied timestamps', async () => {
    rows = records(1_205);
    const received: unknown[] = [];
    await readRoomMessagePages('room', new AbortController().signal, page => received.push(...page));
    expect(received).toEqual(rows);
    expect(requests).toBe(13);
  });

  it('retries a failed healthy audit after five seconds', async () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    sync = startRoomMessageSync('room', jest.fn());
    sync.status('SUBSCRIBED');
    await flush();
    jest.advanceTimersByTime(0);
    await flush();
    fail = true;
    jest.advanceTimersByTime(60_000);
    await flush();
    const failures = requests;
    fail = false;
    jest.advanceTimersByTime(5_000);
    await flush();
    expect(requests).toBe(failures + 1);
    warning.mockRestore();
  });

  it('coalesces reconnect signals and cancels an in-flight request without delivering late rows', async () => {
    let resolve!: (value: { data: Record<string, unknown>[]; error: null }) => void;
    let signal!: AbortSignal;
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(), gt: jest.fn().mockReturnThis(),
      abortSignal: jest.fn(value => { signal = value; return query; }),
      order: jest.fn(() => new Promise(done => { resolve = done; })),
    };
    (supabase.from as jest.Mock).mockReturnValue(query);
    const receive = jest.fn();
    sync = startRoomMessageSync('room', receive);
    sync.status('SUBSCRIBED');
    sync.status('CHANNEL_ERROR');
    sync.status('SUBSCRIBED');
    expect(query.order).toHaveBeenCalledTimes(1);
    sync.stop();
    expect(signal.aborted).toBe(true);
    resolve({ data: records(1), error: null });
    await flush();
    jest.advanceTimersByTime(120_000);
    await flush();
    expect(receive).not.toHaveBeenCalled();
    expect(query.order).toHaveBeenCalledTimes(1);
  });

  it.each([100, 1_000])('measures healthy steady-state request and JSON payload volume for %i rows', async count => {
    rows = records(count);
    const receive = jest.fn();
    sync = startRoomMessageSync('room', receive);
    sync.status('SUBSCRIBED');
    await flush();
    jest.advanceTimersByTime(0);
    await flush();
    requests = 0;
    bytes = 0;
    jest.advanceTimersByTime(60_000);
    await flush();
    expect(requests).toBe(count / 100 + 1);
    const oldBytes = Buffer.byteLength(JSON.stringify(rows)) * 30;
    expect(bytes).toBeLessThan(oldBytes / 29);
    const clock = jest.requireActual('perf_hooks').performance;
    const baselineStarted = clock.now();
    receive([{ ...rows[0], content: 'changed' }]);
    const baselineLatency = clock.now() - baselineStarted;
    const started = clock.now();
    sync.realtime({ ...rows[0], content: 'changed' });
    const realtimeLatency = clock.now() - started;
    expect(receive).toHaveBeenLastCalledWith([{ ...rows[0], content: 'changed' }]);
    console.info(JSON.stringify({
      count, fixture: 'ASCII content100, tied ISO timestamps, ID keyset, JSON response bodies only',
      beforeRequestsPerMinute: 30, afterRequestsPerMinute: requests,
      beforeBytesPerMinute: oldBytes, afterBytesPerMinute: bytes,
      beforeRealtimeDispatchMs: baselineLatency, afterRealtimeDispatchMs: realtimeLatency,
      beforeMissedEventMaxScheduleMs: 2_000, afterHealthyMissedEventMaxScheduleMs: 60_000,
      afterDisconnectedMaxScheduleMs: 5_000, reconnectScheduleMs: 0,
      transport: 'in-process Jest transport; excludes network, compression and headers',
    }));
  });
});

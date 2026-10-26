import { supabase } from '../services/supabase';

export const MESSAGE_SYNC_PAGE_SIZE = 100;
export const MESSAGE_AUDIT_INTERVAL_MS = 60_000;
export const MESSAGE_RECOVERY_INTERVAL_MS = 5_000;

type MessageRow = Record<string, unknown>;

/** ID keysets include tied timestamps and old-row updates without an updated_at contract. */
export async function readRoomMessagePages(
  roomId: string,
  signal: AbortSignal,
  receive: (rows: MessageRow[]) => void,
): Promise<void> {
  let cursor: string | null = null;
  while (!signal.aborted) {
    let query = supabase.from('messages').select('*').eq('room_id', roomId)
      .limit(MESSAGE_SYNC_PAGE_SIZE).abortSignal(signal);
    if (cursor !== null) query = query.gt('id', cursor);
    const { data, error } = await query.order('id', { ascending: true });
    if (signal.aborted) return;
    if (error) throw error;
    const rows = (data || []) as MessageRow[];
    receive(rows);
    if (rows.length < MESSAGE_SYNC_PAGE_SIZE) return;
    const next = String(rows[rows.length - 1].id);
    if (next === cursor) throw new Error('Message reconciliation cursor did not advance');
    cursor = next;
  }
}

/** One cancellable scan at a time; realtime rows supersede an older HTTP snapshot. */
export function startRoomMessageSync(roomId: string, receive: (rows: MessageRow[]) => void) {
  let stopped = false;
  let healthy = false;
  let running = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;
  let realtimeIds = new Set<string>();

  const reconcile = async () => {
    if (stopped) return;
    if (running) { pending = true; return; }
    clearTimeout(timer);
    running = true;
    controller = new AbortController();
    realtimeIds = new Set();
    let failed = false;
    try {
      await readRoomMessagePages(roomId, controller.signal, rows => {
        if (!stopped) receive(rows.filter(row => !realtimeIds.has(String(row.id))));
      });
    } catch (error) {
      failed = true;
      if (!stopped) console.warn('Could not reconcile room messages:', error);
    } finally {
      running = false;
      if (!stopped) {
        const delay = pending ? 0 : healthy && !failed ? MESSAGE_AUDIT_INTERVAL_MS : MESSAGE_RECOVERY_INTERVAL_MS;
        pending = false;
        timer = setTimeout(() => { void reconcile(); }, delay);
      }
    }
  };

  void reconcile();
  return {
    realtime(row: MessageRow) {
      if (stopped || row.room_id !== roomId) return;
      realtimeIds.add(String(row.id));
      receive([row]);
    },
    status(status: string) {
      if (stopped) return;
      const wasHealthy = healthy;
      healthy = status === 'SUBSCRIBED';
      // Initial SUBSCRIBED also closes the fetch/subscription registration gap.
      if (healthy !== wasHealthy) void reconcile();
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    },
  };
}

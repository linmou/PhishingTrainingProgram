import { useEffect, useState } from 'react';
import { readRoomLearningStatus, RoomLearningStatus } from '../services/roomLearningStatusService';
import { supabase } from '../services/supabase';
import { newRequestId } from '../utils/requestId';

/** Reconcile committed status on live events, subscription recovery and a periodic fallback. */
export function useRoomLearningStatus(roomIds: string[], ownerId?: string) {
  const key = JSON.stringify(Array.from(new Set(roomIds)).sort());
  const requestKey = `${ownerId || ''}:${key}`;
  const [state, setState] = useState<{ key: string; statuses: Record<string, RoomLearningStatus>; error: boolean }>({ key: '', statuses: {}, error: false });
  useEffect(() => {
    if (!ownerId || key === '[]') return;
    let cancelled = false;
    let inFlight = false;
    let refreshAgain = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ids: string[] = JSON.parse(key);
    const refresh = async () => {
      if (cancelled) return;
      if (inFlight) { refreshAgain = true; return; }
      clearTimeout(timer);
      inFlight = true;
      try {
        const statuses = await readRoomLearningStatus(ids);
        if (!cancelled) setState({ key: requestKey, statuses, error: false });
      } catch {
        if (!cancelled) setState({ key: requestKey, statuses: {}, error: true });
      } finally {
        inFlight = false;
        if (!cancelled) {
          const delay = refreshAgain ? 0 : 15000;
          refreshAgain = false;
          timer = setTimeout(refresh, delay);
        }
      }
    };
    const channel = supabase.channel(newRequestId('learner-status'));
    for (let offset = 0; offset < ids.length; offset += 100) {
      const filter = `room_id=in.(${ids.slice(offset, offset + 100).join(',')})`;
      for (const table of ['sessions', 'session_checklists', 'messages']) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => { void refresh(); });
      }
    }
    channel.subscribe(status => {
      if (status === 'SUBSCRIBED') void refresh();
    });
    void refresh();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [key, ownerId, requestKey]);
  return state.key === requestKey ? state : { statuses: {} as Record<string, RoomLearningStatus>, error: false };
}

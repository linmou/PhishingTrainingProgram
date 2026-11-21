import { useEffect, useState } from 'react';
import { readRoomLearningStatus, RoomLearningStatus } from '../services/roomLearningStatusService';

/** Poll persisted status, with stale-response cancellation on room or identity changes. */
export function useRoomLearningStatus(roomIds: string[], ownerId?: string) {
  const key = JSON.stringify(roomIds.slice().sort());
  const requestKey = `${ownerId || ''}:${key}`;
  const [state, setState] = useState<{ key: string; statuses: Record<string, RoomLearningStatus>; error: boolean }>({ key: '', statuses: {}, error: false });
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    if (!ownerId || key === '[]') return;
    const refresh = async () => {
      try {
        const statuses = await readRoomLearningStatus(JSON.parse(key));
        if (!cancelled) setState({ key: requestKey, statuses, error: false });
      } catch {
        if (!cancelled) setState({ key: requestKey, statuses: {}, error: true });
      } finally {
        if (!cancelled) timer = setTimeout(refresh, 15000);
      }
    };
    void refresh();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, ownerId, requestKey]);
  return state.key === requestKey ? state : { statuses: {} as Record<string, RoomLearningStatus>, error: false };
}

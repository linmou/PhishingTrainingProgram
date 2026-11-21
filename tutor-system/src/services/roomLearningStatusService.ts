import { supabase } from './supabase';

export interface RoomLearningStatus {
  learnerId: string | null;
  learnerName: string | null;
  joinedAt: string | null;
  targetsSaved: boolean;
  hasMessages: boolean;
}

// Range pages prevent PostgREST's response cap from turning a saved checklist into a false warning.
async function readAllRows<T>(query: { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> }): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const response = await query.range(offset, offset + 499);
    if (response.error) throw response.error;
    rows.push(...(response.data || []));
    if (!response.data || response.data.length < 500) return rows;
  }
}

/** Batch room status reads; drafts in browser storage never establish persistence. */
export async function readRoomLearningStatus(roomIds: string[]): Promise<Record<string, RoomLearningStatus>> {
  const result: Record<string, RoomLearningStatus> = {};
  for (let offset = 0; offset < roomIds.length; offset += 100) {
    const ids = roomIds.slice(offset, offset + 100);
    const sessions = await readAllRows(supabase.from('sessions').select('room_id,student_id,started_at').in('room_id', ids).eq('status', 'active').not('student_id', 'is', null).order('id'));
    const learners = Array.from(new Set(sessions.map(row => row.student_id)));
    const [users, checklists] = await Promise.all([
      learners.length ? readAllRows(supabase.from('users').select('id,display_name').in('id', learners).order('id')) : Promise.resolve([]),
      readAllRows(supabase.from('session_checklists').select('room_id,student_id').in('room_id', ids).order('id')),
    ]);
    const unresolved = sessions.filter(seat => !checklists.some(row => row.room_id === seat.room_id && row.student_id === seat.student_id));
    const messages: Array<{ room_id: string; user_id: string }> = [];
    if (unresolved.length) {
      const pending = new Set(unresolved.map(seat => `${seat.room_id}:${seat.student_id}`));
      for (let offset = 0; pending.size; offset += 500) {
        const page = await supabase.from('messages').select('room_id,user_id')
          .in('room_id', unresolved.map(seat => seat.room_id)).in('user_id', unresolved.map(seat => seat.student_id))
          .eq('user_role', 'student').order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
        if (page.error) throw page.error;
        for (const row of page.data || []) {
          if (pending.delete(`${row.room_id}:${row.user_id}`)) messages.push(row);
        }
        if (!page.data || page.data.length < 500) break;
      }
    }
    for (const id of ids) {
      const seat = sessions.find(row => row.room_id === id);
      result[id] = {
        learnerId: seat?.student_id || null,
        learnerName: users.find(row => row.id === seat?.student_id)?.display_name || null,
        joinedAt: seat?.started_at || null,
        targetsSaved: Boolean(seat && checklists.some(row => row.room_id === id && row.student_id === seat.student_id)),
        hasMessages: Boolean(seat && messages.some(row => row.room_id === id && row.user_id === seat.student_id)),
      };
    }
  }
  return result;
}

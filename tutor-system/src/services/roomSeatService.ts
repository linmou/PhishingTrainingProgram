// Purpose: read who holds a room's learner seat from the room's own records (AD-8) without claiming it.
// Only the trusted join_room operation claims the seat, and only after the student's explicit Join (FR-12).
import { supabase } from './supabase';

export async function readRoomLearnerIds(roomId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('student_id')
    .eq('room_id', roomId)
    .eq('status', 'active')
    .not('student_id', 'is', null);
  if (error) throw error;
  const ids = (data || []).map((session: { student_id: string | null }) => session.student_id);
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

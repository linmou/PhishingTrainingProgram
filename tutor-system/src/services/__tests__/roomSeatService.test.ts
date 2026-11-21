// Test responsibility: src/services/roomSeatService.ts reads the room's active learner from its records
// without claiming the seat (no join_room call), and surfaces read failures to the caller.

import { readRoomLearnerIds } from '../roomSeatService';
import { supabase } from '../supabase';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));

function sessionsReturn(result: { data: Array<{ student_id: string | null }> | null; error: unknown }) {
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    not: jest.fn(() => Promise.resolve(result)),
  };
  (supabase.from as jest.Mock).mockReturnValue(query);
  return query;
}

describe('readRoomLearnerIds', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the distinct active learners of the room and claims nothing', async () => {
    const query = sessionsReturn({ data: [{ student_id: 'learner-1' }, { student_id: 'learner-1' }, { student_id: null }], error: null });

    await expect(readRoomLearnerIds('room-1')).resolves.toEqual(['learner-1']);
    expect(supabase.from).toHaveBeenCalledWith('sessions');
    expect(query.eq).toHaveBeenCalledWith('room_id', 'room-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'active');
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('returns no learner for a room without an active session', async () => {
    sessionsReturn({ data: null, error: null });
    await expect(readRoomLearnerIds('room-1')).resolves.toEqual([]);
  });

  it('rejects when the room records cannot be read', async () => {
    const failure = { message: 'network down' };
    sessionsReturn({ data: null, error: failure });
    await expect(readRoomLearnerIds('room-1')).rejects.toBe(failure);
  });
});

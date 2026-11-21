import { readRoomLearningStatus } from '../roomLearningStatusService';
import { supabase } from '../supabase';
jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));
const from = supabase.from as jest.Mock;
function tables(data: Record<string, any[]>, fail?: string) {
  from.mockImplementation(table => {
    const query: any = {};
    let rows = data[table] || [];
    query.not = jest.fn((column, op, value) => { rows = rows.filter(row => row[column] !== value); return query; });
    for (const op of ['select', 'in', 'eq', 'order']) query[op] = jest.fn(() => query);
    query.range = jest.fn(async (start, end) => ({ data: rows.slice(start, end + 1), error: table === fail ? Error('denied') : null }));
    return query;
  });
}
afterEach(jest.clearAllMocks);
it('distinguishes no learner, missing targets and persisted targets for the current learner', async () => {
  tables({ sessions: [{ room_id: 'r', student_id: 's', started_at: 'now' }], users: [{ id: 's', display_name: 'Sam' }], session_checklists: [{ room_id: 'r', student_id: 'observer' }], messages: [{ room_id: 'r', user_id: 's' }] });
  const result = await readRoomLearningStatus(['r', 'empty']);
  expect(result.r).toMatchObject({ learnerId: 's', learnerName: 'Sam', targetsSaved: false, hasMessages: true });
  expect(result.empty.learnerId).toBeNull();
  tables({ sessions: [{ room_id: 'r', student_id: 's' }], session_checklists: [{ room_id: 'r', student_id: 's' }] });
  expect((await readRoomLearningStatus(['r'])).r.targetsSaved).toBe(true);
});
it('rejects unavailable reads rather than claiming targets are absent', async () => {
  tables({}, 'sessions');
  await expect(readRoomLearningStatus(['r'])).rejects.toThrow('denied');
});
it('continues beyond a full PostgREST page', async () => {
  tables({ sessions: [{ room_id: 'r', student_id: 's' }], session_checklists: [...Array.from({ length: 500 }, () => ({ room_id: 'other', student_id: 'other' })), { room_id: 'r', student_id: 's' }] });
  expect((await readRoomLearningStatus(['r'])).r.targetsSaved).toBe(true);
});

it('ignores null learner placeholders before resolving the current seat', async () => {
  tables({ sessions: [{ room_id: 'empty', student_id: null }, { room_id: 'r', student_id: null }, { room_id: 'r', student_id: 's' }], users: [{ id: 's', display_name: 'Sam' }], session_checklists: [{ room_id: 'r', student_id: 's' }] });
  const result = await readRoomLearningStatus(['empty', 'r']);
  expect(result.empty.learnerId).toBeNull();
  expect(result.r).toMatchObject({ learnerId: 's', learnerName: 'Sam', targetsSaved: true });
  const userQuery = from.mock.results.find((_, index) => from.mock.calls[index][0] === 'users')!.value;
  expect(userQuery.in).toHaveBeenCalledWith('id', ['s']);
});

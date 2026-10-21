/** Tests supabase.ts clearChatHistory: authorization, trusted clear delegation and failure propagation. */
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ from: jest.fn() })) }));
jest.mock('../transferAssessmentService', () => ({ transferAssessmentService: { clearChatHistory: jest.fn() } }));
import { supabase, clearChatHistory } from '../supabase';
import { transferAssessmentService } from '../transferAssessmentService';

const client = supabase as any;
const clear = transferAssessmentService.clearChatHistory as jest.Mock;
const tutor = { id: 'tutor-1', current_role: 'tutor' };
const room = { tutor_id: tutor.id, title: 'Test Room', pre_populated_dialogue: [{ message: 'Template' }] };
const lookup = (data: unknown) => ({
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null })
});
let users: ReturnType<typeof lookup>, rooms: ReturnType<typeof lookup>;

beforeEach(() => {
  users = lookup(tutor);
  rooms = lookup(room);
  client.from.mockImplementation((name: string) => ({ users, rooms } as any)[name]);
  clear.mockResolvedValue({ success: true });
});

it.each([null, { id: 'student-1', current_role: 'student' }])('rejects an absent or non-tutor actor before clearing', async actor => {
  users.single.mockResolvedValue({ data: actor, error: null });
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow();
  expect(clear).not.toHaveBeenCalled();
});

it('rejects a missing room and a different owner before clearing', async () => {
  rooms.single.mockResolvedValueOnce({ data: null, error: { message: 'missing' } });
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow('Room not found');
  rooms.single.mockResolvedValueOnce({ data: { ...room, tutor_id: 'another-tutor' }, error: null });
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow('not authorized');
  expect(clear).not.toHaveBeenCalled();
});

it('delegates only the requested room to the trusted transaction and retains its template', async () => {
  expect(await clearChatHistory('room-1', tutor.id)).toEqual({
    success: true, title: room.title, prePopulatedMessagesPreserved: true
  });
  expect(clear).toHaveBeenCalledWith('room-1');
  expect(client.from).not.toHaveBeenCalledWith('messages');
  expect(client.from).not.toHaveBeenCalledWith('message_feedback');
  expect(room.pre_populated_dialogue).toEqual([{ message: 'Template' }]);
});

it('propagates trusted transaction failures', async () => {
  clear.mockRejectedValueOnce(new Error('clear failed'));
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow('clear failed');
});

it('returns success with no preserved template when the room has none', async () => {
  rooms.single.mockResolvedValue({ data: { ...room, pre_populated_dialogue: null }, error: null });
  expect(await clearChatHistory('room-1', tutor.id)).toMatchObject({ success: true, prePopulatedMessagesPreserved: false });
});

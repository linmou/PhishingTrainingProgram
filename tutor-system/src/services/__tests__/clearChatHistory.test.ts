/** Tests supabase.ts clearChatHistory: authorization, scoped deletion and error propagation through the real service. */
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ from: jest.fn() })) }));
import { supabase, clearChatHistory } from '../supabase';

const client = supabase as any;
const tutor = { id: 'tutor-1', current_role: 'tutor' };
const room = { tutor_id: tutor.id, title: 'Test Room', pre_populated_dialogue: [{ message: 'Template' }] };
let users: any, rooms: any, messages: any, feedback: any;

const lookup = (data: unknown) => ({
  select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data, error: null })
});
const deletion = () => ({ delete: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) });

beforeEach(() => {
  users = lookup(tutor);
  rooms = lookup(room);
  messages = deletion();
  feedback = deletion();
  client.from.mockImplementation((name: string) => ({ users, rooms, messages, message_feedback: feedback } as any)[name]);
});

it.each([null, { id: 'student-1', current_role: 'student' }])('rejects an absent or non-tutor actor before deletion', async actor => {
  users.single.mockResolvedValue({ data: actor, error: null });
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow();
  expect(messages.delete).not.toHaveBeenCalled();
});

it('rejects a missing room and a different owner before deletion', async () => {
  rooms.single.mockResolvedValueOnce({ data: null, error: { message: 'missing' } });
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow('Room not found');
  rooms.single.mockResolvedValueOnce({ data: { ...room, tutor_id: 'another-tutor' }, error: null });
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow('not authorized');
  expect(messages.delete).not.toHaveBeenCalled();
});

it('deletes only the requested room messages and feedback while retaining its template', async () => {
  expect(await clearChatHistory('room-1', tutor.id)).toEqual({
    success: true, title: room.title, prePopulatedMessagesPreserved: true
  });
  expect(messages.eq).toHaveBeenCalledWith('room_id', 'room-1');
  expect(feedback.eq).toHaveBeenCalledWith('room_id', 'room-1');
  expect(room.pre_populated_dialogue).toEqual([{ message: 'Template' }]);
});

it('propagates a message deletion failure and stops subsequent cleanup', async () => {
  messages.eq.mockResolvedValue({ error: new Error('delete failed') });
  await expect(clearChatHistory('room-1', tutor.id)).rejects.toThrow('delete failed');
  expect(feedback.delete).not.toHaveBeenCalled();
});

it('returns success with no preserved template when the room has none', async () => {
  rooms.single.mockResolvedValue({ data: { ...room, pre_populated_dialogue: null }, error: null });
  expect(await clearChatHistory('room-1', tutor.id)).toMatchObject({ success: true, prePopulatedMessagesPreserved: false });
});

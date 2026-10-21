/** Tests supabase.ts clearChatHistory end to end against an in-memory SDK boundary: room isolation, template retention and permission denial. */
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ from: jest.fn() })) }));
import { supabase, clearChatHistory } from '../supabase';

it('clears one owned room without changing another room or either template', async () => {
  const users = [{ id: 'tutor-1', current_role: 'tutor' }, { id: 'student-1', current_role: 'student' }];
  const rooms = [
    { id: 'room-1', tutor_id: 'tutor-1', title: 'One', pre_populated_dialogue: [{ message: 'Original template' }] },
    { id: 'room-2', tutor_id: 'tutor-2', title: 'Two', pre_populated_dialogue: [{ message: 'Other template' }] }
  ];
  const state: Record<string, any[]> = { users, rooms,
    messages: [{ id: 'message-1', room_id: 'room-1' }, { id: 'message-2', room_id: 'room-2' }],
    message_feedback: [{ id: 'feedback-1', room_id: 'room-1' }, { id: 'feedback-2', room_id: 'room-2' }]
  };
  (supabase.from as jest.Mock).mockImplementation((name: string) => {
    const builder = {
      select: () => builder,
      eq: (column: string, value: string) => ({
        single: async () => ({ data: state[name].find(row => row[column] === value), error: null })
      }),
      delete: () => ({
        eq: async (column: string, value: string) => {
          state[name] = state[name].filter(row => row[column] !== value);
          return { error: null };
        }
      })
    };
    return builder;
  });
  const templatesBefore = JSON.parse(JSON.stringify(rooms));
  await expect(clearChatHistory('room-1', 'student-1')).rejects.toThrow('Only tutors');
  expect(state.messages).toHaveLength(2);
  await expect(clearChatHistory('room-2', 'tutor-1')).rejects.toThrow('not authorized');
  expect(state.messages).toHaveLength(2);
  expect(await clearChatHistory('room-1', 'tutor-1')).toMatchObject({ success: true, prePopulatedMessagesPreserved: true });
  expect(state.messages).toEqual([{ id: 'message-2', room_id: 'room-2' }]);
  expect(state.message_feedback).toEqual([{ id: 'feedback-2', room_id: 'room-2' }]);
  expect(rooms).toEqual(templatesBefore);
});

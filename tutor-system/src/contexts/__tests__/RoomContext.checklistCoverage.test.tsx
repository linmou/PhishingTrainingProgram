#!/usr/bin/env node
/** Test responsible for RoomContext.tsx analyzing persisted ordinary learner messages. */
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { ChecklistService } from '../../services/checklistService';

jest.mock('../AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../services/supabase', () => ({
  supabase: { channel: jest.fn(), from: jest.fn() },
  validateRoomPassword: jest.fn(), submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn(), getUserMessageFeedback: jest.fn(),
  getRoomFeedbackSummary: jest.fn(), clearChatHistory: jest.fn(),
}));
jest.mock('../../services/aiService', () => ({
  getAIConfig: jest.fn().mockResolvedValue(null), DEFAULT_AI_MODEL: 'qwen3.5-flash',
}));
jest.mock('../../services/checklistService', () => ({ ChecklistService: {
  getChecklistForStudent: jest.fn().mockResolvedValue(null),
  processStudentMessage: jest.fn().mockResolvedValue({ updatedItems: [] }),
} }));

const Probe = ({ onChange }: { onChange: (value: ReturnType<typeof useRoom>) => void }) => {
  const value = useRoom();
  React.useEffect(() => onChange(value), [value, onChange]);
  return null;
};

describe('ordinary learner checklist coverage', () => {
  let api: ReturnType<typeof useRoom>;
  let insertResult: { data: any; error: any };
  let roomRecord: any;
  const room = { id: 'room-1', tutor_id: 'tutor-1', is_active: true, ai_assistant_enabled: false,
    transfer_learning_enabled: false, created_at: '2026-01-01', updated_at: '2026-01-01' };

  beforeEach(() => {
    jest.clearAllMocks();
    roomRecord = room;
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'student-1', current_role: 'student', display_name: 'Learner' } });
    insertResult = { data: { id: 'stored-1', room_id: room.id, user_id: 'student-1',
      user_role: 'student', content: 'I would open the official app.', created_at: '2026-01-01' }, error: null };
    (supabase.channel as jest.Mock).mockReturnValue({ on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(), unsubscribe: jest.fn() });
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rooms') return { select: () => ({ eq: () => ({ eq: () => ({
        single: async () => ({ data: roomRecord, error: null }) }) }) }) };
      if (table === 'messages') return {
        select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => insertResult }) }),
      };
      if (table === 'users') return { select: () => ({ in: async () => ({ data: [], error: null }) }) };
      throw new Error(`Unexpected table: ${table}`);
    });
  });

  async function mount() {
    render(<RoomProvider><Probe onChange={value => { api = value; }} /></RoomProvider>);
    await waitFor(() => expect(api).toBeDefined());
    await act(async () => { await api.joinRoom(room.id); });
  }

  it('analyzes a saved learner message with its stored identity', async () => {
    await mount();
    await act(async () => { await api.sendMessage('I would open the official app.'); });
    expect(ChecklistService.processStudentMessage).toHaveBeenCalledWith(
      room.id, 'I would open the official app.', 'stored-1', expect.any(Array));
    expect(api.messages.some(message => message.id === 'stored-1')).toBe(true);
  });

  it('does not analyze an insert that failed', async () => {
    await mount();
    insertResult = { data: null, error: new Error('insert failed') };
    await expect(act(async () => { await api.sendMessage('I would open the official app.'); })).rejects.toThrow('insert failed');
    expect(ChecklistService.processStudentMessage).not.toHaveBeenCalled();
  });

  it('keeps the saved message when analysis fails', async () => {
    await mount();
    (ChecklistService.processStudentMessage as jest.Mock).mockRejectedValueOnce(new Error('provider failed'));
    await act(async () => { await api.sendMessage('I would open the official app.'); });
    expect(api.messages.some(message => message.id === 'stored-1')).toBe(true);
  });

  it('does not analyze tutor messages', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'tutor-1', current_role: 'tutor', display_name: 'Tutor' } });
    await mount();
    await act(async () => { await api.sendMessage('Try the official app.'); });
    expect(ChecklistService.processStudentMessage).not.toHaveBeenCalled();
  });

  it('drops messages from the previous room when joining another room', async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: { id: 'tutor-1', current_role: 'tutor', display_name: 'Tutor' } });
    await mount();
    await act(async () => { await api.sendMessage('Try the official app.'); });
    expect(api.messages.some(message => message.id === 'stored-1')).toBe(true);
    roomRecord = { ...room, id: 'room-2' };
    await act(async () => { await api.joinRoom('room-2'); });
    expect(api.currentRoom?.id).toBe('room-2');
    expect(api.messages).toEqual([]);
  });
});

#!/usr/bin/env node
/**
 * Test responsible for RoomContext.tsx surfacing AI generation failures instead of silently keeping a generic or empty suggestion state.
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { generateTutorSuggestion, getAIConfig } from '../../services/aiService';

jest.mock('../../services/supabase', () => ({
  supabase: {
    channel: jest.fn(),
    from: jest.fn(),
    storage: {
      from: jest.fn()
    }
  },
  validateRoomPassword: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn(),
  getUserMessageFeedback: jest.fn(),
  getRoomFeedbackSummary: jest.fn(),
  clearChatHistory: jest.fn()
}));

jest.mock('../../services/aiService', () => ({
  generateTutorSuggestion: jest.fn(),
  recordAISuggestionFeedback: jest.fn(),
  updateAIConfig: jest.fn(),
  getAIConfig: jest.fn()
}));

jest.mock('../AuthContext', () => ({
  useAuth: jest.fn()
}));

const TestRoomHelper: React.FC<{ onReady: (roomApi: ReturnType<typeof useRoom>) => void }> = ({ onReady }) => {
  const roomApi = useRoom();

  React.useEffect(() => {
    onReady(roomApi);
  }, [onReady, roomApi]);

  return null;
};

describe('RoomContext AI generation failures', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useAuth as jest.Mock).mockReturnValue({
      user: {
        id: 'tutor-1',
        email: 'tutor@example.com',
        display_name: 'Tutor',
        current_role: 'tutor',
        status: 'active',
        created_at: '2026-04-02T00:00:00Z',
        updated_at: '2026-04-02T00:00:00Z'
      },
      loading: false
    });

    (getAIConfig as jest.Mock).mockResolvedValue({
      id: 'ai-config-1',
      room_id: 'room-1',
      model_name: 'gpt-4o-mini',
      system_prompt: 'Scenario prompt',
      prompt_config: null,
      temperature: 0.7,
      max_tokens: 150,
      is_active: true,
      created_at: '2026-04-02T00:00:00Z',
      updated_at: '2026-04-02T00:00:00Z'
    });

    (supabase.channel as jest.Mock).mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn()
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'rooms') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: {
                    id: 'room-1',
                    tutor_id: 'tutor-1',
                    title: 'Room',
                    description: 'Test room',
                    image_url: null,
                    is_active: true,
                    ai_assistant_enabled: true,
                    ai_assistant_model: 'gpt-4o-mini',
                    ai_assistant_prompt: 'Scenario prompt',
                    op_id: null,
                    op_display_name: null,
                    op_avatar_url: null,
                    password: null,
                    created_at: '2026-04-02T00:00:00Z',
                    updated_at: '2026-04-02T00:00:00Z'
                  },
                  error: null
                })
              })
            })
          })
        };
      }

      if (table === 'messages') {
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [
                  {
                    id: 'message-1',
                    room_id: 'room-1',
                    user_id: 'student-1',
                    content: 'Is it safe to share my live location?',
                    user_role: 'student',
                    is_ai_generated: false,
                    ai_model_used: null,
                    ai_response_time_ms: null,
                    parent_message_id: null,
                    created_at: '2026-04-02T10:00:00Z'
                  }
                ],
                error: null
              })
            })
          })
        };
      }

      if (table === 'users') {
        return {
          select: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: [
                {
                  id: 'tutor-1',
                  email: 'tutor@example.com',
                  display_name: 'Tutor',
                  current_role: 'tutor',
                  status: 'active',
                  created_at: '2026-04-02T00:00:00Z',
                  updated_at: '2026-04-02T00:00:00Z'
                },
                {
                  id: 'student-1',
                  email: 'student@example.com',
                  display_name: 'Student',
                  current_role: 'student',
                  status: 'active',
                  created_at: '2026-04-02T00:00:00Z',
                  updated_at: '2026-04-02T00:00:00Z'
                }
              ],
              error: null
            })
          })
        };
      }

      throw new Error(`Unexpected table mock: ${table}`);
    });
  });

  it('rejects generateAIResponse when the AI service reports failure', async () => {
    (generateTutorSuggestion as jest.Mock).mockResolvedValue({
      suggestion: '',
      success: false,
      error: 'OpenAI API error: 401 - invalid token',
      contextMessages: []
    });

    let roomApi: ReturnType<typeof useRoom> | null = null;

    render(
      <RoomProvider>
        <TestRoomHelper onReady={(api) => { roomApi = api; }} />
      </RoomProvider>
    );

    await waitFor(() => {
      expect(roomApi).not.toBeNull();
    });

    await act(async () => {
      await roomApi!.joinRoom('room-1');
    });

    await expect(roomApi!.generateAIResponse()).rejects.toThrow('OpenAI API error: 401 - invalid token');
    expect(roomApi!.aiSuggestion).toBeNull();
  });
});

#!/usr/bin/env node
/**
 * Test responsible for RoomContext.tsx reloading persisted AI prompt_config from aiService after joining an AI-enabled room.
 */

import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { useAuth } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { getAIConfig } from '../../services/aiService';

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

describe('RoomContext AI config reload', () => {
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
                    ai_assistant_prompt: 'Persisted modular prompt',
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
                data: [],
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

  it('hydrates aiConfig from persisted prompt_config after joinRoom', async () => {
    (getAIConfig as jest.Mock).mockResolvedValue({
      id: 'ai-config-1',
      room_id: 'room-1',
      model_name: 'gpt-4o-mini',
      system_prompt: 'Persisted modular prompt',
      prompt_config: {
        role: { role: 'high' },
        communication_style: {
          teen_slang: 'low',
          conversational_markers: 'low',
          uncertainty_expression: 'low'
        },
        cognitive_parameters: {
          concept_density: 'high',
          perspective_taking: 'high',
          personal_examples: 'high',
          consequence_highlighting: 'high'
        },
        emotional_parameters: {
          enthusiasm_level: 'low',
          validation_frequency: 'high',
          mistake_normalization: 'high',
          confidence_building: 'high'
        },
        detection_areas: ['Suspicious links', 'Sender spoofing'],
        verification_steps: ['Hover links', 'Verify sender']
      },
      temperature: 0.4,
      max_tokens: 120,
      is_active: true,
      created_at: '2026-04-02T00:00:00Z',
      updated_at: '2026-04-02T00:00:00Z'
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

    await waitFor(() => {
      expect(getAIConfig).toHaveBeenCalledWith('room-1');
      expect(roomApi!.aiConfig).toMatchObject({
        system_prompt: 'Persisted modular prompt',
        prompt_config: {
          detection_areas: ['Suspicious links', 'Sender spoofing'],
          verification_steps: ['Hover links', 'Verify sender']
        },
        temperature: 0.4,
        max_tokens: 120
      });
    });
  });
});

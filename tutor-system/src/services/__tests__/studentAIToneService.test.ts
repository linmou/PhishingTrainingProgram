/**
 * Tests for setStudentAITone in aiService / student tone write path.
 * Purpose: reject multi-student apply; persist peer/adult role + lock for 1:1 rooms.
 * Spec: features/student_ai_tone.feature
 */

import { setStudentAITone } from '../studentAIToneService';
import { getAIConfig, updateAIConfig } from '../aiService';
import type { User } from '../../types';

jest.mock('../aiService', () => {
  const actual = jest.requireActual('../aiService');
  return {
    ...actual,
    getAIConfig: jest.fn(),
    updateAIConfig: jest.fn(),
  };
});

jest.mock('../systemPrompts', () => {
  const actual = jest.requireActual('../systemPrompts');
  return {
    PRESET_CONFIGS: actual.PRESET_CONFIGS,
    generateSystemPrompt: (config: { role: { role: string } }) =>
      `PROMPT:${config.role.role}`,
  };
});

const student = (id: string): User =>
  ({ id, display_name: id, current_role: 'student' }) as User;
const tutor = (id: string): User =>
  ({ id, display_name: id, current_role: 'tutor' }) as User;

describe('setStudentAITone (features/student_ai_tone.feature)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects tone change when more than one student is in the room', async () => {
    await expect(
      setStudentAITone({
        roomId: 'room-1',
        userId: 's1',
        tone: 'peer',
        participants: [tutor('t1'), student('s1'), student('s2')],
        aiEnabled: true,
      })
    ).rejects.toThrow(/single-student|one student|multi-student|not available/i);

    expect(updateAIConfig).not.toHaveBeenCalled();
  });

  it('rejects when AI is disabled', async () => {
    await expect(
      setStudentAITone({
        roomId: 'room-1',
        userId: 's1',
        tone: 'peer',
        participants: [tutor('t1'), student('s1')],
        aiEnabled: false,
      })
    ).rejects.toThrow(/AI|disabled|not available/i);

    expect(updateAIConfig).not.toHaveBeenCalled();
  });

  it('persists peer role and lock for a 1:1 room without wiping other knobs', async () => {
    (getAIConfig as jest.Mock).mockResolvedValue({
      room_id: 'room-1',
      model_name: 'gpt-4o-mini',
      system_prompt: 'old',
      prompt_config: {
        role: { role: 'high' },
        communication_style: {
          teen_slang: 'high',
          conversational_markers: 'low',
          uncertainty_expression: 'high',
        },
        cognitive_parameters: {
          concept_density: 'high',
          perspective_taking: 'low',
          personal_examples: 'high',
          consequence_highlighting: 'low',
        },
        emotional_parameters: {
          enthusiasm_level: 'high',
          validation_frequency: 'high',
          mistake_normalization: 'low',
          confidence_building: 'low',
        },
        detection_areas: ['Urgent language'],
        verification_steps: ['Hover links'],
      },
      temperature: 0.5,
      max_tokens: 100,
      is_active: true,
    });
    (updateAIConfig as jest.Mock).mockImplementation(async (_roomId, updates) => ({
      room_id: 'room-1',
      ...updates,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      id: 'cfg-1',
    }));

    const result = await setStudentAITone({
      roomId: 'room-1',
      userId: 's1',
      tone: 'peer',
      participants: [tutor('t1'), student('s1')],
      aiEnabled: true,
    });

    expect(updateAIConfig).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({
        system_prompt: 'PROMPT:low',
        prompt_config: expect.objectContaining({
          role: { role: 'low' },
          interaction_mode: 'single_agent',
          communication_style: expect.objectContaining({ teen_slang: 'high' }),
          detection_areas: ['Urgent language'],
          student_tone_lock: {
            locked: true,
            chosen_by_user_id: 's1',
            chosen_role: 'low',
            chosen_choice: 'peer',
          },
        }),
      }),
      's1',
      'student_tone_preference'
    );
    expect(result.prompt_config?.role.role).toBe('low');
    expect(result.prompt_config?.student_tone_lock?.locked).toBe(true);
  });

  it('persists adult role for a 1:1 room', async () => {
    (getAIConfig as jest.Mock).mockResolvedValue({
      room_id: 'room-1',
      model_name: 'gpt-4o-mini',
      system_prompt: 'old',
      prompt_config: {
        role: { role: 'low' },
        communication_style: {
          teen_slang: 'low',
          conversational_markers: 'low',
          uncertainty_expression: 'low',
        },
        cognitive_parameters: {
          concept_density: 'low',
          perspective_taking: 'low',
          personal_examples: 'low',
          consequence_highlighting: 'low',
        },
        emotional_parameters: {
          enthusiasm_level: 'low',
          validation_frequency: 'low',
          mistake_normalization: 'low',
          confidence_building: 'low',
        },
        detection_areas: [],
        verification_steps: [],
      },
      temperature: 0.7,
      max_tokens: 150,
      is_active: true,
    });
    (updateAIConfig as jest.Mock).mockImplementation(async (_roomId, updates) => ({
      id: 'cfg-1',
      room_id: 'room-1',
      model_name: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 150,
      is_active: true,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
      ...updates,
    }));

    await setStudentAITone({
      roomId: 'room-1',
      userId: 's1',
      tone: 'adult',
      participants: [tutor('t1'), student('s1')],
      aiEnabled: true,
    });

    expect(updateAIConfig).toHaveBeenCalledWith(
      'room-1',
      expect.objectContaining({
        system_prompt: 'PROMPT:high',
        prompt_config: expect.objectContaining({
          role: { role: 'high' },
          student_tone_lock: expect.objectContaining({
            locked: true,
            chosen_role: 'high',
          }),
        }),
      }),
      's1',
      'student_tone_preference'
    );
  });
});

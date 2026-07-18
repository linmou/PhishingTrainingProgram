/**
 * Student AI tone policy helpers.
 * Purpose: 1:1-room gate, Peer/Adult apply, tutor lock metadata for feedback-9 reinterpretation.
 */

import type { SystemPromptConfig } from '../services/prompts/types';
import type { User } from '../types';
import { PRESET_CONFIGS } from '../services/systemPrompts';

export type StudentToneValue = 'peer' | 'adult';

export const STUDENT_TONE_OPTIONS: ReadonlyArray<{
  value: StudentToneValue;
  label: string;
}> = [
  { value: 'peer', label: 'Peer' },
  { value: 'adult', label: 'Adult' },
];

export function countStudentParticipants(
  participants: Array<Pick<User, 'current_role'> | null | undefined>
): number {
  return participants.filter((p) => p?.current_role === 'student').length;
}

export function isStudentToneFeatureAvailable(args: {
  aiEnabled: boolean;
  studentCount: number;
}): boolean {
  return args.aiEnabled && args.studentCount === 1;
}

export function toneToRoleIntensity(tone: StudentToneValue): 'low' | 'high' {
  return tone === 'peer' ? 'low' : 'high';
}

export function roleIntensityToTone(role: 'low' | 'high' | undefined): StudentToneValue {
  return role === 'low' ? 'peer' : 'adult';
}

export function isTutorRoleLocked(
  promptConfig: SystemPromptConfig | null | undefined
): boolean {
  return Boolean(promptConfig?.student_tone_lock?.locked);
}

export function applyStudentToneToPromptConfig(
  promptConfig: SystemPromptConfig | null | undefined,
  tone: StudentToneValue,
  chosenByUserId: string
): SystemPromptConfig {
  const role = toneToRoleIntensity(tone);
  const base = promptConfig
    ? {
        ...PRESET_CONFIGS.supportive_adult,
        ...promptConfig,
        role: promptConfig.role || PRESET_CONFIGS.supportive_adult.role,
        communication_style: {
          ...PRESET_CONFIGS.supportive_adult.communication_style,
          ...promptConfig.communication_style,
        },
        cognitive_parameters: {
          ...PRESET_CONFIGS.supportive_adult.cognitive_parameters,
          ...promptConfig.cognitive_parameters,
        },
        emotional_parameters: {
          ...PRESET_CONFIGS.supportive_adult.emotional_parameters,
          ...promptConfig.emotional_parameters,
        },
        detection_areas: promptConfig.detection_areas || [],
        verification_steps: promptConfig.verification_steps || [],
      }
    : {
        ...PRESET_CONFIGS.supportive_adult,
        detection_areas: [] as string[],
        verification_steps: [] as string[],
      };

  return {
    ...base,
    role: { role },
    student_tone_lock: {
      locked: true,
      chosen_by_user_id: chosenByUserId,
      chosen_role: role,
    },
  };
}

/**
 * Student AI choice policy helpers.
 * Purpose: single-student-room gate, Peer/Adult/Multi-agent apply, tutor lock metadata.
 */

import type { InteractionMode, StudentAIChoice, User } from '../types';
import type { SystemPromptConfig } from '../services/prompts/types';
import { PRESET_CONFIGS } from '../services/systemPrompts';

export type { StudentAIChoice };

export const STUDENT_AI_OPTIONS: ReadonlyArray<{
  value: StudentAIChoice;
  label: string;
}> = [
  { value: 'peer', label: 'Peer' },
  { value: 'adult', label: 'Adult' },
  { value: 'multi_agent', label: 'Multi-agent' },
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

export function choiceToRoleIntensity(choice: StudentAIChoice): 'low' | 'high' {
  return choice === 'peer' ? 'low' : 'high';
}

export function roleIntensityToTone(role: 'low' | 'high' | undefined): StudentAIChoice {
  return role === 'low' ? 'peer' : 'adult';
}

export function interactionModeForChoice(choice: StudentAIChoice): InteractionMode {
  return choice === 'multi_agent' ? 'multi_agent' : 'single_agent';
}

export function isTutorRoleLocked(
  promptConfig: SystemPromptConfig | null | undefined
): boolean {
  return Boolean(promptConfig?.student_tone_lock?.locked);
}

/** Current selector value: Multi-agent when enabled, else the configured Peer/Adult role. */
export function resolveStudentAIChoice(
  promptConfig: SystemPromptConfig | null | undefined
): StudentAIChoice {
  if (promptConfig?.interaction_mode === 'multi_agent') {
    return 'multi_agent';
  }
  return roleIntensityToTone(promptConfig?.role?.role);
}

export function applyStudentAIChoiceToPromptConfig(
  promptConfig: SystemPromptConfig | null | undefined,
  choice: StudentAIChoice,
  chosenByUserId: string
): SystemPromptConfig {
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
    interaction_mode: interactionModeForChoice(choice),
    // Multi-agent keeps the configured Tutor tone; Peer/Adult claim it.
    role: choice === 'multi_agent' ? base.role : { role: choiceToRoleIntensity(choice) },
    student_tone_lock: {
      locked: true,
      chosen_by_user_id: chosenByUserId,
      chosen_role: choice === 'multi_agent' ? base.role.role : choiceToRoleIntensity(choice),
      chosen_choice: choice,
    },
  };
}

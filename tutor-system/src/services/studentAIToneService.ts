/**
 * Persist student-chosen AI tone (peer/adult) for single-student rooms.
 * Purpose: write path for features/student_ai_tone.feature — multi-student blocked.
 */

import type { AIAssistantConfig, User } from '../types';
import { getAIConfig, updateAIConfig } from './aiService';
import { generateSystemPrompt } from './systemPrompts';
import {
  applyStudentToneToPromptConfig,
  countStudentParticipants,
  isStudentToneFeatureAvailable,
  type StudentToneValue,
} from '../utils/studentAITone';

export async function setStudentAITone(args: {
  roomId: string;
  userId: string;
  tone: StudentToneValue;
  participants: Array<Pick<User, 'current_role'> | null | undefined>;
  aiEnabled: boolean;
}): Promise<AIAssistantConfig> {
  const studentCount = countStudentParticipants(args.participants);

  if (!args.aiEnabled) {
    throw new Error('Student AI tone is not available while AI is disabled');
  }

  if (!isStudentToneFeatureAvailable({ aiEnabled: true, studentCount })) {
    throw new Error(
      'Student AI tone is only available in single-student rooms (multi-student blocked)'
    );
  }

  const existing = await getAIConfig(args.roomId);
  const nextPromptConfig = applyStudentToneToPromptConfig(
    existing?.prompt_config ?? null,
    args.tone,
    args.userId
  );
  const systemPrompt = generateSystemPrompt(nextPromptConfig);

  return updateAIConfig(
    args.roomId,
    {
      model_name: existing?.model_name,
      system_prompt: systemPrompt,
      prompt_config: nextPromptConfig,
      temperature: existing?.temperature,
      max_tokens: existing?.max_tokens,
      is_active: true,
    },
    args.userId,
    'student_tone_preference'
  );
}

/**
 * Builds Promptfoo chat prompts using the same ecological message shape as the
 * product room AI path (ecologicalTutorCall).
 */

import {
  buildEcologicalTutorUserTurn,
  buildPromptfooEcologicalChatMessages,
  EcologicalCaseVars,
  EcologicalChatMessage
} from './ecologicalTutorCall';

export type PromptfooEvaluationCaseVars = EcologicalCaseVars;
export type PromptfooChatMessage = EcologicalChatMessage;

/** @deprecated Prefer buildEcologicalTutorUserTurn — kept for test/import stability. */
export const buildEvaluationUserTurn = buildEcologicalTutorUserTurn;

export const buildPromptfooChatMessages = (
  systemPrompt: string
): PromptfooChatMessage[] => buildPromptfooEcologicalChatMessages(systemPrompt);

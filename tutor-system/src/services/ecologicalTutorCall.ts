/**
 * Purpose: single ecological call shape shared by the website AI button and
 * Promptfoo evals — same scenario/history/student packaging and the same
 * "write the tutor response" instruction the room should use.
 */

import { ConversationMessage, PrePopulatedMessage } from '../types';
import { RESPONSE_POLICY } from './prompts/responsePolicy';

export interface EcologicalCaseVars {
  scenario_context: string;
  conversation_history: string;
  student_message: string;
}

export interface EcologicalChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Exact historical user turn from aiService.original.ts. */
export function buildPhase0TutorUserTurn(conversationText: string): string {
  return 'Based on the recent conversation below, suggest a brief follow-up question or prompt that a tutor could use to engage the student further. '
    + "The suggestion should be under 2 sentences, interactive, and focused on deepening the student's understanding.\n\n"
    + `Recent conversation:\n${conversationText}\n\nTutor suggestion:`;
}

export function buildPhase0ChatCompletionMessages(
  systemPrompt: string,
  conversationText: string
): EcologicalChatMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildPhase0TutorUserTurn(conversationText) }
  ];
}

/**
 * Room title + description as shown on the webpage header/card.
 */
export function formatRoomScenarioContext(
  title: string | null | undefined,
  description: string | null | undefined
): string {
  const t = (title || '').trim();
  const d = (description || '').trim();
  if (t && d) return `${t} — ${d}`;
  return t || d || 'Phishing training room';
}

/**
 * Format pre-populated dialogue the same way the UI shows discussion lines
 * (role labels + speaker names). Accepts either:
 * - product array: PrePopulatedMessage[]
 * - legacy object: { posts: [...] }
 */
export function formatPrePopulatedConversationHistory(
  dialogue: PrePopulatedMessage[] | { posts?: any[] } | null | undefined
): string {
  const lines: string[] = [];

  if (Array.isArray(dialogue)) {
    dialogue.forEach((item) => {
      const role = String(item.role || 'others').toUpperCase();
      const name = item.user_name || role;
      lines.push(`${name} [${role}]: ${item.message}`);
    });
    return lines.join('\n');
  }

  if (dialogue && Array.isArray((dialogue as any).posts)) {
    (dialogue as any).posts.forEach((post: any, index: number) => {
      const content = post.content || post.text || post.message || '';
      const name = post.user_name || post.author || `Post ${index + 1}`;
      lines.push(`${name}: ${content}`);
    });
  }

  return lines.join('\n');
}

/**
 * User turn for both product TutorSuggestionService and Promptfoo.
 * Asks for a full tutor response (what the tutor should say next), not a
 * meta "follow-up question only" co-pilot prompt.
 */
export function buildEcologicalTutorUserTurn({
  scenario_context,
  conversation_history,
  student_message
}: EcologicalCaseVars): string {
  return [
    'You are continuing this phishing-training tutoring conversation on the product room page.',
    'Draft the next tutor message the student should hear.',
    '',
    'Scenario context (room title and description):',
    scenario_context,
    '',
    'Recent conversation (as shown in the room discussion):',
    conversation_history || '(no prior turns)',
    '',
    "Student's latest message:",
    student_message,
    '',
    'Write the tutor response only. Do not prefix it with "Tutor:" or any speaker label.',
    'Keep it short; no lectures, no bullet lists, no long explanations.',
    RESPONSE_POLICY
  ].join('\n');
}

/**
 * Build Qwen-compatible chat messages for the ecological product path:
 * system = room system prompt; user = ecological turn with latest student line.
 */
export function buildEcologicalChatCompletionMessages(
  systemPrompt: string,
  vars: EcologicalCaseVars
): EcologicalChatMessage[] {
  return [
    {
      role: 'system',
      content:
        systemPrompt ||
        'You are a helpful AI assistant in an educational tutoring session.'
    },
    {
      role: 'user',
      content: buildEcologicalTutorUserTurn(vars)
    }
  ];
}

/**
 * Convert DB/context ConversationMessage[] into a single conversation_history
 * string matching room discussion style for the ecological user turn.
 * Uses the same labels the product path uses when packaging history.
 */
export function conversationMessagesToHistoryText(
  messages: ConversationMessage[]
): string {
  return messages
    .filter((m) => m.role !== 'system')
    .map((m) => {
      const label =
        m.role === 'assistant' ? 'Tutor/AI' : m.role === 'user' ? 'Participant' : m.role;
      return `${label}: ${m.content}`;
    })
    .join('\n');
}

/**
 * Build ecological case vars from a real room title/description + pre_populated
 * dialogue array — same packaging as TutorSuggestionService on the webpage.
 * Latest student line is also exposed as student_message (product focus line).
 */
export function buildEcologicalCaseVarsFromRoomDialogue(
  title: string,
  description: string | null | undefined,
  dialogue: PrePopulatedMessage[]
): EcologicalCaseVars {
  const lastStudentIndex = (() => {
    for (let i = dialogue.length - 1; i >= 0; i -= 1) {
      if (dialogue[i].role === 'student') return i;
    }
    return -1;
  })();

  const student_message =
    lastStudentIndex >= 0 ? dialogue[lastStudentIndex].message : '';

  // Include full discussion (including latest student line) — product history does too.
  const contextMsgs = prePopulatedToContextMessages(
    dialogue,
    new Date(0).toISOString()
  );

  return {
    scenario_context: formatRoomScenarioContext(title, description),
    conversation_history: conversationMessagesToHistoryText(contextMsgs),
    student_message
  };
}

/**
 * Normalize pre-populated dialogue entries into context messages for the
 * product AI context builder (same content students see in the room).
 */
export function prePopulatedToContextMessages(
  dialogue: PrePopulatedMessage[] | { posts?: any[] } | null | undefined,
  roomCreatedAt: string
): ConversationMessage[] {
  const base = new Date(roomCreatedAt).getTime() / 1000;
  const out: ConversationMessage[] = [];

  if (Array.isArray(dialogue)) {
    dialogue.forEach((item, index) => {
      const roleLabel =
        item.role === 'student'
          ? 'Student'
          : item.role === 'tutor'
            ? 'Tutor'
            : item.role === 'observer'
              ? 'Observer'
              : 'Others';
      out.push({
        role: item.role === 'tutor' ? 'assistant' : 'user',
        content: `${roleLabel} (${item.user_name || roleLabel}): ${item.message}`,
        timestamp: base + index
      });
    });
    return out;
  }

  if (dialogue && Array.isArray((dialogue as any).posts)) {
    (dialogue as any).posts.slice(0, 5).forEach((post: any, index: number) => {
      out.push({
        role: 'user',
        content: `Student shared for analysis: ${post.content || post.text || post.message || ''}`,
        timestamp: base + index + 1
      });
    });
  }

  return out;
}

/** Promptfoo template messages (mustache vars for cases). */
export function buildPromptfooEcologicalChatMessages(
  systemPrompt: string
): EcologicalChatMessage[] {
  return buildEcologicalChatCompletionMessages(systemPrompt, {
    scenario_context: '{{scenario_context}}',
    conversation_history: '{{conversation_history}}',
    student_message: '{{student_message}}'
  });
}

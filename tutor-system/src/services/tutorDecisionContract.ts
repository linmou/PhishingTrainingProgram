// #!/usr/bin/env node
// Purpose: validate tutor decisions and own the multi-agent response grammar.
import type { DecodedAgentMessage, RoomParticipationMode, TutorBehaviorDecision, TutorDecisionMode, TutorInstruction } from '../types';

const instructions: Array<TutorInstruction | null> = ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', 'multiagent', null];

/** Tag written at the start of each message of a multiagent response. */
const AGENT_TAG_PATTERN = '\\[agent:([a-z_-]+)\\]';
const ANY_AGENT_TAG = new RegExp(AGENT_TAG_PATTERN, 'i');
const ALL_AGENT_TAGS = new RegExp(AGENT_TAG_PATTERN, 'gi');

export interface TutorDecisionParseOptions {
  /** @deprecated Production requests no longer enable multi-agent decisions. */
  allowMultiagent?: boolean;
}

/** Delay between the first and second approved character message. */
export const MULTI_AGENT_PLAYBACK_DELAY_MS = 2000;

/** Multi-agent is a presentation decision; room participation stays tutoring/Guard. */
export function toRoomParticipationMode(mode: TutorDecisionMode): RoomParticipationMode {
  return mode === 'guard' ? 'guard' : 'tutoring';
}

function readAgentTag(content: string): { character: string; index: number; end: number } | null {
  const match = /^\s*\[agent:([a-z_-]+)\]/i.exec(content);
  if (!match) return null;
  const character = match[1].toLowerCase();
  if (character !== 'riley' && character !== 'tutor') return null;
  return { character, index: match.index, end: match[0].length };
}

/**
 * Decode one stored or generated message. Only AI-generated tutor-side rows carry a character tag;
 * a learner typing the same literal text stays a learner message.
 */
export function decodeAgentMessage(message: {
  content: string;
  user_role?: string | null;
  response_mode?: string | null;
}): DecodedAgentMessage | null {
  if (message.response_mode !== 'multiagent' || message.user_role !== 'tutor') return null;
  const tag = readAgentTag(message.content);
  if (!tag) return null;
  const body = message.content.slice(tag.end).trim();
  if (!body) return null;
  return { character: tag.character as 'riley' | 'tutor', content: body };
}

/**
 * @deprecated Retained for compatibility with legacy reviewed drafts.
 * Serialize one character message for storage in the existing messages table.
 */
export function formatAgentTaggedContent(character: 'riley' | 'tutor', content: string): string {
  return `[agent:${character}] ${content.trim()}`;
}

export function containsAgentTag(response: string): boolean {
  return ANY_AGENT_TAG.test(response);
}

/**
 * Decode one or two tagged character messages of a multiagent response in model-generated order.
 * Rejects duplicate/unknown tags, empty bodies and untagged text before the first tag.
 */
/** @deprecated Retained for compatibility with legacy decisions and tests. */
export function decodeMultiAgentResponse(
  response: string
): DecodedAgentMessage[] {
  if (typeof response !== 'string' || !response.trim()) {
    throw new Error('AI tutor decision multiagent response must be a non-empty string');
  }

  const matches = Array.from(response.matchAll(ALL_AGENT_TAGS));
  if (matches.length < 1 || matches.length > 2) {
    throw new Error('AI tutor decision multiagent response must contain one or two agent tags');
  }
  if (response.slice(0, matches[0].index).trim()) {
    throw new Error('AI tutor decision multiagent response must not contain untagged text before the first agent tag');
  }

  const decoded = matches.map((match, index) => {
    const character = match[1].toLowerCase();
    if (character !== 'riley' && character !== 'tutor') {
      throw new Error('AI tutor decision multiagent response contains an unknown agent tag');
    }
    const end = (match.index ?? 0) + match[0].length;
    const nextStart = index + 1 < matches.length ? matches[index + 1].index ?? response.length : response.length;
    const content = response.slice(end, nextStart).trim();
    if (!content) {
      throw new Error('AI tutor decision multiagent response must not contain an empty message');
    }
    return { character: character as 'riley' | 'tutor', content };
  });

  if (decoded.length === 2 && decoded[0].character === decoded[1].character) {
    throw new Error('AI tutor decision multiagent response must not duplicate a character tag');
  }

  return decoded;
}

export function parseTutorDecision(
  content: unknown,
  options?: TutorDecisionParseOptions
): TutorBehaviorDecision {
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI response did not contain a structured tutor decision');
  let candidate: any;
  try { candidate = JSON.parse(content); } catch { throw new Error('AI response was not valid JSON for a tutor decision'); }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('AI response must be a JSON object for a tutor decision');
  const first = content.match(/^\s*\{\s*("(?:[^"\\]|\\.)*")\s*:/);
  if (!first || JSON.parse(first[1]) !== 'reason') throw new Error('AI tutor decision reason must be serialized first');
  if ('mode' in candidate || 'mode_reason' in candidate || 'reasoning' in candidate || 'suggested_response' in candidate) {
    throw new Error('AI tutor decision must use the v2 reason, decision, and response fields');
  }
  for (const field of ['reason', 'response']) {
    if (typeof candidate[field] !== 'string' || !candidate[field].trim()) throw new Error(`AI tutor decision ${field} must be a non-empty string`);
  }
  if (!candidate.decision || typeof candidate.decision !== 'object' || Array.isArray(candidate.decision)) throw new Error('AI tutor decision is missing or invalid');

  const { mode, instruction } = candidate.decision;
  const response: string = candidate.response.trim();
  const reason: string = candidate.reason.trim();

  if (mode === 'multiagent') {
    if (options?.allowMultiagent !== true) throw new Error('AI tutor decision multiagent mode is not allowed for this turn');
    if (instruction !== 'multiagent') throw new Error('AI tutor decision multiagent mode requires the multiagent instruction');
    decodeMultiAgentResponse(response);
    return { reason, decision: { mode: 'multiagent', instruction: 'multiagent' }, response };
  }

  if (mode !== 'tutoring' && mode !== 'guard') throw new Error('AI tutor decision mode must be tutoring or guard');
  if (instruction === 'multiagent') throw new Error('AI tutor decision multiagent instruction is invalid outside multiagent mode');
  if (!instructions.includes(instruction)) throw new Error('AI tutor decision instruction is missing or invalid');
  if (instruction === null && mode !== 'guard') throw new Error('AI tutor decision null instruction is allowed only in Guard');
  if (containsAgentTag(response)) throw new Error('AI tutor decision response must not contain agent tags outside multiagent mode');
  return {
    reason,
    decision: { mode, instruction },
    response
  };
}

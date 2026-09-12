// #!/usr/bin/env node
// Purpose: validate reason-first tutor decisions for both the legacy v2 and explicit transfer v3 contracts,
// and own the multi-agent response grammar (two tagged character messages, either order).
import { DecodedAgentMessage, RoomParticipationMode, TutorBehaviorDecision, TutorDecisionMode, TutorInstruction } from '../types';
import { TutorDecisionV3, TutorInstruction as TutorInstructionV3 } from '../types/assessment';
import { countAssessmentSegments, validateAssessmentRendering } from './assessmentRendering';

const instructions: Array<TutorInstruction | null> = ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', 'multiagent', null];

/** Tag written at the start of each message of a multiagent response. */
const AGENT_TAG_PATTERN = '\\[agent:([a-z_-]+)\\]';
const ANY_AGENT_TAG = new RegExp(AGENT_TAG_PATTERN, 'i');
const ALL_AGENT_TAGS = new RegExp(AGENT_TAG_PATTERN, 'gi');

export interface TutorDecisionParseOptions {
  /** Multi-agent decisions are rejected unless the turn is multi-agent enabled. */
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
  is_ai_generated?: boolean | null;
  user_role?: string | null;
}): DecodedAgentMessage | null {
  if (message.is_ai_generated !== true || message.user_role !== 'tutor') return null;
  const tag = readAgentTag(message.content);
  if (!tag) return null;
  const body = message.content.slice(tag.end).trim();
  if (!body) return null;
  return { character: tag.character as 'riley' | 'tutor', content: body };
}

/** Serialize one character message for storage in the existing messages table. */
export function formatAgentTaggedContent(character: 'riley' | 'tutor', content: string): string {
  return `[agent:${character}] ${content.trim()}`;
}

export function containsAgentTag(response: string): boolean {
  return ANY_AGENT_TAG.test(response);
}

/**
 * Decode the two tagged character messages of a multiagent response, in model-generated order.
 * Rejects missing/duplicate/unknown tags, empty bodies and untagged text before the first tag.
 */
export function decodeMultiAgentResponse(
  response: string
): [DecodedAgentMessage, DecodedAgentMessage] {
  if (typeof response !== 'string' || !response.trim()) {
    throw new Error('AI tutor decision multiagent response must be a non-empty string');
  }

  const matches = Array.from(response.matchAll(ALL_AGENT_TAGS));
  if (matches.length !== 2) {
    throw new Error('AI tutor decision multiagent response must contain exactly two agent tags');
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

  if (decoded[0].character === decoded[1].character) {
    throw new Error('AI tutor decision multiagent response must contain exactly one Riley tag and one Tutor tag');
  }

  return [decoded[0], decoded[1]];
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

interface V3ValidationContext {
  knownItemIds: ReadonlyArray<string>;
  knownMessageIds: ReadonlyArray<string>;
}

const v3Instructions: TutorInstructionV3[] = [
  'protective_instruction',
  'correction',
  'scaffolding',
  'explanation',
  'consolidation',
  'transfer_assess',
  'guard',
];

const v3Modes = ['tutoring', 'guard', 'assessment'] as const;
const v3OptionIds = ['A', 'B', 'C', 'D'] as const;

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AI tutor decision ${field} must be a non-empty string`);
  return value.trim();
}

function requireReasonFirst(content: string): void {
  const first = content.match(/^\s*\{\s*("(?:[^"\\]|\\.)*")\s*:/);
  if (!first || JSON.parse(first[1]) !== 'reason') throw new Error('AI tutor decision reason must be serialized first');
}

function validateV3Assessment(candidate: any, context: V3ValidationContext): any {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('assessment payload is required');
  if (candidate.selection_type !== 'single' && candidate.selection_type !== 'multiple') throw new Error('assessment selection_type is invalid');
  if (!Array.isArray(candidate.options) || candidate.options.length !== 4) throw new Error('assessment options must contain exactly four options');
  candidate.options.forEach((option: any, index: number) => {
    if (!option || option.id !== v3OptionIds[index] || typeof option.text !== 'string' || !option.text.trim()) throw new Error('assessment options must use canonical A-D IDs and non-empty text');
  });
  const optionTexts = candidate.options.map((option: any) => option.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase());
  if (new Set(optionTexts).size !== 4) throw new Error('assessment options must be unique');
  if (!Array.isArray(candidate.correct_option_ids)) throw new Error('assessment correct option IDs are required');
  const keys = candidate.correct_option_ids as unknown[];
  const validKeys = keys.every((id) => v3OptionIds.includes(id as any));
  const uniqueKeys = new Set(keys).size === keys.length;
  const validCardinality = candidate.selection_type === 'single' ? keys.length === 1 : keys.length >= 2 && keys.length <= 3;
  if (!validKeys || !uniqueKeys || !validCardinality) throw new Error('assessment correct option IDs have invalid cardinality or IDs');
  if (!candidate.transfer_basis || typeof candidate.transfer_basis !== 'object') throw new Error('assessment transfer_basis is required');
  requireNonEmptyString(candidate.transfer_basis.concept_rule, 'transfer concept_rule');
  requireNonEmptyString(candidate.transfer_basis.source_context, 'transfer source_context');
  requireNonEmptyString(candidate.transfer_basis.changed_context, 'transfer changed_context');
  if (!Array.isArray(candidate.transfer_basis.source_evidence_message_ids) || candidate.transfer_basis.source_evidence_message_ids.length === 0) throw new Error('assessment source evidence IDs are required');
  if (candidate.transfer_basis.source_evidence_message_ids.some((id: unknown) => !context.knownMessageIds.includes(id as string))) throw new Error('assessment source evidence message ID is unknown');
  const rendered = validateAssessmentRendering({
    stem: candidate.response,
    selection_type: candidate.selection_type,
    options: candidate.options,
  });
  if (!rendered.valid) throw new Error(rendered.errors[0]);
  return {
    selection_type: candidate.selection_type,
    options: candidate.options.map((option: any) => ({ id: option.id, text: option.text.trim() })),
    correct_option_ids: [...keys],
    transfer_basis: {
      concept_rule: candidate.transfer_basis.concept_rule.trim(),
      source_context: candidate.transfer_basis.source_context.trim(),
      changed_context: candidate.transfer_basis.changed_context.trim(),
      source_evidence_message_ids: [...candidate.transfer_basis.source_evidence_message_ids],
    },
    stem: candidate.response.trim(),
    rendered_text: [candidate.response.trim(), candidate.selection_type === 'multiple' ? 'Select all that apply.' : 'Choose one.', ...candidate.options.map((option: any) => `${option.id}. ${option.text.trim()}`)].join('\n'),
  };
}

export function parseTutorDecisionV3(content: unknown, context: V3ValidationContext): TutorDecisionV3 {
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI response did not contain a structured v3 tutor decision');
  requireReasonFirst(content);
  let candidate: any;
  try {
    candidate = JSON.parse(content);
  } catch {
    throw new Error('AI response was not valid JSON for a v3 tutor decision');
  }
  const reason = requireNonEmptyString(candidate?.reason, 'reason');
  if (countAssessmentSegments(reason) > 40) throw new Error('AI tutor decision reason must contain at most 40 word-like segments');
  const response = requireNonEmptyString(candidate?.response, 'response');
  if (!candidate.decision || typeof candidate.decision !== 'object' || Array.isArray(candidate.decision)) throw new Error('AI tutor decision decision is required');
  const { mode, instruction, target_item_id: targetItemId } = candidate.decision;
  if (!v3Modes.includes(mode)) throw new Error('AI tutor decision mode is invalid');
  if (!v3Instructions.includes(instruction)) throw new Error('AI tutor decision instruction is missing or invalid');
  if (targetItemId !== null && (typeof targetItemId !== 'string' || !context.knownItemIds.includes(targetItemId))) throw new Error('AI tutor decision target item ID is unknown');
  const assessment = candidate.assessment === null ? null : validateV3Assessment({ ...candidate.assessment, response }, context);

  if (mode === 'assessment' && (instruction !== 'transfer_assess' || targetItemId === null || assessment === null)) throw new Error('assessment mode requires transfer_assess instruction, target, and assessment payload');
  if (mode === 'tutoring' && (instruction === 'transfer_assess' || instruction === 'guard' || targetItemId !== null || assessment !== null)) throw new Error('tutoring mode has incompatible instruction or assessment payload');
  if (mode === 'guard' && (instruction === 'transfer_assess' || targetItemId !== null || assessment !== null)) throw new Error('guard mode has incompatible instruction or assessment payload');
  if (mode === 'assessment' && instruction !== 'transfer_assess') throw new Error('assessment mode instruction must be transfer_assess');
  if (mode !== 'assessment' && assessment !== null) throw new Error('non-assessment mode cannot include an assessment payload');
  return {
    reason,
    decision: { mode, instruction, target_item_id: targetItemId },
    response,
    assessment,
  };
}

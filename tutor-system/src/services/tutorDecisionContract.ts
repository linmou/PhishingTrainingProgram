// #!/usr/bin/env node
// Purpose: validate reason-first tutor decisions for both the legacy v2 and explicit transfer v3 contracts.
import type { TutorBehaviorDecision, TutorInstruction } from '../types';
import type { TutorDecisionV3, TutorInstruction as TutorInstructionV3 } from '../types/assessment';
import { countAssessmentSegments, validateAssessmentRendering } from './assessmentRendering';

const instructions: Array<TutorInstruction | null> = ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', null];

export function parseTutorDecision(content: unknown): TutorBehaviorDecision {
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
  if (candidate.decision.mode !== 'tutoring' && candidate.decision.mode !== 'guard') throw new Error('AI tutor decision mode must be tutoring or guard');
  if (!instructions.includes(candidate.decision.instruction)) throw new Error('AI tutor decision instruction is missing or invalid');
  if (candidate.decision.instruction === null && candidate.decision.mode !== 'guard') throw new Error('AI tutor decision null instruction is allowed only in Guard');
  return {
    reason: candidate.reason.trim(),
    decision: { mode: candidate.decision.mode, instruction: candidate.decision.instruction },
    response: candidate.response.trim()
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

const GENERIC_CONTEXT_WORDS = new Set([
  'a', 'an', 'the', 'this', 'that', 'these', 'those', 'some', 'any',
  'using', 'with', 'from', 'into', 'in', 'on', 'at', 'of', 'for', 'to', 'by',
  'and', 'or', 'but', 'not', 'no', 'is', 'are', 'was', 'were', 'be', 'been',
  'it', 'its', 'same', 'new', 'context', 'situation', 'example', 'scenario', 'case',
]);

function contextTokens(value: string): Set<string> {
  return new Set(
    value
      .normalize('NFKC')
      .toLocaleLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => !GENERIC_CONTEXT_WORDS.has(token)) ?? []
  );
}

/**
 * Reject a "changed" context that merely restates the source context, which is the
 * cosmetic brand/name substitution and unstated-prerequisite failure class from FR-003.
 * Any substantive situation, actor, channel, or artefact word that the source context
 * does not contain makes the changed context a new situation.
 */
function hasNewSituation(sourceContext: string, changedContext: string): boolean {
  const source = contextTokens(sourceContext);
  const changed = contextTokens(changedContext);
  if (changed.size === 0) return false;
  return Array.from(changed).some((token) => !source.has(token));
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
  if (!hasNewSituation(candidate.transfer_basis.source_context, candidate.transfer_basis.changed_context)) {
    throw new Error('assessment transfer changed_context must describe a situation the source context does not already state');
  }
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

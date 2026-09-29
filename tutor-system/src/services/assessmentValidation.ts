// Purpose: validate an assessment-only draft before tutor review and delivery.

import type { AssessmentOptionId, TransferAssessmentDraft } from '../types/assessment';
// @ts-ignore Deno requires the extension; CRA resolves the same TypeScript source.
import { renderAssessment, validateAssessmentRendering } from './assessmentRendering.ts';

export interface AssessmentValidationContext {
  knownItemIds: ReadonlyArray<string>;
  knownMessageIds: ReadonlyArray<string>;
}

const OPTION_IDS: AssessmentOptionId[] = ['A', 'B', 'C', 'D'];

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any> : {};
}

function nonempty(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

export function validateAssessmentDraft(
  content: unknown,
  context: AssessmentValidationContext
): TransferAssessmentDraft {
  const source = typeof content === 'string' ? record(JSON.parse(content)) : record(content);
  if (Object.keys(source).sort().join(',') !== 'assessment,reason,target_item_id') {
    throw new Error('assessment draft must contain only reason, target_item_id, and assessment');
  }
  const reason = nonempty(source.reason, 'reason');
  const targetItemId = nonempty(source.target_item_id, 'target');
  if (!context.knownItemIds.includes(targetItemId)) throw new Error('assessment target is unknown');
  const assessment = record(source.assessment);
  const stem = nonempty(assessment.stem, 'assessment stem');
  if (assessment.selection_type !== 'single' && assessment.selection_type !== 'multiple') {
    throw new Error('assessment selection_type is invalid');
  }
  if (!Array.isArray(assessment.options) || assessment.options.length !== 4 ||
    assessment.options.some((option: any, index: number) =>
      option?.id !== OPTION_IDS[index] || typeof option.text !== 'string' || !option.text.trim())) {
    throw new Error('assessment options must use four nonempty A-D choices');
  }
  const options = assessment.options.map((option: any) => ({ id: option.id as AssessmentOptionId, text: option.text.trim() }));
  if (new Set(options.map((option: { text: string }) => option.text.normalize('NFKC').toLowerCase())).size !== 4) {
    throw new Error('assessment options must be unique');
  }
  const keys = assessment.correct_option_ids;
  const requiredCount = assessment.selection_type === 'single' ? keys?.length === 1 : keys?.length >= 2 && keys?.length <= 3;
  if (!Array.isArray(keys) || !requiredCount || new Set(keys).size !== keys.length ||
    keys.some((key: unknown) => !OPTION_IDS.includes(key as AssessmentOptionId))) {
    throw new Error('assessment correct option IDs are invalid');
  }
  const basis = record(assessment.transfer_basis);
  const sourceContext = nonempty(basis.source_context, 'transfer source_context');
  const changedContext = nonempty(basis.changed_context, 'transfer changed_context');
  const sourceTokens = new Set(sourceContext.toLowerCase().match(/[a-z0-9]+/g) || []);
  if (!(changedContext.toLowerCase().match(/[a-z0-9]+/g) || []).some(token => !sourceTokens.has(token))) {
    throw new Error('assessment changed_context must introduce a new situation');
  }
  const evidenceIds = basis.source_evidence_message_ids;
  if (!Array.isArray(evidenceIds) || !evidenceIds.length ||
    evidenceIds.some((id: unknown) => typeof id !== 'string' || !context.knownMessageIds.includes(id))) {
    throw new Error('assessment source evidence message ID is unknown');
  }
  const rendering = validateAssessmentRendering({ stem, selection_type: assessment.selection_type, options });
  if (!rendering.valid) throw new Error(rendering.errors[0]);
  return {
    reason,
    target_item_id: targetItemId,
    assessment: {
      selection_type: assessment.selection_type,
      stem,
      options,
      correct_option_ids: [...keys],
      learner_safe_explanation: nonempty(assessment.learner_safe_explanation, 'assessment learner_safe_explanation'),
      transfer_basis: {
        concept_rule: nonempty(basis.concept_rule, 'transfer concept_rule'),
        source_context: sourceContext,
        changed_context: changedContext,
        source_evidence_message_ids: [...evidenceIds],
      },
      rendered_text: renderAssessment({ stem, selection_type: assessment.selection_type, options }),
    },
  };
}

#!/usr/bin/env node
// Test responsible for assessment-only draft validation at the transfer contract boundary.

import { validateAssessmentDraft } from '../assessmentValidation';

const itemId = '11111111-1111-4111-8111-111111111111';
const sourceMessageId = '22222222-2222-4222-8222-222222222222';

function draft(overrides: Record<string, unknown> = {}) {
  return {
    reason: 'The learner acknowledged the rule in the original account-alert example.',
    target_item_id: itemId,
    assessment: {
      selection_type: 'single',
      stem: 'Imagine a teammate sends a prize link from a familiar account.',
      options: [
        { id: 'A', text: 'The account proves the link is safe' },
        { id: 'B', text: 'The account could have been compromised' },
        { id: 'C', text: 'Every prize message is a scam' },
        { id: 'D', text: 'Opening the link proves identity' },
      ],
      correct_option_ids: ['B'],
      learner_safe_explanation: 'A familiar displayed identity does not verify who controls the account.',
      transfer_basis: {
        concept_rule: 'A familiar displayed identity is not sufficient authentication.',
        source_context: 'An account-warning email using a familiar organization name.',
        changed_context: 'A prize link from a known game teammate account.',
        source_evidence_message_ids: [sourceMessageId],
      },
    },
    ...overrides,
  };
}

const knownIds = { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] };

describe('assessment-only draft contract', () => {
  it('accepts a private assessment without tutor mode or duplicate response', () => {
    const parsed = validateAssessmentDraft(draft(), knownIds);
    expect(parsed.target_item_id).toBe(itemId);
    expect(parsed.assessment.stem).toBe('Imagine a teammate sends a prize link from a familiar account.');
    expect(parsed.assessment.correct_option_ids).toEqual(['B']);
    expect(parsed).not.toHaveProperty('decision');
    expect(parsed).not.toHaveProperty('response');
  });

  it('rejects legacy tutor-decision fields and unknown targets', () => {
    expect(() => validateAssessmentDraft(draft({ decision: { mode: 'assessment' } }), knownIds)).toThrow('only');
    expect(() => validateAssessmentDraft(draft({ response: 'duplicate question' }), knownIds)).toThrow('only');
    expect(() => validateAssessmentDraft(draft({ target_item_id: 'not-known' }), knownIds)).toThrow('target');
  });

  it('requires assessment payloads to use exactly A-D and valid key cardinality', () => {
    const validAssessment = draft().assessment;

    expect(() => validateAssessmentDraft(draft({ assessment: { ...validAssessment, options: validAssessment.options.slice(0, 3) } }), knownIds)).toThrow('options');
    expect(() => validateAssessmentDraft(draft({ assessment: { ...validAssessment, options: validAssessment.options.map((option) => ({ ...option, id: 'A' })) } }), knownIds)).toThrow('options');
    expect(() => validateAssessmentDraft(draft({ assessment: { ...validAssessment, options: [validAssessment.options[1], validAssessment.options[0], validAssessment.options[2], validAssessment.options[3]] } }), knownIds)).toThrow('options');
    expect(() => validateAssessmentDraft(draft({ assessment: { ...validAssessment, correct_option_ids: [] } }), knownIds)).toThrow('correct');
    expect(() => validateAssessmentDraft(draft({ assessment: { ...validAssessment, correct_option_ids: ['A', 'B', 'C', 'D'] } }), knownIds)).toThrow('correct');
  });

  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['non-string', 42],
  ])('rejects a %s learner-safe explanation', (_caseName, explanation) => {
    const payload: any = draft();
    if (explanation === undefined) {
      delete payload.assessment.learner_safe_explanation;
    } else {
      payload.assessment.learner_safe_explanation = explanation;
    }

    expect(() => validateAssessmentDraft(payload, knownIds)).toThrow(/learner_safe_explanation|explanation/i);
  });

  it('rejects unknown source evidence and missing private basis', () => {
    const assessment = draft().assessment;
    expect(() => validateAssessmentDraft(draft({ assessment: {
      ...assessment,
      transfer_basis: { ...assessment.transfer_basis, source_evidence_message_ids: ['unknown'] },
    } }), knownIds)).toThrow('unknown');
    expect(() => validateAssessmentDraft(draft({ assessment: {
      ...assessment,
      transfer_basis: undefined,
    } }), knownIds)).toThrow('transfer');
  });
});

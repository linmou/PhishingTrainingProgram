#!/usr/bin/env node
// Test responsible for v3 tutor decision mode/instruction compatibility and explicit transfer payload validation.

import { parseTutorDecisionV3 } from '../tutorDecisionContract';

const itemId = '11111111-1111-4111-8111-111111111111';
const sourceMessageId = '22222222-2222-4222-8222-222222222222';

function decision(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    reason: 'The learner acknowledged the rule in the original account-alert example.',
    decision: {
      mode: 'assessment',
      instruction: 'transfer_assess',
      target_item_id: itemId,
    },
    response: 'Imagine a teammate sends a prize link from a familiar account.',
    assessment: {
      selection_type: 'single',
      options: [
        { id: 'A', text: 'The account proves the link is safe' },
        { id: 'B', text: 'The account could have been compromised' },
        { id: 'C', text: 'Every prize message is a scam' },
        { id: 'D', text: 'Opening the link proves identity' },
      ],
      correct_option_ids: ['B'],
      transfer_basis: {
        concept_rule: 'A familiar displayed identity is not sufficient authentication.',
        source_context: 'An account-warning email using a familiar organization name.',
        changed_context: 'A prize link from a known game teammate account.',
        source_evidence_message_ids: [sourceMessageId],
      },
    },
    ...overrides,
  });
}

describe('v3 tutor decision contract', () => {
  it('accepts a valid reason-first assessment payload', () => {
    expect(parseTutorDecisionV3(decision(), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] })).toMatchObject({
      decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: itemId },
    });
  });

  it('rejects null instructions, invalid target IDs, and incompatible mode pairs', () => {
    expect(() => parseTutorDecisionV3(decision({ decision: { mode: 'tutoring', instruction: null, target_item_id: null }, assessment: null }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] })).toThrow('instruction');
    expect(() => parseTutorDecisionV3(decision({ decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: 'not-known' } }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] })).toThrow('target');
    expect(() => parseTutorDecisionV3(decision({ decision: { mode: 'tutoring', instruction: 'transfer_assess', target_item_id: itemId } }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] })).toThrow('instruction');
    expect(() => parseTutorDecisionV3(decision({ decision: { mode: 'assessment', instruction: 'explanation', target_item_id: itemId } }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] })).toThrow('instruction');
  });

  it('requires assessment payloads to use exactly A-D and valid key cardinality', () => {
    const validAssessment = JSON.parse(decision()).assessment;
    const knownIds = { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] };

    expect(() => parseTutorDecisionV3(decision({ assessment: { ...validAssessment, options: validAssessment.options.slice(0, 3) } }), knownIds)).toThrow('options');
    expect(() => parseTutorDecisionV3(decision({ assessment: { ...validAssessment, options: validAssessment.options.map((option: { id: string; text: string }) => ({ ...option, id: 'A' })) } }), knownIds)).toThrow('options');
    expect(() => parseTutorDecisionV3(decision({ assessment: { ...validAssessment, options: [validAssessment.options[1], validAssessment.options[0], validAssessment.options[2], validAssessment.options[3]] } }), knownIds)).toThrow('options');
    expect(() => parseTutorDecisionV3(decision({ assessment: { ...validAssessment, options: validAssessment.options.map((option: { id: string; text: string }) => option.id === 'D' ? { ...option, id: 'E' } : option) } }), knownIds)).toThrow('options');
    expect(() => parseTutorDecisionV3(decision({ assessment: { ...validAssessment, correct_option_ids: [] } }), knownIds)).toThrow('correct');
    expect(() => parseTutorDecisionV3(decision({ assessment: { ...validAssessment, correct_option_ids: ['A', 'B', 'C', 'D'] } }), knownIds)).toThrow('correct');
  });

  it('allows ordinary tutoring and Guard turns only with explicit instructions', () => {
    expect(parseTutorDecisionV3(decision({
      decision: { mode: 'tutoring', instruction: 'explanation', target_item_id: null },
      assessment: null,
    }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] }).decision.mode).toBe('tutoring');
    expect(parseTutorDecisionV3(decision({
      decision: { mode: 'guard', instruction: 'guard', target_item_id: null },
      assessment: null,
    }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] }).decision.instruction).toBe('guard');
  });

  it('keeps the reason as the first serialized field and rejects a reordered payload', () => {
    const knownIds = { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] };
    const reordered = JSON.stringify({
      decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: itemId },
      reason: 'The learner applied the rule.',
      response: 'A teammate sends a prize link.',
      assessment: JSON.parse(decision()).assessment,
    });

    expect(parseTutorDecisionV3(decision(), knownIds).reason.length).toBeGreaterThan(0);
    expect(() => parseTutorDecisionV3(reordered, knownIds)).toThrow('reason');
  });

  it.each(['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation'])(
    'accepts tutoring with the real teaching instruction %s and a null target/assessment',
    (instruction) => {
      const parsed = parseTutorDecisionV3(decision({
        decision: { mode: 'tutoring', instruction, target_item_id: null },
        assessment: null,
      }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] });

      expect(parsed.decision).toEqual({ mode: 'tutoring', instruction, target_item_id: null });
      expect(parsed.assessment).toBeNull();
    }
  );

  it.each(['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation'])(
    'accepts Guard with the real teaching instruction %s and a null target/assessment',
    (instruction) => {
      const parsed = parseTutorDecisionV3(decision({
        decision: { mode: 'guard', instruction, target_item_id: null },
        assessment: null,
      }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] });

      expect(parsed.decision).toEqual({ mode: 'guard', instruction, target_item_id: null });
      expect(parsed.assessment).toBeNull();
    }
  );

  it.each(['transfer_assess', 'scaffolding'])(
    'rejects Guard with %s when a target or an assessment payload is present',
    (instruction) => {
      const knownIds = { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] };

      expect(() => parseTutorDecisionV3(decision({
        decision: { mode: 'guard', instruction, target_item_id: itemId },
        assessment: null,
      }), knownIds)).toThrow('guard');
      expect(() => parseTutorDecisionV3(decision({
        decision: { mode: 'guard', instruction, target_item_id: null },
      }), knownIds)).toThrow('guard');
    }
  );

  it('rejects Guard with transfer_assess because the instruction is assessment-only', () => {
    expect(() => parseTutorDecisionV3(decision({
      decision: { mode: 'guard', instruction: 'transfer_assess', target_item_id: null },
      assessment: null,
    }), { knownItemIds: [itemId], knownMessageIds: [sourceMessageId] })).toThrow('guard');
  });
});

#!/usr/bin/env node
// Purpose: integration-owned E01 handoff test. It executes component 101's real pure resolver and passes that same produced result into the component 102 persistence-contract projection, so the edge is proven on the real upstream artifact rather than a hand-authored fixture.

import { resolveTransferAnswer } from '../../tutor-system/src/services/transferAssessmentOrchestrator';

const OPTIONS = [
  { id: 'A' as const, text: 'A familiar account proves the link is safe' },
  { id: 'B' as const, text: 'The account could have been compromised' },
  { id: 'C' as const, text: 'Every prize message is necessarily a scam' },
  { id: 'D' as const, text: 'Opening the link proves the sender identity' },
];

const SNAPSHOT = 'integration-snapshot-1';

const PRIVATE_FIELD_NAMES = [
  'correct_option_ids',
  'transfer_basis',
  'rationale',
  'raw_model_output',
  'api_operation',
  'transport',
];

const VALID_PROGRESS_PAIRS = [
  'pending:none',
  'partially_covered:basic',
  'needs_review:basic',
  'covered:good',
];

function publicAssessment() {
  return {
    id: 'assessment-1',
    selection_type: 'single' as const,
    stem: 'A familiar teammate sends a prize link.',
    rendered_text: 'A familiar teammate sends a prize link.\nChoose one.',
    options: OPTIONS,
  };
}

function makeAssessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'assessment-1',
    item_id: 'item-1',
    selection_type: 'single' as const,
    options: OPTIONS,
    correct_option_ids: ['B' as const],
    progress_snapshot_hash: SNAPSHOT,
    ...overrides,
  };
}

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    progress: { status: 'partially_covered' as const, understanding_level: 'basic' as const },
    participation_mode: 'tutoring' as const,
    progress_snapshot_hash: SNAPSHOT,
    feedback_required: false,
    eligible_assessment_item_ids: ['item-1'],
    unresolved_assessment: publicAssessment(),
    pending_repair_message_id: null,
    ...overrides,
  };
}

function makeAnswer(content: string, overrides: Record<string, unknown> = {}) {
  return {
    delivered: true,
    answer_message_id: 'answer-1',
    content,
    assessment: makeAssessment(),
    ...overrides,
  };
}

/**
 * Component 102 persistence-contract projection. It consumes whatever the 101
 * resolver produced and derives the write set from it, so this handoff test fails
 * if 101 ever returns a value that 102 could not persist safely.
 */
function projectForPersistence(result: ReturnType<typeof resolveTransferAnswer>) {
  return {
    graded: result.disposition === 'passed' || result.disposition === 'failed',
    write: result.applied_transition !== null,
    applied_transition: result.applied_transition,
    next_pair: result.progress,
    feedback_required: result.feedback_required,
    learner_projection: {
      disposition: result.disposition,
      next_action: result.next_action,
      assessment_id: result.assessment_id,
    },
  };
}

describe('E01 101-transfer-domain -> 102-transfer-backend', () => {
  it('grades a delivered correct answer once and asks for tutor feedback', () => {
    const produced = resolveTransferAnswer(makeContext() as never, makeAnswer('B') as never);
    const persisted = projectForPersistence(produced);

    expect(produced.disposition).toBe('passed');
    expect(produced.applied_transition).toBe('assessment_pass');
    expect(produced.progress).toEqual({ status: 'covered', understanding_level: 'good' });
    expect(produced.feedback_required).toBe(true);
    expect(persisted.graded).toBe(true);
    expect(persisted.write).toBe(true);
    expect(persisted.applied_transition).toBe('assessment_pass');
  });

  it('forces review and repair for a delivered wrong answer', () => {
    const produced = resolveTransferAnswer(makeContext() as never, makeAnswer('A') as never);
    const persisted = projectForPersistence(produced);

    expect(produced.disposition).toBe('failed');
    expect(produced.applied_transition).toBe('assessment_fail');
    expect(produced.progress).toEqual({ status: 'needs_review', understanding_level: 'basic' });
    expect(produced.next_action).toBe('await_tutor_repair');
    expect(persisted.write).toBe(true);
  });

  it.each([
    ['undelivered', () => makeContext(), () => makeAnswer('B', { delivered: false })],
    ['stale', () => makeContext(), () => makeAnswer('B', { assessment: makeAssessment({ progress_snapshot_hash: 'other' }) })],
    ['guard', () => makeContext({ participation_mode: 'guard' }), () => makeAnswer('B')],
    ['feedback pending', () => makeContext({ feedback_required: true }), () => makeAnswer('B')],
    ['no open assessment', () => makeContext({ unresolved_assessment: null }), () => makeAnswer('B', { assessment: null })],
  ])('produces no persistence write for the %s case', (_label, buildContext, buildAnswer) => {
    const produced = resolveTransferAnswer(buildContext() as never, buildAnswer() as never);
    const persisted = projectForPersistence(produced);

    expect(persisted.write).toBe(false);
    expect(produced.applied_transition).toBeNull();
    expect(VALID_PROGRESS_PAIRS).toContain(
      `${produced.progress.status}:${produced.progress.understanding_level}`
    );
  });

  it('carries no private field name across the consumer boundary', () => {
    const produced = resolveTransferAnswer(makeContext() as never, makeAnswer('B') as never);
    const serialized = JSON.stringify(produced);

    PRIVATE_FIELD_NAMES.forEach((field) => {
      expect(Object.prototype.hasOwnProperty.call(produced, field)).toBe(false);
      expect(serialized).not.toContain(field);
    });
    Object.keys(projectForPersistence(produced).learner_projection).forEach((key) => {
      expect(PRIVATE_FIELD_NAMES).not.toContain(key);
    });
  });

  it('never produces a second transition for a replayed answer', () => {
    const first = resolveTransferAnswer(makeContext() as never, makeAnswer('B') as never);
    const replayed = resolveTransferAnswer(
      makeContext({ progress: first.progress, feedback_required: first.feedback_required }) as never,
      makeAnswer('B', { answer_message_id: 'answer-1' }) as never
    );

    expect(replayed.disposition).toBe('duplicate');
    expect(replayed.applied_transition).toBeNull();
    expect(replayed.progress).toEqual(first.progress);
  });

  it('produces no persistence write for a repair-pending answer without new evidence', () => {
    const produced = resolveTransferAnswer(
      makeContext({
        progress: { status: 'needs_review', understanding_level: 'basic' },
        pending_repair_message_id: 'repair-1',
      }) as never,
      makeAnswer('B', { answer_message_id: 'answer-2' }) as never
    );

    expect(produced.disposition).toBe('unresolved');
    expect(produced.next_action).toBe('await_learner_evidence');
    expect(produced.applied_transition).toBeNull();
  });
});

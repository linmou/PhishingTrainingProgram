#!/usr/bin/env node
// Test responsible for the pure transfer-answer lifecycle: first-valid resolution, clarification, assistance, duplicate/stale suppression, feedback gating, and protective deferral.

import {
  resolveTransferAnswer,
  TransferAssessment,
  TransferLifecycleContext,
  TransferResolvedAssessment,
} from '../transferAssessmentOrchestrator';
import { PublicAssessment } from '../../types/assessment';
import { TransferProgress } from '../../types/learningProgress';
import {
  COVERED,
  PARTIALLY_COVERED,
  TRANSFER_ASSESSMENT_OPTIONS,
  TRANSFER_CORRECT_OPTION_IDS,
} from '../transferAssessmentGoldenFixtures';

const SNAPSHOT_HASH = 'snapshot-hash-1';

function publicAssessment(): Omit<PublicAssessment, 'transfer_basis'> & { id: string } {
  return {
    id: 'assessment-1',
    selection_type: 'single',
    stem: 'A familiar teammate sends a prize link. Is the displayed account enough proof?',
    rendered_text: [
      'A familiar teammate sends a prize link. Is the displayed account enough proof?',
      'Choose one.',
      ...TRANSFER_ASSESSMENT_OPTIONS.map((option) => `${option.id}. ${option.text}`),
    ].join('\n'),
    options: TRANSFER_ASSESSMENT_OPTIONS,
  };
}

function assessment(overrides: Partial<TransferAssessment> = {}): TransferAssessment {
  return {
    id: 'assessment-1',
    item_id: 'item-1',
    selection_type: 'single',
    options: TRANSFER_ASSESSMENT_OPTIONS,
    correct_option_ids: TRANSFER_CORRECT_OPTION_IDS,
    progress_snapshot_hash: SNAPSHOT_HASH,
    ...overrides,
  };
}

function context(overrides: Partial<TransferLifecycleContext> = {}): TransferLifecycleContext {
  return {
    progress: PARTIALLY_COVERED,
    participation_mode: 'tutoring',
    progress_snapshot_hash: SNAPSHOT_HASH,
    feedback_required: false,
    eligible_assessment_item_ids: ['item-1'],
    unresolved_assessment: publicAssessment(),
    pending_repair_message_id: null,
    ...overrides,
  };
}

function answer(
  content: string,
  overrides: Partial<Parameters<typeof resolveTransferAnswer>[1]> = {}
): Parameters<typeof resolveTransferAnswer>[1] {
  return {
    delivered: true,
    answer_message_id: 'answer-1',
    content,
    assessment: assessment(),
    ...overrides,
  };
}

describe('transfer assessment orchestrator', () => {
  it('does not grade an undelivered question', () => {
    const result = resolveTransferAnswer(context(), answer('B', { delivered: false }));

    expect(result).toEqual({
      disposition: 'not_delivered',
      progress: PARTIALLY_COVERED,
      feedback_required: false,
      next_action: 'await_learner_answer',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
  });

  it('grades the first valid delivered selection exactly once', () => {
    const result = resolveTransferAnswer(context(), answer('B'));

    expect(result).toEqual({
      disposition: 'passed',
      progress: COVERED,
      feedback_required: true,
      next_action: 'await_tutor_feedback',
      assessment_id: 'assessment-1',
      applied_transition: 'assessment_pass',
    });
  });

  it('keeps a question open without grading when the selection is ambiguous', () => {
    const result = resolveTransferAnswer(context(), answer('B or D'));

    expect(result).toEqual({
      disposition: 'unresolved',
      progress: PARTIALLY_COVERED,
      feedback_required: false,
      next_action: 'await_learner_answer',
      assessment_id: 'assessment-1',
      applied_transition: null,
      clarification_code: 'AMBIGUOUS_SELECTION',
    });
  });

  it('marks a wrong exact set as failed and requires repair', () => {
    const result = resolveTransferAnswer(context(), answer('A'));

    expect(result).toEqual({
      disposition: 'failed',
      progress: { status: 'needs_review', understanding_level: 'basic' },
      feedback_required: true,
      next_action: 'await_tutor_repair',
      assessment_id: 'assessment-1',
      applied_transition: 'assessment_fail',
    });
  });

  it('does not grade a new answer while repair is pending without new learner evidence', () => {
    const pendingRepair = context({
      progress: { status: 'needs_review', understanding_level: 'basic' },
      pending_repair_message_id: 'repair-1',
    });
    const withoutNewEvidence = resolveTransferAnswer(
      pendingRepair,
      answer('B', { answer_message_id: 'answer-2' })
    );

    expect(withoutNewEvidence).toEqual({
      disposition: 'unresolved',
      progress: { status: 'needs_review', understanding_level: 'basic' },
      feedback_required: false,
      next_action: 'await_learner_evidence',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
    expect(withoutNewEvidence.applied_transition).toBeNull();
  });

  it('applies post-repair evidence to return the target to basic, leaving grading to a fresh assessment', () => {
    const repairedWithNewEvidence = context({
      progress: { status: 'needs_review', understanding_level: 'basic' },
      pending_repair_message_id: 'repair-1',
    });
    const withNewEvidence = resolveTransferAnswer(
      repairedWithNewEvidence,
      answer('B', { answer_message_id: 'answer-3', references_message_id: 'repair-1' })
    );

    expect(withNewEvidence).toEqual({
      disposition: 'unresolved',
      progress: PARTIALLY_COVERED,
      feedback_required: false,
      next_action: 'await_learner_answer',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
  });

  it('resolves content help as assistance without failing the assessment', () => {
    const result = resolveTransferAnswer(context(), answer('What does compromised mean?'));

    expect(result).toEqual({
      disposition: 'assisted',
      progress: PARTIALLY_COVERED,
      feedback_required: false,
      next_action: 'cancel_question',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
  });

  it('accepts a correct selection even when the explanation is inaccurate', () => {
    const result = resolveTransferAnswer(context(), answer('B because A and D are not proof'));

    expect(result.disposition).toBe('passed');
    expect(result.progress).toEqual(COVERED);
  });

  it('suppresses a stale answer whose snapshot no longer matches', () => {
    const result = resolveTransferAnswer(context(), answer('B', { assessment: assessment({ progress_snapshot_hash: 'snapshot-hash-0' }) }));

    expect(result).toEqual({
      disposition: 'stale',
      progress: PARTIALLY_COVERED,
      feedback_required: false,
      next_action: 'await_learner_answer',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
  });

  it('reports a replayed answer as duplicate without a second effect', () => {
    const first = resolveTransferAnswer(context(), answer('B', { answer_message_id: 'answer-1' }));
    const replayed = resolveTransferAnswer(
      context({ progress: first.progress, feedback_required: first.feedback_required }),
      answer('B', { answer_message_id: 'answer-1' })
    );

    expect(replayed).toEqual({
      disposition: 'duplicate',
      progress: COVERED,
      feedback_required: true,
      next_action: 'await_tutor_feedback',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
    expect(replayed.applied_transition).toBeNull();
  });

  it('treats a repeated assessment delivery as duplicate', () => {
    const first = resolveTransferAnswer(context(), answer('A'));
    const second = resolveTransferAnswer(
      context({ progress: first.progress, unresolved_assessment: null, eligible_assessment_item_ids: [] }),
      answer('B', { answer_message_id: 'answer-2', assessment: null })
    );

    expect(second.disposition).toBe('duplicate');
    expect(second.applied_transition).toBeNull();
    expect(second.progress).toEqual({ status: 'needs_review', understanding_level: 'basic' });
  });

  it('does not chain a second assessment while feedback is required', () => {
    const result = resolveTransferAnswer(context({ progress: COVERED, feedback_required: true }), answer('B'));

    expect(result).toEqual({
      disposition: 'duplicate',
      progress: COVERED,
      feedback_required: true,
      next_action: 'await_tutor_feedback',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
  });

  it('defers transfer processing while the room requires a protective response', () => {
    const result = resolveTransferAnswer(context({ participation_mode: 'guard' }), answer('B'));

    expect(result).toEqual({
      disposition: 'guard_deferred',
      progress: PARTIALLY_COVERED,
      feedback_required: false,
      next_action: 'defer_to_protective_response',
      assessment_id: 'assessment-1',
      applied_transition: null,
    });
  });

  it('does not enter Guard merely because the answer was wrong', () => {
    const result = resolveTransferAnswer(context(), answer('A'));

    expect(result.disposition).toBe('failed');
    expect(result.progress).toEqual({ status: 'needs_review', understanding_level: 'basic' });
  });

  it('never grades without an open delivered assessment', () => {
    const result = resolveTransferAnswer(context({ unresolved_assessment: null }), answer('B', { assessment: null }));

    expect(result.disposition).toBe('duplicate');
    expect(result.progress).toEqual(PARTIALLY_COVERED);
    expect(result.applied_transition).toBeNull();
  });

  it('resolves only the assessed target and reports that unselected targets stay unassessed', () => {
    const multiTarget = context({
      eligible_assessment_item_ids: ['item-1', 'item-2', 'item-3'],
      unresolved_assessment: publicAssessment(),
    });
    const selected = resolveTransferAnswer(multiTarget, answer('B'));

    expect(selected.applied_transition).toBe('assessment_pass');
    expect(selected.assessment_id).toBe('assessment-1');
    expect(multiTarget.eligible_assessment_item_ids).toEqual(['item-1', 'item-2', 'item-3']);

    const unselected = ['item-2', 'item-3'].map((itemId) =>
      resolveTransferAnswer(
        context({
          eligible_assessment_item_ids: ['item-1', 'item-2', 'item-3'],
          unresolved_assessment: null,
        }),
        answer('B', { assessment: assessment({ id: `assessment-${itemId}`, item_id: itemId }) })
      )
    );

    unselected.forEach((result) => {
      expect(result.disposition).toBe('duplicate');
      expect(result.applied_transition).toBeNull();
      expect(result.assessment_id).toBeNull();
    });
  });

  it('does not mutate the caller context while resolving an answer', () => {
    const original = context({ eligible_assessment_item_ids: ['item-1', 'item-2'] });
    const snapshot = JSON.stringify(original);

    resolveTransferAnswer(original, answer('A'));

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('keeps the progress pair shape invariant across every disposition', () => {
    const dispositions = [
      resolveTransferAnswer(context(), answer('B', { delivered: false })),
      resolveTransferAnswer(context(), answer('B or D')),
      resolveTransferAnswer(context(), answer('B')),
      resolveTransferAnswer(context(), answer('A')),
      resolveTransferAnswer(context(), answer('What does compromised mean?')),
      resolveTransferAnswer(context(), answer('B', { assessment: assessment({ progress_snapshot_hash: 'other' }) })),
      resolveTransferAnswer(context({ participation_mode: 'guard' }), answer('B')),
    ];

    const validPairs = [
      'pending:none',
      'partially_covered:basic',
      'needs_review:basic',
      'covered:good',
    ];

    dispositions.forEach((result) => {
      expect(validPairs).toContain(`${result.progress.status}:${result.progress.understanding_level}`);
    });
  });
});

describe('transfer resolved assessment privacy', () => {
  it('never leaks a private field name through a real resolved result', () => {
    const privateFieldNames = ['correct_option_ids', 'transfer_basis', 'rationale', 'raw_model_output', 'api_operation', 'transport'];
    const results = [
      resolveTransferAnswer(context(), answer('B')),
      resolveTransferAnswer(context(), answer('A')),
      resolveTransferAnswer(context(), answer('B or D')),
      resolveTransferAnswer(context({ participation_mode: 'guard' }), answer('B')),
      resolveTransferAnswer(context(), answer('B', { delivered: false })),
    ];

    results.forEach((result) => {
      const serialized = JSON.stringify(result);
      privateFieldNames.forEach((field) => {
        expect(Object.keys(result)).not.toContain(field);
        expect(serialized).not.toContain(field);
      });
      expect(serialized).not.toContain('source_evidence_message_ids');
      expect(serialized).not.toContain('changed_context');
    });
  });

  it('exposes only the public assessment fields to consumers', () => {
    const resolved: TransferResolvedAssessment = {
      disposition: 'passed',
      progress: COVERED,
      feedback_required: true,
      next_action: 'await_tutor_feedback',
      assessment_id: 'assessment-1',
      applied_transition: 'assessment_pass',
    };

    const keys = Object.keys(resolved);

    expect(keys).not.toContain('correct_option_ids');
    expect(keys).not.toContain('transfer_basis');
    expect(keys).not.toContain('raw_model_output');
    expect(keys).not.toContain('api_operation');
    expect(JSON.stringify(resolved)).not.toContain('correct_option_ids');
  });

  it('accepts a public assessment type without private fields', () => {
    const projected: Omit<PublicAssessment, 'transfer_basis'> & { id: string } = publicAssessment();
    const progress: TransferProgress = PARTIALLY_COVERED;

    expect(Object.keys(projected).sort()).toEqual(['id', 'options', 'rendered_text', 'selection_type', 'stem']);
    expect(progress.understanding_level).toBe('basic');
  });
});

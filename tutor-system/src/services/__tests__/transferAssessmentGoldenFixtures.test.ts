#!/usr/bin/env node
// Test responsible for the component 101 golden fixture contract, public/private assessment boundary, and v3 assessment-draft validation cases.

import { parseAssessmentAnswer } from '../assessmentAnswerParser';
import { gradeSelection } from '../assessmentGrading';
import { renderAssessment, validateAssessmentRendering } from '../assessmentRendering';
import { applyLearningEvent } from '../learningProgressTransitions';
import { parseTutorDecisionV3 } from '../tutorDecisionContract';
import { validateAssessmentDraft } from '../assessmentValidation';
import { resolveTransferAnswer } from '../transferAssessmentOrchestrator';
import { PublicAssessment } from '../../types/assessment';
import type {
  TransferAttemptResult,
  TransferAttemptSnapshot,
  TransferFailedResult,
  TransferPassedResult,
  TransferRetryResult,
} from '../../types';
import {
  PENDING,
  PARTIALLY_COVERED,
  NEEDS_REVIEW,
  COVERED,
  TRANSFER_ASSESSMENT_OPTIONS,
  TRANSFER_ATTEMPT_FIXTURE_SNAPSHOT_HASH,
  TRANSFER_CORRECT_OPTION_IDS,
  TRANSFER_FIXTURE_ASSESSMENT_ID,
  TRANSFER_FIXTURE_CONTRACT_VERSION,
  TRANSFER_FIXTURE_MANIFEST_VERSION,
  TRANSFER_FIXTURE_POLICY_VERSION,
  TRANSFER_FIXTURE_SOURCE_EVIDENCE_MESSAGE_ID,
  TRANSFER_FIXTURE_TARGET_ITEM_ID,
  TRANSFER_GOLDEN_FIXTURES,
  TRANSFER_ATTEMPT_SEQUENCE_FIXTURES,
  TRANSFER_GRADER_FIXTURES,
  TRANSFER_LIFECYCLE_FIXTURES,
  TRANSFER_PARSER_FIXTURES,
  TRANSFER_REDUCER_FIXTURES,
  TRANSFER_RENDERING_FIXTURES,
  TRANSFER_VALIDATION_FIXTURES,
  transferFixtureManifest,
} from '../transferAssessmentGoldenFixtures';

const SUPPORTED_CONTRACT_VERSIONS = [TRANSFER_FIXTURE_CONTRACT_VERSION];
const SUPPORTED_POLICY_VERSIONS = [TRANSFER_FIXTURE_POLICY_VERSION, 'legacy_v1'];

function validProgressPairs() {
  return ['pending:none', 'partially_covered:basic', 'needs_review:basic', 'covered:good'];
}

describe('golden fixture schema', () => {
  it('gives every fixture a unique ID, supported versions, and an observable expectation', () => {
    const ids = TRANSFER_GOLDEN_FIXTURES.map((fixture) => fixture.fixture_id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);

    TRANSFER_GOLDEN_FIXTURES.forEach((fixture) => {
      expect(typeof fixture.fixture_id).toBe('string');
      expect(fixture.fixture_id.length).toBeGreaterThan(0);
      expect(SUPPORTED_CONTRACT_VERSIONS).toContain(fixture.contract_version);
      expect(SUPPORTED_POLICY_VERSIONS).toContain(fixture.policy_version);
      expect(validProgressPairs()).toContain(
        `${fixture.expected_progress.status}:${fixture.expected_progress.understanding_level}`
      );
      expect(typeof fixture.expected_disposition).toBe('string');
      expect(fixture.evidence_note.length).toBeGreaterThan(0);
      expect(fixture.boundary.length).toBeGreaterThan(0);
    });
  });

  it('exposes a manifest index covering every suite', () => {
    const manifest = transferFixtureManifest();

    expect(manifest.manifest_version).toBe(TRANSFER_FIXTURE_MANIFEST_VERSION);
    expect(manifest.fixture_ids.length).toBe(TRANSFER_GOLDEN_FIXTURES.length);
    expect(manifest.parser_fixture_ids.length).toBe(TRANSFER_PARSER_FIXTURES.length);
    expect(manifest.grader_fixture_ids.length).toBe(TRANSFER_GRADER_FIXTURES.length);
    expect(manifest.rendering_fixture_ids.length).toBe(TRANSFER_RENDERING_FIXTURES.length);
    expect(manifest.reducer_fixture_ids.length).toBe(TRANSFER_REDUCER_FIXTURES.length);
    expect(manifest.lifecycle_fixture_ids.length).toBe(TRANSFER_LIFECYCLE_FIXTURES.length);
    expect(manifest.reducer_fixture_ids.length).toBe(28);
    expect(manifest.lifecycle_ids).toEqual([
      'pass_then_feedback',
      'fail_then_repair',
      'clarification_then_pass',
      'assistance_cancels',
      'guard_defers',
      'stale_snapshot',
      'feedback_required_blocks',
    ]);
    expect(manifest.attempt_sequence_fixture_ids.length).toBe(TRANSFER_ATTEMPT_SEQUENCE_FIXTURES.length);
    expect(manifest.attempt_sequence_ids).toEqual([
      'correct_first',
      'incorrect_correct',
      'incorrect_incorrect',
      'duplicate',
      'reload_tab_equivalent',
      'terminal_third_submission',
      'stale_snapshot',
      'guard_deferred',
      'assistance',
    ]);
  });
});

describe('server-authoritative attempt and result contracts', () => {
  it('accepts the canonical open snapshot and discriminated result shapes', () => {
    const snapshot: TransferAttemptSnapshot = {
      assessment_id: TRANSFER_FIXTURE_ASSESSMENT_ID,
      accepted_attempt_count: 0,
      resolution: 'open',
      processed_answer_message_ids: [],
    };
    const feedback = {
      correct_option_ids: TRANSFER_CORRECT_OPTION_IDS,
      learner_safe_explanation: 'A familiar displayed identity does not verify who controls the account.',
    };
    const retry: TransferRetryResult = {
      disposition: 'retryable',
      progress: PARTIALLY_COVERED,
      feedback_required: false,
      next_action: 'await_learner_answer',
      assessment_id: TRANSFER_FIXTURE_ASSESSMENT_ID,
      applied_transition: null,
      attempt_snapshot: { ...snapshot, accepted_attempt_count: 1, processed_answer_message_ids: ['answer-1'] },
      remaining_attempts: 1,
    };
    const passed: TransferPassedResult = {
      disposition: 'passed',
      progress: COVERED,
      feedback_required: true,
      next_action: 'await_tutor_feedback',
      assessment_id: TRANSFER_FIXTURE_ASSESSMENT_ID,
      applied_transition: 'assessment_pass',
      attempt_snapshot: { ...snapshot, accepted_attempt_count: 1, resolution: 'passed', processed_answer_message_ids: ['answer-1'] },
      remaining_attempts: 0,
      terminal_feedback: feedback,
      learner_feedback_authorized: false,
    };
    const failed: TransferFailedResult = {
      disposition: 'failed',
      progress: NEEDS_REVIEW,
      feedback_required: true,
      next_action: 'await_tutor_repair',
      assessment_id: TRANSFER_FIXTURE_ASSESSMENT_ID,
      applied_transition: 'assessment_fail',
      attempt_snapshot: { ...snapshot, accepted_attempt_count: 2, resolution: 'failed', processed_answer_message_ids: ['answer-1', 'answer-2'] },
      remaining_attempts: 0,
      terminal_feedback: feedback,
      learner_feedback_authorized: true,
    };

    expect(retry).not.toHaveProperty('terminal_feedback');
    expect(passed.learner_feedback_authorized).toBe(false);
    expect(failed.learner_feedback_authorized).toBe(true);
    expect(failed.terminal_feedback).toEqual(feedback);
  });

  it('keeps invalid snapshot examples outside the accepted lifecycle vocabulary', () => {
    const invalidSnapshots = [
      { assessment_id: '', accepted_attempt_count: 0, resolution: 'open', processed_answer_message_ids: [] },
      { assessment_id: TRANSFER_FIXTURE_ASSESSMENT_ID, accepted_attempt_count: 2, resolution: 'open', processed_answer_message_ids: ['answer-1', 'answer-2'] },
      { assessment_id: TRANSFER_FIXTURE_ASSESSMENT_ID, accepted_attempt_count: 1, resolution: 'failed', processed_answer_message_ids: ['answer-1'] },
      { assessment_id: TRANSFER_FIXTURE_ASSESSMENT_ID, accepted_attempt_count: 3, resolution: 'passed', processed_answer_message_ids: ['answer-1', 'answer-2', 'answer-3'] },
    ];

    invalidSnapshots.forEach((candidate) => {
      const lifecycleIsValid = candidate.assessment_id === TRANSFER_FIXTURE_ASSESSMENT_ID
        && ((candidate.resolution === 'open' && (candidate.accepted_attempt_count === 0 || candidate.accepted_attempt_count === 1))
          || (candidate.resolution === 'passed' && (candidate.accepted_attempt_count === 1 || candidate.accepted_attempt_count === 2))
          || (candidate.resolution === 'failed' && candidate.accepted_attempt_count === 2));
      expect(lifecycleIsValid).toBe(false);
    });
  });
});

describe('golden parser fixtures', () => {
  it.each(TRANSFER_PARSER_FIXTURES.map((fixture) => [fixture.fixture_id, fixture] as const))(
    'matches %s',
    (_fixtureId, fixture) => {
      const result = parseAssessmentAnswer(fixture.input.content, fixture.input.selection_type, TRANSFER_ASSESSMENT_OPTIONS);

      expect(result.kind).toBe(fixture.expected_disposition);
      if (result.kind === 'selection') {
        expect(result.option_ids).toEqual(fixture.expected_option_ids);
      }
      if (result.kind === 'clarification_required') {
        expect(result.code).toBe(fixture.expected_clarification_code);
      }
    }
  );
});

describe('golden grader fixtures', () => {
  it.each(TRANSFER_GRADER_FIXTURES.map((fixture) => [fixture.fixture_id, fixture] as const))(
    'matches %s',
    (_fixtureId, fixture) => {
      expect(gradeSelection(fixture.selected, fixture.key)).toBe(fixture.expected_disposition);
    }
  );

  it('covers all 16 A-D subsets of the single-key case', () => {
    const subsetBoundaries = ['exact_subset', 'empty_selection', 'incomplete_selection', 'over_inclusive_selection'];
    const subsets = TRANSFER_GRADER_FIXTURES.filter(
      (fixture) =>
        fixture.key.length === 1 &&
        fixture.key[0] === TRANSFER_CORRECT_OPTION_IDS[0] &&
        subsetBoundaries.includes(fixture.boundary)
    );
    const distinct = new Set(subsets.map((fixture) => `${fixture.selected.length}:${fixture.selected.join('')}`));

    expect(distinct.size).toBe(16);
    subsets.forEach((fixture) => {
      const expected = fixture.selected.length === 1 && fixture.selected[0] === 'B' ? 'pass' : 'fail';
      expect(fixture.expected_disposition).toBe(expected);
    });
  });
});

describe('golden reducer fixtures', () => {
  it.each(TRANSFER_REDUCER_FIXTURES.map((fixture) => [fixture.fixture_id, fixture] as const))(
    'matches %s',
    (_fixtureId, fixture) => {
      const result = applyLearningEvent(fixture.current, fixture.event_kind as never);

      expect(result.disposition).toBe(fixture.expected_transition);
      expect(result.disposition === 'reject' ? result.error_code : null).toBe(fixture.expected_error_code);
      expect(result.disposition === 'reject' ? fixture.current : result.next).toEqual(fixture.expected_progress);
    }
  );

  it('rejects an invalid serialized progress pair before matrix dispatch', () => {
    const invalid = applyLearningEvent(
      { status: 'covered', understanding_level: 'basic' } as never,
      'no_change'
    );

    expect(invalid).toEqual({ disposition: 'reject', error_code: 'INVALID_STATE_PAIR' });
  });

  it('contains one fixture for every state/event cell in the data model matrix', () => {
    expect(TRANSFER_REDUCER_FIXTURES).toHaveLength(28);
    expect(TRANSFER_REDUCER_FIXTURES.filter((fixture) => fixture.expected_transition === 'reject')).toHaveLength(6);
  });
});

describe('golden rendering fixtures', () => {
  it('renders canonical A-D order with the matching instruction', () => {
    const single = renderAssessment({ stem: 'Which statement is safest?', selection_type: 'single', options: TRANSFER_ASSESSMENT_OPTIONS });
    const multiple = renderAssessment({ stem: 'Which statements are safest?', selection_type: 'multiple', options: TRANSFER_ASSESSMENT_OPTIONS });

    expect(single.split('\n')).toEqual([
      'Which statement is safest?',
      'Choose one.',
      'A. A familiar account proves the link is safe',
      'B. The account could have been compromised',
      'C. Every prize message is necessarily a scam',
      'D. Opening the link proves the sender identity',
    ]);
    expect(multiple).toContain('Select all that apply.');
  });

  it('passes at exactly 80 word-like segments and fails at 81 without truncating', () => {
    const options = [
      { id: 'A' as const, text: 'alpha' },
      { id: 'B' as const, text: 'bravo' },
      { id: 'C' as const, text: 'charlie' },
      { id: 'D' as const, text: 'delta' },
    ];
    const stemEighty = Array.from({ length: 70 }, () => 'word').join(' ');
    const atLimit = validateAssessmentRendering({ stem: stemEighty, selection_type: 'single', options });
    const overLimit = validateAssessmentRendering({ stem: `${stemEighty} word`, selection_type: 'single', options });

    expect(atLimit.valid).toBe(true);
    expect(overLimit.valid).toBe(false);
    expect(overLimit.errors).toContain('rendered text must contain at most 80 word-like segments');
    expect(renderAssessment({ stem: `${stemEighty} word`, selection_type: 'single', options })).toContain('word word');
  });

  it('passes at two stem sentences and fails at three', () => {
    const options = TRANSFER_ASSESSMENT_OPTIONS.map((option) => ({ ...option, text: 'short' }));
    const twoSentences = validateAssessmentRendering({ stem: 'First sentence. Second sentence.', selection_type: 'single', options });
    const threeSentences = validateAssessmentRendering({ stem: 'First. Second. Third.', selection_type: 'single', options });

    expect(twoSentences.valid).toBe(true);
    expect(threeSentences.valid).toBe(false);
    expect(threeSentences.errors).toContain('stem must contain at most two sentences');
  });

  it('fails when the option count is not exactly four', () => {
    const three = validateAssessmentRendering({ stem: 'Pick one.', selection_type: 'single', options: TRANSFER_ASSESSMENT_OPTIONS.slice(0, 3) });

    expect(three.valid).toBe(false);
    expect(three.errors).toContain('assessment must contain exactly four options');
  });

  it.each(TRANSFER_RENDERING_FIXTURES.filter((fixture) => fixture.expected_valid === false).map((fixture) => [fixture.fixture_id, fixture] as const))(
    'matches recorded invalid boundary %s',
    (_fixtureId, fixture) => {
      expect(fixture.expected_valid).toBe(false);
      expect(fixture.expected_errors.length).toBeGreaterThan(0);
    }
  );
});

describe('golden lifecycle sequences', () => {
  it('starts the pass-then-feedback sequence from a partially covered pair', () => {
    const fixture = TRANSFER_LIFECYCLE_FIXTURES.find((entry) => entry.lifecycle_id === 'pass_then_feedback');

    expect(fixture).toBeDefined();
    expect(fixture!.steps[0].expected_progress).toEqual(COVERED);
    expect(fixture!.steps[0].expected_feedback_required).toBe(true);
    expect(fixture!.steps[0].expected_next_action).toBe('await_tutor_feedback');
  });

  it('keeps the no-repair acknowledgement at needs_review', () => {
    const fixture = TRANSFER_LIFECYCLE_FIXTURES.find((entry) => entry.lifecycle_id === 'fail_then_repair');

    expect(fixture!.steps[0].expected_progress).toEqual(NEEDS_REVIEW);
    expect(fixture!.steps[1].expected_progress).toEqual(NEEDS_REVIEW);
    expect(fixture!.steps[1].expected_next_action).toBe('await_learner_evidence');
  });

  it('records every named lifecycle sequence with at least one step', () => {
    expect(TRANSFER_LIFECYCLE_FIXTURES.length).toBe(7);
    TRANSFER_LIFECYCLE_FIXTURES.forEach((fixture) => {
      expect(fixture.steps.length).toBeGreaterThan(0);
      expect(fixture.context.length).toBeGreaterThan(0);
    });
  });

  it('never starts a lifecycle from an invalid progress pair', () => {
    TRANSFER_LIFECYCLE_FIXTURES.forEach((fixture) => {
      const first = fixture.steps[0].expected_progress;
      expect(validProgressPairs()).toContain(`${first.status}:${first.understanding_level}`);
    });
  });
});

describe('golden server-authoritative attempt sequences', () => {
  it.each(TRANSFER_ATTEMPT_SEQUENCE_FIXTURES.map((fixture) => [fixture.sequence_id, fixture] as const))(
    'replays %s from its persisted snapshots',
    (_sequenceId, fixture) => {
      fixture.steps.forEach((step) => {
        const publicAssessment: Omit<PublicAssessment, 'transfer_basis'> & { id: string } = {
          id: fixture.steps[0].input_snapshot.assessment_id,
          selection_type: 'single',
          stem: 'A familiar teammate sends a prize link.',
          rendered_text: 'A familiar teammate sends a prize link.\nChoose one.',
          options: TRANSFER_ASSESSMENT_OPTIONS,
        };
        const result = resolveTransferAnswer(
          {
            progress: step.input_progress,
            participation_mode: step.participation_mode,
            progress_snapshot_hash: TRANSFER_ATTEMPT_FIXTURE_SNAPSHOT_HASH,
            feedback_required: step.input_snapshot.resolution !== 'open',
            eligible_assessment_item_ids: ['item-1'],
            unresolved_assessment: publicAssessment,
            pending_repair_message_id: null,
            attempt_snapshot: step.input_snapshot,
          },
          {
            delivered: step.delivered,
            answer_message_id: step.answer_message_id,
            content: step.learner_message,
            assessment: {
              id: step.input_snapshot.assessment_id,
              item_id: 'item-1',
              selection_type: 'single',
              options: TRANSFER_ASSESSMENT_OPTIONS,
              correct_option_ids: TRANSFER_CORRECT_OPTION_IDS,
              progress_snapshot_hash: step.assessment_snapshot_hash,
              learner_safe_explanation: 'A familiar displayed identity does not verify who controls the account.',
            },
          }
        );

        const attemptResult = result as TransferAttemptResult;
        expect(attemptResult.disposition).toBe(step.expected_disposition);
        expect(attemptResult.progress).toEqual(step.expected_progress);
        expect(attemptResult.feedback_required).toBe(step.expected_feedback_required);
        expect(attemptResult.next_action).toBe(step.expected_next_action);
        expect(attemptResult.applied_transition).toBe(step.expected_applied_transition);
        expect(attemptResult.remaining_attempts).toBe(step.expected_remaining_attempts);
        expect(attemptResult.attempt_snapshot).toEqual(step.expected_snapshot);
        if (step.expected_terminal_feedback) {
          expect((attemptResult as TransferAttemptResult & { terminal_feedback: unknown }).terminal_feedback)
            .toEqual(step.expected_terminal_feedback);
        } else {
          expect(attemptResult).not.toHaveProperty('terminal_feedback');
        }
        if (step.expected_learner_feedback_authorized === null) {
          expect(attemptResult).not.toHaveProperty('learner_feedback_authorized');
        } else {
          expect((attemptResult as TransferAttemptResult & { learner_feedback_authorized: boolean }).learner_feedback_authorized)
            .toBe(step.expected_learner_feedback_authorized);
        }
      });
    }
  );
});

describe('component 101 public/private separation', () => {
  const privateFields = ['correct_option_ids', 'transfer_basis', 'rationale', 'raw_model_output', 'api_operation', 'transport'];

  it('declares a public assessment contract without private or transport fields', () => {
    const publicAssessment: PublicAssessment = {
      selection_type: 'single',
      options: TRANSFER_ASSESSMENT_OPTIONS,
      stem: 'Which statement is safest?',
      rendered_text: 'Which statement is safest?\nChoose one.\nA. one\nB. two\nC. three\nD. four',
    };

    expect(Object.keys(publicAssessment).sort()).toEqual(['options', 'rendered_text', 'selection_type', 'stem']);
    privateFields.forEach((field) => {
      expect(Object.keys(publicAssessment)).not.toContain(field);
    });
  });

  it('never exposes private material through the projected learner shape', () => {
    const projected = {
      id: TRANSFER_FIXTURE_ASSESSMENT_ID,
      selection_type: 'single' as const,
      stem: 'Which statement is safest?',
      rendered_text: 'Which statement is safest?\nChoose one.',
      options: TRANSFER_ASSESSMENT_OPTIONS,
    };

    const serialized = JSON.stringify(projected);

    privateFields.forEach((field) => {
      expect(serialized).not.toContain(field);
    });
    expect(serialized).not.toContain(TRANSFER_FIXTURE_SOURCE_EVIDENCE_MESSAGE_ID);
  });
});

describe('component 101 assessment-draft validation', () => {
  const knownIds = {
    knownItemIds: [TRANSFER_FIXTURE_TARGET_ITEM_ID],
    knownMessageIds: [TRANSFER_FIXTURE_SOURCE_EVIDENCE_MESSAGE_ID],
  };

  function assessmentDecision(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      reason: 'The learner applied the rule in the original account-alert example.',
      target_item_id: TRANSFER_FIXTURE_TARGET_ITEM_ID,
      assessment: {
        selection_type: 'single',
        stem: 'A teammate sends a prize link from a familiar account.',
        options: TRANSFER_ASSESSMENT_OPTIONS,
        correct_option_ids: TRANSFER_CORRECT_OPTION_IDS,
        learner_safe_explanation: 'A familiar displayed identity does not verify who controls the account.',
        transfer_basis: {
          concept_rule: 'A familiar displayed identity is not sufficient authentication.',
          source_context: 'An account-warning email using a familiar organization name.',
          changed_context: 'A prize link from a known game teammate account.',
          source_evidence_message_ids: [TRANSFER_FIXTURE_SOURCE_EVIDENCE_MESSAGE_ID],
        },
      },
      ...overrides,
    });
  }

  it('validates a well-formed assessment draft through the production seam', () => {
    const decision = validateAssessmentDraft(assessmentDecision(), knownIds);

    expect(decision.target_item_id).toBe(TRANSFER_FIXTURE_TARGET_ITEM_ID);
    expect(decision.assessment?.correct_option_ids).toEqual(TRANSFER_CORRECT_OPTION_IDS);
  });

  it('rejects unknown source evidence message IDs with a stable category', () => {
    const content = assessmentDecision();
    const payload = JSON.parse(content);
    payload.assessment.transfer_basis.source_evidence_message_ids = ['99999999-9999-4999-8999-999999999999'];

    expect(() => validateAssessmentDraft(JSON.stringify(payload), knownIds)).toThrow(/unknown/i);
  });

  it('rejects unknown option IDs and non-A-D option order', () => {
    const payload = JSON.parse(assessmentDecision());
    payload.assessment.options = payload.assessment.options.map((option: { id: string }) =>
      option.id === 'D' ? { ...option, id: 'E' } : option
    );

    expect(() => validateAssessmentDraft(JSON.stringify(payload), knownIds)).toThrow('options');
  });

  it('rejects duplicate option text even when the A-D IDs are canonical and ordered', () => {
    const payload = JSON.parse(assessmentDecision());
    payload.assessment.options = payload.assessment.options.map((option: { id: string; text: string }) =>
      option.id === 'C' ? { ...option, text: 'The account could have been compromised' } : option
    );

    expect(() => validateAssessmentDraft(JSON.stringify(payload), knownIds)).toThrow(/unique/i);
  });

  it('rejects a changed context that is only a cosmetic name substitution', () => {
    const payload = JSON.parse(assessmentDecision());
    payload.assessment.transfer_basis.source_context = 'An account-warning email using a familiar organization name.';
    payload.assessment.transfer_basis.changed_context = 'An account-warning email using a familiar organization account.';

    expect(() => validateAssessmentDraft(JSON.stringify(payload), knownIds)).toThrow(/changed_context/i);
  });

  it('keeps accepting a genuinely different changed context', () => {
    const payload = JSON.parse(assessmentDecision());
    payload.assessment.transfer_basis.source_context = 'An account-warning email using a familiar organization name.';
    payload.assessment.transfer_basis.changed_context = 'An urgent prize notification delivered through a game chat from a teammate account.';

    expect(() => validateAssessmentDraft(JSON.stringify(payload), knownIds)).not.toThrow();
  });

  it('rejects key cardinality outside the selection type', () => {
    const single = JSON.parse(assessmentDecision());
    single.assessment.correct_option_ids = ['B', 'D'];
    const multiple = JSON.parse(assessmentDecision());
    multiple.assessment.selection_type = 'multiple';
    multiple.assessment.correct_option_ids = [];

    expect(() => validateAssessmentDraft(JSON.stringify(single), knownIds)).toThrow('correct');
    expect(() => validateAssessmentDraft(JSON.stringify(multiple), knownIds)).toThrow('correct');
  });

  it('rejects an assessment draft without a payload', () => {
    expect(() => validateAssessmentDraft(assessmentDecision({ assessment: null }), knownIds)).toThrow('assessment');
  });

  it('rejects a blank stem and a non-object draft', () => {
    const payload = JSON.parse(assessmentDecision());
    payload.assessment.stem = '   ';

    expect(() => validateAssessmentDraft(JSON.stringify(payload), knownIds)).toThrow('stem');
    expect(() => validateAssessmentDraft('[]', knownIds)).toThrow('draft');
  });

  it('keeps the private key inside the validated private assessment only', () => {
    const decision = validateAssessmentDraft(assessmentDecision(), knownIds);
    const publicView = {
      selection_type: decision.assessment!.selection_type,
      options: decision.assessment!.options,
      stem: decision.assessment.stem,
      rendered_text: decision.assessment.rendered_text,
    };

    expect(JSON.stringify(publicView)).not.toContain('correct_option_ids');
    expect(JSON.stringify(publicView)).not.toContain('transfer_basis');
  });

  it.each(TRANSFER_VALIDATION_FIXTURES.map((fixture) => [fixture.case_kind, fixture] as const))(
    'records fixture %s with a stable expected error category',
    (kind, fixture) => {
      expect(fixture.suite).toBe('validation');
      expect(fixture.case_kind).toBe(kind);
      expect(fixture.expected_error.length).toBeGreaterThan(0);
      expect(fixture.expected_disposition).toBe('reject');
    }
  );

  it('uses the closed progress pair vocabulary in every validation fixture', () => {
    TRANSFER_VALIDATION_FIXTURES.forEach((fixture) => {
      expect([PENDING, PARTIALLY_COVERED, NEEDS_REVIEW, COVERED]).toContainEqual(fixture.expected_progress);
    });
  });
});

#!/usr/bin/env node
// Test support (not a suite): versioned golden fixture records for component 101 deterministic transfer behavior.

import type {
  AssessmentOption,
  AssessmentOptionId,
  AssessmentSelectionType,
} from '../types/assessment';
import type { TransferProgress } from '../types/learningProgress';

export const TRANSFER_FIXTURE_CONTRACT_VERSION = 'transfer_v1';
export const TRANSFER_FIXTURE_POLICY_VERSION = 'transfer_v1';
export const TRANSFER_FIXTURE_MANIFEST_VERSION = 1;

export type TransferFixtureSuite =
  | 'parser'
  | 'grader'
  | 'rendering'
  | 'reducer'
  | 'contract'
  | 'orchestrator'
  | 'validation'
  | 'lifecycle';

export type TransferFixtureDisposition =
  | 'selection'
  | 'clarification_required'
  | 'not_selection'
  | 'pass'
  | 'fail'
  | 'not_delivered'
  | 'unresolved'
  | 'passed'
  | 'failed'
  | 'assisted'
  | 'duplicate'
  | 'stale'
  | 'guard_deferred'
  | 'applied'
  | 'no_change'
  | 'valid'
  | 'reject';

export type TransferFixtureNextAction =
  | 'await_learner_answer'
  | 'await_tutor_feedback'
  | 'await_tutor_repair'
  | 'await_learner_evidence'
  | 'cancel_question'
  | 'defer_to_protective_response'
  | 'none';

export interface GoldenFixtureRecord {
  fixture_id: string;
  suite: TransferFixtureSuite;
  contract_version: string;
  policy_version: string;
  requirement_ref: string;
  evidence_note: string;
  boundary: string;
  expected_disposition: TransferFixtureDisposition;
  expected_progress: TransferProgress;
  expected_next_action: TransferFixtureNextAction;
}

export interface ParserFixtureRecord extends GoldenFixtureRecord {
  suite: 'parser';
  boundary: 'exact_option_text' | 'unicode_full_width' | 'trailing_punctuation' | 'prefix_form' | 'ambiguous_alternative' | 'content_question' | 'semantic_near_miss' | 'malformed_combination';
  input: { content: string; selection_type: AssessmentSelectionType };
  expected_option_ids: AssessmentOptionId[];
  expected_clarification_code: string | null;
}

export interface GraderFixtureRecord extends GoldenFixtureRecord {
  suite: 'grader';
  boundary: 'exact_subset' | 'duplicate_order_normalization' | 'empty_selection' | 'incomplete_selection' | 'over_inclusive_selection';
  selected: AssessmentOptionId[];
  key: AssessmentOptionId[];
}

export interface RenderingFixtureRecord extends GoldenFixtureRecord {
  suite: 'rendering';
  boundary: 'option_order' | 'single_instruction' | 'multiple_instruction' | 'four_options' | 'segment_limit' | 'sentence_limit';
  expected_valid: boolean;
  expected_errors: string[];
}

export interface ReducerFixtureRecord extends GoldenFixtureRecord {
  suite: 'reducer';
  current: TransferProgress;
  event_kind: string;
  expected_transition: 'apply' | 'no_change' | 'reject';
  expected_error_code: string | null;
}

export interface LifecycleFixtureStep {
  step_id: string;
  learner_message: string;
  expected_disposition: TransferFixtureDisposition;
  expected_progress: TransferProgress;
  expected_feedback_required: boolean | null;
  expected_next_action: TransferFixtureNextAction;
}

export interface LifecycleFixtureRecord extends GoldenFixtureRecord {
  suite: 'lifecycle';
  lifecycle_id: string;
  context: 'baseline' | 'guard_pending' | 'feedback_required' | 'stale_snapshot' | 'multi_target';
  steps: LifecycleFixtureStep[];
}

export interface ValidationFixtureRecord extends GoldenFixtureRecord {
  suite: 'validation';
  case_kind:
    | 'unknown_message_id'
    | 'unknown_option_id'
    | 'key_cardinality'
    | 'missing_payload'
    | 'privacy_leak'
    | 'duplicate_option_text'
    | 'cosmetic_changed_context';
  expected_error: string;
}

/**
 * The manifest index is the single lookup surface for parser boundaries, grader
 * subsets, rendering boundaries, reducer cells, and named lifecycle sequences.
 */
export interface TransferFixtureManifest {
  manifest_version: number;
  fixture_ids: string[];
  parser_fixture_ids: string[];
  grader_fixture_ids: string[];
  rendering_fixture_ids: string[];
  reducer_fixture_ids: string[];
  lifecycle_fixture_ids: string[];
  lifecycle_ids: string[];
}

export const TRANSFER_ASSESSMENT_OPTIONS: AssessmentOption[] = [
  { id: 'A', text: 'A familiar account proves the link is safe' },
  { id: 'B', text: 'The account could have been compromised' },
  { id: 'C', text: 'Every prize message is necessarily a scam' },
  { id: 'D', text: 'Opening the link proves the sender identity' },
];

export const TRANSFER_CORRECT_OPTION_IDS: AssessmentOptionId[] = ['B'];

export const TRANSFER_FIXTURE_SOURCE_EVIDENCE_MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
export const TRANSFER_FIXTURE_TARGET_ITEM_ID = '11111111-1111-4111-8111-111111111111';
export const TRANSFER_FIXTURE_ASSESSMENT_ID = '33333333-3333-4333-8333-333333333333';

export const PENDING: TransferProgress = { status: 'pending', understanding_level: 'none' };
export const PARTIALLY_COVERED: TransferProgress = { status: 'partially_covered', understanding_level: 'basic' };
export const NEEDS_REVIEW: TransferProgress = { status: 'needs_review', understanding_level: 'basic' };
export const COVERED: TransferProgress = { status: 'covered', understanding_level: 'good' };

function golden(
  fixture_id: string,
  suite: TransferFixtureSuite,
  requirement_ref: string,
  evidence_note: string,
  boundary: string,
  expected_disposition: TransferFixtureDisposition,
  expected_progress: TransferProgress,
  expected_next_action: TransferFixtureNextAction
): GoldenFixtureRecord {
  return {
    fixture_id,
    suite,
    contract_version: TRANSFER_FIXTURE_CONTRACT_VERSION,
    policy_version: TRANSFER_FIXTURE_POLICY_VERSION,
    requirement_ref,
    evidence_note,
    boundary,
    expected_disposition,
    expected_progress,
    expected_next_action,
  };
}

function parserFixture(
  fixture_id: string,
  boundary: ParserFixtureRecord['boundary'],
  requirement_ref: string,
  content: string,
  selection_type: AssessmentSelectionType,
  expected_disposition: TransferFixtureDisposition,
  expected_option_ids: AssessmentOptionId[],
  expected_clarification_code: string | null
): ParserFixtureRecord {
  return {
    ...golden(
      `parser_${fixture_id}`,
      'parser',
      requirement_ref,
      `Parser boundary ${boundary} must normalize deterministically without semantic guessing.`,
      boundary,
      expected_disposition,
      PENDING,
      'none'
    ),
    suite: 'parser',
    boundary,
    input: { content, selection_type },
    expected_option_ids,
    expected_clarification_code,
  };
}

function graderFixture(
  boundary: GraderFixtureRecord['boundary'],
  selected: AssessmentOptionId[],
  key: AssessmentOptionId[],
  expected_disposition: 'pass' | 'fail'
): GraderFixtureRecord {
  return {
    ...golden(
      `grader_${boundary}_${selected.join('') || 'none'}_key${key.join('') || 'none'}`,
      'grader',
      'Exact-set grading',
      'Only the deduplicated exact key set passes regardless of order.',
      boundary,
      expected_disposition,
      expected_disposition === 'pass' ? COVERED : NEEDS_REVIEW,
      'none'
    ),
    suite: 'grader',
    boundary,
    selected,
    key,
  };
}

function reducerFixture(
  current: TransferProgress,
  event_kind: string,
  expected_transition: 'apply' | 'no_change' | 'reject',
  expected_progress: TransferProgress,
  expected_error_code: string | null
): ReducerFixtureRecord {
  return {
    ...golden(
      `reducer_${current.status}_${event_kind}`,
      'reducer',
      'Progress authority',
      'Every state/event cell has exactly one deterministic outcome.',
      'matrix_cell',
      expected_transition === 'reject' ? 'reject' : expected_transition === 'apply' ? 'applied' : 'no_change',
      expected_progress,
      'none'
    ),
    suite: 'reducer',
    current,
    event_kind,
    expected_transition,
    expected_error_code,
  };
}

const GRADER_KEY_SINGLE: AssessmentOptionId[] = ['B'];
const GRADER_KEY_MULTIPLE: AssessmentOptionId[] = ['B', 'D'];

const allSubsets: AssessmentOptionId[][] = [];
for (let mask = 0; mask < 16; mask += 1) {
  const subset: AssessmentOptionId[] = [];
  if (mask & 1) subset.push('A');
  if (mask & 2) subset.push('B');
  if (mask & 4) subset.push('C');
  if (mask & 8) subset.push('D');
  allSubsets.push(subset);
}

export const TRANSFER_GRADER_FIXTURES: GraderFixtureRecord[] = [
  ...allSubsets.map((subset) =>
    graderFixture(
      subset.length === GRADER_KEY_SINGLE.length && subset.every((id) => GRADER_KEY_SINGLE.includes(id))
        ? 'exact_subset'
        : subset.length === 0
          ? 'empty_selection'
          : subset.length < GRADER_KEY_SINGLE.length
            ? 'incomplete_selection'
            : subset.length > GRADER_KEY_SINGLE.length
              ? 'over_inclusive_selection'
              : 'exact_subset',
      subset,
      GRADER_KEY_SINGLE,
      subset.length === 1 && subset[0] === 'B' ? 'pass' : 'fail'
    )
  ),
  graderFixture('duplicate_order_normalization', ['B', 'B'], GRADER_KEY_SINGLE, 'pass'),
  graderFixture('duplicate_order_normalization', ['D', 'B'], GRADER_KEY_MULTIPLE, 'pass'),
  graderFixture('duplicate_order_normalization', ['B', 'D', 'B'], GRADER_KEY_MULTIPLE, 'pass'),
  graderFixture('over_inclusive_selection', ['B', 'C'], GRADER_KEY_MULTIPLE, 'fail'),
];

export const TRANSFER_PARSER_FIXTURES: ParserFixtureRecord[] = [
  parserFixture('exact_option_text_phrase', 'exact_option_text', 'Explicit selection parsing', 'the account could have been compromised', 'single', 'selection', ['B'], null),
  parserFixture('exact_option_text_label', 'exact_option_text', 'Explicit selection parsing', 'B', 'single', 'selection', ['B'], null),
  parserFixture('unicode_full_width', 'unicode_full_width', 'Explicit selection parsing', 'Ａ，ｂ', 'multiple', 'selection', ['A', 'B'], null),
  parserFixture('trailing_punctuation', 'trailing_punctuation', 'Explicit selection parsing', 'answer: B?', 'single', 'selection', ['B'], null),
  parserFixture('prefix_form', 'prefix_form', 'Explicit selection parsing', 'I choose b', 'single', 'selection', ['B'], null),
  parserFixture('ambiguous_alternative', 'ambiguous_alternative', 'Explicit selection parsing', 'B or D', 'multiple', 'clarification_required', [], 'AMBIGUOUS_SELECTION'),
  parserFixture('content_question', 'content_question', 'Explicit selection parsing', 'What does compromised mean?', 'single', 'not_selection', [], null),
  parserFixture('semantic_near_miss', 'semantic_near_miss', 'Explicit selection parsing', 'The account is probably unsafe', 'single', 'not_selection', [], null),
  parserFixture('malformed_combination', 'malformed_combination', 'Explicit selection parsing', 'BD', 'multiple', 'clarification_required', [], 'SELECTION_NOT_RECOGNIZED'),
];

export const TRANSFER_RENDERING_FIXTURES: RenderingFixtureRecord[] = [
  {
    ...golden('rendering_option_order', 'rendering', 'Canonical rendering', 'Rendering preserves authored option text in A-D order.', 'option_order', 'applied', PENDING, 'none'),
    suite: 'rendering',
    boundary: 'option_order',
    expected_valid: true,
    expected_errors: [],
  },
  {
    ...golden('rendering_four_options', 'rendering', 'Canonical rendering', 'Exactly four options are required.', 'four_options', 'valid', PENDING, 'none'),
    suite: 'rendering',
    boundary: 'four_options',
    expected_valid: true,
    expected_errors: [],
  },
  {
    ...golden('rendering_segment_limit_81', 'rendering', 'Rendering bounds', 'Eighty-one word-like segments is invalid.', 'segment_limit', 'reject', PENDING, 'none'),
    suite: 'rendering',
    boundary: 'segment_limit',
    expected_valid: false,
    expected_errors: ['rendered text must contain at most 80 word-like segments'],
  },
  {
    ...golden('rendering_sentence_limit_three', 'rendering', 'Rendering bounds', 'A three-sentence stem is invalid.', 'sentence_limit', 'reject', PENDING, 'none'),
    suite: 'rendering',
    boundary: 'sentence_limit',
    expected_valid: false,
    expected_errors: ['stem must contain at most two sentences'],
  },
];

const matrixRows: Array<{ current: TransferProgress; cells: Array<[string, 'apply' | 'no_change' | 'reject', TransferProgress, string | null]> }> = [
  {
    current: PENDING,
    cells: [
      ['initial_signal', 'apply', PARTIALLY_COVERED, null],
      ['post_repair_signal', 'no_change', PENDING, null],
      ['spontaneous_transfer', 'apply', COVERED, null],
      ['contradiction', 'no_change', PENDING, null],
      ['assessment_pass', 'reject', PENDING, 'INVALID_TRANSITION'],
      ['assessment_fail', 'reject', PENDING, 'INVALID_TRANSITION'],
      ['no_change', 'no_change', PENDING, null],
    ],
  },
  {
    current: PARTIALLY_COVERED,
    cells: [
      ['initial_signal', 'no_change', PARTIALLY_COVERED, null],
      ['post_repair_signal', 'no_change', PARTIALLY_COVERED, null],
      ['spontaneous_transfer', 'apply', COVERED, null],
      ['contradiction', 'apply', NEEDS_REVIEW, null],
      ['assessment_pass', 'apply', COVERED, null],
      ['assessment_fail', 'apply', NEEDS_REVIEW, null],
      ['no_change', 'no_change', PARTIALLY_COVERED, null],
    ],
  },
  {
    current: NEEDS_REVIEW,
    cells: [
      ['initial_signal', 'no_change', NEEDS_REVIEW, null],
      ['post_repair_signal', 'apply', PARTIALLY_COVERED, null],
      ['spontaneous_transfer', 'apply', COVERED, null],
      ['contradiction', 'no_change', NEEDS_REVIEW, null],
      ['assessment_pass', 'reject', NEEDS_REVIEW, 'INVALID_TRANSITION'],
      ['assessment_fail', 'reject', NEEDS_REVIEW, 'INVALID_TRANSITION'],
      ['no_change', 'no_change', NEEDS_REVIEW, null],
    ],
  },
  {
    current: COVERED,
    cells: [
      ['initial_signal', 'no_change', COVERED, null],
      ['post_repair_signal', 'no_change', COVERED, null],
      ['spontaneous_transfer', 'no_change', COVERED, null],
      ['contradiction', 'apply', NEEDS_REVIEW, null],
      ['assessment_pass', 'reject', COVERED, 'INVALID_TRANSITION'],
      ['assessment_fail', 'reject', COVERED, 'INVALID_TRANSITION'],
      ['no_change', 'no_change', COVERED, null],
    ],
  },
];

export const TRANSFER_REDUCER_FIXTURES: ReducerFixtureRecord[] = matrixRows.flatMap((row) =>
  row.cells.map(([event_kind, transition, progress, error]) => reducerFixture(row.current, event_kind, transition, progress, error))
);

export const TRANSFER_VALIDATION_FIXTURES: ValidationFixtureRecord[] = [
  {
    ...golden('validation_unknown_message_id', 'validation', 'Golden fixture contract', 'Unknown source evidence IDs must reject.', 'unknown_message_id', 'reject', PENDING, 'none'),
    suite: 'validation',
    case_kind: 'unknown_message_id',
    expected_error: 'unknown',
  },
  {
    ...golden('validation_unknown_option_id', 'validation', 'Golden fixture contract', 'Unknown option IDs must reject.', 'unknown_option_id', 'reject', PENDING, 'none'),
    suite: 'validation',
    case_kind: 'unknown_option_id',
    expected_error: 'options',
  },
  {
    ...golden('validation_key_cardinality', 'validation', 'Golden fixture contract', 'Single selection requires exactly one key.', 'key_cardinality', 'reject', PENDING, 'none'),
    suite: 'validation',
    case_kind: 'key_cardinality',
    expected_error: 'correct',
  },
  {
    ...golden('validation_missing_payload', 'validation', 'Golden fixture contract', 'Assessment mode without a payload must reject.', 'missing_payload', 'reject', PENDING, 'none'),
    suite: 'validation',
    case_kind: 'missing_payload',
    expected_error: 'assessment',
  },
  {
    ...golden('validation_privacy_leak', 'validation', 'Public/private separation', 'Public assessments must never carry the key or transfer basis.', 'privacy_leak', 'reject', PENDING, 'none'),
    suite: 'validation',
    case_kind: 'privacy_leak',
    expected_error: 'PRIVATE_FIELD_PRESENT',
  },
  {
    ...golden('validation_duplicate_option_text', 'validation', 'FR-003 option uniqueness', 'Duplicate option text must reject even when the A-D IDs are canonical.', 'duplicate_option_text', 'reject', PENDING, 'none'),
    suite: 'validation',
    case_kind: 'duplicate_option_text',
    expected_error: 'unique',
  },
  {
    ...golden('validation_cosmetic_changed_context', 'validation', 'FR-003 changed context', 'A cosmetic name substitution that reuses the same situation must not qualify as a transfer.', 'cosmetic_changed_context', 'reject', PENDING, 'none'),
    suite: 'validation',
    case_kind: 'cosmetic_changed_context',
    expected_error: 'changed_context',
  },
];

function lifecycle(
  lifecycle_id: string,
  requirement_ref: string,
  evidence_note: string,
  context: LifecycleFixtureRecord['context'],
  steps: LifecycleFixtureStep[]
): LifecycleFixtureRecord {
  return {
    ...golden(
      `lifecycle_${lifecycle_id}`,
      'lifecycle',
      requirement_ref,
      evidence_note,
      context,
      steps[steps.length - 1].expected_disposition,
      steps[steps.length - 1].expected_progress,
      steps[steps.length - 1].expected_next_action
    ),
    suite: 'lifecycle',
    lifecycle_id,
    context,
    steps,
  };
}

export const TRANSFER_LIFECYCLE_FIXTURES: LifecycleFixtureRecord[] = [
  lifecycle('pass_then_feedback', 'Feedback-first sequencing', 'A pass requires tutoring feedback before another assessment.', 'baseline', [
    { step_id: 'answer', learner_message: 'B', expected_disposition: 'passed', expected_progress: COVERED, expected_feedback_required: true, expected_next_action: 'await_tutor_feedback' },
  ]),
  lifecycle('fail_then_repair', 'Failure repair', 'A failure moves to needs_review and requires repair plus new evidence.', 'baseline', [
    { step_id: 'wrong', learner_message: 'A', expected_disposition: 'failed', expected_progress: NEEDS_REVIEW, expected_feedback_required: true, expected_next_action: 'await_tutor_repair' },
    { step_id: 'acknowledgement', learner_message: 'ok', expected_disposition: 'unresolved', expected_progress: NEEDS_REVIEW, expected_feedback_required: false, expected_next_action: 'await_learner_evidence' },
  ]),
  lifecycle('clarification_then_pass', 'Explicit selection parsing', 'Ambiguous input keeps the question open without grading.', 'baseline', [
    { step_id: 'ambiguous', learner_message: 'B or D', expected_disposition: 'unresolved', expected_progress: PARTIALLY_COVERED, expected_feedback_required: false, expected_next_action: 'await_learner_answer' },
    { step_id: 'clear', learner_message: 'B', expected_disposition: 'passed', expected_progress: COVERED, expected_feedback_required: true, expected_next_action: 'await_tutor_feedback' },
  ]),
  lifecycle('assistance_cancels', 'Assistance boundary', 'Content help cancels the question without a failing grade.', 'baseline', [
    { step_id: 'help', learner_message: 'What does compromised mean?', expected_disposition: 'assisted', expected_progress: PARTIALLY_COVERED, expected_feedback_required: false, expected_next_action: 'cancel_question' },
  ]),
  lifecycle('guard_defers', 'Guard/protection priority', 'An independently required protective response defers assessment processing.', 'guard_pending', [
    { step_id: 'answer_under_guard', learner_message: 'B', expected_disposition: 'guard_deferred', expected_progress: PARTIALLY_COVERED, expected_feedback_required: false, expected_next_action: 'defer_to_protective_response' },
  ]),
  lifecycle('stale_snapshot', 'Current snapshot', 'A mismatched snapshot must not create a second effect.', 'stale_snapshot', [
    { step_id: 'stale', learner_message: 'B', expected_disposition: 'stale', expected_progress: PARTIALLY_COVERED, expected_feedback_required: false, expected_next_action: 'await_learner_answer' },
  ]),
  lifecycle('feedback_required_blocks', 'Feedback-first sequencing', 'No further assessment may resolve while feedback is pending.', 'feedback_required', [
    { step_id: 'answer', learner_message: 'B', expected_disposition: 'duplicate', expected_progress: COVERED, expected_feedback_required: true, expected_next_action: 'await_tutor_feedback' },
  ]),
];

export const TRANSFER_GOLDEN_FIXTURES: GoldenFixtureRecord[] = [
  ...TRANSFER_PARSER_FIXTURES,
  ...TRANSFER_GRADER_FIXTURES,
  ...TRANSFER_RENDERING_FIXTURES,
  ...TRANSFER_REDUCER_FIXTURES,
  ...TRANSFER_LIFECYCLE_FIXTURES,
  ...TRANSFER_VALIDATION_FIXTURES,
];

export function transferFixtureManifest(): TransferFixtureManifest {
  return {
    manifest_version: TRANSFER_FIXTURE_MANIFEST_VERSION,
    fixture_ids: TRANSFER_GOLDEN_FIXTURES.map((fixture) => fixture.fixture_id),
    parser_fixture_ids: TRANSFER_PARSER_FIXTURES.map((fixture) => fixture.fixture_id),
    grader_fixture_ids: TRANSFER_GRADER_FIXTURES.map((fixture) => fixture.fixture_id),
    rendering_fixture_ids: TRANSFER_RENDERING_FIXTURES.map((fixture) => fixture.fixture_id),
    reducer_fixture_ids: TRANSFER_REDUCER_FIXTURES.map((fixture) => fixture.fixture_id),
    lifecycle_fixture_ids: TRANSFER_LIFECYCLE_FIXTURES.map((fixture) => fixture.fixture_id),
    lifecycle_ids: TRANSFER_LIFECYCLE_FIXTURES.map((fixture) => fixture.lifecycle_id),
  };
}

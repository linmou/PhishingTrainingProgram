// Purpose: resolve one transfer-assessment answer purely, with deterministic delivery, staleness, duplication, repair-evidence, and protective-deferral boundaries.

import type {
  AssessmentOption,
  AssessmentOptionId,
  AssessmentSelectionType,
  PublicAssessment,
  TransferAttemptResultBase,
  TransferAttemptResult,
  TransferAttemptSnapshot,
  TransferTerminalFeedback,
} from '../types/assessment';
import type { RoomParticipationMode } from '../types/assessment';
import type { TransferProgress } from '../types/learningProgress';
import { parseAssessmentAnswer } from './assessmentAnswerParser';
import { gradeSelection } from './assessmentGrading';
import { applyLearningEvent } from './learningProgressTransitions';

export type TransferAssessmentDisposition =
  | 'not_delivered'
  | 'unresolved'
  | 'passed'
  | 'failed'
  | 'assisted'
  | 'duplicate'
  | 'stale'
  | 'guard_deferred';

export type TransferAssessmentNextAction =
  | 'await_learner_answer'
  | 'await_tutor_feedback'
  | 'await_tutor_repair'
  | 'await_learner_evidence'
  | 'cancel_question'
  | 'defer_to_protective_response'
  | 'none';

export interface LegacyTransferResolvedAssessment {
  disposition: TransferAssessmentDisposition;
  progress: TransferProgress;
  feedback_required: boolean;
  next_action: TransferAssessmentNextAction;
  assessment_id: string | null;
  applied_transition: 'assessment_pass' | 'assessment_fail' | null;
  clarification_code?: string;
}

export type TransferResolvedAssessment = LegacyTransferResolvedAssessment | TransferAttemptResult;

type AttemptResultOverrides = Partial<Pick<
  TransferAttemptResultBase,
  'progress' | 'feedback_required' | 'next_action' | 'assessment_id' | 'applied_transition' | 'clarification_code'
>> & {
  terminal_feedback?: TransferTerminalFeedback;
  learner_feedback_authorized?: boolean;
};

/** The open delivered assessment the learner is answering, with its private key. */
export interface TransferAssessment {
  id: string;
  item_id: string;
  selection_type: AssessmentSelectionType;
  options: ReadonlyArray<AssessmentOption>;
  correct_option_ids: ReadonlyArray<AssessmentOptionId>;
  learner_safe_explanation?: string;
  progress_snapshot_hash: string;
}

export interface TransferLifecycleContext {
  progress: TransferProgress;
  participation_mode: RoomParticipationMode | 'unknown';
  progress_snapshot_hash: string;
  feedback_required: boolean;
  eligible_assessment_item_ids: ReadonlyArray<string>;
  unresolved_assessment: (Omit<PublicAssessment, 'transfer_basis'> & { id: string }) | null;
  /** Set while a failed concept is waiting for tutor repair before new learner evidence. */
  pending_repair_message_id: string | null;
  attempt_snapshot?: TransferAttemptSnapshot;
}

export interface TransferAnswerInput {
  delivered: boolean;
  answer_message_id: string;
  content: string;
  assessment?: TransferAssessment | null;
  /** Learner evidence that answers a pending repair, required before re-grading. */
  references_message_id?: string | null;
}

export interface TransferTurnContextInput {
  progress_policy_version: 'legacy_v1' | 'transfer_v1';
  focus_student_id: string;
  focus_student_message_id: string;
  checklist_id: string | null;
  prior_participation_mode: RoomParticipationMode | 'unknown';
  progress: TransferProgress;
  progress_snapshot_hash: string;
  feedback_required: boolean;
  eligible_assessment_item_ids: ReadonlyArray<string>;
  unresolved_assessment?: (Omit<PublicAssessment, 'transfer_basis'> & { id: string }) | null;
  pending_repair_message_id?: string | null;
  attempt_snapshot?: TransferAttemptSnapshot;
}

function validateAttemptSnapshot(snapshot: TransferAttemptSnapshot, assessmentId: string | null): void {
  if (!snapshot || typeof snapshot !== 'object' || typeof snapshot.assessment_id !== 'string' || !snapshot.assessment_id.trim()) {
    throw new Error('INVALID_ATTEMPT_SNAPSHOT');
  }
  if (assessmentId !== null && snapshot.assessment_id !== assessmentId) {
    throw new Error('INVALID_ATTEMPT_SNAPSHOT');
  }
  if (![0, 1, 2].includes(snapshot.accepted_attempt_count)) {
    throw new Error('INVALID_ATTEMPT_SNAPSHOT');
  }
  if (!['open', 'passed', 'failed'].includes(snapshot.resolution)) {
    throw new Error('INVALID_ATTEMPT_SNAPSHOT');
  }
  if (!Array.isArray(snapshot.processed_answer_message_ids)
    || snapshot.processed_answer_message_ids.length !== snapshot.accepted_attempt_count
    || snapshot.processed_answer_message_ids.some((id) => typeof id !== 'string' || !id.trim())
    || new Set(snapshot.processed_answer_message_ids).size !== snapshot.processed_answer_message_ids.length) {
    throw new Error('INVALID_ATTEMPT_SNAPSHOT');
  }
  const validResolution = snapshot.resolution === 'open'
    ? snapshot.accepted_attempt_count === 0 || snapshot.accepted_attempt_count === 1
    : snapshot.resolution === 'passed'
      ? snapshot.accepted_attempt_count === 1 || snapshot.accepted_attempt_count === 2
      : snapshot.accepted_attempt_count === 2;
  if (!validResolution) throw new Error('INVALID_ATTEMPT_SNAPSHOT');
}

function copyAttemptSnapshot(snapshot: TransferAttemptSnapshot): TransferAttemptSnapshot {
  return { ...snapshot, processed_answer_message_ids: [...snapshot.processed_answer_message_ids] };
}

function remainingAttempts(snapshot: TransferAttemptSnapshot): 0 | 1 | 2 {
  return snapshot.resolution === 'open'
    ? (2 - snapshot.accepted_attempt_count) as 0 | 1 | 2
    : 0;
}

function authoritativeResult(
  disposition: TransferAttemptResult['disposition'],
  context: TransferLifecycleContext,
  snapshot: TransferAttemptSnapshot,
  overrides: AttemptResultOverrides = {}
): TransferAttemptResult {
  return {
    disposition,
    progress: context.progress,
    feedback_required: context.feedback_required,
    next_action: 'await_learner_answer',
    assessment_id: context.unresolved_assessment?.id ?? snapshot.assessment_id,
    applied_transition: null,
    attempt_snapshot: copyAttemptSnapshot(snapshot),
    remaining_attempts: remainingAttempts(snapshot),
    ...overrides,
  } as TransferAttemptResult;
}

function resolveWithAttemptSnapshot(
  context: TransferLifecycleContext,
  input: TransferAnswerInput,
  initialSnapshot: TransferAttemptSnapshot
): TransferAttemptResult {
  const currentAssessmentId = context.unresolved_assessment?.id ?? initialSnapshot.assessment_id;
  validateAttemptSnapshot(initialSnapshot, currentAssessmentId);
  const snapshot = copyAttemptSnapshot(initialSnapshot);
  const assessment = input.assessment && input.assessment.id === currentAssessmentId ? input.assessment : null;

  if (snapshot.resolution !== 'open' || snapshot.processed_answer_message_ids.includes(input.answer_message_id)) {
    return authoritativeResult('duplicate', context, snapshot, {
      feedback_required: context.feedback_required || snapshot.resolution !== 'open',
      next_action: snapshot.resolution === 'failed' ? 'await_tutor_repair' : snapshot.resolution === 'passed' ? 'await_tutor_feedback' : 'await_learner_answer',
    });
  }
  if (context.feedback_required) {
    return authoritativeResult('duplicate', context, snapshot, {
      feedback_required: true,
      next_action: 'await_tutor_feedback',
    });
  }
  if (!assessment) return authoritativeResult('duplicate', context, snapshot);
  if (!input.delivered) return authoritativeResult('not_delivered', context, snapshot, { feedback_required: false });
  if (assessment.progress_snapshot_hash !== context.progress_snapshot_hash) {
    return authoritativeResult('stale', context, snapshot, { feedback_required: false });
  }
  if (context.participation_mode === 'guard') {
    return authoritativeResult('guard_deferred', context, snapshot, {
      feedback_required: false,
      next_action: 'defer_to_protective_response',
    });
  }
  if (context.pending_repair_message_id && input.references_message_id !== context.pending_repair_message_id) {
    return authoritativeResult('unresolved', context, snapshot, {
      feedback_required: false,
      next_action: 'await_learner_evidence',
    });
  }
  if (context.pending_repair_message_id && input.references_message_id === context.pending_repair_message_id) {
    const repaired = applyLearningEvent(context.progress, 'post_repair_signal');
    return authoritativeResult('unresolved', {
      ...context,
      progress: repaired.disposition === 'reject' ? context.progress : repaired.next,
    }, snapshot, {
      feedback_required: false,
    });
  }

  const parsed = parseAssessmentAnswer(input.content, assessment.selection_type, assessment.options);
  if (parsed.kind === 'clarification_required') {
    return authoritativeResult('unresolved', context, snapshot, {
      feedback_required: false,
      clarification_code: parsed.code,
    });
  }
  if (parsed.kind === 'not_selection') {
    return authoritativeResult('assisted', context, snapshot, {
      feedback_required: false,
      next_action: 'cancel_question',
    });
  }
  if (typeof assessment.learner_safe_explanation !== 'string' || !assessment.learner_safe_explanation.trim()) {
    throw new Error('INVALID_LEARNER_SAFE_EXPLANATION');
  }

  const nextSnapshot: TransferAttemptSnapshot = {
    ...snapshot,
    accepted_attempt_count: (snapshot.accepted_attempt_count + 1) as 1 | 2,
    processed_answer_message_ids: [...snapshot.processed_answer_message_ids, input.answer_message_id],
  };
  const graded = gradeSelection(parsed.option_ids, assessment.correct_option_ids);
  const feedback: TransferTerminalFeedback = {
    correct_option_ids: [...assessment.correct_option_ids],
    learner_safe_explanation: assessment.learner_safe_explanation.trim(),
  };

  if (graded === 'fail' && snapshot.accepted_attempt_count === 0) {
    return authoritativeResult('retryable', context, { ...nextSnapshot, resolution: 'open' }, {
      progress: context.progress,
      feedback_required: false,
      next_action: 'await_learner_answer',
    });
  }

  const event = graded === 'pass' ? 'assessment_pass' : 'assessment_fail';
  const transition = applyLearningEvent(context.progress, event);
  if (transition.disposition === 'reject') return authoritativeResult('duplicate', context, snapshot);
  const terminalSnapshot: TransferAttemptSnapshot = {
    ...nextSnapshot,
    resolution: graded === 'pass' ? 'passed' : 'failed',
  };
  return authoritativeResult(graded === 'pass' ? 'passed' : 'failed', {
    ...context,
    progress: transition.next,
  }, terminalSnapshot, {
    feedback_required: true,
    next_action: graded === 'pass' ? 'await_tutor_feedback' : 'await_tutor_repair',
    applied_transition: event,
    terminal_feedback: feedback,
    learner_feedback_authorized: graded === 'pass' ? false : true,
  });
}

function unchangedProgress(context: TransferLifecycleContext): TransferProgress {
  const result = applyLearningEvent(context.progress, 'no_change');
  return result.disposition === 'reject' ? context.progress : result.next;
}

function resolved(
  disposition: TransferAssessmentDisposition,
  progress: TransferProgress,
  feedbackRequired: boolean,
  nextAction: TransferAssessmentNextAction,
  assessmentId: string | null,
  appliedTransition: TransferResolvedAssessment['applied_transition'],
  clarificationCode?: string
): TransferResolvedAssessment {
  const result: TransferResolvedAssessment = {
    disposition,
    progress,
    feedback_required: feedbackRequired,
    next_action: nextAction,
    assessment_id: assessmentId,
    applied_transition: appliedTransition,
  };
  if (clarificationCode !== undefined && clarificationCode !== null) {
    result.clarification_code = clarificationCode;
  }
  return result;
}

/**
 * Resolve one learner message against a delivered, current, unanswered assessment.
 * Pure: no persistence, transport, provider, or React side effect is reachable here.
 */
export function resolveTransferAnswer(
  context: TransferLifecycleContext,
  input: TransferAnswerInput
): TransferResolvedAssessment {
  if (context.attempt_snapshot) {
    return resolveWithAttemptSnapshot(context, input, context.attempt_snapshot);
  }
  const assessmentId = context.unresolved_assessment ? context.unresolved_assessment.id : null;
  const assessment = input.assessment && input.assessment.id === assessmentId ? input.assessment : null;

  if (context.feedback_required) {
    return resolved('duplicate', context.progress, true, 'await_tutor_feedback', assessmentId, null);
  }
  if (!assessment) {
    return resolved('duplicate', unchangedProgress(context), context.feedback_required, 'await_learner_answer', assessmentId, null);
  }
  if (!input.delivered) {
    return resolved('not_delivered', unchangedProgress(context), false, 'await_learner_answer', assessmentId, null);
  }
  if (assessment.progress_snapshot_hash !== context.progress_snapshot_hash) {
    return resolved('stale', unchangedProgress(context), false, 'await_learner_answer', assessmentId, null);
  }
  if (context.participation_mode === 'guard') {
    return resolved('guard_deferred', unchangedProgress(context), false, 'defer_to_protective_response', assessmentId, null);
  }
  if (context.pending_repair_message_id && input.references_message_id !== context.pending_repair_message_id) {
    return resolved('unresolved', unchangedProgress(context), false, 'await_learner_evidence', assessmentId, null);
  }
  if (context.pending_repair_message_id && input.references_message_id === context.pending_repair_message_id) {
    const repaired = applyLearningEvent(context.progress, 'post_repair_signal');
    const progress = repaired.disposition === 'reject' ? context.progress : repaired.next;
    return resolved('unresolved', progress, false, 'await_learner_answer', assessmentId, null);
  }

  const parsed = parseAssessmentAnswer(input.content, assessment.selection_type, assessment.options);

  if (parsed.kind === 'clarification_required') {
    return resolved('unresolved', unchangedProgress(context), false, 'await_learner_answer', assessmentId, null, parsed.code);
  }
  if (parsed.kind === 'not_selection') {
    return resolved('assisted', unchangedProgress(context), false, 'cancel_question', assessmentId, null);
  }

  const graded = gradeSelection(parsed.option_ids, assessment.correct_option_ids);
  const transition = applyLearningEvent(
    context.progress,
    graded === 'pass' ? 'assessment_pass' : 'assessment_fail'
  );
  if (transition.disposition === 'reject') {
    return resolved('duplicate', context.progress, true, 'await_tutor_feedback', assessmentId, null);
  }

  return graded === 'pass'
    ? resolved('passed', transition.next, true, 'await_tutor_feedback', assessmentId, 'assessment_pass')
    : resolved('failed', transition.next, true, 'await_tutor_repair', assessmentId, 'assessment_fail');
}

/** Build the pure per-turn lifecycle snapshot consumed by the resolver. */
export function createTransferTurnContext(input: TransferTurnContextInput): TransferLifecycleContext {
  const result: TransferLifecycleContext = {
    progress: input.progress,
    participation_mode: input.prior_participation_mode,
    progress_snapshot_hash: input.progress_snapshot_hash,
    feedback_required: input.feedback_required,
    eligible_assessment_item_ids: [...input.eligible_assessment_item_ids],
    unresolved_assessment: input.unresolved_assessment ? { ...input.unresolved_assessment } : null,
    pending_repair_message_id: input.pending_repair_message_id || null,
  };
  if (input.attempt_snapshot) result.attempt_snapshot = copyAttemptSnapshot(input.attempt_snapshot);
  return result;
}

/**
 * Apply one learning event to the current context exactly once.
 * Returns the unchanged context for a rejected or no-change transition so an
 * invalid event can never create a second progression authority.
 */
export function reduceTurnEvent(
  context: TransferLifecycleContext,
  kind: Parameters<typeof applyLearningEvent>[1]
): TransferLifecycleContext {
  const transition = applyLearningEvent(context.progress, kind);
  if (transition.disposition === 'reject') return context;
  return { ...context, progress: transition.next };
}

#!/usr/bin/env node
// Purpose: resolve one transfer-assessment answer purely, with deterministic delivery, staleness, duplication, repair-evidence, and protective-deferral boundaries.

import type {
  AssessmentOption,
  AssessmentOptionId,
  AssessmentSelectionType,
  PublicAssessment,
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

export interface TransferResolvedAssessment {
  disposition: TransferAssessmentDisposition;
  progress: TransferProgress;
  feedback_required: boolean;
  next_action: TransferAssessmentNextAction;
  assessment_id: string | null;
  applied_transition: 'assessment_pass' | 'assessment_fail' | null;
  clarification_code?: string;
}

/** The open delivered assessment the learner is answering, with its private key. */
export interface TransferAssessment {
  id: string;
  item_id: string;
  selection_type: AssessmentSelectionType;
  options: ReadonlyArray<AssessmentOption>;
  correct_option_ids: ReadonlyArray<AssessmentOptionId>;
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
  return {
    progress: input.progress,
    participation_mode: input.prior_participation_mode,
    progress_snapshot_hash: input.progress_snapshot_hash,
    feedback_required: input.feedback_required,
    eligible_assessment_item_ids: [...input.eligible_assessment_item_ids],
    unresolved_assessment: input.unresolved_assessment ? { ...input.unresolved_assessment } : null,
    pending_repair_message_id: input.pending_repair_message_id || null,
  };
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

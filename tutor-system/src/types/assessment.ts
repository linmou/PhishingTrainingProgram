// Purpose: define the public assessment payload and private v3 tutor-decision data contracts.

// @ts-ignore TypeScript 4.9 needs extensionless imports; Deno needs explicit extensions.
import type { ProgressPolicyVersion, TransferProgress } from './learningProgress.ts';

export type AssessmentOptionId = 'A' | 'B' | 'C' | 'D';
export type AssessmentSelectionType = 'single' | 'multiple';
export type TutorTurnMode = 'tutoring' | 'guard' | 'assessment' | 'multiagent';
export type RoomParticipationMode = 'tutoring' | 'guard';
export type TeachingInstruction =
  | 'protective_instruction'
  | 'correction'
  | 'scaffolding'
  | 'explanation'
  | 'consolidation';
export type TutorInstruction = TeachingInstruction | 'transfer_assess' | 'guard';

export interface AssessmentOption {
  id: AssessmentOptionId;
  text: string;
}

export interface TransferBasis {
  concept_rule: string;
  source_context: string;
  changed_context: string;
  source_evidence_message_ids: string[];
}

export interface PublicAssessment {
  selection_type: AssessmentSelectionType;
  options: AssessmentOption[];
  stem: string;
  rendered_text: string;
}

export interface PrivateAssessment extends PublicAssessment {
  transfer_basis: TransferBasis;
  correct_option_ids: AssessmentOptionId[];
  learner_safe_explanation: string;
}

export interface TransferAssessmentDraft {
  reason: string;
  target_item_id: string;
  assessment: PrivateAssessment;
}

export interface TransferAttemptSnapshot {
  assessment_id: string;
  accepted_attempt_count: 0 | 1 | 2;
  resolution: 'open' | 'passed' | 'failed';
  processed_answer_message_ids: ReadonlyArray<string>;
}

export interface TransferTerminalFeedback {
  correct_option_ids: ReadonlyArray<AssessmentOptionId>;
  learner_safe_explanation: string;
}

export type TransferAttemptResultNextAction =
  | 'await_learner_answer'
  | 'await_tutor_feedback'
  | 'await_tutor_repair'
  | 'await_learner_evidence'
  | 'cancel_question'
  | 'defer_to_protective_response'
  | 'none';

export interface TransferAttemptResultBase {
  progress: TransferProgress;
  feedback_required: boolean;
  next_action: TransferAttemptResultNextAction;
  assessment_id: string | null;
  applied_transition: 'assessment_pass' | 'assessment_fail' | null;
  clarification_code?: string;
  attempt_snapshot: TransferAttemptSnapshot;
  remaining_attempts: 0 | 1 | 2;
}

export interface TransferRetryResult extends TransferAttemptResultBase {
  disposition: 'retryable';
  progress: TransferProgress;
  feedback_required: false;
  next_action: 'await_learner_answer';
  applied_transition: null;
  remaining_attempts: 1;
}

export interface TransferPassedResult extends TransferAttemptResultBase {
  disposition: 'passed';
  feedback_required: true;
  applied_transition: 'assessment_pass';
  remaining_attempts: 0;
  terminal_feedback: TransferTerminalFeedback;
  learner_feedback_authorized: false;
}

export interface TransferFailedResult extends TransferAttemptResultBase {
  disposition: 'failed';
  feedback_required: true;
  applied_transition: 'assessment_fail';
  remaining_attempts: 0;
  terminal_feedback: TransferTerminalFeedback;
  learner_feedback_authorized: true;
}

export type TransferNonConsumingDisposition =
  | 'not_delivered'
  | 'unresolved'
  | 'assisted'
  | 'duplicate'
  | 'stale'
  | 'guard_deferred';

export interface TransferNonConsumingResult extends TransferAttemptResultBase {
  disposition: TransferNonConsumingDisposition;
  learner_feedback_authorized?: never;
  terminal_feedback?: never;
}

export type TransferAttemptResult =
  | TransferRetryResult
  | TransferPassedResult
  | TransferFailedResult
  | TransferNonConsumingResult;

export type TransferEvidenceSignal = 'initial' | 'contradiction' | 'spontaneous_transfer';

export interface TransferEvidenceDecision {
  item_id: string;
  evidence_message_id: string;
  signal: TransferEvidenceSignal;
  analysis: string;
}

export interface TutorDecisionV3 {
  reason: string;
  /** Required from the transfer provider; optional for reviewed legacy fixtures and consumers. */
  learning_evidence?: TransferEvidenceDecision[];
  decision: {
    mode: TutorTurnMode;
    instruction: TutorInstruction;
    target_item_id: string | null;
  };
  response: string;
  assessment: PrivateAssessment | null;
}

export type TransferChecklistItemSnapshot = TransferProgress & {
  id: string;
  area_text: string;
  priority: 'critical' | 'important' | 'optional';
  relevant_evidence_message_ids: string[];
  repair_message_id: string | null;
};

export interface TransferTurnContext {
  progress_policy_version: ProgressPolicyVersion;
  focus_student_id: string;
  focus_student_message_id: string;
  checklist_id: string | null;
  prior_participation_mode: RoomParticipationMode | 'unknown';
  checklist_items: TransferChecklistItemSnapshot[];
  unresolved_assessment: (PublicAssessment & { id: string }) | null;
  eligible_assessment_item_ids: string[];
  feedback_required: boolean;
  progress_snapshot_hash: string;
}

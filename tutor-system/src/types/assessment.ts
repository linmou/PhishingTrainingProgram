// Purpose: define the public assessment payload and private v3 tutor-decision data contracts.

import type { ProgressPolicyVersion, TransferProgress } from './learningProgress';

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
  transfer_basis?: TransferBasis;
}

export interface PrivateAssessment extends PublicAssessment {
  correct_option_ids: AssessmentOptionId[];
}

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
  unresolved_assessment: Omit<PublicAssessment, 'transfer_basis'> & { id: string } | null;
  eligible_assessment_item_ids: string[];
  feedback_required: boolean;
  progress_snapshot_hash: string;
}

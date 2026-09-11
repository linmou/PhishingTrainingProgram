// Purpose: apply the transfer-policy event/state table as the single pure progress authority.

import {
  isValidTransferProgress,
} from '../types/learningProgress';
import type { TransferProgress } from '../types/learningProgress';

export { isValidTransferProgress } from '../types/learningProgress';
export type { TransferProgress } from '../types/learningProgress';

export type LearningEventKind =
  | 'initial_signal'
  | 'post_repair_signal'
  | 'spontaneous_transfer'
  | 'contradiction'
  | 'assessment_pass'
  | 'assessment_fail'
  | 'no_change';

export interface LearningEvent {
  event_id: string;
  room_id: string;
  student_id: string;
  checklist_id: string;
  item_id: string;
  source_message_id: string | null;
  kind: LearningEventKind;
  evidence_text: string;
  source_evidence_message_ids: string[];
  assessment_id?: string;
  repair_message_id?: string;
  classified_by: 'model' | 'deterministic_grader' | 'tutor';
}

export type TransitionResult =
  | { disposition: 'apply'; next: TransferProgress }
  | { disposition: 'no_change'; next: TransferProgress }
  | { disposition: 'reject'; error_code: string };

function unchanged(current: TransferProgress): TransitionResult {
  return { disposition: 'no_change', next: current };
}

export function applyLearningEvent(
  current: TransferProgress,
  kind: LearningEventKind
): TransitionResult {
  if (!isValidTransferProgress(current)) {
    return { disposition: 'reject', error_code: 'INVALID_STATE_PAIR' };
  }

  switch (kind) {
    case 'initial_signal':
      return current.status === 'pending'
        ? { disposition: 'apply', next: { status: 'partially_covered', understanding_level: 'basic' } }
        : unchanged(current);
    case 'post_repair_signal':
      return current.status === 'needs_review'
        ? { disposition: 'apply', next: { status: 'partially_covered', understanding_level: 'basic' } }
        : unchanged(current);
    case 'spontaneous_transfer':
      return current.status === 'covered'
        ? unchanged(current)
        : { disposition: 'apply', next: { status: 'covered', understanding_level: 'good' } };
    case 'contradiction':
      return current.status === 'partially_covered' || current.status === 'covered'
        ? { disposition: 'apply', next: { status: 'needs_review', understanding_level: 'basic' } }
        : unchanged(current);
    case 'assessment_pass':
      return current.status === 'partially_covered'
        ? { disposition: 'apply', next: { status: 'covered', understanding_level: 'good' } }
        : { disposition: 'reject', error_code: 'INVALID_TRANSITION' };
    case 'assessment_fail':
      return current.status === 'partially_covered'
        ? { disposition: 'apply', next: { status: 'needs_review', understanding_level: 'basic' } }
        : { disposition: 'reject', error_code: 'INVALID_TRANSITION' };
    case 'no_change':
      return unchanged(current);
    default:
      return { disposition: 'reject', error_code: 'INVALID_TRANSITION' };
  }
}

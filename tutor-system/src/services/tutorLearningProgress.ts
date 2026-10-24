// Purpose: expose authoritative learner progress and outstanding follow-up to tutor planning.
import type { SessionChecklist } from '../types/checklist';

export type TutorAssessmentPreparation = 'no_candidate' | 'assessment_answer';

export function formatTutorLearningProgress(
  checklist: SessionChecklist,
  focusStudentId?: string,
  focusStudentMessageId?: string,
  assessmentPreparation?: TutorAssessmentPreparation
): string {
  if (checklist.progress_policy_version === 'transfer_v1' &&
      (!focusStudentId || checklist.student_id !== focusStudentId)) {
    throw new Error('Learning progress does not belong to the selected learner');
  }
  const targets = [...checklist.detection_areas, ...checklist.verification_steps]
    .filter(item => !item.deleted)
    .map(item => ({
      item_id: item.id,
      target_key: item.target_key ?? null,
      label: item.area_text,
      status: item.status,
      understanding_level: item.understanding_level ?? null,
      updated_at: item.updated_at ?? null,
    }));
  const snapshot = {
    checklist_id: checklist.id,
    progress_policy_version: checklist.progress_policy_version ?? 'legacy_v1',
    target_version: checklist.target_version ?? null,
    student_id: checklist.student_id ?? focusStudentId ?? null,
    focus_message_id: focusStudentMessageId ?? null,
    assessment_preparation: assessmentPreparation ?? 'not_checked',
    targets_requiring_follow_up: targets.filter(item => item.status === 'partially_covered' || item.status === 'needs_review'),
    targets,
    unresolved_target_ids: targets.filter(item => item.status !== 'covered').map(item => item.item_id),
  };
  return `CURRENT LEARNING PROGRESS\n${JSON.stringify(snapshot)}\n\n` +
    'Use this recorded learner progress as the target-state authority. Dialogue is evidence, not permission to rewrite these states. ' +
    'A generic acknowledgment of a tutor explanation is not demonstrated understanding. Partially covered/basic and needs_review/basic remain unresolved; elicit the missing target-specific evidence or repair the misconception. ' +
    'Choose at most one relevant unmet target. If switching away from an unresolved target, explain the teaching reason and name that target for explicit follow-up in your supervisor-facing reason; do not describe it as completed. ' +
    'Covered/good records understanding, not by itself final-assessment completion. The trusted assessment preparation owns eligibility: partial evidence alone is ineligible; developed Partial-to-Covered understanding may require a final check, while direct Pending-to-Covered and spontaneous transfer do not. ' +
    'A no_candidate preparation result means no assessment draft was returned, not that every target is complete. Do not invent, bypass, or replace an assessment; continue appropriate tutoring or assessment feedback under the recorded state. ' +
    'Keep the student-facing response focused on learning, with the evidence and any deferred target in the reason.';
}

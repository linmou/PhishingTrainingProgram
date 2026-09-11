// Purpose: expose one production validation seam for trusted and teacher-reviewed v3 assessment drafts.

import { TutorDecisionV3 } from '../types/assessment';
import { parseTutorDecisionV3 } from './tutorDecisionContract';

export interface AssessmentValidationContext {
  knownItemIds: ReadonlyArray<string>;
  knownMessageIds: ReadonlyArray<string>;
}

export function validateAssessmentDraft(
  content: unknown,
  context: AssessmentValidationContext
): TutorDecisionV3 {
  return parseTutorDecisionV3(content, context);
}

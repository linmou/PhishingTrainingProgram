// Purpose: grade normalized assessment selections by exact set equality only.

import type { AssessmentOptionId } from '../types/assessment';

export function gradeSelection(
  selected: ReadonlyArray<AssessmentOptionId>,
  key: ReadonlyArray<AssessmentOptionId>
): 'pass' | 'fail' {
  const selectedSet = new Set(selected);
  const keySet = new Set(key);
  if (selectedSet.size !== keySet.size) return 'fail';
  return Array.from(keySet).every((optionId) => selectedSet.has(optionId)) ? 'pass' : 'fail';
}

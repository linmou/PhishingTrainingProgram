// Purpose: grade normalized assessment selections by exact set equality only.

// @ts-ignore TypeScript 4.9 needs extensionless imports; Deno needs explicit extensions.
import type { AssessmentOptionId } from '../types/assessment.ts';

export function gradeSelection(
  selected: ReadonlyArray<AssessmentOptionId>,
  key: ReadonlyArray<AssessmentOptionId>
): 'pass' | 'fail' {
  const selectedSet = new Set(selected);
  const keySet = new Set(key);
  if (selectedSet.size !== keySet.size) return 'fail';
  return Array.from(keySet).every((optionId) => selectedSet.has(optionId)) ? 'pass' : 'fail';
}

// Purpose: render one canonical learner-visible assessment and enforce its explicit length bounds.

import { AssessmentOption, AssessmentSelectionType } from '../types/assessment';

export interface AssessmentToRender {
  stem: string;
  selection_type: AssessmentSelectionType;
  options: ReadonlyArray<AssessmentOption>;
}

export interface AssessmentRenderingValidation {
  valid: boolean;
  errors: string[];
}

const optionOrder = ['A', 'B', 'C', 'D'];

function orderedOptions(options: ReadonlyArray<AssessmentOption>): AssessmentOption[] {
  return [...options].sort((left, right) => optionOrder.indexOf(left.id) - optionOrder.indexOf(right.id));
}

export function renderAssessment(assessment: AssessmentToRender): string {
  const instruction = assessment.selection_type === 'multiple' ? 'Select all that apply.' : 'Choose one.';
  const options = orderedOptions(assessment.options).map((option) => `${option.id}. ${option.text.trim()}`);
  return [assessment.stem.trim(), instruction, ...options].join('\n');
}

export function countAssessmentSegments(text: string): number {
  const segmenter = (Intl as unknown as { Segmenter?: new (locale?: string, options?: object) => { segment: (value: string) => Iterable<{ isWordLike?: boolean }> } }).Segmenter;
  if (segmenter) {
    return Array.from(new segmenter('en', { granularity: 'word' }).segment(text)).filter((part) => part.isWordLike).length;
  }
  return text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g)?.length ?? 0;
}

function sentenceCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return (trimmed.match(/[.!?]+(?=\s|$)/g) || []).length || 1;
}

export function validateAssessmentRendering(assessment: AssessmentToRender): AssessmentRenderingValidation {
  const errors: string[] = [];
  const rendered = renderAssessment(assessment);
  if (!assessment.stem.trim()) errors.push('stem must not be blank');
  if (sentenceCount(assessment.stem) > 2) errors.push('stem must contain at most two sentences');
  if (countAssessmentSegments(rendered) > 80) errors.push('rendered text must contain at most 80 word-like segments');
  if (orderedOptions(assessment.options).length !== 4) errors.push('assessment must contain exactly four options');
  return { valid: errors.length === 0, errors };
}

// Purpose: render one canonical learner-visible assessment and enforce its explicit length bounds.

// @ts-ignore TypeScript 4.9 uses extensionless imports; Deno needs the explicit extension.
import type { AssessmentEvent, AssessmentOption, AssessmentSelectionType } from '../types/assessment.ts';

/** Validate and allowlist backend provenance at every public ingress. */
export function parseAssessmentEvent(value: unknown): AssessmentEvent | null {
  if (value == null) return null;
  const event = value as Record<string, unknown>;
  const text = (key: string) => typeof event[key] === 'string' && Boolean((event[key] as string).trim());
  if (typeof value !== 'object' || Array.isArray(value) ||
    !['event_key','assessment_id','question_message_id','student_id'].every(text) ||
    !['result','closure'].includes(String(event.kind)) ||
    ![0,1,2].includes(event.attempts_used as number) || ![0,1].includes(event.attempts_remaining as number) ||
    typeof event.terminal !== 'boolean' || typeof event.progress_deferred !== 'boolean') throw new Error('INVALID_ASSESSMENT_EVENT');
  if (event.kind === 'result') {
    if (!text('answer_message_id') || ![1,2].includes(event.attempt_number as number) ||
      !['retry','passed','failed'].includes(String(event.outcome)) || event.closure_reason != null ||
      event.attempts_used !== event.attempt_number ||
      event.lifecycle !== (event.outcome === 'retry' ? 'open' : event.outcome) ||
      event.terminal !== (event.outcome !== 'retry') ||
      event.attempts_remaining !== (event.outcome === 'retry' ? 1 : 0) ||
      (event.outcome === 'retry' && event.attempt_number !== 1) ||
      (event.outcome === 'failed' && event.attempt_number !== 2) ||
      event.event_key !== `assessment-result:${event.answer_message_id}`) throw new Error('INVALID_ASSESSMENT_EVENT');
  } else if (event.outcome != null || event.attempt_number != null || event.lifecycle !== 'cancelled' ||
    !event.terminal || event.attempts_remaining !== 0 || event.progress_deferred ||
    (event.answer_message_id != null && !text('answer_message_id')) ||
    !['assisted','target_changed','progress_invalidated','cancelled'].includes(String(event.closure_reason)) ||
    event.event_key !== `assessment-closure:${event.question_message_id}`) throw new Error('INVALID_ASSESSMENT_EVENT');
  return {
    event_key: event.event_key as string, kind: event.kind as AssessmentEvent['kind'],
    assessment_id: event.assessment_id as string, question_message_id: event.question_message_id as string,
    student_id: event.student_id as string, answer_message_id: event.answer_message_id as string | null,
    attempt_number: event.attempt_number as AssessmentEvent['attempt_number'], outcome: event.outcome as AssessmentEvent['outcome'],
    attempts_used: event.attempts_used as AssessmentEvent['attempts_used'], attempts_remaining: event.attempts_remaining as AssessmentEvent['attempts_remaining'],
    terminal: event.terminal, lifecycle: event.lifecycle as AssessmentEvent['lifecycle'],
    progress_deferred: event.progress_deferred, closure_reason: event.closure_reason as AssessmentEvent['closure_reason'],
  };
}

/** Stable chronological order with assessment question/answer/result dependencies first. */
export function orderAssessmentMessages<T extends {
  id: string; created_at: string; parent_message_id?: string | null; assessment_event?: AssessmentEvent | null;
}>(messages: ReadonlyArray<T>): T[] {
  const sorted = [...messages].sort((left,right) => {
    const prepop = Number(right.id.startsWith('prepop-'))-Number(left.id.startsWith('prepop-'));
    return prepop || (Date.parse(left.created_at)||0)-(Date.parse(right.created_at)||0) || left.id.localeCompare(right.id);
  });
  const byId = new Map(sorted.map(message => [message.id,message]));
  const priorResults = new Map<string,string[]>();
  for (const message of sorted) {
    const event = message.assessment_event;
    if (!event) continue;
    const earlier = sorted.filter(candidate => candidate.assessment_event?.kind==='result' &&
      candidate.assessment_event.assessment_id===event.assessment_id &&
      (event.kind==='closure' || candidate.assessment_event.attempts_used<event.attempts_used)).map(candidate => candidate.id);
    priorResults.set(message.id,earlier);
    if (event.answer_message_id && event.kind==='result') priorResults.set(event.answer_message_id,earlier);
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: T[] = [];
  const visit = (message: T) => {
    if (visited.has(message.id) || visiting.has(message.id)) return;
    visiting.add(message.id);
    for (const id of [...(priorResults.get(message.id) ?? []),message.assessment_event?.question_message_id,message.assessment_event?.answer_message_id,message.parent_message_id]) {
      const dependency = id ? byId.get(id) : undefined;
      if (dependency) visit(dependency);
    }
    visiting.delete(message.id);
    visited.add(message.id);
    result.push(message);
  };
  sorted.forEach(visit);
  return result;
}

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

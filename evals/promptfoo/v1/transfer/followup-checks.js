#!/usr/bin/env node
// Purpose: followup-checks.js implements the deterministic assessment_followup lifecycle check over ordered tutor turns: delivery precedes grading, the first valid answer resolves once, clarification stays open, assistance cancels without failure, feedback precedes a later assessment, a wrong answer alone is not Guard, and a failed transfer is not reused in the same context.
'use strict';

const KNOWN_STEP_KINDS = ['assessment_delivered', 'learner_answer', 'clarification_request', 'assistance_request', 'feedback', 'tutor_turn'];
const ANSWER_EVIDENCE_KINDS = ['clarification_request', 'assistance_request', 'feedback', 'tutor_turn'];

const result = (status, failures, steps, extras = {}) => ({
  metric: 'assessment_followup',
  method: 'deterministic',
  status,
  failures,
  steps,
  ...extras
});

const failure = (code, detail) => ({ code, ...detail });
const stepFailure = (code, turn, kind, detail = {}) => ({ code, turn, kind, actual: { turn, kind, ...detail }, ...detail });

function stepState(step, context) {
  if (step.kind === 'assessment_delivered') {
    context.assessment_open = true;
    context.delivered_item = step.item_id;
    context.previous_delivered_context_key = step.context_key === undefined ? context.previous_delivered_context_key : step.context_key;
    context.delivered_context_key = context.previous_delivered_context_key;
    context.resolved = false;
    context.feedback_since_resolution = false;
    context.cancelled = false;
  } else if (step.kind === 'learner_answer') {
    if (context.assessment_open) {
      if (!step.keep_open) context.assessment_open = false;
      context.resolved = true;
      context.resolved_turns.push(step.turn);
      context.last_outcome = step.outcome;
      context.last_item = step.item_id;
      context.answered_item = step.item_id;
      context.answered_context_key = step.context_key === undefined ? context.previous_delivered_context_key : step.context_key;
      context.cancelled = false;
    }
  } else if (step.kind === 'clarification_request') {
    context.clarifications += 1;
    context.assessment_open = true;
  } else if (step.kind === 'assistance_request') {
    context.cancellations.push({ turn: step.turn, reason: 'assistance_request', item_id: step.item_id });
    context.assessment_open = false;
    context.cancelled = true;
    if (step.assistance_unresolved) failures.push(stepFailure('assistance_treated_as_failure', step.turn, step.kind));
  } else if (step.kind === 'feedback') {
    context.feedback_since_resolution = true;
    context.resolved = false;
  } else if (step.kind === 'tutor_turn') {
    context.last_mode = step.mode;
  }
  return {
    turn: step.turn,
    kind: step.kind,
    state: {
      assessment_open: context.assessment_open,
      resolved: Boolean(context.resolved),
      feedback_since_resolution: Boolean(context.feedback_since_resolution),
      cancelled: Boolean(context.cancelled)
    }
  };
}

function checkAssessmentFollowup(sequence) {
  if (sequence === null || sequence === undefined) return result('missing', [failure('missing_sequence')], []);
  if (!Array.isArray(sequence) || sequence.length === 0) return result('error', [failure('malformed_sequence')], []);
  const failures = [];
  const steps = [];
  const context = {
    previous_delivered_context_key: null,
    delivered_context_key: null,
    answered_item: null,
    answered_context_key: null,
    assessment_open: false,
    resolved: false,
    resolved_turns: [],
    feedback_since_resolution: false,
    cancelled: false,
    cancellations: [],
    clarifications: 0,
    context_key: null,
    last_item: null,
    last_context_key: null
  };
  for (const [index, step] of sequence.entries()) {
    if (!step || typeof step !== 'object' || typeof step.turn !== 'number' || !KNOWN_STEP_KINDS.includes(step.kind)) {
      const code = !step || typeof step !== 'object' || step.kind === undefined || typeof step.turn !== 'number' ? 'malformed_step' : 'unknown_step_kind';
      return result('error', [stepFailure(code, index, step && step.kind)], steps);
    }
    const turn = step.turn === undefined ? index : step.turn;
    const before = { ...context };
    steps.push(stepState(step, context));
    if (step.kind === 'learner_answer') {
      if (before.assessment_open && before.answered_item === step.item_id && before.resolved) failures.push(stepFailure('resolved_twice', turn, step.kind));
      else if (!before.assessment_open) failures.push(stepFailure('graded_before_delivery', turn, step.kind));
      if (before.cancelled && step.assistance_unresolved) failures.push(stepFailure('assistance_treated_as_failure', turn, step.kind));
    }
    if (step.kind === 'assessment_delivered') {
      if (before.assessment_open) failures.push(stepFailure('consecutive_assessments', turn, step.kind, { previous_turn: before.delivered_turn }));
      if (before.resolved && !before.feedback_since_resolution) failures.push(stepFailure('feedback_precedes_assessment', turn, step.kind));
      if (before.answered_context_key != null && before.answered_context_key === step.context_key && before.last_outcome === 'wrong' && before.answered_item === step.item_id) {
        failures.push(stepFailure('failed_context_reuse', turn, step.kind, { item_id: step.item_id, context_key: step.context_key }));
      }
      context.delivered_turn = turn;
    }
    if (step.kind === 'tutor_turn' && step.mode === 'guard' && before.last_outcome === 'wrong' && before.resolved && before.last_item === step.item_id) {
      failures.push({ code: 'wrong_answer_guard', turn, kind: step.kind, expected: { mode: 'tutoring' }, actual: { turn, kind: step.kind, mode: step.mode } });
    }
  }
  return result(failures.length ? 'fail' : 'pass', failures, steps, {
    resolved_turns: context.resolved_turns,
    cancellations: context.cancellations,
    clarifications: context.clarifications
  });
}

function checkSequence(sequence, options = {}) {
  const checked = checkAssessmentFollowup(sequence);
  const turns = (sequence || []).map((step, index) => (step && step.turn === undefined ? index : step && step.turn));
  const missing = [];
  if (options.requireTurns) {
    for (let turn = 0; turn < turns.length; turn++) if (!turns.includes(turn)) missing.push(turn);
  }
  const expectedAnswers = (sequence || []).filter(step => step && step.kind === 'learner_answer' && step.answer_option_ids).flatMap(step => step.answer_option_ids).slice().sort();
  return {
    ...checked,
    missing_turns: missing,
    answered_option_ids: expectedAnswers,
    step_count: (sequence || []).length,
    ordered: turns.every((turn, index) => index === 0 || turn > turns[index - 1])
  };
}

module.exports = { checkAssessmentFollowup, checkSequence, KNOWN_STEP_KINDS, ANSWER_EVIDENCE_KINDS };

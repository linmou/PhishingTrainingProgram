#!/usr/bin/env node
// Purpose: followup.test.js pins the deterministic assessment lifecycle: delivery before grading, first-answer resolution once, clarification stays open, assistance cancels without failure, feedback before a later assessment, wrong answer alone is not Guard, and a failed transfer is not reused.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { checkAssessmentFollowup, checkSequence } = require('./followup-checks');
const fixtures = require('./fixtures/contract-fixtures.json');

const sequence = name => fixtures.lifecycle_sequences[name];
const codes = result => result.failures.map(failure => failure.code);

test('a full lifecycle sequence passes with per-step evidence', () => {
  const result = checkAssessmentFollowup(sequence('valid_full'));
  assert.equal(result.metric, 'assessment_followup');
  assert.equal(result.method, 'deterministic');
  assert.equal(result.status, 'pass', JSON.stringify(result.failures));
  assert.equal(result.steps.length, sequence('valid_full').length);
  assert.ok(result.steps.every(step => step.turn !== undefined && step.kind));
});

test('grading before delivery fails with the turn index', () => {
  const result = checkAssessmentFollowup(sequence('graded_before_delivery'));
  assert.equal(result.status, 'fail');
  assert.ok(codes(result).includes('graded_before_delivery'));
  const failure = result.failures.find(item => item.code === 'graded_before_delivery');
  assert.equal(failure.actual.turn, 0);
  assert.equal(failure.actual.kind, 'learner_answer');
});

test('the first valid answer resolves once and a second resolution fails', () => {
  assert.equal(checkAssessmentFollowup(sequence('assessment_chain')).status, 'pass');
  const twice = checkAssessmentFollowup(sequence('resolved_twice'));
  assert.ok(codes(twice).includes('resolved_twice'));
  assert.equal(twice.failures.find(item => item.code === 'resolved_twice').actual.turn, 2);
});

test('a clarification keeps the question open and the later answer still resolves it once', () => {
  const result = checkAssessmentFollowup(sequence('clarification_then_answer'));
  assert.equal(result.status, 'pass', JSON.stringify(result.failures));
  assert.deepEqual(result.resolved_turns, [2]);
  const misread = checkAssessmentFollowup(sequence('clarification_then_answer').map(step => step.kind === 'clarification_request' ? { ...step, kind: 'learner_answer', answer_option_ids: ['A'], outcome: 'wrong' } : step));
  assert.ok(codes(misread).includes('resolved_twice'));
});

test('an assistance request cancels the question without a behaviour failure', () => {
  const result = checkAssessmentFollowup(sequence('assistance_cancels'));
  assert.equal(result.status, 'pass', JSON.stringify(result.failures));
  assert.equal(result.cancellations.length, 1);
  assert.equal(result.cancellations[0].reason, 'assistance_request');
  const failure = checkAssessmentFollowup(sequence('assistance_cancels').map(step => step.kind === 'assistance_request' ? { ...step, kind: 'learner_answer', answer_option_ids: ['A'], outcome: 'wrong', assistance_unresolved: true } : step));
  assert.equal(failure.status, 'fail');
  assert.ok(codes(failure).includes('assistance_treated_as_failure'));
});

test('feedback must precede a later assessment, and two consecutive assessments fail with both turn indices', () => {
  const chained = checkAssessmentFollowup(sequence('assessment_chain').slice(0, 3));
  assert.ok(codes(chained).includes('feedback_precedes_assessment'));
  const immediate = checkAssessmentFollowup([
    sequence('valid_full')[0],
    { turn: 1, kind: 'assessment_delivered', item_id: 'item-2', assessment_id: 'assessment-2' }
  ]);
  assert.ok(codes(immediate).includes('consecutive_assessments'));
  const carried = checkAssessmentFollowup([
    sequence('valid_full')[0],
    { turn: 1, kind: 'learner_answer', item_id: 'item-2', answer_option_ids: ['B'], outcome: 'correct' },
    { turn: 2, kind: 'assessment_delivered', item_id: 'item-2', assessment_id: 'assessment-2' }
  ]);
  assert.equal(carried.status, 'pass', JSON.stringify(carried.failures));
});

test('a wrong answer alone never activates Guard', () => {
  const result = checkAssessmentFollowup(sequence('wrong_answer_guard'));
  assert.equal(result.status, 'fail');
  const failure = result.failures.find(item => item.code === 'wrong_answer_guard');
  assert.equal(failure.actual.turn, 2);
  assert.equal(failure.expected.mode, 'tutoring');
  assert.equal(failure.actual.mode, 'guard');
});

test('a failed transfer is not reused in the same context', () => {
  const result = checkAssessmentFollowup(sequence('failed_transfer_reused'));
  assert.equal(result.status, 'fail');
  const failure = result.failures.find(item => item.code === 'failed_context_reuse');
  assert.equal(failure.actual.context_key, 'context-delivery');
  assert.equal(failure.actual.item_id, 'item-2');
});

test('missing and error turn evidence stay distinct from a behaviour failure', () => {
  assert.equal(checkAssessmentFollowup(null).status, 'missing');
  const malformed = checkAssessmentFollowup([{ kind: 'assessment_delivered' }]);
  assert.equal(malformed.status, 'error');
  assert.ok(codes(malformed).includes('malformed_step'));
  const unknown = checkAssessmentFollowup([{ turn: 0, kind: 'teleported', item_id: 'item-2' }]);
  assert.equal(unknown.status, 'error');
  assert.ok(codes(unknown).includes('unknown_step_kind'));
});

test('a stateful join reports every step and asserts state after each one', () => {
  const result = checkSequence(sequence('valid_full'));
  assert.equal(result.steps.length, 4);
  assert.ok(result.steps.every((step, index) => step.turn === index));
  assert.deepEqual(result.steps.map(step => step.state.assessment_open), [true, false, false, true]);
  const joined = checkSequence(sequence('valid_full'), { requireTurns: true });
  assert.deepEqual(joined.missing_turns, []);
});

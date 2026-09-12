#!/usr/bin/env node
// Purpose: contract-checks.test.js pins the deterministic t09_contract_and_progress check: reason-first serialization, known ids, four A-D options with key cardinality, rendering limits, progress pairs without a parallel mastery field, and assessment as a tutor turn rather than a room mode.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  checkContractAndProgress,
  checkProgressPair,
  ORDERED_REASON_FIRST,
  ROOM_MODES
} = require('./contract-checks');
const fixtures = require('./fixtures/contract-fixtures.json');

const baseContext = () => ({
  item_ids: ['item-1', 'item-2'],
  message_ids: ['msg-fixture-focus', 'msg-evidence-1', 'msg-evidence-2', 'msg-repair-1'],
  room_mode: 'tutoring',
  prior_progress: fixtures.progress_pair_from
});

const run = (output, context = {}) => checkContractAndProgress(JSON.stringify(output), { ...baseContext(), ...context });

test('a valid tutoring turn passes with no failures', () => {
  const result = run(fixtures.valid_tutoring_output);
  assert.equal(result.status, 'pass');
  assert.equal(result.metric, 't09_contract_and_progress');
  assert.equal(result.method, 'deterministic');
  assert.deepEqual(result.failures, []);
});

test('a valid assessment turn passes and reports the item id', () => {
  const result = run(fixtures.valid_assessment_output);
  assert.equal(result.status, 'pass', JSON.stringify(result.failures));
  assert.equal(result.actual.mode, 'assessment');
  assert.equal(result.actual.target_item_id, 'item-2');
  assert.equal(result.actual.correct_option_ids.join(','), 'B');
});

test('reason must serialize before every other key', () => {
  const reordered = JSON.stringify({
    decision: fixtures.valid_tutoring_output.decision,
    response: fixtures.valid_tutoring_output.response,
    reason: fixtures.valid_tutoring_output.reason
  });
  const result = checkContractAndProgress(reordered, baseContext());
  assert.equal(result.status, 'fail');
  assert.ok(result.failures.some(failure => failure.code === 'serialization_order'));
  assert.deepEqual(result.expected.key_order[0], 'reason');
  assert.deepEqual(ORDERED_REASON_FIRST, ['reason', 'decision', 'response', 'assessment']);
});

test('unknown item and message ids are rejected', () => {
  const unknownItem = run({ ...fixtures.valid_tutoring_output, decision: { ...fixtures.valid_tutoring_output.decision, target_item_id: 'item-9' } });
  assert.ok(unknownItem.failures.some(failure => failure.code === 'unknown_item_id' && failure.actual === 'item-9'));
  const unknownMessage = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, transfer_basis: { ...fixtures.valid_assessment_output.assessment.transfer_basis, source_evidence_message_ids: ['msg-missing'] } } });
  assert.ok(unknownMessage.failures.some(failure => failure.code === 'unknown_message_id' && failure.actual === 'msg-missing'));
});

test('an assessment needs exactly four A-D options and a key consistent with the selection type', () => {
  const threeOptions = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, options: fixtures.valid_assessment_output.assessment.options.slice(0, 3) } });
  assert.ok(threeOptions.failures.some(failure => failure.code === 'option_cardinality' && failure.expected === 4 && failure.actual === 3));
  const duplicateIds = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, options: fixtures.valid_assessment_output.assessment.options.map(option => ({ ...option, id: 'A' })) } });
  assert.ok(duplicateIds.failures.some(failure => failure.code === 'option_ids'));
  const twoKeys = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, correct_option_ids: ['A', 'B'] } });
  assert.ok(twoKeys.failures.some(failure => failure.code === 'key_cardinality' && failure.expected === 1 && failure.actual === 2));
  const multi = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, selection_type: 'multiple', correct_option_ids: ['A', 'B'] } });
  assert.equal(multi.status, 'pass', JSON.stringify(multi.failures));
  const emptyMulti = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, selection_type: 'multiple', correct_option_ids: [] } });
  assert.ok(emptyMulti.failures.some(failure => failure.code === 'key_cardinality'));
  const unknownKey = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, correct_option_ids: ['E'] } });
  assert.ok(unknownKey.failures.some(failure => failure.code === 'unknown_option_key'));
});

test('assessment rendering and stem limits are enforced', () => {
  const longStem = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, stem: 'x'.repeat(301) } });
  assert.ok(longStem.failures.some(failure => failure.code === 'stem_length' && failure.limit === 300));
  const emptyStem = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, stem: '   ' } });
  assert.ok(emptyStem.failures.some(failure => failure.code === 'stem_empty'));
  const longOption = run({ ...fixtures.valid_assessment_output, assessment: { ...fixtures.valid_assessment_output.assessment, options: fixtures.valid_assessment_output.assessment.options.map((option, index) => index ? option : { ...option, text: 'y'.repeat(201) }) } });
  assert.ok(longOption.failures.some(failure => failure.code === 'option_length' && failure.limit === 200));
});

test('assessment is a tutor turn and never a room mode', () => {
  assert.deepEqual(ROOM_MODES, ['tutoring', 'guard']);
  const assessmentMode = run(fixtures.valid_assessment_output, { room_mode: 'assessment' });
  assert.ok(assessmentMode.failures.some(failure => failure.code === 'room_mode_separation' && failure.actual === 'assessment'));
  const guardRoom = run(fixtures.valid_guard_output, { room_mode: 'guard' });
  assert.equal(guardRoom.status, 'pass', JSON.stringify(guardRoom.failures));
  const modeMismatch = run(fixtures.valid_tutoring_output, { room_mode: 'guard' });
  assert.ok(modeMismatch.failures.some(failure => failure.code === 'mode_instruction_pair'));
});

test('mode and instruction combinations are constrained, and a participation-only guard uses a null item', () => {
  const teachingInAssessment = run({ ...fixtures.valid_assessment_output, decision: { mode: 'assessment', instruction: 'scaffolding', target_item_id: 'item-2' } });
  assert.ok(teachingInAssessment.failures.some(failure => failure.code === 'mode_instruction_pair'));
  const assessmentWithoutItem = run({ ...fixtures.valid_assessment_output, decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: null } });
  assert.ok(assessmentWithoutItem.failures.some(failure => failure.code === 'assessment_requires_item'));
  const tutoringWithAssessment = run({ ...fixtures.valid_tutoring_output, decision: { mode: 'tutoring', instruction: 'scaffolding', target_item_id: null }, assessment: fixtures.valid_assessment_output.assessment });
  assert.ok(tutoringWithAssessment.failures.some(failure => failure.code === 'unexpected_assessment'));
  const guardWithNullInstruction = run({ ...fixtures.valid_guard_output, decision: { mode: 'guard', instruction: null, target_item_id: null } });
  assert.equal(guardWithNullInstruction.status, 'pass', JSON.stringify(guardWithNullInstruction.failures));
});

test('a progress pair must be a declared transition and must not carry a parallel mastery field', () => {
  for (const to of fixtures.progress_pair_valid_tos) {
    assert.equal(checkProgressPair(fixtures.progress_pair_from, to).status, 'pass', JSON.stringify(to));
  }
  for (const to of fixtures.progress_pair_invalid_tos) {
    assert.equal(checkProgressPair(fixtures.progress_pair_from, to).status, 'fail', JSON.stringify(to));
  }
  const withMastery = run({ ...fixtures.valid_tutoring_output, progress: { ...fixtures.progress_pair_from, mastery: 'good' } });
  assert.ok(withMastery.failures.some(failure => failure.code === 'parallel_mastery_field'));
  const validProgress = run({ ...fixtures.valid_tutoring_output, progress: fixtures.progress_pair_valid_tos[1] });
  assert.equal(validProgress.status, 'pass', JSON.stringify(validProgress.failures));
  assert.equal(validProgress.actual.progress_to.status, 'covered');
});

test('a statement is reported as fail with typed evidence while missing or unparseable output stays distinct', () => {
  assert.equal(checkContractAndProgress(null, baseContext()).status, 'missing');
  const unparseable = checkContractAndProgress('{not json', baseContext());
  assert.equal(unparseable.status, 'fail');
  assert.ok(unparseable.failures.some(failure => failure.code === 'unparseable_output'));
  const emptyResponse = run({ ...fixtures.valid_tutoring_output, response: '   ' });
  assert.ok(emptyResponse.failures.some(failure => failure.code === 'empty_response'));
  const emptyReason = run({ ...fixtures.valid_tutoring_output, reason: '' });
  assert.ok(emptyReason.failures.some(failure => failure.code === 'empty_reason'));
});

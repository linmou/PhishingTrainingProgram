#!/usr/bin/env node
// Purpose: contract-checks.js implements the deterministic t09_contract_and_progress check over a preserved v3 generation: reason-first serialization, known ids, four A-D options with key cardinality, rendering limits, progress-pair validity without a parallel mastery field, and assessment as a tutor turn rather than a room mode.
'use strict';

const ORDERED_REASON_FIRST = ['reason', 'decision', 'response', 'assessment'];
const ROOM_MODES = ['tutoring', 'guard'];
const TEACHING_INSTRUCTIONS = ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation'];
const OPTION_IDS = ['A', 'B', 'C', 'D'];
const STEM_LIMIT = 300;
const OPTION_TEXT_LIMIT = 200;
const RESPONSE_LIMIT = 600;

const STATUS_ORDER = ['pending', 'needs_review', 'partially_covered', 'covered'];
const UNDERSTANDING_ORDER = ['none', 'basic', 'good'];

const MASTERY_KEYS = ['mastery', 'mastery_level', 'mastery_score'];

const result = (status, failures, actual, expected) => ({
  metric: 't09_contract_and_progress',
  method: 'deterministic',
  status,
  failures,
  actual,
  expected
});

const failure = (code, detail) => ({ code, ...detail });

function checkProgressPair(from, to) {
  const failures = [];
  if (!from || !to) return { metric: 'progress_pair', method: 'deterministic', status: 'missing', failures: [failure('missing_progress_pair')] };
  for (const key of MASTERY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(to, key) || Object.prototype.hasOwnProperty.call(from, key)) {
      failures.push(failure('parallel_mastery_field', { field: key }));
    }
  }
  if (from.target_item_id !== to.target_item_id) failures.push(failure('progress_pair_target_change', { expected: from.target_item_id, actual: to.target_item_id }));
  if (!STATUS_ORDER.includes(from.status) || !STATUS_ORDER.includes(to.status)) {
    failures.push(failure('unknown_progress_status', { actual: [from.status, to.status].filter(value => !STATUS_ORDER.includes(value)) }));
  } else {
    const advancedStatus = STATUS_ORDER.indexOf(to.status) - STATUS_ORDER.indexOf(from.status);
    const advancedUnderstanding = UNDERSTANDING_ORDER.indexOf(to.understanding_level) - UNDERSTANDING_ORDER.indexOf(from.understanding_level);
    if (advancedStatus < 0 || advancedUnderstanding < 0) failures.push(failure('invalid_progress_pair', { expected: { status: from.status, understanding_level: from.understanding_level }, actual: to }));
    else if (advancedStatus === 0 && advancedUnderstanding === 0) failures.push(failure('progress_pair_not_advanced', { expected: 'one dimension must advance', actual: to }));
  }
  return { metric: 'progress_pair', method: 'deterministic', status: failures.length ? 'fail' : 'pass', failures, actual: { ...to }, expected: { from } };
}

function checkContractAndProgress(rawOutput, context = {}) {
  if (rawOutput === null || rawOutput === undefined || rawOutput === '') return result('missing', [failure('missing_output')], null, {});
  let parsed;
  try {
    parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
  } catch (error) {
    return result('fail', [failure('unparseable_output', { reason: error.message })], null, {});
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return result('fail', [failure('non_object_output')], null, {});
  }
  const failures = [];
  const keyOrder = Object.keys(parsed);
  if (keyOrder[0] !== ORDERED_REASON_FIRST[0]) failures.push(failure('serialization_order', { expected: ORDERED_REASON_FIRST, actual: keyOrder }));
  if (typeof parsed.reason !== 'string' || !parsed.reason.trim()) failures.push(failure('empty_reason'));
  if (typeof parsed.response !== 'string' || !parsed.response.trim()) failures.push(failure('empty_response'));
  if (typeof parsed.response === 'string' && parsed.response.length > RESPONSE_LIMIT) failures.push(failure('response_length', { limit: RESPONSE_LIMIT, actual: parsed.response.length }));

  const decision = parsed.decision;
  const actual = { key_order: keyOrder, mode: decision && decision.mode, instruction: decision && decision.instruction, target_item_id: decision && decision.target_item_id };
  if (!decision || typeof decision !== 'object') {
    failures.push(failure('missing_decision'));
  } else {
    const itemIds = new Set(context.item_ids || []);
    const messageIds = new Set(context.message_ids || []);
    if (!['tutoring', 'guard', 'assessment'].includes(decision.mode)) failures.push(failure('unknown_mode', { actual: decision.mode }));
    const instructionOk = decision.instruction === null || TEACHING_INSTRUCTIONS.includes(decision.instruction) || decision.instruction === 'transfer_assess' || decision.instruction === 'guard';
    if (!instructionOk) failures.push(failure('unknown_instruction', { actual: decision.instruction }));
    if (decision.target_item_id !== null && decision.target_item_id !== undefined && !itemIds.has(decision.target_item_id)) {
      failures.push(failure('unknown_item_id', { actual: decision.target_item_id }));
    }
    const pairs = {
      tutoring: { instructions: TEACHING_INSTRUCTIONS, requires_assessment: false },
      guard: { instructions: [...TEACHING_INSTRUCTIONS, 'guard', null], requires_assessment: false },
      assessment: { instructions: ['transfer_assess'], requires_assessment: true }
    }[decision.mode];
    if (pairs && !pairs.instructions.includes(decision.instruction)) failures.push(failure('mode_instruction_pair', { mode: decision.mode, actual: decision.instruction }));
    if (decision.mode === 'assessment' && !decision.target_item_id) failures.push(failure('assessment_requires_item'));
    if (decision.mode !== 'assessment' && parsed.assessment) failures.push(failure('unexpected_assessment'));
    if (context.room_mode !== undefined) {
      if (!ROOM_MODES.includes(context.room_mode)) failures.push(failure('room_mode_separation', { actual: context.room_mode, allowed: ROOM_MODES }));
      else {
        const allowedModes = context.room_mode === 'tutoring' ? ['tutoring', 'assessment'] : [context.room_mode];
        if (!allowedModes.includes(decision.mode)) failures.push(failure('mode_instruction_pair', { mode: decision.mode, actual: context.room_mode }));
      }
    }
    if (parsed.assessment) failures.push(...checkAssessment(parsed.assessment, messageIds, decision));
    if (parsed.progress) {
      const pair = checkProgressPair(context.prior_progress, parsed.progress);
      failures.push(...pair.failures);
      actual.progress_to = parsed.progress;
    }
  }
  return result(failures.length ? 'fail' : 'pass', failures, actual, { key_order: ORDERED_REASON_FIRST });
}

function checkAssessment(assessment, messageIds, decision) {
  const failures = [];
  if (!Array.isArray(assessment.options)) {
    failures.push(failure('option_cardinality', { expected: 4, actual: 0 }));
  } else {
    if (assessment.options.length !== OPTION_IDS.length) failures.push(failure('option_cardinality', { expected: OPTION_IDS.length, actual: assessment.options.length }));
    const optionIds = assessment.options.map(option => option.id);
    if ([...new Set(optionIds)].length !== optionIds.length) failures.push(failure('option_ids', { actual: optionIds }));
    for (const id of optionIds) if (!OPTION_IDS.includes(id)) failures.push(failure('option_ids', { actual: id }));
    for (const option of assessment.options) {
      if (typeof option.text !== 'string' || !option.text.trim()) failures.push(failure('option_empty', { actual: option.id }));
      else if (option.text.length > OPTION_TEXT_LIMIT) failures.push(failure('option_length', { limit: OPTION_TEXT_LIMIT, actual: option.text.length }));
    }
  }
  if (typeof assessment.stem !== 'string' || !assessment.stem.trim()) failures.push(failure('stem_empty'));
  else if (assessment.stem.length > STEM_LIMIT) failures.push(failure('stem_length', { limit: STEM_LIMIT, actual: assessment.stem.length }));
  if (!['single', 'multiple'].includes(assessment.selection_type)) failures.push(failure('selection_type', { actual: assessment.selection_type }));
  const keys = assessment.correct_option_ids;
  if (!Array.isArray(keys)) {
    failures.push(failure('key_cardinality', { expected: 1, actual: 0 }));
  } else {
    const minimum = 1;
    if (keys.length < minimum) failures.push(failure('key_cardinality', { expected: minimum, actual: keys.length }));
    if (assessment.selection_type === 'single' && keys.length !== 1) failures.push(failure('key_cardinality', { expected: 1, actual: keys.length }));
    for (const key of keys) if (!OPTION_IDS.includes(key)) failures.push(failure('unknown_option_key', { actual: key }));
  }
  if (assessment.item_id && decision && assessment.item_id !== decision.target_item_id) {
    failures.push(failure('assessment_item_mismatch', { expected: decision.target_item_id, actual: assessment.item_id }));
  }
  const basis = assessment.transfer_basis;
  if (!basis || typeof basis !== 'object') {
    failures.push(failure('missing_transfer_basis'));
  } else {
    for (const field of ['concept', 'source_context', 'changed_context']) {
      if (typeof basis[field] !== 'string' || !basis[field].trim()) failures.push(failure('missing_transfer_basis', { field }));
    }
    if (basis.source_context === basis.changed_context) failures.push(failure('transfer_basis_identical_context'));
    const sourceMessageIds = (basis.source_evidence_message_ids || []).map(id => ({ id, known: messageIds.has(id) }));
    const unknown = sourceMessageIds.filter(item => !item.known).map(item => item.id);
    if (unknown.length) failures.push(failure('unknown_message_id', { actual: unknown[0] }));
  }
  return failures;
}

module.exports = { checkContractAndProgress, checkProgressPair, ORDERED_REASON_FIRST, ROOM_MODES, STATUS_ORDER, UNDERSTANDING_ORDER, STEM_LIMIT, OPTION_TEXT_LIMIT };

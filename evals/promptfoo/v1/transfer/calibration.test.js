#!/usr/bin/env node
// Purpose: calibration.test.js pins the transfer judge calibration contract: the four semantic rubrics require annotated positive, negative, boundary, and contradictory examples, deterministic assessment_followup is excluded, disagreements and judge errors stay visible, and uncalibrated rubrics block acceptance.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildCalibration, calibrationStatus, SEMANTIC_RUBRIC_IDS, DETERMINISTIC_RUBRIC_IDS } = require('./calibrate');
const registry = require('./metric-registry.json');

const evidence = verdict => ({ verdict });

function fullExamples(metricId) {
  return ['positive', 'negative', 'boundary', 'contradictory'].map((kind, index) => ({
    example_id: `${metricId}-${kind}`,
    metric_id: metricId,
    kind,
    output: { suggested_response: `${kind} example` },
    human_label: kind !== 'contradictory',
    judge_label: kind !== 'contradictory'
  }));
}

test('the four semantic rubrics are calibrated and the deterministic rubric is excluded', () => {
  assert.deepEqual(SEMANTIC_RUBRIC_IDS.slice().sort(), ['assessment_item_validity', 'medium_transfer_quality', 'transfer_trigger_target', 'verification_evidence']);
  assert.deepEqual(DETERMINISTIC_RUBRIC_IDS, ['assessment_followup']);
  const calibration = buildCalibration({ examples: SEMANTIC_RUBRIC_IDS.flatMap(fullExamples), judge_settings: { model: 'qwen3.5-flash' }, judge_version: 'v1' });
  assert.equal(calibration.status, 'complete');
  assert.deepEqual(calibration.excluded_deterministic, DETERMINISTIC_RUBRIC_IDS);
  assert.equal(calibration.excluded_reason, 'covered by deterministic lifecycle fixtures');
  assert.throws(() => buildCalibration({ examples: fullExamples('assessment_followup'), judge_settings: {}, judge_version: 'v1' }), /deterministic/);
});

test('each semantic rubric needs all four annotated example kinds before calibration is complete', () => {
  for (const kind of ['positive', 'negative', 'boundary', 'contradictory']) {
    const examples = SEMANTIC_RUBRIC_IDS.flatMap(fullExamples).filter(example => !(example.metric_id === 'medium_transfer_quality' && example.kind === kind));
    const calibration = buildCalibration({ examples, judge_settings: { model: 'qwen3.5-flash' }, judge_version: 'v1' });
    assert.equal(calibration.status, 'incomplete');
    assert.ok(calibration.missing_examples.some(item => item.metric_id === 'medium_transfer_quality' && item.kind === kind));
  }
});

test('a disagreement is recorded with both labels and keeps the rubric uncalibrated', () => {
  const examples = SEMANTIC_RUBRIC_IDS.flatMap(fullExamples).map(example => example.metric_id === 'verification_evidence' && example.kind === 'boundary' ? { ...example, human_label: false, judge_label: true } : example);
  const calibration = buildCalibration({ examples, judge_settings: { model: 'qwen3.5-flash' }, judge_version: 'v1' });
  assert.equal(calibration.status, 'incomplete');
  const disagreement = calibration.disagreements.find(item => item.metric_id === 'verification_evidence');
  assert.equal(disagreement.human_label, false);
  assert.equal(disagreement.judge_label, true);
  assert.deepEqual(calibrationStatus(calibration).blocking_metrics, ['verification_evidence']);
});

test('a judge error is preserved with its raw response and never counted as agreement', () => {
  const examples = SEMANTIC_RUBRIC_IDS.flatMap(fullExamples);
  const judgments = [
    { metric_id: 'transfer_trigger_target', example_id: 'transfer_trigger_target-positive', status: 'pass', raw: { choices: [] }, parsed: { pass: true } },
    { metric_id: 'transfer_trigger_target', example_id: 'transfer_trigger_target-negative', status: 'error', error: 'HTTP 500', raw: null, parsed: null },
    { metric_id: 'medium_transfer_quality', example_id: 'medium_transfer_quality-positive', status: 'missing', raw: null, parsed: null }
  ];
  const calibration = buildCalibration({ examples, judge_settings: { model: 'qwen3.5-flash' }, judge_version: 'v1', judgments });
  assert.equal(calibration.status, 'incomplete');
  assert.equal(calibration.unresolved_errors.length, 2);
  assert.ok(calibration.unresolved_errors.some(item => item.status === 'error' && item.error === 'HTTP 500'));
  assert.ok(calibration.unresolved_errors.some(item => item.status === 'missing'));
  assert.equal(calibration.agreed, 1);
  assert.equal(calibration.disagreements.some(item => item.metric_id === 'transfer_trigger_target' && item.example_id === 'transfer_trigger_target-negative'), false);
  assert.ok(calibration.judgments.every(item => item.raw !== undefined));
});

test('calibration without a live judge reports the missing configuration as a blocking unrun gate', () => {
  const calibration = buildCalibration({ examples: SEMANTIC_RUBRIC_IDS.flatMap(fullExamples), judge_settings: null, judge_version: 'v1' });
  assert.equal(calibration.verdict, 'unrun');
  assert.equal(calibration.blocked_reason, 'MISSING_LIVE_CONFIGURATION');
  assert.equal(calibration.status, 'incomplete');
  assert.deepEqual(calibration.required_configuration, ['judge model', 'judge endpoint', 'provider credentials', 'judge token limit']);
});

test('calibration examples can never be eligible holdouts', () => {
  const calibration = buildCalibration({ examples: SEMANTIC_RUBRIC_IDS.flatMap(fullExamples), judge_settings: { model: 'qwen3.5-flash' }, judge_version: 'v1' });
  assert.equal(calibration.holdout_eligible, false);
  assert.equal(calibration.limitation, 'Calibration examples establish judge agreement on these boundaries and are not eligible holdouts.');
  assert.equal(registry.checks.find(check => check.metric_id === 'assessment_followup').calibration, 'not_applicable: covered by deterministic lifecycle fixtures instead of judge calibration (rubric-registry.md Calibration contract)');
});

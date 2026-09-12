#!/usr/bin/env node
// Purpose: calibration.js builds immutable transfer judge calibration records for the four semantic rubrics, excludes the deterministic assessment_followup, preserves raw judge responses and unresolved errors, and reports a blocking unrun gate when no live judge is configured.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const registry = require('./metric-registry.json');

const SEMANTIC_RUBRIC_IDS = registry.checks.filter(check => check.method === 'llm_rubric').map(check => check.metric_id);
const DETERMINISTIC_RUBRIC_IDS = [registry.checks.find(check => check.metric_id === 'assessment_followup').metric_id];
const DETERMINISTIC_SUPPORTING_CHECK_IDS = registry.checks.filter(check => check.method === 'deterministic' && check.metric_id !== 'assessment_followup').map(check => check.metric_id);
const EXAMPLE_KINDS = ['positive', 'negative', 'boundary', 'contradictory'];
const REQUIRED_CONFIGURATION = ['judge model', 'judge endpoint', 'provider credentials', 'judge token limit'];
const LIMITATION = 'Calibration examples establish judge agreement on these boundaries and are not eligible holdouts.';

function buildCalibration({ examples = [], judgments = [], judge_settings = null, judge_version = null } = {}) {
  const offending = examples.filter(example => DETERMINISTIC_RUBRIC_IDS.includes(example.metric_id));
  if (offending.length) throw new Error(`Calibration excludes the deterministic rubric ${offending[0].metric_id}; it is covered by deterministic lifecycle fixtures.`);
  for (const example of examples) {
    if (!SEMANTIC_RUBRIC_IDS.includes(example.metric_id)) throw new Error(`Calibration received an unknown rubric ${example.metric_id}.`);
  }
  const missing_examples = [];
  for (const metric_id of SEMANTIC_RUBRIC_IDS) {
    for (const kind of EXAMPLE_KINDS) {
      if (!examples.some(example => example.metric_id === metric_id && example.kind === kind)) missing_examples.push({ metric_id, kind });
    }
  }
  const unresolved_errors = judgments.filter(judgment => judgment.status === 'error' || judgment.status === 'missing')
    .map(judgment => ({ ...judgment }));
  const judged = new Map(judgments.map(judgment => [judgment.example_id, judgment]));
  const labelDisagrees = example => {
    if (example.agreement === false) return true;
    if (example.human_label === undefined || example.judge_label === undefined) return false;
    return example.human_label !== example.judge_label;
  };
  const disagreements = examples
    .filter(example => labelDisagrees(example) && !['error', 'missing'].includes(judged.get(example.example_id)?.status))
    .map(example => ({ metric_id: example.metric_id, example_id: example.example_id, kind: example.kind, human_label: example.human_label, judge_label: example.judge_label }));
  const agreed = examples.filter(example => {
    const judgment = judged.get(example.example_id);
    if (judgment) return judgment.status === 'pass' && !labelDisagrees(example);
    return !labelDisagrees(example);
  }).length;
  const unconfigured = !judge_settings;
  const status = unconfigured || missing_examples.length || disagreements.length || unresolved_errors.length ? 'incomplete' : 'complete';
  return {
    calibration_version: 'transfer-calibration-v1',
    created_at: new Date().toISOString(),
    judge_version,
    judge_settings: judge_settings ? { model: judge_settings.model, temperature: judge_settings.temperature ?? null, max_tokens: judge_settings.max_tokens ?? null, enable_thinking: judge_settings.enable_thinking ?? null } : null,
    semantic_rubric_ids: SEMANTIC_RUBRIC_IDS.slice(),
    excluded_deterministic: DETERMINISTIC_RUBRIC_IDS.slice(),
    excluded_reason: 'covered by deterministic lifecycle fixtures',
    examples: examples.slice(),
    judgments: judgments.map(judgment => ({ raw: null, parsed: null, ...judgment })),
    agreed,
    total: examples.length,
    disagreements,
    unresolved_errors,
    missing_examples,
    status,
    verdict: unconfigured ? 'unrun' : status === 'complete' ? 'complete' : 'incomplete',
    blocked_reason: unconfigured ? 'MISSING_LIVE_CONFIGURATION' : null,
    required_configuration: unconfigured ? REQUIRED_CONFIGURATION.slice() : [],
    holdout_eligible: false,
    limitation: LIMITATION
  };
}

function calibrationStatus(calibration) {
  const blocking = new Set([...calibration.disagreements.map(item => item.metric_id), ...calibration.missing_examples.map(item => item.metric_id)]);
  for (const error of calibration.unresolved_errors) if (error.metric_id) blocking.add(error.metric_id);
  return { verdict: calibration.verdict, status: calibration.status, blocking_metrics: [...blocking].sort() };
}

function writeCalibration(directory, calibration) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'calibration.json');
  fs.writeFileSync(file, JSON.stringify(calibration, null, 2) + '\n', { flag: 'wx' });
  return file;
}

module.exports = { buildCalibration, calibrationStatus, writeCalibration, SEMANTIC_RUBRIC_IDS, DETERMINISTIC_RUBRIC_IDS, DETERMINISTIC_SUPPORTING_CHECK_IDS, EXAMPLE_KINDS, REQUIRED_CONFIGURATION, LIMITATION };

#!/usr/bin/env node
// Purpose: gate-fixtures.js builds the synthetic transfer gate reports used by the gate tests and by the standalone gate-fixtures command; it derives expected rows from the frozen manifest and never from returned report rows.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { assess } = require('./quality-gate');
const policy = require('./gate-policy.json');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function frozen() {
  const { cases } = read('cases.json');
  return { cases, manifest: read('manifest.json'), policy };
}

function metricsFor(definition) {
  return [...new Set(['t09_contract_and_progress', ...definition.evaluator.metric_ids])];
}

function makeReport(options = {}) {
  const { cases, manifest } = options.cases ? { cases: options.cases, manifest: options.manifest || read('manifest.json') } : frozen();
  const repetitions = manifest.settings.repetitions;
  const evidence = [];
  for (const definition of cases) {
    for (let repetition = 0; repetition < repetitions; repetition++) {
      evidence.push({
        case_id: definition.case_id,
        case_version: definition.case_version,
        partition: definition.partition,
        case_role: definition.case_role,
        repetition,
        target_generation_id: `gen-${definition.case_id}-${repetition}`,
        target_input: clone(definition.input),
        metric_ids: metricsFor(definition),
        results: metricsFor(definition).map(metric => ({
          metric,
          method: policy.hard_metrics.includes(metric) ? 'deterministic' : 'llm_rubric',
          status: 'pass',
          pass: true,
          score: 1,
          reason: 'fixture pass'
        }))
      });
    }
  }
  return {
    run_id: options.run_id || 'fixture-run-1',
    manifest_version: manifest.manifest_version,
    contract_version: manifest.shared_request_contract.contract_version,
    evidence
  };
}

const MUTATIONS = {
  passing: () => makeReport(),
  missing_result: () => {
    const report = makeReport();
    report.evidence[0].results = report.evidence[0].results.filter(result => result.metric !== 'transfer_trigger_target');
    return report;
  },
  errored_result: () => {
    const report = makeReport();
    report.evidence[0].results[0] = { ...report.evidence[0].results[0], status: 'error', pass: false, score: 0, reason: 'checks threw' };
    return report;
  },
  zero_coverage: () => {
    const report = makeReport();
    for (const record of report.evidence) {
      for (const result of record.results) {
        if (result.metric === 'transfer_trigger_target') Object.assign(result, { status: 'not_applicable', applicable: false, pass: null, score: null, reason: 'declared conditional' });
      }
    }
    return report;
  },
  below_threshold: () => {
    const report = makeReport();
    const target = report.evidence.find(record => record.metric_ids.includes('medium_transfer_quality'));
    const index = target.results.findIndex(result => result.metric === 'medium_transfer_quality');
    target.results[index] = { ...target.results[index], status: 'fail', pass: false, score: 0, reason: 'brand-only substitution' };
    return report;
  },
  pair_member_failed: () => {
    const report = makeReport();
    const target = report.evidence.find(record => record.metric_ids.includes('medium_transfer_quality') && read('cases.json').cases.find(item => item.case_id === record.case_id).pair);
    const index = target.results.findIndex(result => result.metric === 'medium_transfer_quality');
    target.results[index] = { ...target.results[index], status: 'fail', pass: false, score: 0, reason: 'pair member failed' };
    return report;
  },
  forbidden_metadata: () => {
    const report = makeReport();
    report.evidence[0].target_input = { ...report.evidence[0].target_input, holdout_eligibility: 'leaked' };
    return report;
  },
  incomplete_manifest: () => {
    const report = makeReport();
    delete report.contract_version;
    return report;
  }
};

const GATE_FIXTURES = [
  { name: 'passing', expected_verdict: 'accepted' },
  { name: 'missing_result', expected_verdict: 'incomplete' },
  { name: 'errored_result', expected_verdict: 'incomplete' },
  { name: 'zero_coverage', expected_verdict: 'incomplete' },
  { name: 'below_threshold', expected_verdict: 'failed' },
  { name: 'above_threshold_below_baseline', expected_verdict: 'failed' },
  { name: 'pair_member_failed', expected_verdict: 'failed' },
  { name: 'incomparable_baseline', expected_verdict: 'incomplete' },
  { name: 'invalid_inapplicability', expected_verdict: 'incomplete' },
  { name: 'missing_builder_hash', expected_verdict: 'incomplete' },
  { name: 'prompt_hash_mismatch', expected_verdict: 'incomplete' },
  { name: 'request_parity_mismatch', expected_verdict: 'incomplete' },
  { name: 'budget_mismatch', expected_verdict: 'incomplete' },
  { name: 'thinking_mismatch', expected_verdict: 'incomplete' },
  { name: 'forbidden_metadata', expected_verdict: 'incomplete' }
];

function fixtureInputs(name) {
  const { cases, manifest } = frozen();
  switch (name) {
    case 'above_threshold_below_baseline': {
      const report = makeReport();
      const target = report.evidence.find(record => record.case_role === 'positive');
      const index = target.results.findIndex(result => result.metric === 'transfer_trigger_target');
      target.results[index] = { ...target.results[index], status: 'fail', pass: false, score: 0, reason: 'weaker target' };
      return { report, context: { cases, manifest, policy, baseline: { report: makeReport(), manifest } } };
    }
    case 'incomparable_baseline': {
      const drifted = clone(manifest);
      drifted.partitions = { ...drifted.partitions, development: { ...drifted.partitions.development, case_versions: drifted.partitions.development.case_versions.map(version => version + 1) } };
      return { report: makeReport(), context: { cases, manifest, policy, baseline: { report: makeReport(), manifest: drifted } } };
    }
    case 'invalid_inapplicability': {
      const report = makeReport();
      report.evidence[0].results[0] = { ...report.evidence[0].results[0], status: 'not_applicable', applicable: false, pass: null, score: null, reason: 'skipped' };
      return { report, context: { cases, manifest, policy } };
    }
    case 'missing_builder_hash':
    case 'prompt_hash_mismatch':
    case 'request_parity_mismatch':
    case 'budget_mismatch':
    case 'thinking_mismatch': {
      const broken = clone(manifest);
      if (name === 'missing_builder_hash') delete broken.shared_request_contract.builder_source_sha256;
      if (name === 'prompt_hash_mismatch') broken.shared_request_contract.production_prompt_source_sha256 = 'deadbeef';
      if (name === 'request_parity_mismatch') broken.shared_request_contract.parity_result = 'mismatch';
      if (name === 'budget_mismatch') broken.shared_request_contract.evaluation_effective_completion_token_budget = 8000;
      if (name === 'thinking_mismatch') broken.shared_request_contract.evaluation_enable_thinking = true;
      return { report: makeReport(), context: { cases, manifest: broken, policy } };
    }
    default:
      return { report: MUTATIONS[name](), context: { cases, manifest, policy } };
  }
}

function runFixtures() {
  return GATE_FIXTURES.map(fixture => {
    const { report, context } = fixtureInputs(fixture.name);
    const verdict = assess(report, context);
    return {
      fixture: fixture.name,
      expected_verdict: fixture.expected_verdict,
      actual_verdict: verdict.verdict,
      matched: verdict.verdict === fixture.expected_verdict,
      issue_types: [...new Set(verdict.issues.map(issue => issue.type))]
    };
  });
}

if (require.main === module) {
  const results = runFixtures();
  const mismatched = results.filter(result => !result.matched);
  console.log(JSON.stringify({ fixtures: results.length, mismatched: mismatched.length, results }, null, 2));
  if (mismatched.length) process.exitCode = 1;
}

module.exports = { makeReport, fixtureInputs, runFixtures, GATE_FIXTURES, MUTATIONS };

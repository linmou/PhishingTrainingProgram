#!/usr/bin/env node
// Purpose: quality-gate.test.js pins the blocking transfer gate: complete denominators, missing and errored rows blocking, zero coverage, frozen thresholds, same-case non-regression, joint pair gating, and the pre-scoring contract and parity blockers.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assess, buildExpectedRows } = require('./quality-gate');
const { makeReport } = require('./fixtures/gate-fixtures');
const policy = require('./gate-policy.json');
const { cases } = require('./cases.json');
const manifest = require('./manifest.json');

const issueTypes = verdict => verdict.issues.map(issue => issue.type);

test('a complete passing report is accepted with exact counts and every partition present', () => {
  const verdict = assess(makeReport(), { cases, manifest, policy });
  assert.equal(verdict.verdict, 'accepted');
  assert.deepEqual(verdict.issues, []);
  assert.ok(verdict.metrics.length > 0);
  const overall = verdict.metrics.filter(row => row.partition === 'overall');
  assert.ok(overall.length >= policy.hard_metrics.length);
  for (const row of verdict.metrics) {
    assert.equal(row.expected, row.applicable + row.inapplicable + row.missing + row.error_rows);
    assert.equal(row.fraction, `${row.passed}/${row.applicable}`);
  }
  assert.ok(verdict.expected_rows > 0);
  assert.equal(verdict.expected_rows, buildExpectedRows({ cases, manifest }).length);
});

test('a missing or errored required row is incomplete and stays in the denominator', () => {
  const missing = makeReport();
  const targetCase = cases.find(item => item.evaluator.metric_ids.includes('medium_transfer_quality'));
  const targetRecord = missing.evidence.find(item => item.case_id === targetCase.case_id && item.repetition === 0);
  targetRecord.results = targetRecord.results.filter(result => result.metric !== 'medium_transfer_quality');
  const missingVerdict = assess(missing, { cases, manifest, policy });
  assert.equal(missingVerdict.verdict, 'incomplete');
  assert.ok(issueTypes(missingVerdict).includes('missing_result'));
  const row = missingVerdict.metrics.find(item => item.metric === 'medium_transfer_quality' && item.partition === 'overall');
  assert.equal(row.missing, 1);
  assert.equal(row.applicable + row.missing, buildExpectedRows({ cases, manifest }).filter(item => item.metric === 'medium_transfer_quality').length);

  const errored = makeReport();
  errored.evidence.find(record => record.repetition === 0).results[0] = { metric: errored.evidence.find(record => record.repetition === 0).results[0].metric, method: 'deterministic', status: 'error', pass: false, score: 0, reason: 'checks threw' };
  const errorVerdict = assess(errored, { cases, manifest, policy });
  assert.equal(errorVerdict.verdict, 'incomplete');
  assert.ok(issueTypes(errorVerdict).includes('errored_result'));
});

test('a zero-applicable partition is zero coverage and never a pass', () => {
  const report = makeReport();
  // Every applicable case declares the conditional rule, so the metric has no applicable rows at all.
  for (const record of report.evidence) {
    for (const result of record.results) {
      if (result.metric === 'transfer_trigger_target') Object.assign(result, { status: 'not_applicable', applicable: false, pass: null, score: null });
    }
  }
  const verdict = assess(report, { cases, manifest, policy });
  assert.equal(verdict.verdict, 'incomplete');
  assert.ok(issueTypes(verdict).includes('zero_coverage'));
  const row = verdict.metrics.find(item => item.metric === 'transfer_trigger_target' && item.partition === 'overall');
  assert.equal(row.applicable, 0);
  assert.equal(row.verdict, 'unmeasured');
});

test('an undeclared not_applicable result is invalid and blocks', () => {
  const report = makeReport();
  report.evidence[0].results[0] = { ...report.evidence[0].results[0], status: 'not_applicable', applicable: false, pass: null, score: null, reason: 'skipped' };
  const verdict = assess(report, { cases, manifest, policy });
  assert.equal(verdict.verdict, 'incomplete');
  assert.ok(issueTypes(verdict).includes('invalid_inapplicability'));
});

test('a candidate below the frozen threshold fails and identifies the metric and partition', () => {
  const report = makeReport();
  for (const record of report.evidence) {
    for (const result of record.results) {
      if (result.metric === 'medium_transfer_quality') Object.assign(result, { status: 'fail', pass: false, score: 0, reason: 'transfers only a brand name' });
    }
  }
  const verdict = assess(report, { cases, manifest, policy });
  assert.equal(verdict.verdict, 'failed');
  const issue = verdict.issues.find(item => item.type === 'below_threshold');
  assert.equal(issue.metric, 'medium_transfer_quality');
  assert.equal(issue.threshold, policy.semantic_default_threshold);
  assert.equal(issue.passed, 0);
  assert.ok(issue.applicable > 0);
  // Two further cases pass every metric; the failing metric must still be visible rather than
  // averaged away by the additional evidence.
  const otherRows = verdict.metrics.filter(row => row.metric !== 'medium_transfer_quality');
  assert.ok(otherRows.every(row => row.verdict === 'pass'));
});

test('the gate uses the frozen policy threshold rather than a later working manifest value', () => {
  const report = makeReport();
  const drifted = { ...manifest, thresholds: { ...manifest.thresholds, semantic_default: 1 } };
  const verdict = assess(report, { cases, manifest: drifted, policy });
  assert.equal(verdict.verdict, 'accepted');
  assert.ok(verdict.metrics.every(row => row.threshold !== 1 || row.metric === 't09_contract_and_progress' || row.metric === 'assessment_followup'));
});

test('a candidate above threshold but below a comparable baseline fails with the pass-to-fail case list', () => {
  const baseline = makeReport();
  const candidate = makeReport();
  const failingCase = cases.find(item => item.case_role === 'positive');
  const record = candidate.evidence.find(item => item.case_id === failingCase.case_id && item.repetition === 0);
  const index = record.results.findIndex(result => result.metric === 'transfer_trigger_target');
  record.results[index] = { ...record.results[index], status: 'fail', pass: false, score: 0, reason: 'selected a weaker target' };
  const verdict = assess(candidate, { cases, manifest, policy, baseline: { report: baseline, manifest } });
  assert.equal(verdict.verdict, 'failed');
  assert.ok(issueTypes(verdict).includes('regression'));
  assert.equal(verdict.new_failures.length, 1);
  assert.equal(verdict.new_failures[0].case_id, failingCase.case_id);
  assert.equal(verdict.new_failures[0].baseline_status, 'pass');
  const row = verdict.metrics.find(item => item.metric === verdict.new_failures[0].metric && item.partition === 'overall');
  assert.ok(row.candidate_comparable_passed < row.baseline_comparable_passed);
});

test('an incomparable baseline is rejected before acceptance', () => {
  const candidate = makeReport();
  const baseline = makeReport();
  const drifted = JSON.parse(JSON.stringify(manifest));
  drifted.partitions = { ...drifted.partitions, development: { ...drifted.partitions.development, case_versions: drifted.partitions.development.case_versions.map(version => version + 1) } };
  const verdict = assess(candidate, { cases, manifest, policy, baseline: { report: baseline, manifest: drifted } });
  assert.equal(verdict.verdict, 'incomplete');
  assert.ok(issueTypes(verdict).includes('incomparable_baseline'));
});

test('one failing semantic-pair member fails the gate despite an aggregate pass', () => {
  const report = makeReport();
  const pairCase = cases.find(item => item.pair);
  const record = report.evidence.find(item => item.case_id === pairCase.case_id);
  const index = record.results.findIndex(result => result.metric === 'medium_transfer_quality');
  record.results[index] = { ...record.results[index], status: 'fail', pass: false, score: 0, reason: 'pair member failed' };
  const verdict = assess(report, { cases, manifest, policy });
  assert.ok(issueTypes(verdict).includes('pair_member_failed') || issueTypes(verdict).includes('pair'));
  assert.ok(verdict.pairs.some(pair => pair.status === 'fail'));
});

test('a missing shared builder hash, a prompt hash mismatch, or a parity failure is incomplete before any scoring', () => {
  for (const mutate of [
    next => { delete next.shared_request_contract.builder_source_sha256; },
    next => { next.shared_request_contract.production_prompt_source_sha256 = 'deadbeef'; },
    next => { next.shared_request_contract.parity_result = 'mismatch'; },
    next => { next.shared_request_contract.evaluation_effective_completion_token_budget = 8000; },
    next => { next.shared_request_contract.evaluation_enable_thinking = true; }
  ]) {
    const broken = JSON.parse(JSON.stringify(manifest));
    mutate(broken);
    const verdict = assess(makeReport(), { cases, manifest: broken, policy });
    assert.equal(verdict.verdict, 'incomplete', `expected incomplete for ${JSON.stringify(broken.shared_request_contract).slice(0, 80)}`);
    assert.equal(verdict.metrics.length, 0, 'no metric may be scored before the contract identity is complete');
    assert.ok(issueTypes(verdict).includes('pre_scoring_blocker'));
  }
});

test('evaluator-only metadata or a provider credential inside target evidence is incomplete and names the path', () => {
  for (const key of ['evaluator', 'expected', 'holdout_eligibility', 'api_key']) {
    const report = makeReport();
    report.evidence[0].target_input = { ...report.evidence[0].target_input, [key]: 'leaked' };
    const verdict = assess(report, { cases, manifest, policy });
    assert.equal(verdict.verdict, 'incomplete');
    assert.ok(issueTypes(verdict).includes('forbidden_metadata'), `expected forbidden_metadata for ${key}`);
    assert.ok(verdict.issues.some(issue => issue.type === 'forbidden_metadata' && issue.path.includes(key)));
  }
});

test('the verdict states the non-substitution boundary and never claims a release gate', () => {
  const verdict = assess(makeReport(), { cases, manifest, policy });
  assert.equal(verdict.evidence_label, policy.evidence_label);
  assert.deepEqual(verdict.separate_gates.slice().sort(), policy.non_substitution_boundaries.slice().sort());
  assert.equal(verdict.claims_release_acceptance, false);
});

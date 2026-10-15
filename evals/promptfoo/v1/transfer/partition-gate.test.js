#!/usr/bin/env node
// Purpose: exercise quality-gate.js partition isolation and every pair repetition with a frozen production-identity fixture.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('./manifest.json');
const policy = require('./gate-policy.json');
// The production v3 endpoint has since been replaced. Mock only its frozen source identity;
// scoring, expected evidence, partition thresholds, and pair checks are the actual gate.
require('./shared-request-contract').loadSharedRequestContract = () => ({
  source: { sha256: manifest.shared_request_contract.builder_source_sha256 },
  production_prompt: { sha256: manifest.shared_request_contract.production_prompt_source_sha256 },
  production_call: { max_tokens: 1200, enable_thinking: false }
});
const { assess } = require('./quality-gate');
const { makeReport } = require('./fixtures/gate-fixtures');

function fixture() {
  const cases = Array.from({ length: 10 }, (_, i) => ({
    case_id: `case-${i}`, case_version: '1', partition: i === 0 ? 'boundary' : 'ordinary',
    case_role: 'positive', input: {}, evaluator: { metric_ids: ['medium_transfer_quality'] }
  }));
  const frozenManifest = structuredClone(manifest);
  frozenManifest.partitions = Object.fromEntries(['boundary', 'ordinary'].map(name => [name, {
    ...Object.values(manifest.partitions)[0],
    case_ids: cases.filter(item => item.partition === name).map(item => item.case_id),
    case_versions: cases.filter(item => item.partition === name).map(item => item.case_version)
  }]));
  return { cases, manifest: frozenManifest, report: makeReport({ cases, manifest: frozenManifest }) };
}

test('a failing partition blocks despite an overall 90 percent pass rate', () => {
  const { cases, report, manifest } = fixture();
  for (const record of report.evidence.filter(record => record.case_id === 'case-0')) {
    Object.assign(record.results.find(result => result.metric === 'medium_transfer_quality'), { status: 'fail', pass: false, score: 0 });
  }
  const verdict = assess(report, { cases, manifest, policy });
  assert.equal(verdict.verdict, 'failed');
  assert.equal(verdict.metrics.find(row => row.metric === 'medium_transfer_quality' && row.partition === 'overall').rate, 0.9);
  assert.ok(verdict.issues.some(issue => issue.type === 'below_threshold' && issue.partition === 'boundary'));
});

test('zero applicable evidence in one partition blocks despite coverage elsewhere', () => {
  const { cases, report, manifest } = fixture();
  for (const record of report.evidence.filter(record => record.case_id === 'case-0')) {
    Object.assign(record.results.find(result => result.metric === 'medium_transfer_quality'), { status: 'not_applicable', applicable: false, pass: null, score: null });
  }
  const verdict = assess(report, { cases, manifest, policy });
  assert.equal(verdict.verdict, 'incomplete');
  assert.ok(verdict.issues.some(issue => issue.type === 'zero_coverage' && issue.partition === 'boundary'));
});

test('a failure in the second repetition still fails its semantic pair', () => {
  const { cases, report, manifest } = fixture();
  for (let i = 0; i < 2; i++) cases[i].pair = { pair_id: 'contrast', member: i, changed_factor: String(i), expected_contrast: String(i) };
  const record = report.evidence.find(record => record.case_id === 'case-1' && record.repetition === 1);
  Object.assign(record.results.find(result => result.metric === 'medium_transfer_quality'), { status: 'fail', pass: false, score: 0 });
  const verdict = assess(report, { cases, manifest, policy });
  assert.ok(verdict.issues.some(issue => issue.type === 'pair_member_failed' && issue.repetition === 1));
  assert.equal(verdict.verdict, 'failed');
});

test('a missing frozen partition cannot disappear with its supplied cases', () => {
  const { cases, report, manifest } = fixture();
  const verdict = assess(report, { cases: cases.slice(1), manifest, policy });
  assert.equal(verdict.verdict, 'incomplete');
  assert.ok(verdict.issues.some(issue => issue.type === 'manifest_coverage'));
});

test('a missing comparable baseline cannot establish non-regression', () => {
  const { cases, report, manifest } = fixture();
  const verdict = assess(report, { cases, manifest, policy, baseline: { manifest, report: { ...report, evidence: [] } } });
  assert.equal(verdict.verdict, 'incomplete');
  assert.ok(verdict.issues.some(issue => issue.type === 'missing_baseline_generation'));
});

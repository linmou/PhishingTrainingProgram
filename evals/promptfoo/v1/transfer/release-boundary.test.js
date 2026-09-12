#!/usr/bin/env node
// Purpose: release-boundary.test.js pins the non-substitution boundary: a transfer report is evaluation evidence only and may never claim database, authorization, provider-path, browser, activation, or rollback acceptance.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildReport, NON_SUBSTITUTION_BOUNDARIES, STATEMENT } = require('./report');
const { makeReport } = require('./fixtures/gate-fixtures');
const { assess } = require('./quality-gate');
const policy = require('./gate-policy.json');
const { cases } = require('./cases.json');
const manifest = require('./manifest.json');

const verdict = () => assess(makeReport(), { cases, manifest, policy });

test('a transfer report labels itself evaluation evidence only', () => {
  const report = buildReport({ verdict: verdict() });
  assert.equal(report.evidence_label, policy.evidence_label);
  assert.equal(report.claims_release_acceptance, false);
  assert.equal(report.statement, STATEMENT);
  assert.match(report.statement, /evaluation evidence only/i);
});

test('the report names all six separate gates', () => {
  const report = buildReport({ verdict: verdict() });
  assert.deepEqual(NON_SUBSTITUTION_BOUNDARIES.slice().sort(), policy.non_substitution_boundaries.slice().sort());
  for (const boundary of policy.non_substitution_boundaries) {
    assert.ok(report.separate_gates.includes(boundary), `report must name ${boundary}`);
  }
  const weakened = buildReport({ verdict: verdict(), separate_gates: policy.non_substitution_boundaries.filter(item => item !== 'rollback') });
  assert.deepEqual(weakened.validation_errors, ['missing_boundary:rollback']);
});

test('removing the statement or asserting a release claim is a validation error, not a formatting choice', () => {
  const noStatement = buildReport({ verdict: verdict(), statement: '' });
  assert.ok(noStatement.validation_errors.includes('missing_statement'));
  const claimed = buildReport({ verdict: verdict(), release_acceptance: true });
  assert.ok(claimed.validation_errors.includes('release_claim_forbidden'));
  assert.equal(claimed.claims_release_acceptance, false);
  const dbClaim = buildReport({ verdict: verdict(), claims: { database: 'accepted' } });
  assert.ok(dbClaim.validation_errors.includes('gate_claim_forbidden:database'));
});

test('a report preserves the exact verdict, fractions, and per-case failures of the gate', () => {
  const source = verdict();
  const report = buildReport({ verdict: source });
  assert.equal(report.verdict, source.verdict);
  assert.deepEqual(report.metrics, source.metrics);
  assert.equal(report.expected_rows, source.expected_rows);
  assert.deepEqual(report.new_failures, source.new_failures);
  assert.deepEqual(report.validation_errors, []);
  assert.ok(report.metrics.every(row => typeof row.fraction === 'string' && row.fraction.includes('/')));
});

test('the report never converts an incomplete verdict into a pass', () => {
  const report = buildReport({ verdict: { ...verdict(), verdict: 'incomplete', issues: [{ type: 'missing_result', metric: 'medium_transfer_quality' }] } });
  assert.equal(report.verdict, 'incomplete');
  assert.equal(report.claims_release_acceptance, false);
  const failed = buildReport({ verdict: { ...verdict(), verdict: 'failed' } });
  assert.equal(failed.verdict, 'failed');
});

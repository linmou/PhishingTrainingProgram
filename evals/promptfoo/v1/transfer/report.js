#!/usr/bin/env node
// Purpose: report.js renders the transfer evaluation report and enforces the non-substitution boundary: the verdict is labelled evaluation evidence only, all six separate release gates are named, and no database, authorization, provider, browser, activation, or rollback acceptance may be claimed.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const policy = require('./gate-policy.json');

const NON_SUBSTITUTION_BOUNDARIES = policy.non_substitution_boundaries.slice();
const STATEMENT = 'This report is Promptfoo transfer evaluation evidence only. Database and row-level security, verification and answer-key privacy, the production provider path, browser downstream consumption, feature-flag activation, and rollback remain separate gates owned by their own components.';
const CLAIM_KEYS = ['database', 'authorization', 'provider', 'browser', 'activation', 'rollback', 'release'];

function buildReport({ verdict, statement = STATEMENT, separate_gates = NON_SUBSTITUTION_BOUNDARIES, release_acceptance = false, claims = {} } = {}) {
  const validation_errors = [];
  if (!statement) validation_errors.push('missing_statement');
  if (release_acceptance) validation_errors.push('release_claim_forbidden');
  for (const boundary of NON_SUBSTITUTION_BOUNDARIES) {
    if (!separate_gates.includes(boundary)) validation_errors.push(`missing_boundary:${boundary}`);
  }
  for (const [key, value] of Object.entries(claims)) {
    if (CLAIM_KEYS.includes(key) && value) validation_errors.push(`gate_claim_forbidden:${key}`);
  }
  return {
    report_version: 'transfer-report-v1',
    created_at: new Date().toISOString(),
    run_id: verdict ? verdict.run_id : null,
    verdict: verdict ? verdict.verdict : 'incomplete',
    evidence_label: policy.evidence_label,
    claims_release_acceptance: false,
    statement,
    separate_gates: separate_gates.slice(),
    expected_rows: verdict ? verdict.expected_rows : 0,
    metrics: verdict ? verdict.metrics : [],
    pairs: verdict ? verdict.pairs : [],
    new_failures: verdict ? verdict.new_failures : [],
    applicability_changes: verdict ? verdict.applicability_changes : [],
    issues: verdict ? verdict.issues : [],
    raw_evidence_links: verdict ? (verdict.metrics || []).map(row => `${row.metric}/${row.partition}`) : [],
    validation_errors
  };
}

function writeReport(directory, report) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'report.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  return file;
}

module.exports = { buildReport, writeReport, NON_SUBSTITUTION_BOUNDARIES, STATEMENT, CLAIM_KEYS };

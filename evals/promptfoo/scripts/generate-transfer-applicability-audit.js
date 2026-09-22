#!/usr/bin/env node
// Purpose: generate the W0 T09 applicability audit while preserving every legacy case and assertion.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const inputPath = path.resolve(
  __dirname,
  '../audits/tutor-v1-preparation-20260907/case-audit.json',
);
const outputPath = path.resolve(
  __dirname,
  '../audits/transfer-assessment-w0-20260911/applicability-audit.json',
);

const source = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const sourceSha256 = crypto
  .createHash('sha256')
  .update(fs.readFileSync(inputPath))
  .digest('hex');
const cases = source.cases.map((entry, caseIndex) => ({
  case_id: entry.case_id,
  source_file: entry.source.file,
  source_index: entry.source.index,
  t09_disposition: 'not_applicable',
  reason:
    'The legacy case has no transfer-assessment lifecycle state, delivered assessment, learner assessment answer, or transfer-evidence basis. This disposition removes only T09 from its applicability denominator; all legacy assertions and historical dispositions are preserved below.',
  legacy_case: {
    assessment: entry.assessment,
    case_roles: entry.case_roles,
    source: entry.source,
    legacy_assertion_review: entry.legacy_assertion_review,
  },
  assertions: (entry.source.assertions || []).map((assertion, assertionIndex) => ({
    assertion_id: `${entry.case_id}#${assertionIndex}`,
    source_assertion_index: assertionIndex,
    source_assertion: assertion,
    t09_disposition: 'not_applicable',
    legacy_disposition: entry.legacy_assertion_review[assertionIndex].disposition,
    preserved: entry.legacy_assertion_review[assertionIndex].preserved,
    reason:
      'The assertion retains its legacy metric and meaning. T09 is not applicable because the source case does not exercise the transfer-assessment lifecycle.',
  })),
}));

const assertionCount = cases.reduce((total, entry) => total + entry.assertions.length, 0);
if (cases.length !== 43 || assertionCount !== 173) {
  throw new Error(`Unexpected legacy inventory: ${cases.length} cases / ${assertionCount} assertions`);
}

const audit = {
  intent:
    'Account for every existing Promptfoo case and assertion against T09 without changing legacy coverage or historical meanings.',
  status: 'draft_preparation_complete_t09_not_applicable',
  recorded: '2026-09-11',
  behavior_requirement: 'T09',
  source: {
    path: 'evals/promptfoo/audits/tutor-v1-preparation-20260907/case-audit.json',
    sha256: sourceSha256,
    cases: cases.length,
    assertions: assertionCount,
  },
  disposition: {
    cases: 'not_applicable',
    assertions: 'not_applicable',
    legacy_assertions_preserved: true,
    legacy_meaning_changed: false,
  },
  rationale:
    'The legacy inventory evaluates ordinary tutor behavior and participation. It contains no delivered assessment, answer submission, transfer key/basis, feedback-first assessment sequence, or transfer progress transition. T09 therefore has no applicable legacy denominator. This does not retire, replace, or reinterpret any legacy assertion.',
  cases,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(audit, null, 2)}\n`);
console.log(`Wrote ${outputPath} (${cases.length} cases / ${assertionCount} assertions)`);

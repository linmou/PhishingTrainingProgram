#!/usr/bin/env node
// Purpose: account for every historical tutor case and assertion without relabeling or overwriting the frozen suites.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
const sourcePath = 'evals/promptfoo/v1/development-with-guard-scenario-rich.json';
const sourceText = fs.readFileSync(path.join(root, sourcePath), 'utf8');
const source = JSON.parse(sourceText);
const rows = source.map(c => {
  const guard = c.expected.mode === 'guard';
  const protective = c.expected.instruction?.includes('protective_instruction');
  return {
    source_id: c.id,
    disposition: guard ? 'not_applicable' : protective ? 'reuse' : 'refine',
    rationale: guard
      ? 'Reference expects participation management, outside ordinary-tutoring component checks. Existing Guard and hard-constraint assertions remain intact.'
      : protective
        ? 'Retain the immediate-protection exception and existing mode/action references. Rescore any content under the frozen current rubric; add a separate return-to-reasoning counterpart.'
        : 'Retain the original history and assertions; before executing under the new checks annotate learner-owned recognition/action evidence against the full real room inventory. Old required-safe-action correction judgments cannot define the new disclosure gate.',
    mapped_requirements: guard ? [] : ['T01.1', 'T02.1', 'T02.2', 'T04'],
    mapped_metrics: guard ? [] : ['component_disclosure', 'recognition_before_action', 'responsive_progression', 'factual_accuracy'],
    proposed_changes: guard ? [] : protective
      ? ['Add evaluator-only R2 exception annotation; do not rewrite target input or expected protection.']
      : ['Add evaluator-only component evidence and current target reference.', 'Use a separately named counterpart if real-template alignment changes the original setting.', 'Revisit action label only when the adopted component gate changes eligibility; preserve original label alongside revision.'],
    original_expected: c.expected,
    original_assertions: c.legacy.map((a, index) => ({index, id: a.id || null, metric: a.metric || null, sha256: crypto.createHash('sha256').update(JSON.stringify(a)).digest('hex')})),
    original_source_type: c.source_type,
    selected_for_focused_execution: false,
    selection_reason: 'Focused experiment uses separately named, explicitly simulated component histories; this row remains an unrun broader-regression obligation.',
    original_preserved: true,
  };
});
assert.equal(rows.length, 61);
assert.equal(rows.reduce((n, c) => n + c.original_assertions.length, 0), 173);
const report = {
  source: sourcePath,
  source_sha256: crypto.createHash('sha256').update(sourceText).digest('hex'),
  method: 'Map existing frozen reference mode/action fields to scope, not keyword interpretation of dialogue. Per-component semantic reference authoring remains required before broader execution.',
  case_count: rows.length,
  legacy_assertion_count: 173,
  counts: Object.fromEntries(['reuse', 'refine', 'not_applicable'].map(k => [k, rows.filter(r => r.disposition === k).length])),
  prior_real_target_expansion: {
    path: '/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram-worktrees/tutor-real-targets/evals/promptfoo/scaffolding-diagnostics/2026-11-13-real-target-regression',
    core_cases: 64,
    historical_controls: 16,
    relationship: 'These are separately preserved real-template counterparts/openings and controls for the same 61 originals. Their prior component-unaware labels are not imported as new gold labels. The six template snapshot is reused, while this increment authors a smaller explicit component dataset.',
  },
  rows,
};
const output = path.join(__dirname, 'existing-case-index.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output, cases: rows.length, assertions: 173, counts: report.counts}));

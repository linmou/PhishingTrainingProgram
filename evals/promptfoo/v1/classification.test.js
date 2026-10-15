#!/usr/bin/env node
// Purpose: verify classification.js uses fixed majority votes, counts abstentions, and preserves permitted-label references.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { majority, statistics, classify, compare, ABSTAIN } = require('./classification');
test('majority voting abstains on ties without using expected labels', () => {
  assert.equal(majority(['guard', 'tutoring']), ABSTAIN);
  assert.equal(majority(['correction', 'explanation', 'scaffolding']), ABSTAIN);
  assert.equal(majority(['guard', 'tutoring', 'guard']), 'guard');
});
test('missing predictions stay in accuracy and per-class recall denominators', () => {
  const result = statistics([{ allowed: ['guard'], predicted: 'guard' }, { allowed: ['guard'], predicted: ABSTAIN }]);
  assert.equal(result.accuracy, 0.5);
  assert.equal(result.answered_coverage, 0.5);
  assert.equal(result.per_class[0].recall, 0.5);
});
test('permitted alternatives count without inventing a single correct label', () => {
  const result = statistics([{ allowed: ['scaffolding', 'explanation'], predicted: 'explanation' }]);
  assert.equal(result.accuracy, 1);
  assert.equal(result.singleton_reference_count, 0);
  assert.deepEqual(result.confusion_matrix, { 'explanation|scaffolding': { explanation: 1 } });
});

function completeRun(id = 'case') {
  return {
    snapshot: { settings: { repetitions: 3 }, cases: [{ id, source_type: 'ecological', expected: { checks: ['mode_selection'], mode: 'tutoring' } }] },
    report: { results: [0, 1, 2].map(repetition => ({ case_id: id, repetition, parsed: { mode: 'tutoring' } })) }
  };
}
test('a correct majority cannot hide a missing, duplicate, or errored generation', () => {
  for (const mutation of [
    report => report.results.pop(),
    report => report.results.push(report.results[0]),
    report => { report.results[0].target = { error: 'truncated' }; }
  ]) {
    const { report, snapshot } = completeRun();
    mutation(report);
    const result = classify(report, snapshot);
    assert.equal(result.verdict, 'incomplete');
    assert(result.issues.length > 0);
  }
});
test('classification comparison requires the same cases and settings', () => {
  const baseline = completeRun();
  const candidate = completeRun('different-case');
  assert.equal(compare(classify(candidate.report, candidate.snapshot), classify(baseline.report, baseline.snapshot)).verdict, 'incomplete');
  candidate.snapshot = structuredClone(baseline.snapshot);
  candidate.report = structuredClone(baseline.report);
  candidate.snapshot.settings.target_max_tokens = 120;
  assert.equal(compare(classify(candidate.report, candidate.snapshot), classify(baseline.report, baseline.snapshot)).verdict, 'incomplete');
  candidate.snapshot = structuredClone(baseline.snapshot);
  candidate.snapshot.manifest = { checks: [{ id: 'mode_selection', hard_partitions: ['exact_transitions'] }] };
  assert.equal(compare(classify(candidate.report, candidate.snapshot), classify(baseline.report, baseline.snapshot)).verdict, 'incomplete');
});
test('classification reports declared mode transitions and blocks empty coverage', () => {
  const { report, snapshot } = completeRun();
  snapshot.manifest = { checks: [{ id: 'mode_selection', hard_partitions: ['exact_transitions'] }] };
  snapshot.cases[0].partitions = ['exact_transitions'];
  const result = classify(report, snapshot);
  const row = result.rows.find(item => item.partition === 'exact_transitions' && item.view === 'three_member');
  assert.equal(row.threshold, 1);
  assert.equal(row.verdict, 'pass');
  snapshot.cases = [];
  assert.equal(classify({ results: [] }, snapshot).verdict, 'incomplete');
});

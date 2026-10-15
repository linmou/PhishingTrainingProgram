#!/usr/bin/env node
// Purpose: verify check-promptfoo-quality-gate.js reconciles frozen coverage before accepting a report.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { METRICS, evaluateGate } = require('./check-promptfoo-quality-gate');

function report() {
  const cases = ['product_template', 'synthetic_holdout'].flatMap(source_type =>
    ['failed', 'not_started'].map(scaffolding_status => ({
      case_id: `${source_type}-${scaffolding_status}`, source_type, scaffolding_status, metrics: METRICS
    })));
  return {
    evaluation_manifest: { repetitions: 1, cases },
    results: cases.map(definition => ({
      promptIdx: 0,
      testCase: { vars: definition },
      assertionResults: METRICS.map(metric => ({ metric, pass: true, score: 1 }))
    }))
  };
}

test('complete passing evidence passes', () => assert.equal(evaluateGate(report()).passed, true));

test('a failed assertion cannot become a pass by disappearing', () => {
  const value = report();
  const result = value.results[0];
  const correction = result.assertionResults.find(item => item.metric === 'direct_correction');
  correction.pass = false;
  correction.score = 0;
  assert.equal(evaluateGate(value).passed, false);
  result.assertionResults = result.assertionResults.filter(item => item !== correction);
  const verdict = evaluateGate(value);
  assert.equal(verdict.passed, false);
  assert.ok(verdict.failures.some(message => message.includes('assertion count for direct_correction')));
  assert.equal(verdict.summary.current.direct_correction.total, 4);
  assert.equal(verdict.summary.current.direct_correction.missing, 1);
  assert.equal(verdict.summary.current.direct_correction.passRate, 0.75);
});

for (const [name, mutate] of [
  ['missing generation', value => value.results.pop()],
  ['zero components', value => { value.results[0].assertionResults = []; }],
  ['duplicate generation', value => value.results.push(value.results[0])],
  ['duplicate assertion', value => value.results[0].assertionResults.push(value.results[0].assertionResults[0])],
  ['unresolved error with passing components', value => { value.results[0].error = 'provider timeout'; }],
  ['component judge error', value => { value.results[0].assertionResults[0].error = 'judge timeout'; }],
  ['malformed judgment', value => { value.results[0].assertionResults[0] = { metric: METRICS[0] }; }],
  ['missing manifest', value => { delete value.evaluation_manifest; }],
  ['changed partition', value => { value.results[0].testCase.vars = { ...value.results[0].testCase.vars, source_type: 'other' }; }]
]) test(`${name} blocks acceptance`, () => {
  const value = report();
  mutate(value);
  assert.equal(evaluateGate(value).passed, false);
});

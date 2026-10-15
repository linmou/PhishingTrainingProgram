#!/usr/bin/env node
// File: evaluator.js. Purpose: verify schema-aware Guard/null routing, semantic result preservation, and frozen T01 gate denominators; mocked judgments do not validate semantic labels.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluateGeneratedOutput } = require('./evaluator');
const { assess } = require('./gate');
const manifest = require('../rubrics/v1/manifest.json');
const proposal = require('../refinement-20261014/null-instruction-calibration-proposal.json').proposed_evaluator_revision;

function definition() {
  return { id: 'null-routing', source_type: 'synthetic_development', role: 'adult', inventory: {},
    input: { student_message: 'Does the lock identify the owner?', prior_mode: 'guard' },
    expected: { mode: 'tutoring', instruction: ['scaffolding', 'explanation'], knowledge_required: false,
      checks: ['contract_validity', 'mode_selection', 'instruction_selection', 'instruction_realization'] },
    partitions: [], legacy: [] };
}

function raw(version, mode, instruction, response = 'Please make a relevant attempt about the link.') {
  return JSON.stringify(version === 'v2'
    ? { reason: 'Observable task evidence.', decision: { mode, instruction }, response }
    : { reasoning: 'Observable task evidence.', mode, mode_reason: 'Observable participation.', decision: { instruction }, suggested_response: response });
}

async function evaluate(version, mode, instruction, verdict = { pass: false, score: 0, reason: 'No declared teaching action.' }, response) {
  const requests = [];
  const evaluated = await evaluateGeneratedOutput({ caseDefinition: definition(), rawOutput: raw(version, mode, instruction, response),
    contractVersion: version, settings: {}, judgeCall: async messages => {
      requests.push(messages);
      if (verdict instanceof Error) throw verdict;
      return { text: JSON.stringify({ instruction_realization: verdict }) };
    } });
  return { ...evaluated, requests };
}

for (const version of ['legacy', 'v2']) {
  test(`${version}: valid Guard/null reaches the semantic judge and preserves independent decision failures`, async () => {
    for (const response of ['Return to the task.', 'A lock does not identify the website owner.']) {
      const evaluated = await evaluate(version, 'guard', null, undefined, response);
      assert.equal(evaluated.requests.length, 1);
      assert.deepEqual(evaluated.results.map(row => row.status), ['pass', 'fail', 'fail', 'fail']);
      const realization = evaluated.results.at(-1);
      assert.equal(realization.method, 'llm_rubric');
      assert.equal(realization.score, 0);
      assert.equal(evaluated.judge[0].calls.length, 1);
      const body = JSON.parse(evaluated.requests[0][1].content);
      assert.equal(body.checks.instruction_realization.output.mode, 'guard');
      assert.equal(body.checks.instruction_realization.output.decision.instruction, null);
      assert.equal(body.evidence.expected_instruction, undefined);
      assert.equal(body.evidence.expected_mode, undefined);
    }
  });

  test(`${version}: missing, invalid and tutoring/null fields stay contract errors without semantic calls`, async () => {
    for (const fixture of proposal.routing_fixtures) {
      const evaluated = await evaluate(version, fixture.mode, fixture.instruction);
      assert.equal(evaluated.results[0].status, fixture.expected_contract);
      assert.equal(evaluated.requests.length, fixture.expected_judge_calls);
      assert.equal(evaluated.results.at(-1).status, fixture.expected_judge_calls ? 'fail' : 'error');
    }
  });
}

test('valid Guard/null does not gain a pass when semantic judging fails or requests inapplicability', async () => {
  for (const verdict of [new Error('judge unavailable'), { applicable: false, pass: null, score: null, reason: 'wrong mode' }]) {
    const evaluated = await evaluate('v2', 'guard', null, verdict);
    assert.equal(evaluated.results.at(-1).status, 'error');
    assert.equal(evaluated.results.at(-1).pass, false);
    assert.ok(evaluated.requests.length >= 1);
  }
});

test('Guard with a real teaching label preserves semantic pass or fail independent of mode eligibility', async () => {
  for (const pass of [true, false]) {
    const evaluated = await evaluate('v2', 'guard', 'explanation', { pass, score: Number(pass), reason: 'Independent realization verdict.' });
    assert.equal(evaluated.requests.length, 1);
    assert.equal(evaluated.results[1].status, 'fail');
    assert.equal(evaluated.results.at(-1).pass, pass);
  }
});

test('error-to-fail correction preserves frozen expected/applicable counts and decision failures', async () => {
  const c = definition();
  const evaluated = await evaluate('v2', 'guard', null);
  const record = { case_id: c.id, repetition: 0, source_type: c.source_type, role: c.role,
    partitions: [], input: c, parsed: evaluated.parsed, parsed_for_evaluation: evaluated.parsed_for_evaluation,
    results: evaluated.results };
  const snapshot = { cases: [c], settings: { repetitions: 1 }, rubrics: {}, manifest };
  const before = structuredClone(record);
  Object.assign(before.results.at(-1), { status: 'error', pass: false, score: 0 });
  const oldGate = assess({ results: [before] }, snapshot);
  const newGate = assess({ results: [record] }, snapshot);
  const counts = gate => gate.metrics.map(row => ({ metric: row.metric, partition: row.partition,
    expected: row.expected, applicable: row.applicable, passed: row.passed, inapplicable: row.inapplicable, threshold: row.threshold }));
  assert.deepEqual(counts(newGate), counts(oldGate));
  assert.equal(newGate.verdict, 'failed');
  assert.ok(newGate.issues.some(row => row.type === 'below_threshold' && row.metric === 'instruction_realization'));
  assert.deepEqual(record.results.slice(0, 3), before.results.slice(0, 3));
});

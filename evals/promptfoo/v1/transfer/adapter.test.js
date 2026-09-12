#!/usr/bin/env node
// Purpose: adapter.test.js pins the thin transfer adapter: it projects only target-visible case fields into the component-102 v3 builder, refuses to read evaluator-only metadata, never builds prompt text, and registers additively without changing legacy v0/v1 behaviour.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { projectCase, projectContextInput, buildTransferTargetRequest, EVALUATOR_ONLY_KEYS } = require('./adapter');
const { cases } = require('./cases.json');
const manifest = require('./manifest.json');

const definition = () => JSON.parse(JSON.stringify(cases[0]));

test('the projection produces exactly the shared v3 context input for a frozen case', () => {
  const contextInput = projectContextInput(definition());
  assert.deepEqual(Object.keys(contextInput).sort(), [
    'checklist_id',
    'checklist_items',
    'eligible_assessment_item_ids',
    'feedback_required',
    'focus_student_id',
    'focus_student_message',
    'prior_participation_mode',
    'progress_snapshot_hash',
    'room_id',
    'unresolved_assessment'
  ]);
  assert.deepEqual(projectCase(definition()), contextInput);
});

test('no evaluator-only key reaches the projection, at any depth', () => {
  const serialized = JSON.stringify(projectContextInput(definition()));
  for (const key of EVALUATOR_ONLY_KEYS) {
    assert.ok(!serialized.includes(`"${key}"`), `${key} leaked into the target projection`);
  }
  for (const key of ['evaluator', 'holdout_eligibility', 'pair', 'transition', 'source_provenance']) {
    const mutated = definition();
    mutated.input = { ...mutated.input, nested: { [key]: 'leaked' } };
    assert.throws(() => projectContextInput(mutated), new RegExp(key), `${key} must throw rather than pass through`);
  }
});

test('the adapter rejects a case whose target input carries expected labels', () => {
  for (const key of ['expected', 'rubric_annotations', 'gate_thresholds', 'metric_ids']) {
    const mutated = definition();
    mutated.input = { ...mutated.input, [key]: 'leaked' };
    assert.throws(() => projectContextInput(mutated), /forbidden|evaluator/i);
  }
});

test('the adapter builds the request through the shared builder and declares the frozen budget and thinking flag', () => {
  const built = buildTransferTargetRequest(definition(), manifest);
  assert.equal(built.request.contract_version, 'transfer_tutor_request_v3');
  assert.equal(built.request.context.contract_version, 'transfer_tutor_context_v3');
  assert.equal(built.declared_target_max_tokens, 1200);
  assert.equal(built.declared_target_enable_thinking, false);
  assert.equal(built.inherited_from_legacy_v1, false);
  assert.equal(typeof built.user_message, 'string');
  assert.equal(built.user_message, JSON.stringify(built.request));
  assert.equal(built.production_prompt_reference, manifest.shared_request_contract.production_prompt_reference);
});

test('the adapter refuses a manifest whose budget, thinking flag, or builder identity drifted', () => {
  for (const mutate of [
    next => { next.shared_request_contract.evaluation_effective_completion_token_budget = 8000; },
    next => { next.shared_request_contract.evaluation_enable_thinking = true; },
    next => { delete next.shared_request_contract.builder_source_sha256; }
  ]) {
    const broken = JSON.parse(JSON.stringify(manifest));
    mutate(broken);
    assert.throws(() => buildTransferTargetRequest(definition(), broken), /budget|thinking|builder/i);
  }
});

test('the adapter does not construct messages, copy prompt text, or resolve provider settings', () => {
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname, 'adapter.js'), 'utf8');
  for (const forbidden of ['./runner', 'fetch(', 'REACT_APP_OAI', 'contract =', 'TRANSFER_V3_SYSTEM_PROMPT']) {
    assert.ok(!source.includes(forbidden), `adapter.js must not reference ${forbidden}`);
  }
  const built = buildTransferTargetRequest(definition(), manifest);
  assert.equal(built.system_prompt_text, undefined);
  assert.equal(built.endpoint, undefined);
  assert.equal(built.api_key, undefined);
});

test('registering the transfer evaluator leaves legacy evaluated output and gate output unchanged', () => {
  const { registerEvaluatorExtension, evaluateGeneratedOutput } = require('../evaluator');
  const { assess } = require('../gate');
  const legacyCase = { id: 'legacy-case', source_type: 'ecological', role: 'peer', input: { prior_mode: null }, expected: { mode: 'tutoring', checks: ['mode_selection'] }, partitions: [], legacy: [] };
  const snapshot = { cases: [legacyCase], settings: { repetitions: 1 }, rubrics: {}, manifest: JSON.parse(JSON.stringify(require('../../rubrics/v1/manifest.json'))) };
  const report = { results: [{ case_id: 'legacy-case', repetition: 0, input: legacyCase, source_type: 'ecological', role: 'peer', partitions: [], parsed: { mode: 'tutoring' }, results: [{ metric: 'mode_selection', method: 'deterministic', status: 'pass', pass: true, score: 1 }] }] };
  const before = JSON.stringify(assess(report, snapshot));
  const rawOutput = JSON.stringify({ reasoning: 'evidence', mode: 'tutoring', mode_reason: 'engaged', decision: { instruction: 'scaffolding' }, suggested_response: 'What did you check?' });
  const legacyEvaluation = evaluateGeneratedOutput({ caseDefinition: legacyCase, rawOutput, contractVersion: 'legacy', settings: {}, judgeCall: async () => ({ text: '{}' }), replayEvidence: null, sha: value => JSON.stringify(value) });
  const registered = registerEvaluatorExtension('v3', require('./adapter').transferEvaluatorExtension());
  assert.equal(registered.id, 'v3');
  const after = JSON.stringify(assess(report, snapshot));
  assert.equal(after, before);
  assert.equal(JSON.stringify(evaluateGeneratedOutput({ caseDefinition: legacyCase, rawOutput, contractVersion: 'legacy', settings: {}, judgeCall: async () => ({ text: '{}' }), replayEvidence: null, sha: value => JSON.stringify(value) })), JSON.stringify(legacyEvaluation));
  assert.throws(() => require('../runner').messagesFor(legacyCase, 'candidate', 'policy', 'v9'), /Unsupported contract version/);
});

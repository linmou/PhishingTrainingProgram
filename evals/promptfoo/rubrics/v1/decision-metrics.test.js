#!/usr/bin/env node
// Purpose: validate decision-metrics.js, its Promptfoo entrypoints, and version manifests for independent decisions, boundary cases, and preserved legacy evidence.

'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const mode = require('./mode_selection');
const instruction = require('./instruction_selection');
const contract = require('./contract_validity');

function raw(overrides = {}) {
  return JSON.stringify({
    reasoning: 'The learner is about to open the link; protect first without inventing obstruction.',
    mode: 'tutoring',
    mode_reason: 'The learner is genuinely asking for help.',
    decision: { instruction: 'protective_instruction' },
    suggested_response: 'Do not open that link. Open the real app yourself.',
    ...overrides
  });
}

test('entrypoints score the same generation independently and preserve typed evidence', () => {
  const output = raw();
  const context = { vars: { expected_mode: 'tutoring', expected_instruction: 'protective_instruction' } };
  for (const check of [contract(output), mode(output, context), instruction(output, context)]) {
    assert.equal(check.status, 'pass');
    assert.equal(check.method, 'deterministic');
    assert.equal(check.pass, true);
    assert.equal(check.score, 1);
  }
  assert.equal(mode(output, context).actual, 'tutoring');
  assert.deepEqual(instruction(output, context).expected, ['protective_instruction']);
  assert.equal(output, raw());
});

test('schema-valid but wrong mode fails despite convincing reasoning', () => {
  const output = raw({ mode: 'guard' });
  assert.equal(contract(output).status, 'pass');
  assert.equal(mode(output, { vars: { expected_mode: 'tutoring' } }).status, 'fail');
  assert.equal(instruction(output, { vars: { expected_instruction: 'protective_instruction' } }).status, 'pass');
});

test('correct mode cannot mask a wrong instructional action', () => {
  const output = raw({ decision: { instruction: 'scaffolding' } });
  assert.equal(mode(output, { vars: { expected_mode: 'tutoring' } }).status, 'pass');
  assert.equal(instruction(output, { vars: { expected_instruction: 'protective_instruction' } }).status, 'fail');
});

test('both permitted correct-partial actions pass; correction does not', () => {
  const context = { vars: { expected_instruction: ['scaffolding', 'explanation'] } };
  for (const action of ['scaffolding', 'explanation']) {
    assert.equal(instruction(raw({ decision: { instruction: action } }), context).status, 'pass');
  }
  assert.equal(instruction(raw({ decision: { instruction: 'correction' } }), context).status, 'fail');
});

test('participation-only Guard accepts explicit null without demanding a safety action', () => {
  const output = raw({ mode: 'guard', decision: { instruction: null },
    suggested_response: 'Repeating lyrics is derailing the discussion. Stop and make a relevant attempt.' });
  assert.equal(contract(output).status, 'pass');
  assert.equal(instruction(output, { vars: { expected_instruction: null } }).status, 'pass');
  assert.equal(instruction(output, { vars: { expected_instruction: ['correction'] } }).status, 'fail');
  assert.equal(contract(raw({ decision: { instruction: null } })).status, 'error');
});

test('missing or invalid expectations never imply success', () => {
  for (const check of [mode, instruction]) {
    assert.equal(check(raw(), {}).status, 'missing');
    assert.equal(check(raw()).pass, false);
  }
  for (const label of [[], ['unknown'], {}, 1, '']) {
    assert.equal(mode(raw(), { vars: { expected_mode: label } }).status, 'error');
    assert.equal(instruction(raw(), { vars: { expected_instruction: label } }).status, 'error');
  }
  assert.equal(mode(raw(), { vars: { expected_mode: null } }).status, 'error');
});

test('missing and malformed targets remain explicit and cannot be inferred from prose', () => {
  for (const check of [contract, mode, instruction]) {
    for (const output of [undefined, null, '']) assert.equal(check(output).status, 'missing');
    for (const output of ['{', '[]', 'null', '42', 'guard: correct the learner', '```json\n{}\n```', {}]) {
      assert.equal(check(output).status, 'error');
    }
  }
});

test('contract failures do not duplicate a semantic mode failure', () => {
  const output = raw({ reasoning: '' });
  assert.equal(contract(output).status, 'error');
  assert.equal(mode(output, { vars: { expected_mode: 'tutoring' } }).status, 'pass');
  assert.equal(instruction(output, { vars: { expected_instruction: 'protective_instruction' } }).status, 'pass');
});

test('contract rejects bad strings, decision shapes, enums, and missing keys', () => {
  for (const key of ['reasoning', 'mode_reason', 'suggested_response']) {
    for (const value of [undefined, null, '', '  ', 2, []]) {
      assert.equal(contract(raw({ [key]: value })).status, 'error');
    }
  }
  for (const value of [undefined, null, [], {}, { instruction: '' }, { instruction: 'guard' }, { instruction: [] }]) {
    assert.equal(contract(raw({ decision: value })).status, 'error');
  }
  for (const value of [undefined, null, 'warning', ['tutoring']]) {
    assert.equal(contract(raw({ mode: value })).status, 'error');
  }
});

test('raw reasoning-first order is checked without rejecting numeric extra fields or escaped JSON keys', () => {
  const value = JSON.parse(raw());
  const { reasoning, ...rest } = value;
  assert.equal(contract(JSON.stringify({ ...rest, reasoning })).status, 'error');
  assert.equal(contract(raw().replace('{', '{"0":"extra",')).status, 'error');
  assert.equal(contract(raw().replace(/}$/, ',"0":"extra"}')).status, 'pass');
  assert.equal(contract(raw().replace('"reasoning"', '"\\u0072easoning"')).status, 'pass');
});

test('all instructional enum values are supported and absent decisions remain errors', () => {
  for (const action of ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation']) {
    const output = raw({ decision: { instruction: action } });
    assert.equal(contract(output).status, 'pass');
    assert.equal(instruction(output, { vars: { expected_instruction: action } }).status, 'pass');
  }
  const output = raw({ decision: undefined });
  assert.equal(instruction(output, { vars: { expected_instruction: 'correction' } }).status, 'error');
  assert.equal(mode(raw({ mode: 'guard' }), { vars: { expected_mode: ['tutoring', 'guard'] } }).status, 'pass');
});

test('v0 archives match all 13 legacy evaluators without modifying their existing entrypoints', () => {
  const archive = path.resolve(__dirname, '../v0');
  const root = path.resolve(__dirname, '../../../..');
  const manifest = JSON.parse(fs.readFileSync(path.join(archive, 'manifest.json'), 'utf8'));
  assert.equal(manifest.files.length, 13);
  for (const entry of manifest.files) {
    const snapshot = fs.readFileSync(path.join(archive, entry.file));
    assert.equal(crypto.createHash('sha256').update(snapshot).digest('hex'), entry.sha256);
    assert.deepEqual(snapshot, fs.readFileSync(path.join(root, entry.source_path)));
  }
});

test('v1 file hashes and requirement mappings reconcile, with no composite turn_rhythm', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, 'v1');
  assert.equal(manifest.status, 'draft_uncalibrated');
  for (const entry of manifest.files) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, entry.file))).digest('hex'), entry.sha256);
  }
  const check = id => manifest.checks.find(entry => entry.id === id);
  assert.deepEqual(check('instruction_selection').requirements, ['T01']);
  assert.deepEqual(check('learning_state_target').requirements, ['T02']);
  assert.deepEqual(check('disruption_correction').requirements, ['G02']);
  assert.equal(check('mode_selection').method, 'deterministic');
  assert.equal(check('direct_correction').method, 'llm_rubric');
  assert.equal(check('turn_rhythm'), undefined);
  for (const entry of manifest.files.filter(file => file.file.endsWith('.md'))) {
    const rubric = fs.readFileSync(path.join(__dirname, entry.file), 'utf8');
    assert.doesNotMatch(rubric, /^(?:#|Intent:|Metric\/check ID:|Requirement:|Rubric version:|Status:)/m);
    assert.match(rubric, /^Allowed evaluator inputs:/);
    assert.match(rubric, /Return only JSON:/);
  }
});

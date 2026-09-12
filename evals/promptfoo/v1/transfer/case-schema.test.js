#!/usr/bin/env node
// Purpose: case-schema.test.js pins the frozen transfer case contract: required fields, evaluator-label isolation from target input, pair cardinality, holdout exposure, transition steps, and the malformed-metadata-is-an-error rule.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCase, validateCases } = require('./case-schema');
const schema = require('./case-schema.json');

function validCase() {
  return {
    case_id: 'transfer-case-1',
    case_version: 1,
    source_type: 'synthetic_holdout',
    case_role: 'positive',
    partition: 'development',
    source_provenance: {
      source_record_id: 'template-1',
      revision: '2026-09-11',
      author: 'component-104',
      changed_field_rationale: 'authored for the frozen transfer contract',
      redaction_status: 'no_identifiers',
      prompt_exposure: false,
      development_exposure: false
    },
    input: { room_id: 'r1' },
    evaluator: { metric_ids: ['transfer_trigger_target'], requirements: ['T09.1'], expected: { mode: 'tutoring' }, pass_rule: 'exact', applicability: 'case_fixed', label_author: 'component-104', label_version: 1, review_status: 'reviewed' },
    pair: null,
    transition: null,
    holdout_eligibility: {
      author: 'component-104',
      author_independent: true,
      creation_version: 1,
      prompt_exposure: false,
      development_exposure: false,
      exposure_date: null,
      eligible: true,
      replacement_ref: null
    }
  };
}

const paths = errors => errors.map(error => error.path);

test('a complete case validates with no errors', () => {
  assert.deepEqual(validateCase(validCase()), []);
});

test('a case missing identity, provenance, partition, or evaluator metadata is rejected by field name', () => {
  for (const field of schema.required_fields) {
    const candidate = validCase();
    delete candidate[field];
    const errors = validateCase(candidate);
    assert.ok(errors.length > 0, `expected a missing-${field} error`);
    assert.ok(paths(errors).some(path => path.includes(field)), `expected ${field} in ${JSON.stringify(paths(errors))}`);
  }
  const nested = validCase();
  delete nested.source_provenance.prompt_exposure;
  assert.ok(validateCase(nested).some(error => error.path === 'source_provenance.prompt_exposure'));
  const noHoldoutField = validCase();
  delete noHoldoutField.holdout_eligibility.eligible;
  assert.ok(validateCase(noHoldoutField).some(error => error.path === 'holdout_eligibility.eligible'));
});

test('unknown enumeration values are rejected instead of silently accepted', () => {
  const candidate = validCase();
  candidate.case_role = 'almost_positive';
  candidate.partition = 'somewhere';
  candidate.source_type = 'imported';
  const errors = validateCase(candidate);
  assert.ok(errors.some(error => error.path === 'case_role'));
  assert.ok(errors.some(error => error.path === 'partition'));
  assert.ok(errors.some(error => error.path === 'source_type'));
});

test('every declared forbidden evaluator key is rejected inside the target input at any depth', () => {
  for (const key of schema.input.forbidden_keys) {
    const candidate = validCase();
    candidate.input = { room_id: 'r1', nested: { [key]: 'leaked' } };
    const errors = validateCase(candidate);
    assert.ok(errors.some(error => error.path.includes(key)), `expected ${key} to be rejected, got ${JSON.stringify(errors)}`);
  }
});

test('a pair without exactly two members or without one declared meaning-bearing change is rejected', () => {
  const oneMember = validCase();
  oneMember.pair = { pair_id: 'pair-transport', member: 'a', changed_factor: 'the brand name', expected_contrast: 'pass' };
  assert.ok(validateCase(oneMember).some(error => error.path.includes('pair')));

  const noFactor = validCase();
  noFactor.pair = { pair_id: 'pair-transport', member: 'a', changed_factor: '', expected_contrast: 'pass' };
  assert.ok(validateCase(noFactor).some(error => error.path.includes('changed_factor')));

  const badMember = validCase();
  badMember.pair = { pair_id: 'pair-transport', member: 'c', changed_factor: 'a factor', expected_contrast: 'pass' };
  assert.ok(validateCase(badMember).some(error => error.path.includes('member')));
});

test('a declared pair is rejected when the manifest holds only one member or three members', () => {
  const first = validCase();
  first.pair = { pair_id: 'pair-transport', member: 'a', changed_factor: 'the brand name', expected_contrast: 'pass' };
  const second = { ...validCase(), case_id: 'transfer-case-2', pair: { pair_id: 'pair-transport', member: 'b', changed_factor: 'the situation', expected_contrast: 'fail' } };
  assert.deepEqual(validateCases([first, second]).filter(error => error.path.includes('pair')), []);
  assert.ok(validateCases([first]).some(error => error.path === 'pair[pair-transport].members'));
  assert.ok(validateCases([first, second, { ...first, case_id: 'transfer-case-3', pair: { ...first.pair, member: 'c' } }]).some(error => error.path === 'pair[pair-transport].members'));
});

test('an eligible holdout with prompt or development exposure is rejected and names the exposure field', () => {
  for (const field of ['prompt_exposure', 'development_exposure']) {
    const candidate = validCase();
    candidate.holdout_eligibility[field] = true;
    const errors = validateCase(candidate);
    assert.ok(errors.some(error => error.path === `holdout_eligibility.${field}`), `expected ${field} to block eligibility`);
  }
  const exposedButRegression = validCase();
  exposedButRegression.holdout_eligibility.prompt_exposure = true;
  exposedButRegression.holdout_eligibility.eligible = false;
  assert.deepEqual(validateCase(exposedButRegression), []);
});

test('duplicate case identity and version drift are rejected', () => {
  const first = validCase();
  assert.ok(validateCases([first, validCase()]).some(error => error.path === 'case_id'));
  const versionless = validCase();
  versionless.case_version = '1';
  assert.ok(validateCase(versionless).some(error => error.path === 'case_version'));
});

test('a stateful transition must preserve turns and assert state after each step', () => {
  const partiallyAsserted = validCase();
  partiallyAsserted.transition = { sequence_id: 'seq-1', steps: [{ turn: 0, learner_message: 'first' }], causal_evidence_ref: 'msg-1' };
  assert.ok(validateCase(partiallyAsserted).some(error => error.path.startsWith('transition.steps[0]')));
  const empty = validCase();
  empty.transition = { sequence_id: 'seq-1', steps: [], causal_evidence_ref: 'msg-1' };
  assert.ok(validateCase(empty).some(error => error.path === 'transition.steps'));
});

test('malformed expected metadata is a manifest error and never not_applicable', () => {
  const candidate = validCase();
  candidate.evaluator.pass_rule = '';
  const errors = validateCase(candidate);
  assert.ok(errors.some(error => error.path === 'evaluator.pass_rule'));
  assert.ok(errors.every(error => error.status === 'error'));
});

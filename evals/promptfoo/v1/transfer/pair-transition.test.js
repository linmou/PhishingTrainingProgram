#!/usr/bin/env node
// Purpose: pair-transition.test.js pins the semantic-pair and stateful-join gates: exactly two members, one declared meaning-bearing change, matching target-generation identity, and a joint verdict that one failing member blocks.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluatePairs, joinGenerations } = require('./pair-transition');
const fixtures = require('./fixtures/contract-fixtures.json');

const resultsFor = definitions => definitions.map((definition, index) => ({
  case_id: definition.case_id,
  case_version: definition.case_version,
  pair_id: definition.pair.pair_id,
  member: definition.pair.member,
  repetition: 0,
  target_generation_id: `gen-pair-${index === 0 ? 0 : 0}`,
  status: definition.pair.member === 'a' ? 'pass' : 'pass'
}));

test('a valid pair with both members passing passes jointly', () => {
  const result = evaluatePairs(fixtures.semantic_pairs.valid, resultsFor(fixtures.semantic_pairs.valid));
  assert.equal(result.status, 'pass');
  assert.deepEqual(result.failures, []);
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].members.length, 2);
});

test('a pair with one member missing fails instead of being averaged', () => {
  const definitions = fixtures.semantic_pairs.valid;
  const results = [resultsFor(definitions)[0]];
  const result = evaluatePairs(definitions, results);
  assert.equal(result.status, 'fail');
  assert.ok(result.failures.some(failure => failure.code === 'missing_pair_member' && failure.actual.member === 'b'));
});

test('a pair with one failing member fails even when the aggregate would pass', () => {
  const definitions = fixtures.semantic_pairs.valid;
  const results = resultsFor(definitions);
  results[1].status = 'fail';
  const result = evaluatePairs(definitions, results);
  assert.equal(result.status, 'fail');
  assert.equal(result.aggregate_pass_rate, 0.5);
  assert.ok(result.failures.some(failure => failure.code === 'pair_member_failed' && failure.actual.case_id === 'pair-b'));
});

test('a pair declared with one member or three members is rejected by cardinality', () => {
  const single = evaluatePairs(fixtures.semantic_pairs.single_member, resultsFor(fixtures.semantic_pairs.single_member));
  assert.ok(single.failures.some(failure => failure.code === 'pair_cardinality' && failure.expected === 2 && failure.actual === 1));
  const triple = evaluatePairs(fixtures.semantic_pairs.three_members, resultsFor(fixtures.semantic_pairs.three_members));
  assert.ok(triple.failures.some(failure => failure.code === 'pair_cardinality' && failure.actual === 3));
});

test('a pair whose members do not differ in one declared meaning-bearing change is rejected', () => {
  const definitions = fixtures.semantic_pairs.valid.map(member => ({ ...member, pair: { ...member.pair, changed_factor: 'the same factor' } }));
  const result = evaluatePairs(definitions, resultsFor(definitions));
  assert.ok(result.failures.some(failure => failure.code === 'pair_factor_identity'));
  const noContrast = fixtures.semantic_pairs.valid.map(member => ({ ...member, pair: { ...member.pair, expected_contrast: 'pass' } }));
  const sameContrast = evaluatePairs(noContrast, resultsFor(noContrast));
  assert.ok(sameContrast.failures.some(failure => failure.code === 'pair_contrast_identity'));
});

test('pair members must share one target-generation identity and one repetition', () => {
  const definitions = fixtures.semantic_pairs.valid;
  const joined = joinGenerations(definitions, fixtures.generation_ids.matching_pair);
  assert.equal(joined.status, 'pass', JSON.stringify(joined.failures));
  const mismatched = joinGenerations(definitions, fixtures.generation_ids.mismatched_pair);
  assert.equal(mismatched.status, 'fail');
  assert.ok(mismatched.failures.some(failure => failure.code === 'generation_identity_mismatch' && failure.actual.pair_id === 'pair-transport'));
  const missingRepetition = evaluatePairs(definitions, resultsFor(definitions).map(member => ({ ...member, repetition: undefined })));
  assert.ok(missingRepetition.failures.some(failure => failure.code === 'missing_repetition_identity'));
});

test('an errored pair member is not a pass and blocks the pair gate', () => {
  const definitions = fixtures.semantic_pairs.valid;
  for (const status of ['error', 'missing', 'fail']) {
    const results = resultsFor(definitions);
    results[0].status = status;
    const result = evaluatePairs(definitions, results);
    assert.equal(result.status, 'fail', `status ${status} must block the pair`);
  }
});

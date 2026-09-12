#!/usr/bin/env node
// Purpose: comparison.test.js pins baseline/candidate comparability: the same case and metric versions, settings, repetitions, target-generation identity, partition membership, shared builder and prompt hashes, both 1200 budgets, and parity result; any drift rejects the comparison before acceptance.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compareManifests, comparablePartitions } = require('./comparison');
const manifest = require('./manifest.json');

const clone = () => JSON.parse(JSON.stringify(manifest));
const codes = result => result.failures.map(failure => failure.code);

test('identical manifests are comparable and report the joined partitions', () => {
  const result = compareManifests(clone(), clone());
  assert.equal(result.status, 'comparable');
  assert.deepEqual(result.failures, []);
  assert.ok(result.partitions.includes('development'));
  assert.deepEqual(comparablePartitions(clone()), manifest.comparison.comparability_checks);
});

test('a changed case version, metric version, or partition membership rejects comparability', () => {
  const versionDrift = clone();
  versionDrift.partitions.development.case_versions = versionDrift.partitions.development.case_versions.map(version => version + 1);
  assert.ok(codes(compareManifests(clone(), versionDrift)).includes('case_version_drift'));

  const metricDrift = clone();
  metricDrift.metric_registry = { ...metricDrift.metric_registry, methods: { ...metricDrift.metric_registry.methods, medium_transfer_quality: 'other' } };
  assert.ok(codes(compareManifests(clone(), metricDrift)).includes('metric_version_drift'));

  const partitionDrift = clone();
  partitionDrift.partitions.development = { ...partitionDrift.partitions.development, case_ids: partitionDrift.partitions.development.case_ids.slice(1) };
  assert.ok(codes(compareManifests(clone(), partitionDrift)).includes('partition_membership_drift'));
});

test('changed settings, repetitions, or target generation identity rejects comparability', () => {
  const settingsDrift = clone();
  settingsDrift.settings = { ...settingsDrift.settings, target_temperature: 0.9 };
  assert.ok(codes(compareManifests(clone(), settingsDrift)).includes('settings_drift'));

  const repetitionDrift = clone();
  repetitionDrift.settings = { ...repetitionDrift.settings, repetitions: 1 };
  const result = compareManifests(clone(), repetitionDrift);
  assert.ok(codes(result).includes('repetition_policy_drift'));

  const generationDrift = clone();
  generationDrift.comparison = { ...generationDrift.comparison, join_keys: generationDrift.comparison.join_keys.filter(key => key !== 'target_generation_id') };
  assert.ok(codes(compareManifests(clone(), generationDrift)).includes('generation_identity_drift'));
});

test('a changed shared builder hash, production prompt hash, budget, thinking flag, or parity result rejects comparability', () => {
  for (const [mutate, code] of [
    [next => { next.shared_request_contract.builder_source_sha256 = 'deadbeef'; }, 'builder_hash_drift'],
    [next => { next.shared_request_contract.production_prompt_source_sha256 = 'deadbeef'; }, 'prompt_hash_drift'],
    [next => { next.shared_request_contract.evaluation_effective_completion_token_budget = 8000; }, 'budget_drift'],
    [next => { next.shared_request_contract.evaluation_enable_thinking = true; }, 'thinking_flag_drift'],
    [next => { next.shared_request_contract.parity_result = 'mismatch'; }, 'parity_failure']
  ]) {
    const drifted = clone();
    mutate(drifted);
    const result = compareManifests(clone(), drifted);
    assert.equal(result.status, 'incomparable', `expected incomparable for ${code}`);
    assert.ok(codes(result).includes(code), `expected ${code} in ${JSON.stringify(codes(result))}`);
  }
});

test('changed experimental factors must be declared separately from prompt changes', () => {
  const declared = clone();
  declared.comparison = { ...declared.comparison, permitted_changed_factors: ['contract_version'] };
  declared.settings = { ...declared.settings, request_concurrency: 4 };
  assert.equal(compareManifests(clone(), declared).status, 'comparable');
  const undeclared = clone();
  undeclared.settings = { ...undeclared.settings, request_concurrency: 4 };
  const result = compareManifests(clone(), undeclared);
  assert.ok(codes(result).includes('undeclared_changed_factor'));
  assert.ok(result.failures.find(failure => failure.code === 'undeclared_changed_factor').path.includes('request_concurrency'));
  assert.ok(declared.comparison.permitted_changed_factors.length >= 1);
});

test('the baseline and candidate must share the same contract version and manifest version', () => {
  const contractDrift = clone();
  contractDrift.shared_request_contract = { ...contractDrift.shared_request_contract, contract_version: 'transfer_tutor_context_v4' };
  assert.ok(codes(compareManifests(clone(), contractDrift)).includes('contract_version_drift'));
  const manifestDrift = clone();
  manifestDrift.manifest_version = 'transfer-eval-v2';
  const result = compareManifests(clone(), manifestDrift);
  assert.ok(codes(result).includes('manifest_version_drift'));
  assert.equal(result.status, 'incomparable');
});

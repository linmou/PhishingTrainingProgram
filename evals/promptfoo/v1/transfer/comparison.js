#!/usr/bin/env node
// Purpose: comparison.js decides whether a candidate manifest is comparable to a baseline manifest and reports required case-role coverage for the frozen case set.
'use strict';
const schema = require('./case-schema.json');

const failure = (code, detail = {}) => ({ code, ...detail });
const clone = value => JSON.parse(JSON.stringify(value));

function requiredCaseRoles() {
  return schema.required_case_roles.slice();
}

function roleCoverage(cases, gaps = []) {
  const covered = [...new Set(cases.map(definition => definition.case_role))].sort();
  const declaredGaps = gaps.map(gap => gap.role);
  const missing = requiredCaseRoles().filter(role => !covered.includes(role) && !declaredGaps.includes(role));
  return { roles: requiredCaseRoles(), covered, gaps, missing };
}

function comparablePartitions(manifest) {
  return manifest.comparison.comparability_checks.slice();
}

function compareManifests(baseline, candidate) {
  const failures = [];
  if (!baseline || !candidate) return { status: 'incomparable', failures: [failure('missing_manifest')], partitions: [] };
  if (baseline.manifest_version !== candidate.manifest_version) failures.push(failure('manifest_version_drift', { path: 'manifest_version', expected: baseline.manifest_version, actual: candidate.manifest_version }));
  if (baseline.shared_request_contract.contract_version !== candidate.shared_request_contract.contract_version) {
    failures.push(failure('contract_version_drift', { path: 'shared_request_contract.contract_version', expected: baseline.shared_request_contract.contract_version, actual: candidate.shared_request_contract.contract_version }));
  }

  const shared = [
    ['builder_source_sha256', 'builder_hash_drift'],
    ['production_prompt_source_sha256', 'prompt_hash_drift'],
    ['evaluation_effective_completion_token_budget', 'budget_drift'],
    ['evaluation_enable_thinking', 'thinking_flag_drift'],
    ['parity_result', 'parity_failure']
  ];
  for (const [field, code] of shared) {
    if (baseline.shared_request_contract[field] !== candidate.shared_request_contract[field]) {
      failures.push(failure(code, { path: `shared_request_contract.${field}`, expected: baseline.shared_request_contract[field], actual: candidate.shared_request_contract[field] }));
    }
  }

  for (const key of ['case_versions', 'case_ids', 'denominator_rule']) {
    for (const name of Object.keys(baseline.partitions)) {
      const left = JSON.stringify(baseline.partitions[name][key]);
      const right = JSON.stringify((candidate.partitions[name] || {})[key]);
      if (left === right) continue;
      const code = key === 'case_versions' ? 'case_version_drift' : key === 'case_ids' ? 'partition_membership_drift' : 'denominator_rule_drift';
      failures.push(failure(code, { path: `partitions.${name}.${key}` }));
    }
  }

  for (const field of ['target_model', 'judge_model', 'target_temperature', 'judge_temperature', 'target_max_tokens', 'target_enable_thinking', 'judge_max_tokens', 'judge_enable_thinking', 'timeout_ms', 'transport_attempts', 'seed_policy']) {
    if (JSON.stringify(baseline.settings[field]) !== JSON.stringify(candidate.settings[field])) {
      failures.push(failure('settings_drift', { path: `settings.${field}`, expected: baseline.settings[field], actual: candidate.settings[field] }));
    }
  }
  if (baseline.settings.repetitions !== candidate.settings.repetitions) {
    failures.push(failure('repetition_policy_drift', { path: 'settings.repetitions', expected: baseline.settings.repetitions, actual: candidate.settings.repetitions }));
  }

  const permitted = candidate.comparison.permitted_changed_factors || [];
  for (const field of ['request_concurrency']) {
    if (baseline.settings[field] !== candidate.settings[field] && !permitted.includes(field)) {
      failures.push(failure('undeclared_changed_factor', { path: `settings.${field}`, expected: baseline.settings[field], actual: candidate.settings[field] }));
    }
  }
  if (permitted.includes('contract_version') === false && baseline.shared_request_contract.contract_version !== candidate.shared_request_contract.contract_version) {
    failures.push(failure('undeclared_changed_factor', { path: 'shared_request_contract.contract_version' }));
  }

  for (const key of ['case_version', 'metric_version', 'partition', 'target_generation_id', 'repetition', 'turn']) {
    if (!candidate.comparison.join_keys.includes(key)) failures.push(failure('generation_identity_drift', { path: `comparison.join_keys.${key}` }));
  }
  if (baseline.metric_registry.methods && JSON.stringify(baseline.metric_registry.methods) !== JSON.stringify(candidate.metric_registry.methods)) {
    failures.push(failure('metric_version_drift', { path: 'metric_registry.methods' }));
  }

  return {
    status: failures.length ? 'incomparable' : 'comparable',
    failures,
    partitions: Object.keys(baseline.partitions),
    join_keys: candidate.comparison.join_keys.slice()
  };
}

module.exports = { compareManifests, comparablePartitions, roleCoverage, requiredCaseRoles, clone };

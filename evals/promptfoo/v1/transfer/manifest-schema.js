#!/usr/bin/env node
// Purpose: manifest-schema.js validates a frozen transfer run manifest: rubric registration and declaration completeness, partition coverage, the shared-request contract snapshot with both 1200 budgets and thinking flags, and the pre-scoring blockers.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const schema = require('./manifest-schema.json');
const registry = require('./metric-registry.json');

const REQUIRED_RUBRIC_IDS = registry.public_metric_ids.slice();
const PRE_SCORING_BLOCKERS = schema.pre_scoring_blockers.slice();
const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function issue(path_, code, status = 'incomplete', detail = {}) {
  return { path: path_, error: code, status, ...detail };
}

function validateRubricRegistration(manifest) {
  const errors = [];
  const registration = manifest.metric_registry;
  if (!isPlainObject(registration)) return [issue('metric_registry', 'missing_field')];
  for (const id of registration.public_metric_ids || []) {
    if (!REQUIRED_RUBRIC_IDS.includes(id)) errors.push(issue(`metric_registry.public_metric_ids[${id}]`, 'unexpected_rubric_id'));
  }
  for (const id of REQUIRED_RUBRIC_IDS) {
    if (!(registration.public_metric_ids || []).includes(id)) errors.push(issue(`metric_registry.public_metric_ids[${id}]`, 'missing_rubric_id'));
  }
  for (const [id, method] of Object.entries(registration.methods || {})) {
    const declared = registry.checks.find(check => check.metric_id === id);
    if (!declared) continue;
    if (declared.method !== method) errors.push(issue(`metric_registry.methods.${id}`, 'method_mismatch', 'incomplete', { expected: declared.method, actual: method }));
  }
  return errors;
}

function validateRubricDeclarations(manifest) {
  const errors = [];
  const declarations = manifest.rubric_declarations;
  if (!isPlainObject(declarations)) return [issue('rubric_declarations', 'missing_field')];
  for (const id of REQUIRED_RUBRIC_IDS) {
    const declaration = declarations[id];
    if (!isPlainObject(declaration)) {
      errors.push(issue(`rubric_declarations.${id}`, 'missing_rubric_declaration'));
      continue;
    }
    for (const field of schema.rubric_declaration_required_fields) {
      const value = declaration[field];
      if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
        errors.push(issue(`rubric_declarations.${id}.${field}`, 'missing_field'));
      }
    }
  }
  return errors;
}

function validateSharedRequestContract(manifest) {
  const errors = [];
  const shared = manifest.shared_request_contract;
  if (!isPlainObject(shared)) return [issue('shared_request_contract', 'pre_scoring_blocker', 'incomplete', { blocker: PRE_SCORING_BLOCKERS[0] })];
  for (const field of schema.shared_request_contract.required_fields) {
    const value = shared[field];
    const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
    if (empty) {
      const blocker = ['builder_source_sha256', 'builder_export_identities'].includes(field) ? 'missing shared builder hash' : 'missing production prompt reference or hash';
      errors.push(issue(`shared_request_contract.${field}`, field.includes('prompt') || field.includes('builder') ? 'pre_scoring_blocker' : 'missing_field', 'incomplete', { blocker }));
    }
  }
  for (const key of ['product_effective_completion_token_budget', 'evaluation_effective_completion_token_budget']) {
    if (shared[key] !== schema.shared_request_contract.effective_completion_token_budget) {
      errors.push(issue(`shared_request_contract.${key}`, 'budget_mismatch', 'incomplete', { expected: schema.shared_request_contract.effective_completion_token_budget, actual: shared[key] }));
    }
  }
  for (const key of ['product_enable_thinking', 'evaluation_enable_thinking']) {
    if (shared[key] !== schema.shared_request_contract.effective_enable_thinking) {
      errors.push(issue(`shared_request_contract.${key}`, 'thinking_mismatch', 'incomplete', { expected: schema.shared_request_contract.effective_enable_thinking, actual: shared[key] }));
    }
  }
  if (shared.parity_result !== 'match') errors.push(issue('shared_request_contract.parity_result', 'parity_failure', 'incomplete', { actual: shared.parity_result }));
  return [...errors, ...forbiddenMetadata(shared, 'shared_request_contract')];
}

function forbiddenMetadata(value, prefix) {
  const found = [];
  const forbidden = schema.shared_request_contract.forbidden_keys;
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...forbiddenMetadata(item, `${prefix}[${index}]`)));
    return found;
  }
  if (!isPlainObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${prefix}.${key}`;
    if (forbidden.includes(key)) found.push(issue(childPath, 'forbidden_metadata'));
    if (isPlainObject(child)) found.push(...forbiddenMetadata(child, childPath));
  }
  return found;
}

function validatePartitions(manifest, cases) {
  const errors = [];
  const partitions = manifest.partitions;
  if (!isPlainObject(partitions)) return [issue('partitions', 'missing_field')];
  const byId = new Map((cases || []).map(definition => [definition.case_id, definition]));
  const covered = new Set();
  for (const [name, partition] of Object.entries(partitions)) {
    if (!isPlainObject(partition)) {
      errors.push(issue(`partitions.${name}`, 'missing_field'));
      continue;
    }
    for (const field of schema.partitions.partition_required_fields) {
      if (partition[field] === undefined) errors.push(issue(`partitions.${name}.${field}`, 'missing_field'));
    }
    if (!cases) continue;
    for (const [index, caseId] of (partition.case_ids || []).entries()) {
      const definition = byId.get(caseId);
      if (!definition) {
        errors.push(issue(`partitions.${name}.case_ids[${caseId}]`, 'unknown_case_in_partition'));
        continue;
      }
      covered.add(caseId);
      if (definition.case_version !== partition.case_versions[index]) {
        errors.push(issue(`partitions.${name}.case_versions[${caseId}]`, 'case_version_drift', 'incomplete', { expected: definition.case_version, actual: partition.case_versions[index] }));
      }
    }
  }
  if (cases && cases.length) {
    for (const definition of cases) {
      if (!covered.has(definition.case_id)) errors.push(issue(`partitions.*.case_ids[${definition.case_id}]`, 'uncovered_case'));
    }
  }
  return errors;
}

function validateManifest(manifest, options = {}) {
  if (!isPlainObject(manifest)) return [issue('manifest', 'missing_field')];
  const errors = [];
  for (const field of schema.required_fields) {
    if (manifest[field] === undefined) errors.push(issue(field, 'missing_field'));
  }
  return [
    ...errors,
    ...validateRubricRegistration(manifest),
    ...validateRubricDeclarations(manifest),
    ...validateSharedRequestContract(manifest),
    ...validatePartitions(manifest, options.cases)
  ];
}

function loadManifest(file) {
  return JSON.parse(fs.readFileSync(file || path.join(__dirname, 'manifest.json'), 'utf8'));
}

module.exports = { validateManifest, loadManifest, REQUIRED_RUBRIC_IDS, PRE_SCORING_BLOCKERS };

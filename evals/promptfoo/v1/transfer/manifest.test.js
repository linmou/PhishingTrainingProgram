#!/usr/bin/env node
// Purpose: manifest.test.js pins the frozen transfer run manifest: rubric registration and declaration completeness, partition coverage, case references, the shared-request contract snapshot, and the pre-scoring blockers.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validateManifest, REQUIRED_RUBRIC_IDS, PRE_SCORING_BLOCKERS } = require('./manifest-schema');
const registry = require('./metric-registry.json');
const schema = require('./manifest-schema.json');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));

function validManifest() {
  const manifest = read('manifest.json');
  return JSON.parse(JSON.stringify(manifest));
}

test('the frozen manifest carries every required top-level section', () => {
  const manifest = validManifest();
  for (const field of schema.required_fields) {
    assert.ok(manifest[field] !== undefined, `manifest is missing ${field}`);
  }
  assert.deepEqual(validateManifest(manifest, { cases: read('cases.json').cases }), []);
});

test('the metric registry registers exactly the five public rubric IDs plus the deterministic supporting check', () => {
  const ids = registry.checks.map(check => check.metric_id);
  assert.deepEqual(registry.public_metric_ids.slice().sort(), ids.filter(id => id !== registry.deterministic_supporting_check_id).sort());
  assert.equal(ids.filter(id => id === registry.deterministic_supporting_check_id).length, 1);
  assert.deepEqual(REQUIRED_RUBRIC_IDS.slice().sort(), registry.public_metric_ids.slice().sort());
  for (const id of ['transfer_trigger_target', 'medium_transfer_quality', 'assessment_item_validity', 'verification_evidence']) {
    assert.equal(registry.checks.find(check => check.metric_id === id).method, 'llm_rubric', `${id} must be semantic`);
  }
  assert.equal(registry.checks.find(check => check.metric_id === 'assessment_followup').method, 'deterministic');
  assert.equal(registry.checks.find(check => check.metric_id === 't09_contract_and_progress').method, 'deterministic');
});

test('a sixth injected rubric ID or a changed method is reported with the offending ID', () => {
  const manifest = validManifest();
  manifest.metric_registry = { ...manifest.metric_registry, public_metric_ids: [...REQUIRED_RUBRIC_IDS, 'extra_metric'] };
  const sixErrors = validateManifest(manifest);
  assert.ok(sixErrors.some(error => error.error === 'unexpected_rubric_id' && error.path.includes('extra_metric')), JSON.stringify(sixErrors));

  const registryDrift = validManifest();
  registryDrift.metric_registry = { ...registryDrift.metric_registry, methods: { ...registryDrift.metric_registry.methods, assessment_followup: 'llm_rubric' } };
  assert.ok(validateManifest(registryDrift).some(error => error.path === 'metric_registry.methods.assessment_followup'));
});

test('each rubric must declare method, consumer, requirements, applicability, pass rule, threshold, calibration, and error handling', () => {
  const manifest = validManifest();
  for (const id of REQUIRED_RUBRIC_IDS) {
    for (const field of schema.rubric_declaration_required_fields) {
      const candidate = validManifest();
      candidate.rubric_declarations[id] = { ...candidate.rubric_declarations[id] };
      delete candidate.rubric_declarations[id][field];
      assert.ok(
        validateManifest(candidate).some(error => error.path === `rubric_declarations.${id}.${field}`),
        `expected a missing ${field} error for ${id}`
      );
    }
  }
  const missingDeclaration = validManifest();
  delete missingDeclaration.rubric_declarations.verification_evidence;
  assert.ok(validateManifest(missingDeclaration).some(error => error.path === 'rubric_declarations.verification_evidence'));
});

test('the shared request contract pins the builder, the production prompt, both 1200 budgets, both thinking flags, and parity', () => {
  const manifest = validManifest();
  const shared = manifest.shared_request_contract;
  for (const field of schema.shared_request_contract.required_fields) {
    const candidate = validManifest();
    delete candidate.shared_request_contract[field];
    const errors = validateManifest(candidate);
    assert.ok(errors.some(error => error.path === `shared_request_contract.${field}`), `expected a missing ${field} error, got ${JSON.stringify(errors)}`);
  }
  assert.equal(shared.product_effective_completion_token_budget, 1200);
  assert.equal(shared.evaluation_effective_completion_token_budget, 1200);
  assert.equal(shared.product_enable_thinking, false);
  assert.equal(shared.evaluation_enable_thinking, false);
  assert.deepEqual(shared.builder_export_identities.slice().sort(), schema.shared_request_contract.required_builder_exports.slice().sort());
});

test('a non-1200 budget, a thinking mismatch, or a parity failure is a pre-scoring blocker naming the field', () => {
  const wrongBudget = validManifest();
  wrongBudget.shared_request_contract.evaluation_effective_completion_token_budget = 8000;
  const budgetErrors = validateManifest(wrongBudget);
  assert.ok(budgetErrors.some(error => error.error === 'budget_mismatch' && error.path === 'shared_request_contract.evaluation_effective_completion_token_budget'));

  const wrongThinking = validManifest();
  wrongThinking.shared_request_contract.evaluation_enable_thinking = true;
  assert.ok(validateManifest(wrongThinking).some(error => error.error === 'thinking_mismatch' && error.path === 'shared_request_contract.evaluation_enable_thinking'));

  const parity = validManifest();
  parity.shared_request_contract.parity_result = 'mismatch';
  assert.ok(validateManifest(parity).some(error => error.error === 'parity_failure'));

  const noBuilder = validManifest();
  noBuilder.shared_request_contract.builder_source_sha256 = null;
  const noBuilderErrors = validateManifest(noBuilder);
  assert.ok(noBuilderErrors.some(error => error.status === 'incomplete' && error.path === 'shared_request_contract.builder_source_sha256'));
  assert.ok(PRE_SCORING_BLOCKERS.includes('missing shared builder hash'));
});

test('declared partitions cover every case, and a case referencing an undeclared partition is rejected', () => {
  const manifest = validManifest();
  const { cases } = read('cases.json');
  const caseIds = manifest.partitions.development.case_ids;
  assert.ok(caseIds.length > 0);
  const orphan = validManifest();
  orphan.partitions.development = { ...orphan.partitions.development, case_ids: [...caseIds, 'case-that-does-not-exist'] };
  assert.ok(validateManifest(orphan, { cases }).some(error => error.error === 'unknown_case_in_partition' && error.path.includes('case-that-does-not-exist')));

  const uncovered = validManifest();
  uncovered.partitions.development = { ...uncovered.partitions.development, case_ids: caseIds.filter(id => id !== caseIds[0]), case_versions: uncovered.partitions.development.case_versions.filter((_, index) => index !== 0) };
  assert.ok(validateManifest(uncovered, { cases }).some(error => error.error === 'uncovered_case' && error.path.includes(caseIds[0])));
});

test('a credential or copied prompt text in the manifest is rejected and names the offending path', () => {
  for (const key of schema.shared_request_contract.forbidden_keys) {
    const candidate = validManifest();
    candidate.shared_request_contract[key] = 'leaked-value';
    const errors = validateManifest(candidate);
    assert.ok(errors.some(error => error.error === 'forbidden_metadata' && error.path.includes(key)), `expected ${key} to be rejected`);
  }
});

test('every case referenced by the manifest exists in cases.json with a matching version', () => {
  const manifest = validManifest();
  const { cases } = read('cases.json');
  for (const [name, partition] of Object.entries(manifest.partitions)) {
    for (const [index, caseId] of partition.case_ids.entries()) {
      const found = cases.find(item => item.case_id === caseId);
      assert.ok(found, `partition ${name} references unknown case ${caseId}`);
      assert.equal(partition.case_versions[index], found.case_version, `version drift for ${caseId}`);
    }
  }
});

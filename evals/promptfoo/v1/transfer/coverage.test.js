#!/usr/bin/env node
// Purpose: coverage.test.js proves every declared case role is covered or recorded as a named coverage gap, and that partition and requirement mappings are complete.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { requiredCaseRoles, roleCoverage } = require('./comparison');
const schema = require('./case-schema.json');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const { cases } = read('cases.json');
const manifest = read('manifest.json');

test('every required case role is covered by a frozen case or named as a coverage gap', () => {
  const coverage = roleCoverage(cases, manifest.coverage_gaps || []);
  assert.deepEqual(coverage.missing, []);
  assert.deepEqual(coverage.roles.slice().sort(), schema.required_case_roles.slice().sort());
  for (const role of requiredCaseRoles()) {
    assert.ok(coverage.covered.includes(role), `role ${role} is neither covered nor declared as a gap`);
  }
});

test('an uncovered role without a declared gap fails with the missing role name', () => {
  const dropped = cases.filter(item => item.case_role !== 'assistance');
  const coverage = roleCoverage(dropped, manifest.coverage_gaps || []);
  assert.deepEqual(coverage.missing, ['assistance']);
});

test('a declared coverage gap is accepted and carries a reason and provenance', () => {
  const coverage = roleCoverage(cases.filter(item => item.case_role !== 'assistance'), [{ role: 'assistance', reason: 'no authored case yet', provenance: 'component-104' }]);
  assert.deepEqual(coverage.missing, []);
  assert.equal(coverage.gaps.length, 1);
  for (const gap of manifest.coverage_gaps || []) {
    assert.ok(gap.role && gap.reason && gap.provenance, 'a declared gap must name role, reason, and provenance');
  }
});

test('the semantic pair role has exactly two members sharing one meaning-bearing change', () => {
  const roles = cases.filter(item => item.pair).map(item => item.pair.pair_id);
  for (const pairId of new Set(roles)) {
    const members = cases.filter(item => item.pair && item.pair.pair_id === pairId);
    assert.equal(members.length, 2, `pair ${pairId} must have two members`);
    assert.deepEqual(members.map(item => item.pair.member).sort(), ['a', 'b']);
    assert.notEqual(members[0].pair.expected_contrast, members[1].pair.expected_contrast);
    assert.ok(members[0].pair.changed_factor.trim() && members[1].pair.changed_factor.trim());
  }
});

test('every case declares metric mappings and T09 requirement mappings', () => {
  for (const item of cases) {
    assert.ok(item.evaluator.metric_ids.length > 0, `${item.case_id} declares no metric`);
    assert.ok(item.evaluator.requirements.length > 0, `${item.case_id} declares no requirement mapping`);
    for (const metricId of item.evaluator.metric_ids) {
      assert.ok(['transfer_trigger_target', 'medium_transfer_quality', 'assessment_item_validity', 'assessment_followup', 'verification_evidence', 't09_contract_and_progress'].includes(metricId), `${item.case_id} names unknown metric ${metricId}`);
    }
  }
});

test('every case belongs to exactly one declared partition', () => {
  const declared = new Map();
  for (const [name, partition] of Object.entries(manifest.partitions)) {
    for (const caseId of partition.case_ids) declared.set(caseId, name);
  }
  for (const item of cases) assert.ok(declared.has(item.case_id), `${item.case_id} is in no declared partition`);
});

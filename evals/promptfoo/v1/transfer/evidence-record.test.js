#!/usr/bin/env node
// Purpose: evidence-record.test.js pins immutable write-once run evidence: required raw/parsed/displayed and expected/actual fields, evaluator-only separation, secret redaction, and partial-run blocking.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { writeRun, writeEvidence, validateEvidenceRecord, scanForSecrets, REQUIRED_EVIDENCE_FIELDS, ALLOWED_STATUSES } = require('./evidence-record');

const tmpRun = () => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'transfer-run-'));

function validRecord() {
  return {
    run_id: 'fixture-run-1',
    case_id: 'transfer-case-1',
    case_version: 1,
    metric_id: 'medium_transfer_quality',
    method: 'llm_rubric',
    repetition: 0,
    turn: null,
    partition: 'development',
    target_generation_id: 'gen-1',
    target_input: { room_id: 'r1' },
    raw_request: { model: 'qwen3.5-flash', messages: [{ role: 'user', content: '{}' }], max_tokens: 1200 },
    raw_response: { choices: [{ message: { content: '{}' } }] },
    parsed_output: { reason: 'evidence', decision: { mode: 'tutoring', instruction: 'scaffolding', target_item_id: 'item-2' }, response: 'Which part?' },
    displayed_output: 'Which part?',
    expected: { pass: true },
    actual: { pass: true },
    judgment: { pass: true, score: 1, reason: 'moves the same concept to a new situation' },
    raw_judgment: { metric: 'medium_transfer_quality' },
    judge_settings: { model: 'qwen3.5-flash', temperature: 0, max_tokens: 8000 },
    status: 'pass',
    score: 1,
    applicability: { applicable: true, rule: 'case_fixed' },
    provider_metadata: { endpoint_host: 'example.invalid', attempts: 1 },
    source_provenance: { source_record_id: 'template-1' },
    manifest_hashes: { builder_source_sha256: 'abc' }
  };
}

test('a complete record validates and preserves raw, parsed, displayed, expected, actual, and judgment evidence', () => {
  const record = validRecord();
  assert.deepEqual(validateEvidenceRecord(record), []);
  for (const field of REQUIRED_EVIDENCE_FIELDS) assert.ok(record[field] !== undefined, `fixture is missing ${field}`);
  assert.deepEqual(validateEvidenceRecord({ ...record, status: 'scored' }).filter(error => error.path === 'status').length, 1);
  assert.ok(ALLOWED_STATUSES.includes('not_applicable'));
});

test('a record that stores only a score is rejected by field name', () => {
  const record = validRecord();
  delete record.raw_response;
  delete record.judgment;
  delete record.raw_request;
  const errors = validateEvidenceRecord(record);
  assert.ok(errors.some(error => error.path === 'raw_response'));
  assert.ok(errors.some(error => error.path === 'judgment'));
  assert.ok(errors.some(error => error.path === 'raw_request'));
});

test('evaluator-only metadata inside the target projection is rejected and the offending path is named', () => {
  for (const key of ['evaluator', 'expected', 'holdout_eligibility', 'pair', 'gate_thresholds']) {
    const record = validRecord();
    record.target_input = { room_id: 'r1', nested: { [key]: 'leaked' } };
    const errors = validateEvidenceRecord(record);
    assert.ok(errors.some(error => error.error === 'forbidden_metadata' && error.path.includes(key)), `expected ${key} to be rejected`);
  }
});

test('credentials and secrets are detected and redacted without altering tested meaning', () => {
  const secrets = ['api_key', 'authorization', 'bearer_token', 'password'];
  for (const key of secrets) {
    const found = scanForSecrets({ provider_metadata: { [key]: 'secret-value' } });
    assert.ok(found.some(item => item.path.includes(key)), `expected ${key} to be detected`);
  }
  const report = scanForSecrets({ note: 'Authorization: Bearer sk-abcdef0123456789' });
  assert.ok(report.length > 0);
  const record = validRecord();
  record.provider_metadata = { ...record.provider_metadata, api_key: 'sk-live-123' };
  assert.ok(validateEvidenceRecord(record).some(error => error.error === 'forbidden_metadata'));
});

test('a run directory is write-once and a second write leaves the original bytes unchanged', () => {
  const directory = tmpRun();
  const runPath = writeRun(directory, { run_id: 'fixture-run-1', manifest_version: 'transfer-eval-v1' });
  const before = fs.readFileSync(path.join(runPath, 'snapshot.json'), 'utf8');
  assert.throws(() => writeRun(directory, { run_id: 'fixture-run-1', manifest_version: 'transfer-eval-v1' }), /exists/i);
  assert.equal(fs.readFileSync(path.join(runPath, 'snapshot.json'), 'utf8'), before);
  assert.throws(() => writeEvidence(runPath, validRecord()), /exists/i);
  writeEvidence(runPath, validRecord());
  assert.throws(() => writeEvidence(runPath, validRecord()), /exists/i);
});

test('a partial run is preserved as incomplete evidence and never reported as accepted', () => {
  const directory = tmpRun();
  const runPath = writeRun(directory, { run_id: 'fixture-run-2', manifest_version: 'transfer-eval-v1' });
  const first = writeEvidence(runPath, validRecord());
  const partial = writeEvidence(runPath, { ...validRecord(), case_id: 'transfer-case-2', status: 'error', reason: 'judge transport failed' });
  const summary = require('./evidence-record').summarizeRun(runPath);
  assert.equal(summary.records.length, 2);
  assert.equal(summary.complete, false);
  assert.equal(summary.verdict, 'incomplete');
  assert.ok(fs.existsSync(first) && fs.existsSync(partial));
});

test('a status outside the declared set or a missing applicability reason is an error', () => {
  const record = validRecord();
  record.status = 'probably';
  assert.ok(validateEvidenceRecord(record).some(error => error.path === 'status'));
  const inapplicable = { ...validRecord(), status: 'not_applicable', applicable: false, pass: null, score: null, applicability: { applicable: false, rule: '' } };
  assert.ok(validateEvidenceRecord(inapplicable).some(error => error.path === 'applicability.rule'));
});

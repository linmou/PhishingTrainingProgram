#!/usr/bin/env node
// Purpose: evidence-record.js writes immutable write-once transfer run evidence and validates each per-case record: complete raw/parsed/displayed and expected/actual fields, evaluator-only separation, secret redaction, and partial-run blocking.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const caseSchema = require('./case-schema.json');

const ALLOWED_STATUSES = caseSchema.statuses.slice();
const REQUIRED_EVIDENCE_FIELDS = [
  'run_id',
  'case_id',
  'case_version',
  'metric_id',
  'method',
  'repetition',
  'partition',
  'target_generation_id',
  'target_input',
  'raw_request',
  'raw_response',
  'parsed_output',
  'displayed_output',
  'expected',
  'actual',
  'judgment',
  'status'
];
const SECRET_KEY_PATTERN = /(api[_-]?key|authorization|bearer|password|secret|access[_-]?token|refresh[_-]?token|client[_-]?secret)/i;
const SECRET_VALUE_PATTERN = /(bearer\s+[a-z0-9._-]{12,}|sk-[a-z0-9-]{12,})/i;

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const error = (path_, code, detail = {}) => ({ path: path_, error: code, ...detail });

function scanForSecrets(value, prefix = '') {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...scanForSecrets(item, `${prefix}[${index}]`)));
    return found;
  }
  if (typeof value === 'string') {
    if (SECRET_VALUE_PATTERN.test(value)) found.push({ path: prefix || '(value)', key: 'secret_value' });
    return found;
  }
  if (!isPlainObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (SECRET_KEY_PATTERN.test(key)) found.push({ path: childPath, key });
    else found.push(...scanForSecrets(child, childPath));
  }
  return found;
}

function walkForbidden(value, forbidden, prefix) {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...walkForbidden(item, forbidden, `${prefix}[${index}]`)));
    return found;
  }
  if (!isPlainObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (forbidden.includes(key)) found.push({ path: childPath, key });
    found.push(...walkForbidden(child, forbidden, childPath));
  }
  return found;
}

function validateEvidenceRecord(record) {
  if (!isPlainObject(record)) return [error('record', 'missing_field')];
  const errors = [];
  for (const field of REQUIRED_EVIDENCE_FIELDS) {
    if (record[field] === undefined) errors.push(error(field, 'missing_field'));
  }
  if (record.status !== undefined && !ALLOWED_STATUSES.includes(record.status)) errors.push(error('status', 'invalid_status', { actual: record.status }));
  if (record.status === 'not_applicable') {
    if (!isPlainObject(record.applicability) || !record.applicability.rule) errors.push(error('applicability.rule', 'missing_field'));
    if (record.pass !== null || record.score !== null) errors.push(error('pass', 'invalid_inapplicability'));
  }
  for (const found of walkForbidden(record.target_input || {}, caseSchema.input.forbidden_keys, 'target_input')) {
    errors.push(error(found.path, 'forbidden_metadata', { key: found.key }));
  }
  for (const found of scanForSecrets(record)) {
    const mapped = found.path.startsWith('target_input') ? found.path : found.path;
    errors.push(error(mapped, 'forbidden_metadata', { key: found.key }));
  }
  return errors;
}

function writeExclusive(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
  return file;
}

function writeRun(directory, snapshot) {
  if (!snapshot || !snapshot.run_id) throw new Error('A run snapshot requires a run_id.');
  fs.mkdirSync(directory, { recursive: true });
  const runPath = path.join(directory, snapshot.run_id);
  if (fs.existsSync(runPath)) {
    const existing = path.join(runPath, 'snapshot.json');
    if (fs.existsSync(existing) && JSON.stringify(JSON.parse(fs.readFileSync(existing, 'utf8'))) === JSON.stringify(snapshot)) {
      // Identical snapshot: resuming the same declared run is not an overwrite.
      return runPath;
    }
    throw new Error(`Run directory already exists and is immutable: ${runPath} (refusing to overwrite the recorded snapshot)`);
  }
  fs.mkdirSync(runPath);
  writeExclusive(path.join(runPath, 'snapshot.json'), snapshot);
  return runPath;
}

function writeEvidence(runPath, record) {
  const errors = validateEvidenceRecord(record);
  if (errors.length) throw new Error(`Refusing to write invalid evidence for ${record && record.case_id}: ${errors.map(item => `${item.path}:${item.error}`).join(', ')}`);
  const identity = record.turn === null || record.turn === undefined ? `${record.repetition}` : `${record.repetition}-t${record.turn}`;
  return writeExclusive(path.join(runPath, `${record.case_id}-${identity}-${record.metric_id}.json`), record);
}

function summarizeRun(runPath) {
  const names = fs.readdirSync(runPath).filter(name => name.endsWith('.json') && name !== 'snapshot.json');
  const records = names.map(name => JSON.parse(fs.readFileSync(path.join(runPath, name), 'utf8')));
  const errored = records.filter(record => record.status === 'error' || record.status === 'missing');
  return {
    run_id: path.basename(runPath),
    records: names,
    count: records.length,
    errored: errored.length,
    complete: errored.length === 0 && records.length > 0,
    verdict: errored.length === 0 && records.length > 0 ? 'complete' : 'incomplete',
    failures: errored.map(record => ({ case_id: record.case_id, metric_id: record.metric_id, status: record.status, reason: record.reason || null }))
  };
}

module.exports = { writeRun, writeEvidence, writeExclusive, validateEvidenceRecord, scanForSecrets, summarizeRun, REQUIRED_EVIDENCE_FIELDS, ALLOWED_STATUSES };

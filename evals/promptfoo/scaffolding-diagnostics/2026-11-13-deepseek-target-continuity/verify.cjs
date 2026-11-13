#!/usr/bin/env node
// Purpose: verify saved request identity, real continuation history, source snapshots, and artifact hashes without model calls.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const frozen = read('raw/frozen.json'), manifest = read('evidence-manifest.json');
const names = fs.readdirSync(path.join(__dirname, 'raw')).filter(n => /^(fixed|journey)-/.test(n));
assert.equal(names.length, 12);
let tokens = 0;
for (const n of names) {
  const r = read('raw/' + n);
  assert.equal(r.http_status, 200); assert.equal(r.payload.model, 'deepseek-flash');
  assert.equal(r.payload.choices[0].finish_reason, 'stop'); assert.equal(r.error, undefined);
  assert.equal(r.frozen_sha256, hash(fs.readFileSync(path.join(__dirname, 'raw/frozen.json'))));
  tokens += r.payload.usage.total_tokens;
  if (n.startsWith('fixed') || n.endsWith('t1.json')) assert.deepEqual(r.request.messages, frozen.messages);
}
for (let r = 1; r <= 3; r++) for (let t = 2; t <= 3; t++) {
  const curr = read(`raw/journey-r${r}-t${t}.json`), prev = read(`raw/journey-r${r}-t${t-1}.json`);
  const message = t === 2 ? 'Yes' : 'Okay';
  assert.equal(curr.input.conversation_history, prev.input.conversation_history + '\nTutor/AI: Tutor (Tutor): ' + prev.parsed.response + '\nParticipant: Student (Learner): ' + message);
  assert.equal(curr.input.student_message, message);
  assert.equal(curr.input.prior_guard_mode, prev.parsed.decision.guard_mode);
}
for (const s of frozen.sources) {
  assert.equal(hash(s.content), s.sha256);
  assert.equal(hash(fs.readFileSync(path.join(root, s.path))), s.sha256);
}
for (const f of manifest.files) assert.equal(hash(fs.readFileSync(path.join(__dirname, f.path))), f.sha256);
assert.equal(hash(JSON.stringify(manifest.files)), manifest.manifest_sha256);
console.log(JSON.stringify({ expected: 12, complete: 12, http_200: 12, returned_model: 'deepseek-flash', finish_stop: 12, total_tokens: tokens, identical_start_requests: 6, trajectory_history_checks: 6, source_hashes_verified: frozen.sources.length, raw_files_verified: manifest.file_count, source_commit: frozen.source_commit }));

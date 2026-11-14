#!/usr/bin/env node
// Purpose: produce compact diagnostic counts and a hash manifest without tracking raw model conversations.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const raw = path.join(__dirname, 'raw');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const summaries = fs.readdirSync(raw).filter(f => /^summary-\d+\.json$/.test(f)).sort();
assert(summaries.length, 'No completed summary');
const source = summaries.at(-1), data = read(path.join(raw, source));
assert.equal(data.rows.length, 72);
assert(data.rows.every(r => Object.values(r.metrics).every(v => ['pass', 'fail', 'error'].includes(v))), 'Missing judgment slot');
const lengthAndRepeat = Object.fromEntries(['baseline', 'full_history'].map(arm => {
  const rows = data.rows.filter(r => r.arm === arm), sizes = rows.map(r => r.reason.split(/\s+/).filter(Boolean).length);
  return [arm, { reason_words_mean: sizes.reduce((a, b) => a + b, 0) / sizes.length, reason_words_max: Math.max(...sizes), reason_over_40: sizes.filter(x => x > 40).length,
    verbatim_followup_repeats: rows.filter(r => r.turn === 2 && r.response === rows.find(p => p.turn === 1 && p.rep === r.rep && p.case_id === r.case_id).response).map(r => r.id) }];
}));
const jointPairs = Object.fromEntries(['baseline', 'full_history'].map(arm => [arm, Object.fromEntries([1, 2].map(turn => {
  const rows = data.rows.filter(r => r.arm === arm && r.turn === turn);
  const pairs = [['contextual_progression', 'unfinished_prerequisite'], ['contextual_progression', 'component_disclosure']];
  return [turn, Object.fromEntries(pairs.map(([a, b]) => [a + '__' + b, { both_pass: rows.filter(r => r.metrics[a] === 'pass' && r.metrics[b] === 'pass').length, only_first: rows.filter(r => r.metrics[a] === 'pass' && r.metrics[b] === 'fail').length, only_second: rows.filter(r => r.metrics[a] === 'fail' && r.metrics[b] === 'pass').length, both_fail: rows.filter(r => r.metrics[a] === 'fail' && r.metrics[b] === 'fail').length, unevaluable: rows.filter(r => [r.metrics[a], r.metrics[b]].some(v => !['pass', 'fail'].includes(v))).length, expected: rows.length }]))];
}))]));
const records = fs.readdirSync(raw, { recursive: true }).filter(p => fs.statSync(path.join(raw, p)).isFile()).sort().map(p => ({ path: 'raw/' + p, bytes: fs.statSync(path.join(raw, p)).size, sha256: sha(fs.readFileSync(path.join(raw, p))) }));
const payload = { intent: 'Compact machine results; independent interpretation is recorded separately.', fingerprint: data.fingerprint, summary_source: 'raw/' + source, summary_sha256: sha(fs.readFileSync(path.join(raw, source))), overall: data.overall, by_turn: data.by_turn, by_case: data.by_case, transitions: data.transitions, length_and_repetition: lengthAndRepeat, joint_pairs: jointPairs };
fs.writeFileSync(path.join(__dirname, 'final-summary.json'), JSON.stringify(payload, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(__dirname, 'evidence-manifest.json'), JSON.stringify({ intent: 'Retain locally saved immutable raw evidence by hash.', fingerprint: data.fingerprint, directory: raw, files: records.length, bytes: records.reduce((n, r) => n + r.bytes, 0), manifest_sha256: sha(JSON.stringify(records)), records }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ overall: data.overall, by_turn: data.by_turn, length_and_repetition: lengthAndRepeat, evidence: { files: records.length, bytes: records.reduce((n, r) => n + r.bytes, 0), manifest_sha256: sha(JSON.stringify(records)) } }, null, 2));

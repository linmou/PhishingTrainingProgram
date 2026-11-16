#!/usr/bin/env node
// Purpose: revalidate every retained v3 calibration under the documented ancillary-evidence schema correction without additional model calls.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { snapshot, parseJudge, judgeMessages, sha } = require('./runner.cjs');
const raw = path.join(__dirname, 'raw'), s = snapshot(), results = [], started_at = new Date().toISOString();
const prior = JSON.parse(fs.readFileSync(path.join(raw, 'frozen-v3.json')));
assert.deepEqual(s.calibration, prior.calibration); assert.deepEqual(s.judge_system, prior.judge_system); assert.deepEqual(s.judge_steps, prior.judge_steps); assert.deepEqual(s.settings, prior.settings);
fs.mkdirSync(path.join(raw, 'calibration-v4'), { recursive: true });
for (const ex of s.calibration) {
  const source = path.join(raw, 'calibration-v3', ex.id + '.json'), saved = JSON.parse(fs.readFileSync(source));
  assert.deepEqual(saved.messages, judgeMessages(s, ex.case, ex.output, ex.metric), 'Judge request changed');
  const parsed = saved.attempts.map(parseJudge), index = parsed.findIndex(p => !p.error), selected = index >= 0 ? parsed[index] : parsed.at(-1);
  const record = { ...saved, ...selected, error: selected.error || null, source: path.relative(__dirname, source), source_sha256: sha(fs.readFileSync(source)), selected_attempt: index >= 0 ? index + 1 : saved.attempts.length, selection_rule: 'First structurally usable attempt under corrected schema, independent of expected label.', all_attempt_verdicts: parsed.map(p => p.error ? { error: p.error } : { pass: p.result.pass }) };
  fs.writeFileSync(path.join(raw, 'calibration-v4', ex.id + '.json'), JSON.stringify(record, null, 2) + '\n', { flag: 'wx' });
  const row = { id: ex.id, metric: ex.metric, expected: ex.expected, actual: selected.result?.pass, error: selected.error, agreed: !selected.error && selected.result.pass === ex.expected, selected_attempt: record.selected_attempt };
  results.push(row); console.log('REPARSED_CALIBRATION', results.length + '/' + s.calibration.length, JSON.stringify(row));
}
const summary = { fingerprint: s.fingerprint, protocol_source_fingerprint: prior.fingerprint, started_at, completed_at: new Date().toISOString(), new_model_calls: 0, correction: 'Ancillary attribution evidence accepts nonempty string or nonempty object/list of nonempty strings. Decisive reason/evidence/pass unchanged. Original representations retained.', total: results.length, agreed: results.filter(r => r.agreed).length, errors: results.filter(r => r.error).length, passed: results.every(r => r.agreed), results };
fs.writeFileSync(path.join(raw, 'calibration-summary-' + Date.now() + '.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log('CALIBRATION_SUMMARY', JSON.stringify(summary)); if (!summary.passed) process.exitCode = 1;

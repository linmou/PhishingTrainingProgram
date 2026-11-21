#!/usr/bin/env node
// Purpose: pin complete per-metric calibration provenance and verify exact request/settings parity for the bounded mixed-judge comparison.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { snapshot, judgeMessages, judgeSettings, sha } = require('./runner.cjs');
const raw = path.join(__dirname, 'raw'), s = snapshot(), results = [], started_at = new Date().toISOString();
for (const ex of s.calibration) {
  const version = ex.source_target ? 'v9' : 'v5';
  const file = path.join(raw, 'calibration-' + version, ex.id + '.json'), record = JSON.parse(fs.readFileSync(file));
  assert.deepEqual(record.messages, judgeMessages(s, ex.case, ex.output, ex.metric), 'Calibration request messages changed');
  const selected = record.selected_attempt || record.attempts.length, request = record.attempts[selected - 1].request, cfg = judgeSettings(ex.metric);
  assert.equal(request.model, s.settings.model); assert.equal(request.enable_thinking, cfg.judge_enable_thinking); assert.equal(request.max_tokens, cfg.judge_max_tokens); assert.equal(request.temperature, s.settings.judge_temperature);
  const row = { id: ex.id, metric: ex.metric, expected: ex.expected, actual: record.result?.pass, agreed: !record.error && record.result.pass === ex.expected, error: record.error || null, source: path.relative(__dirname, file), source_sha256: sha(fs.readFileSync(file)), selected_attempt: selected, settings: cfg };
  results.push(row); console.log('METRIC_CALIBRATION', results.length + '/' + s.calibration.length, JSON.stringify(row));
}
const summary = { fingerprint: s.fingerprint, started_at, completed_at: new Date().toISOString(), new_model_calls: 0, selection_rule: 'All32 original checks reuse v5 thinking; all7 independently annotated observed boundaries use v9 thinking. Same protocol/settings, no individual-case selection.', total: results.length, agreed: results.filter(r => r.agreed).length, errors: results.filter(r => r.error).length, passed: results.every(r => r.agreed), results };
fs.writeFileSync(path.join(raw, 'calibration-summary-' + Date.now() + '.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log('CALIBRATION_SUMMARY', JSON.stringify(summary)); if (!summary.passed) process.exitCode = 1;

#!/usr/bin/env node
// Purpose: reconcile frozen contextual-completion outputs, paired changes, metric interactions, and active execution time without model calls.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const raw = path.join(__dirname, 'raw');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const frozenFile = path.join(raw, 'frozen-v3.json'), s = read(frozenFile), copy = { ...s }; delete copy.fingerprint;
assert.equal(sha(JSON.stringify(copy)), s.fingerprint);
const arms = [...new Set(s.jobs.map(job => job.arm))], unavailable = value => ['error', 'missing'].includes(value);
const rows = s.jobs.map(job => {
  const targetFile = path.join(raw, 'targets', job.id + '.json'), target = fs.existsSync(targetFile) ? read(targetFile) : null;
  if (target) assert.deepEqual(target.messages, job.messages);
  return { id: job.id, arm: job.arm, case_id: job.case_id, repetition: job.repetition,
    target_status: !target ? 'missing' : target.error ? 'error' : 'valid', target_error: target?.error || null,
    target_source: target ? path.relative(__dirname, targetFile) : null, target_sha256: target ? sha(fs.readFileSync(targetFile)) : null,
    metrics: Object.fromEntries(s.metrics.map(metric => { const file = path.join(raw, s.judgment_directory, job.id + '__' + metric + '.json'), record = fs.existsSync(file) ? read(file) : null;
      return [metric, { status: !record ? 'missing' : record.error ? 'error' : record.result.pass ? 'pass' : 'fail', error: record?.error || null, source: record ? path.relative(__dirname, file) : null, sha256: record ? sha(fs.readFileSync(file)) : null }]; })) };
});
assert.equal(rows.length, 81); assert.equal(new Set(rows.map(row => row.id)).size, 81);
function summarize(selected) {
  const metrics = Object.fromEntries(s.metrics.map(metric => { const counts = { pass: 0, fail: 0, error: 0, missing: 0 }; for (const row of selected) counts[row.metrics[metric].status]++; return [metric, { expected: selected.length, ...counts, rate_planned: counts.pass / selected.length }]; }));
  const joint = { pass: 0, fail: 0, unevaluable: 0 };
  for (const row of selected) { const values = Object.values(row.metrics).map(m => m.status); joint[values.some(unavailable) ? 'unevaluable' : values.every(v => v === 'pass') ? 'pass' : 'fail']++; }
  const pairwise = {};
  for (const b of ['component_disclosure', 'unfinished_prerequisite']) {
    const value = { both_pass: 0, progression_only: 0, other_only: 0, both_fail: 0, unevaluable: 0, expected: selected.length };
    for (const row of selected) { const x = row.metrics.contextual_progression.status, y = row.metrics[b].status; value[unavailable(x) || unavailable(y) ? 'unevaluable' : x === 'pass' && y === 'pass' ? 'both_pass' : x === 'pass' ? 'progression_only' : y === 'pass' ? 'other_only' : 'both_fail']++; }
    pairwise['contextual_progression__' + b] = value;
  }
  return { expected: selected.length, valid_targets: selected.filter(r => r.target_status === 'valid').length, metrics, joint, pairwise };
}
const comparisons = [['baseline', 'candidate'], ['baseline', 'task_meaning'], ['candidate', 'task_meaning']];
const transitions = Object.fromEntries(comparisons.map(([base, next]) => [base + '__to__' + next, Object.fromEntries(s.metrics.map(metric => {
  const value = { expected: 27, both_pass: 0, baseline_only: 0, candidate_only: 0, both_fail: 0, unevaluable: 0, pass_to_fail: [], fail_to_pass: [] };
  for (const a of rows.filter(row => row.arm === base)) { const b = rows.find(row => row.arm === next && row.case_id === a.case_id && row.repetition === a.repetition); assert(b); const x = a.metrics[metric].status, y = b.metrics[metric].status;
    if (unavailable(x) || unavailable(y)) value.unevaluable++; else if (x === 'pass' && y === 'pass') value.both_pass++; else if (x === 'pass') { value.baseline_only++; value.pass_to_fail.push(b.id); } else if (y === 'pass') { value.candidate_only++; value.fail_to_pass.push(b.id); } else value.both_fail++;
  }
  return [metric, value];
}))]));
const pairs = s.pairs.map(pair => ({ id: pair.id, results: arms.flatMap(arm => [1, 2, 3].map(repetition => { const selected = rows.filter(r => r.arm === arm && r.repetition === repetition && pair.members.includes(r.case_id)); assert.equal(selected.length, pair.members.length); const result = summarize(selected); return { arm, repetition, members: selected.map(r => r.id), status: result.joint.unevaluable ? 'unevaluable' : result.joint.pass === selected.length ? 'pass' : 'fail' }; })) }));
const intervals = fs.readdirSync(path.join(raw, 'budget')).map(name => { const b = read(path.join(raw, 'budget', name)); return { source: 'raw/budget/' + name, start: Date.parse(b.started_at), end: Date.parse(b.started_at) + b.elapsed_ms }; }).sort((a, b) => a.start - b.start), merged = [];
for (const interval of intervals) { const last = merged.at(-1); if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end); else merged.push({ start: interval.start, end: interval.end }); }
const minutes = data => data.reduce((n, interval) => n + interval.end - interval.start, 0) / 60000;
const calibrationFiles = fs.readdirSync(raw).filter(name => name.startsWith('calibration-summary-')).sort();
const detail = { created_at: new Date().toISOString(), fingerprint: s.fingerprint, source_commit: s.source_commit, frozen_sha256: sha(fs.readFileSync(frozenFile)), summary_script_sha256: sha(fs.readFileSync(__filename)), command: process.argv, cwd: process.cwd(),
  coverage: { expected: rows.length, saved: rows.filter(r => r.target_source).length, valid: rows.filter(r => r.target_status === 'valid').length, judgments_expected: rows.length * s.metrics.length, judgments_saved: rows.flatMap(r => Object.values(r.metrics)).filter(m => m.source).length, judge_errors: rows.filter(r => r.target_status === 'valid').flatMap(r => Object.values(r.metrics)).filter(m => m.status === 'error').length },
  arms: Object.fromEntries(arms.map(arm => [arm, summarize(rows.filter(r => r.arm === arm))])),
  by_case: Object.fromEntries(s.cases.map(c => [c.id, Object.fromEntries(arms.map(arm => [arm, summarize(rows.filter(r => r.arm === arm && r.case_id === c.id))]))])), transitions, pairs,
  calibration: calibrationFiles.map(name => ({ source: 'raw/' + name, sha256: sha(fs.readFileSync(path.join(raw, name))), ...read(path.join(raw, name)) })),
  execution_time: { active_union_minutes: minutes(merged), process_sum_minutes: minutes(intervals), allowance_minutes: 15, intervals, merged_intervals: merged, idle_gaps_excluded: true }, rows };
const file = path.join(raw, 'final-summary-' + Date.now() + '.json'); save(file, detail);
const { rows: omitted, ...compact } = detail;
save(path.join(__dirname, 'final-summary.json'), { ...compact, detailed_evidence: { path: path.relative(__dirname, file), sha256: sha(fs.readFileSync(file)) } });
console.log(JSON.stringify({ detailed_summary: file, coverage: detail.coverage, arms: detail.arms, execution_time: detail.execution_time }, null, 2));

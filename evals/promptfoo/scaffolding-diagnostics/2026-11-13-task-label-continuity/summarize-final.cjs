#!/usr/bin/env node
// Purpose: summarize preserved tutor outputs and judgments, including matched comparisons, unavailable results and concurrent execution time.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { expected, sha } = require('./runner.cjs');
const { loadFrozen } = require('./frozen-evidence.cjs');
const raw = path.join(__dirname, 'raw'), startedAt = new Date().toISOString(), evidence = loadFrozen(), s = evidence.snapshot;
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const blockedBy = { journey_3__labels__r2__t4: 'journey_3__labels__r2__t3' };
const rows = expected(s).map(job => {
  const targetFile = path.join(raw, 'targets', job.id + '.json'), target = fs.existsSync(targetFile) ? read(targetFile) : null;
  const row = { id: job.id, arm: job.arm, case_id: job.case.id, repetition: job.repetition, trajectory: !!job.trajectory, component: job.case.reference.component, source_type: job.case.source_type, pair_id: job.case.pair_id || null,
    target_status: !target ? (blockedBy[job.id] ? 'blocked_by_prior_turn' : 'missing') : target.error ? (target.error === 'HTTP 400' ? 'provider_error' : 'format_or_transport_error') : 'valid',
    blocked_by: blockedBy[job.id] || null, target_error: target?.error || null, target_fingerprint: target?.fingerprint || null,
    target_source: target ? path.relative(__dirname, targetFile) : null, target_sha256: target ? sha(fs.readFileSync(targetFile)) : null, metrics: {} };
  for (const metric of s.metrics) {
    let file = path.join(raw, s.judgment_directory, job.id + '__' + metric + '.json');
    const original = fs.existsSync(file) ? read(file) : null, originalFile = file;
    const repairFile = path.join(raw, 'judge-repair-v1', job.id + '__' + metric + '.json'); let judgment = original;
    if (fs.existsSync(repairFile)) {
      judgment = read(repairFile); assert(original?.error && original.attempts && !target.error); assert.equal(judgment.repaired_from_sha256, sha(fs.readFileSync(file))); assert.deepEqual(judgment.messages, original.messages); assert.equal(judgment.target_output_sha256, original.target_output_sha256); file = repairFile;
    }
    row.metrics[metric] = { status: !judgment ? 'missing' : judgment.error ? 'error' : judgment.result.pass ? 'pass' : 'fail', error: judgment?.error || null,
      original_status: !original ? 'missing' : original.error ? 'error' : original.result.pass ? 'pass' : 'fail', original_error: original?.error || null, original_source: original ? path.relative(__dirname, originalFile) : null, repair_applied: file !== originalFile,
      source: judgment ? path.relative(__dirname, file) : null, sha256: judgment ? sha(fs.readFileSync(file)) : null, grading_fingerprint: judgment?.grading_fingerprint || null };
  }
  return row;
});
assert.equal(rows.length, 267); assert.equal(new Set(rows.map(r => r.id)).size, rows.length);
for (const row of rows) if (Object.values(row.metrics).some(m => m.status === 'missing')) assert.equal(row.target_status, 'blocked_by_prior_turn', 'Unexpected ungraded record: ' + row.id);
const statusCounts = items => items.reduce((acc, r) => { acc[r.target_status] = (acc[r.target_status] || 0) + 1; return acc; }, {});
function summarize(items) {
  const result = { expected: items.length, target_status: statusCounts(items), metrics: {}, all_three: { pass: 0, fail: 0, unevaluable: 0 }, pairwise: {} };
  for (const metric of s.metrics) {
    const count = { expected: items.length, pass: 0, fail: 0, error: 0, missing: 0 };
    for (const row of items) count[row.metrics[metric].status]++;
    result.metrics[metric] = { ...count, pass_rate_planned: count.pass / count.expected, pass_rate_evaluable: count.pass / (count.pass + count.fail) };
  }
  for (const row of items) {
    const statuses = Object.values(row.metrics).map(m => m.status);
    result.all_three[statuses.some(v => ['error', 'missing'].includes(v)) ? 'unevaluable' : statuses.every(v => v === 'pass') ? 'pass' : 'fail']++;
  }
  for (const [a, b] of [['recognition_before_action', 'responsive_progression'], ['responsive_progression', 'component_disclosure']]) {
    const count = { both_pass: 0, first_pass_second_fail: 0, first_fail_second_pass: 0, both_fail: 0, unevaluable: 0 };
    for (const row of items) {
      const x = row.metrics[a].status, y = row.metrics[b].status;
      count[['error', 'missing'].includes(x) || ['error', 'missing'].includes(y) ? 'unevaluable' : x === 'pass' && y === 'pass' ? 'both_pass' : x === 'pass' ? 'first_pass_second_fail' : y === 'pass' ? 'first_fail_second_pass' : 'both_fail']++;
    }
    result.pairwise[a + '__' + b] = count;
  }
  return result;
}
function transitions(baseArm, candidateArm) {
  const before = rows.filter(r => r.arm === baseArm && !r.trajectory), after = rows.filter(r => r.arm === candidateArm && !r.trajectory), result = {};
  for (const metric of s.metrics) {
    const count = { expected: before.length, both_pass: 0, baseline_only: 0, candidate_only: 0, both_fail: 0, unevaluable: 0, pass_to_fail: [], fail_to_pass: [] };
    for (const a of before) {
      const b = after.find(r => r.case_id === a.case_id && r.repetition === a.repetition); assert(b);
      const x = a.metrics[metric].status, y = b.metrics[metric].status;
      if (['error', 'missing'].includes(x) || ['error', 'missing'].includes(y)) count.unevaluable++;
      else if (x === 'pass' && y === 'pass') count.both_pass++;
      else if (x === 'pass') { count.baseline_only++; count.pass_to_fail.push(b.id); }
      else if (y === 'pass') { count.candidate_only++; count.fail_to_pass.push(b.id); }
      else count.both_fail++;
    }
    result[metric] = count;
  }
  return result;
}
const arms = ['production', ...s.arms];
function partitionRows(inputRows) {
const partitions = {};
for (const arm of arms) {
  const selected = inputRows.filter(r => r.arm === arm); assert.equal(selected.length, arm === 'production' ? 27 : 60); partitions[arm] = {};
  for (const partition of s.partitions) {
    const items = selected.filter(r => partition === 'all' || partition === (r.trajectory ? 'trajectory' : 'fixed') || partition === r.component || partition === r.source_type);
    if (items.length) partitions[arm][partition] = summarize(items);
  }
}
return partitions;
}
const partitions = partitionRows(rows), originalPartitions = partitionRows(rows.map(row => ({ ...row, metrics: Object.fromEntries(Object.entries(row.metrics).map(([metric, result]) => [metric, { ...result, status: result.original_status }])) })));
const productionKeys = new Set(rows.filter(r => r.arm === 'production').map(r => r.case_id + '__' + r.repetition));
const matchedHistorical = Object.fromEntries(arms.map(arm => [arm, summarize(rows.filter(r => r.arm === arm && !r.trajectory && productionKeys.has(r.case_id + '__' + r.repetition)))]));
for (const value of Object.values(matchedHistorical)) assert.equal(value.expected, 27);
const completionPairs = Object.fromEntries(s.arms.map(arm => [arm, [1, 2, 3].map(repetition => {
  const members = rows.filter(r => r.arm === arm && r.repetition === repetition && r.pair_id === 'room_completion_boundary'); assert.equal(members.length, 2);
  const results = summarize(members); return { repetition, members: members.map(r => r.id), status: results.all_three.unevaluable ? 'unevaluable' : results.all_three.pass === 2 ? 'pass' : 'fail' };
})]));
const intervals = fs.readdirSync(path.join(raw, 'budget')).map(name => { const b = read(path.join(raw, 'budget', name)); return { source: 'raw/budget/' + name, start_ms: Date.parse(b.started_at), end_ms: Date.parse(b.started_at) + b.elapsed_ms }; }).sort((a, b) => a.start_ms - b.start_ms), merged = [];
for (const interval of intervals) { const last = merged.at(-1); if (last && interval.start_ms <= last.end_ms) last.end_ms = Math.max(last.end_ms, interval.end_ms); else merged.push({ start_ms: interval.start_ms, end_ms: interval.end_ms }); }
const sumMinutes = data => data.reduce((n, i) => n + i.end_ms - i.start_ms, 0) / 60000;
const summary = { intent: 'Deterministic final machine-grade summary; independent semantic disagreements remain separate and do not overwrite raw judgments.', created_at: new Date().toISOString(), started_at: startedAt,
  command: process.argv, cwd: process.cwd(), script_sha256: sha(fs.readFileSync(__filename)), frozen_fingerprint: s.fingerprint, workspace_drift_after_execution: evidence.workspace_drift, coverage: { planned: rows.length, saved: rows.filter(r => r.target_source).length, valid: rows.filter(r => r.target_status === 'valid').length, target_status: statusCounts(rows), judgments: { planned: rows.length * s.metrics.length, saved: rows.reduce((n, r) => n + Object.values(r.metrics).filter(m => m.source).length, 0), valid_target_judge_errors: rows.filter(r => r.target_status === 'valid').flatMap(r => Object.values(r.metrics)).filter(m => m.status === 'error').length, original_valid_target_judge_errors: rows.filter(r => r.target_status === 'valid').flatMap(r => Object.values(r.metrics)).filter(m => m.original_status === 'error').length, repaired_entries: rows.flatMap(r => Object.values(r.metrics)).filter(m => m.repair_applied).length, propagated_target_errors: rows.filter(r => r.target_error).flatMap(r => Object.values(r.metrics)).filter(m => m.status === 'error').length, missing: rows.flatMap(r => Object.values(r.metrics)).filter(m => m.status === 'missing').length } },
  partitions, original_partitions_before_transport_repair: originalPartitions, fixed_transitions: Object.fromEntries([['current', 'labels'], ['current', 'sequence'], ['current', 'completion_cleanup'], ['sequence', 'completion_cleanup']].map(([a, b]) => [a + '__to__' + b, transitions(a, b)])), matched_historical_27: matchedHistorical, completion_pairs_machine: completionPairs,
  execution_time: { allowance_minutes: 60, active_union_minutes: sumMinutes(merged), process_sum_minutes: sumMinutes(intervals), accounting: 'Union of overlapping active intervals; process sum is retained to expose concurrency rather than count overlap as extra elapsed time.', intervals, merged_intervals: merged }, rows };
const file = path.join(raw, 'final-summary-' + Date.now() + '.json'); fs.writeFileSync(file, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
const calibrationFile = path.join(raw, fs.readdirSync(raw).filter(n => n.startsWith('calibration-summary-')).sort().at(-1)), calibration = read(calibrationFile);
const compact = { ...summary, detailed_evidence: { path: path.relative(__dirname, file), sha256: sha(fs.readFileSync(file)) }, calibration: { path: path.relative(__dirname, calibrationFile), sha256: sha(fs.readFileSync(calibrationFile)), total: calibration.total, agreed: calibration.agreed, errors: calibration.errors, reference_note: 'Original boundary calibration was6/7; independently versioned one-label correction reconciled7/7 with unchanged requests, plus32retained thinking calibration checks.' }, rows: undefined, original_partitions_before_transport_repair: { sequence: originalPartitions.sequence }, execution_time: { ...summary.execution_time, intervals: undefined, merged_intervals: undefined } };
fs.writeFileSync(path.join(__dirname, 'final-summary.json'), JSON.stringify(compact, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ summary_file: file, coverage: summary.coverage, all: Object.fromEntries(arms.map(a => [a, partitions[a].all])), execution_time: { active_union_minutes: summary.execution_time.active_union_minutes, process_sum_minutes: summary.execution_time.process_sum_minutes } }, null, 2));

#!/usr/bin/env node
// Purpose: join preserved outputs and rubric verdicts across conditions without changing any model judgment.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const objectHash = p => crypto.createHash('sha256').update(JSON.stringify(read(p))).digest('hex');
const original = path.join(__dirname, 'raw/comparison-v1');
const replay = path.join(__dirname, 'raw/comparison-measurement-v2');
const cleanup = path.join(__dirname, 'raw/cleanup-v1');
const fullCleanup = path.join(__dirname, 'raw/cleanup-full-v1');
const rubric = read(path.join(__dirname, 'rubrics.json'));
const primary = Object.keys(rubric.primary);
const secondary = Object.keys(rubric.secondary);
const arms = ['baseline', 'instruction', 'instruction_expression', 'cleanup', 'cleanup_full'];
function records(dir) {
  return fs.readdirSync(path.join(dir, 'targets')).filter(f => f.endsWith('.json')).map(f => read(path.join(dir, 'targets', f)));
}
function judgments(dir, id) {
  const p = path.join(dir, id + '.json');
  return fs.existsSync(p) ? read(p) : {error: 'missing judgment', results: {}};
}
const oldRecords = records(original);
const newRecords = records(cleanup);
const all = [...oldRecords, ...newRecords, ...records(fullCleanup)];
const integrity = oldRecords.map(r => {
  const oldPath = path.join(original, 'targets', r.id + '.json');
  const replayPath = path.join(replay, 'targets', r.id + '.json');
  return {id: r.id, source_sha256: hash(oldPath), replay_sha256: hash(replayPath), identical: hash(oldPath) === hash(replayPath)};
});
assert(integrity.every(r => r.identical), 'Rejudging changed target evidence');
function metricResult(r, metric) {
  const cleanupArm = r.arm === 'cleanup' || r.arm === 'cleanup_full';
  const dir = cleanupArm ? r.arm === 'cleanup' ? cleanup : fullCleanup : primary.includes(metric) ? replay : original;
  let j = judgments(path.join(dir, primary.includes(metric) ? 'primary' : 'secondary'), r.id);
  const repairPath = path.join(__dirname, 'raw/secondary-repairs', r.id + '.json');
  if (secondary.includes(metric) && !cleanupArm && j.error && fs.existsSync(repairPath)) {
    const repaired = read(repairPath);
    assert.equal(repaired.source_sha256, objectHash(path.join(original, 'secondary', r.id + '.json')));
    j = repaired;
  }
  const localRepair = path.join(dir, primary.includes(metric) ? 'primary-repairs' : 'secondary-repairs', r.id + '.json');
  if (j.error && fs.existsSync(localRepair)) {
    const repaired = read(localRepair);
    assert.equal(repaired.source_sha256, objectHash(path.join(dir, primary.includes(metric) ? 'primary' : 'secondary', r.id + '.json')));
    j = repaired;
  }
  const v = j.results?.[metric];
  if (r.error || j.error || !v) return {status: 'error', reason: r.error || j.error || 'missing metric'};
  return {...v, status: v.applicable ? v.pass ? 'pass' : 'fail' : 'inapplicable'};
}
const slices = {all: () => true, fixed: r => !r.trajectory, trajectory: r => Boolean(r.trajectory)};
const metrics = {};
for (const metric of [...primary, ...secondary]) {
  metrics[metric] = {};
  for (const arm of arms) {
    metrics[metric][arm] = {};
    for (const [slice, applies] of Object.entries(slices)) {
      const rs = all.filter(r => r.arm === arm && applies(r));
      const s = {expected: slice === 'all' ? 105 : slice === 'fixed' ? 81 : 24, generated: rs.length, pass: 0, fail: 0, inapplicable: 0, error: 0, failures: []};
      for (const r of rs) {
        const v = metricResult(r, metric); s[v.status]++;
        if (v.status === 'fail' || v.status === 'error') s.failures.push({id: r.id, reason: v.reason, evidence: v.evidence});
      }
      s.missing = s.expected - s.generated;
      metrics[metric][arm][slice] = s;
    }
  }
}
const key = r => r.case.id + '|r' + r.repetition + '|t' + (r.turn || 0);
const comparisons = {};
for (const arm of arms.slice(1)) {
  comparisons[arm] = {};
  for (const metric of [...primary, ...secondary]) {
    comparisons[arm][metric] = {};
    for (const [slice, applies] of Object.entries(slices)) {
      const rs = all.filter(r => r.arm === 'baseline' && applies(r));
      const candidates = new Map(all.filter(r => r.arm === arm).map(r => [key(r), r]));
      const c = {both_pass: 0, pass_to_fail: [], fail_to_pass: [], both_fail: 0, both_inapplicable: 0, inapplicability_change: [], unevaluable: []};
      for (const b of rs) {
        const a = candidates.get(key(b));
        const bv = metricResult(b, metric), av = a ? metricResult(a, metric) : {status: 'error'};
        if (bv.status === 'error' || av.status === 'error') c.unevaluable.push(key(b));
        else if (bv.status === 'inapplicable' && av.status === 'inapplicable') c.both_inapplicable++;
        else if (bv.status === 'inapplicable' || av.status === 'inapplicable') c.inapplicability_change.push({key: key(b), baseline: bv.status, candidate: av.status});
        else if (bv.pass && av.pass) c.both_pass++;
        else if (bv.pass) c.pass_to_fail.push(a.id);
        else if (av.pass) c.fail_to_pass.push(a.id);
        else c.both_fail++;
      }
      comparisons[arm][metric][slice] = c;
    }
  }
}
const joints = {};
for (const arm of arms) {
  joints[arm] = {};
  for (const [slice, applies] of Object.entries(slices)) {
    const counts = {total: 0, all_pass: 0, unevaluable: 0, combinations: {}};
    for (const r of all.filter(r => r.arm === arm && applies(r))) {
      counts.total++;
      const values = primary.map(m => metricResult(r, m));
      if (values.some(v => v.status === 'error')) counts.unevaluable++;
      else {
        const failed = primary.filter((m, i) => !values[i].pass).join('+') || 'all_pass';
        counts.combinations[failed] = (counts.combinations[failed] || 0) + 1;
        if (failed === 'all_pass') counts.all_pass++;
      }
    }
    joints[arm][slice] = counts;
  }
}
const result = {created_at: new Date().toISOString(),metric_order: [...primary, ...secondary],arms,metrics,comparisons,joints,target_replay_integrity: {count: integrity.length,all_identical: true,records: integrity},limitations: ['Primary metrics use the single repaired rubric version; secondary metrics retain their original rubric.', 'Trajectory histories differ by generated tutor replies and are reported separately from matched fixed histories.', 'Scores are automated judgments with independently documented residual errors; no full-suite acceptance or human learning-effect claim.']};
const output = path.join(__dirname, 'analysis.json');
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output,targets: all.length,replay_integrity: integrity.length,joints,metrics:Object.fromEntries(Object.entries(metrics).map(([m, a]) => [m,Object.fromEntries(Object.entries(a).map(([arm, s]) => [arm,{pass:s.all.pass,applicable:s.all.pass+s.all.fail,errors:s.all.error,missing:s.all.missing}]))]))}));

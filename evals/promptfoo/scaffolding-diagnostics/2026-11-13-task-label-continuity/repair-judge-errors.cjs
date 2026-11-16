#!/usr/bin/env node
// Purpose: execute one authorized repair round for transient judge errors without resampling targets or valid judgments.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { loadFrozen, sha } = require('./frozen-evidence.cjs');
const { parseJudge, judgeSettings } = require('./runner.cjs');
const provider = require('../../v1/runner');
const root = path.resolve(__dirname, '../../../..'), raw = path.join(__dirname, 'raw'), evidence = loadFrozen(), s = evidence.snapshot;
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const save = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' }); };
async function main() {
  const envFile = '/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env', env = require(path.join(root, 'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(envFile));
  assert.equal(env.OAI_BASE_URL.replace(/\/+$/, ''), s.settings.endpoint); assert(env.OAI_API_KEY);
  process.env.OAI_BASE_URL = env.OAI_BASE_URL; process.env.OAI_API_KEY = env.OAI_API_KEY;
  const jobs = fs.readdirSync(path.join(raw, s.judgment_directory)).flatMap(name => {
    const source = path.join(raw, s.judgment_directory, name), old = read(source);
    if (!old.error || !old.attempts) return [];
    assert.equal(old.error, 'The operation was aborted due to timeout', 'Unreviewed judge error requires separate disposition');
    const target = read(path.join(raw, 'targets', old.target_id + '.json')); assert(!target.error);
    const metric = name.split('__').at(-1).replace('.json', ''), request = old.attempts[0].request;
    assert.deepEqual(request.messages, old.messages); assert.equal(request.model, s.settings.model); assert.equal(request.temperature, s.settings.judge_temperature); assert.equal(request.max_tokens, 8000); assert.equal(request.enable_thinking, true);
    return [{ name, source, old, metric }];
  });
  const started = Date.now(), budgetFile = path.join(raw, 'budget', started + '.json'), outcomes = [];
  const updateBudget = () => fs.writeFileSync(budgetFile, JSON.stringify({ started_at: new Date(started).toISOString(), elapsed_ms: Date.now() - started, prior_elapsed_ms: null, accounting: 'Concurrent interval union is the allowance; this repair segment is recorded independently.' }) + '\n');
  const remaining = () => {
    updateBudget(); const intervals = fs.readdirSync(path.join(raw, 'budget')).map(n => { const b = read(path.join(raw, 'budget', n)); return [Date.parse(b.started_at), Date.parse(b.started_at) + b.elapsed_ms]; }).sort((a, b) => a[0] - b[0]), merged = [];
    for (const i of intervals) { const last = merged.at(-1); if (last && i[0] <= last[1]) last[1] = Math.max(last[1], i[1]); else merged.push([...i]); }
    return 3600000 - merged.reduce((n, i) => n + i[1] - i[0], 0);
  };
  console.log('REPAIR_START', JSON.stringify({ errors: jobs.map(j => j.name), settings: { thinking: true, max_tokens: 8000, timeout_ms: 180000 }, round: 1 }));
  await Promise.all(jobs.map(async job => {
    const file = path.join(raw, 'judge-repair-v1', job.name); assert(!fs.existsSync(file), 'Repair round already exists');
    const attempts = []; let parsed;
    for (let i = 0; i < s.settings.judge_format_attempts; i++) {
      assert(remaining() >= s.settings.judge_timeout_ms * s.settings.transport_attempts + s.settings.transport_retry_delay_ms, 'Insufficient union allowance for full unchanged transport policy');
      const response = await provider.call(job.old.messages, 'judge', { ...s.settings, ...judgeSettings(), timeout_ms: s.settings.judge_timeout_ms }); updateBudget(); attempts.push(response);
      assert.deepEqual(response.request, job.old.attempts[0].request, 'Repair model request changed'); parsed = parseJudge(response); if (!parsed.error || response.error) break;
    }
    const result = { ...job.old, attempts, result: undefined, error: undefined, ...parsed, repaired_from: path.relative(__dirname, job.source), repaired_from_sha256: sha(fs.readFileSync(job.source)), repair_round: 1, repair_authorization: 'Root-authorized bounded transient-judge repair, identical request/settings; valid grades and targets are not resampled.', repair_script_sha256: sha(fs.readFileSync(__filename)), repair_frozen_fingerprint: s.fingerprint };
    save(file, result); const row = { file: path.relative(__dirname, file), target_id: job.old.target_id, metric: job.metric, error: result.error || null, pass: result.result?.pass }; outcomes.push(row); console.log('REPAIR_RESULT', JSON.stringify(row));
  }));
  updateBudget(); const report = { started_at: new Date(started).toISOString(), completed_at: new Date().toISOString(), command: process.argv, cwd: process.cwd(), environment_reference: envFile, frozen_fingerprint: s.fingerprint, workspace_drift: evidence.workspace_drift, outcomes, remaining_union_ms: remaining() };
  save(path.join(raw, 'judge-repair-summary-' + Date.now() + '.json'), report); console.log('REPAIR_SUMMARY', JSON.stringify(report));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });

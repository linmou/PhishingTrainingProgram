#!/usr/bin/env node
// Purpose: compare frozen rubric boundaries while reusing exact requests and preserving every calibration verdict.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { call, checkedResult, judgeMessages, rubricsFor, sha } = require('./runner');
const root = path.resolve(__dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

function requestFor(messages, settings) {
  return { model: settings.model, messages, temperature: settings.judge_temperature,
    max_tokens: settings.judge_max_tokens, enable_thinking: Boolean(settings.judge_enable_thinking), response_format: { type: 'json_object' } };
}
function grade(raw, fixture) {
  let value;
  try { value = JSON.parse(raw.text)?.[fixture.metric]; } catch { value = null; }
  const result = checkedResult(fixture.metric, value);
  const agrees = !raw.error && Object.entries(fixture.expected).every(([key, expected]) => result[key] === expected);
  return { result, agrees };
}
function assemble(proposal) {
  const prior = proposal.regression_fixtures.map(ref => {
    const text = fs.readFileSync(path.join(root, ref.source), 'utf8');
    if (sha(text) !== ref.source_sha256) throw new Error('Prior calibration source changed: ' + ref.source);
    const row = JSON.parse(text);
    const expectedPass = row.fixture?.expected ? row.fixture.expected.pass : row.fixture ? row.fixture.expected_realization : row.example.expected;
    if (expectedPass !== ref.expected.pass || (row.example?.accuracy !== undefined && row.example.accuracy !== ref.expected.accuracy_pass)) throw new Error('Prior calibration label changed');
    return { id: ref.id, metric: ref.metric, expected: ref.expected, input: row.input, output: row.output,
      source: ref.source, source_sha256: ref.source_sha256, prior_raw: row.raw };
  });
  const added = proposal.fixtures.map(f => ({ ...f, expected: { status: f.expected_pass ? 'pass' : 'fail', pass: f.expected_pass,
    ...(f.expected_accuracy_pass === undefined ? {} : { accuracy_pass: f.expected_accuracy_pass }) } }));
  const fixtures = [...prior, ...added];
  if (new Set(fixtures.map(f => f.id)).size !== fixtures.length || fixtures.length !== proposal.totals.total_per_condition) throw new Error('Incomplete or duplicate calibration fixtures');
  return fixtures;
}
async function main() {
  const [proposalFile, settingsFile, directory, ...args] = process.argv.slice(2);
  if (!directory) throw new Error('Supply proposal, settings, directory [--num_workers N] [--prepare]');
  const workers = Number(args.includes('--num_workers') ? args[args.indexOf('--num_workers') + 1] : 16);
  if (!Number.isInteger(workers) || workers < 1) throw new Error('Invalid num_workers');
  const proposalText = fs.readFileSync(proposalFile, 'utf8'), proposal = JSON.parse(proposalText);
  const settings = read(settingsFile), fixtures = assemble(proposal);
  const dotenv = require(path.join(root, 'tutor-system/node_modules/dotenv'));
  const envFile = path.join(root, 'tutor-system/.env');
  const env = { ...(fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {}), ...process.env };
  if (!env.OAI_BASE_URL) throw new Error('Missing configured endpoint');
  const endpoint = env.OAI_BASE_URL.replace(/\/+$/, '');
  const metrics = [...new Set(fixtures.map(f => f.metric))];
  const original = rubricsFor({ expected: { checks: metrics }, legacy: [] });
  for (const metric of metrics) if (!original[metric]) throw new Error('Missing rubric ' + metric);
  for (const [metric, pin] of Object.entries(proposal.current_rubric_identities)) {
    if (sha(original[metric]) !== (typeof pin === 'string' ? pin : pin.sha256)) throw new Error('Pinned rubric changed: ' + metric);
  }
  const rubrics = { current: original, clarified: Object.fromEntries(metrics.map(metric => [metric, proposal.replacements?.[metric] ?? (original[metric] +
    (proposal.clarifications[metric] ? '\n\nAdditional boundary clarification:\n' + proposal.clarifications[metric] : ''))])) };
  const dependencies = ['runner.js', 'evaluator.js', '../rubrics/v1/manifest.json'].map(file => ({ file, content: fs.readFileSync(path.join(__dirname, file), 'utf8') }));
  const jobs = Object.keys(rubrics).flatMap(condition => fixtures.map((fixture, index) => {
    const messages = judgeMessages(fixture.input, fixture.output, { [fixture.metric]: rubrics[condition][fixture.metric] });
    const request = requestFor(messages, settings);
    return { condition, index, fixture, messages, request, request_sha256: sha(request) };
  }));
  const cache = new Map();
  const priorSources = new Map();
  for (const fixture of fixtures) if (fixture.prior_raw?.request && fixture.prior_raw.endpoint === endpoint) {
    const key = sha(fixture.prior_raw.request);
    if (!cache.has(key)) {
      const provenance = { source: fixture.source, source_sha256: fixture.source_sha256 };
      cache.set(key, Promise.resolve({ raw: fixture.prior_raw, provenance }));
      priorSources.set(key, provenance);
    }
  }
  const canonical = new Map();
  const jobManifest = jobs.map(job => {
    const key = job.request_sha256, id = job.condition + '-' + job.index;
    const prior = priorSources.get(key), alias = canonical.get(key);
    if (!canonical.has(key)) canonical.set(key, id);
    return { id, fixture_id: job.fixture.id, request_sha256: key, endpoint, request: job.request,
      source: prior || (alias ? { job: alias } : null), new_call: !prior && !alias };
  });
  const identity = { proposal: JSON.parse(proposalText), proposal_sha256: sha(proposalText), settings, endpoint, fixtures, rubrics, dependencies,
    jobs: jobManifest, source: fs.readFileSync(__filename, 'utf8'), num_workers: workers };
  const fingerprint = sha(identity);
  fs.mkdirSync(directory, { recursive: true });
  const snapshotFile = path.join(directory, 'snapshot.json');
  if (fs.existsSync(snapshotFile)) {
    if (read(snapshotFile).fingerprint !== fingerprint) throw new Error('Resume fingerprint mismatch');
  } else write(snapshotFile, { fingerprint, command: process.argv, started_at: new Date().toISOString(), ...identity });
  console.log(JSON.stringify({ fixtures: fixtures.length, jobs: jobs.length, unique_requests: new Set(jobs.map(j => j.request_sha256)).size,
    reusable_jobs: jobs.filter(j => cache.has(j.request_sha256)).length, num_workers: workers, fingerprint }));
  if (args.includes('--prepare')) return;
  const fileFor = job => path.join(directory, job.condition + '-' + job.index + '.json');
  function load(job) {
    const row = read(fileFor(job));
    if (row.fingerprint !== fingerprint || row.condition !== job.condition || row.index !== job.index || row.raw.endpoint !== endpoint || sha(row.raw.request) !== job.request_sha256 || sha(row.fixture) !== sha(job.fixture)) throw new Error('Cached calibration identity mismatch');
    return { ...row, ...grade(row.raw, job.fixture) };
  }
  for (const job of jobs) if (fs.existsSync(fileFor(job))) {
    const row = load(job);
    if (!cache.has(job.request_sha256)) cache.set(job.request_sha256, Promise.resolve({ raw: row.raw, provenance: { source: fileFor(job), source_sha256: sha(fs.readFileSync(fileFor(job), 'utf8')) } }));
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      if (fs.existsSync(fileFor(job))) continue;
      const reused = cache.has(job.request_sha256);
      if (!reused) cache.set(job.request_sha256, call(job.messages, 'judge', settings).then(raw => ({ raw, provenance: { source: fileFor(job) } })));
      const { raw, provenance } = await cache.get(job.request_sha256);
      if (raw.endpoint !== endpoint || sha(raw.request) !== job.request_sha256) throw new Error('Actual request mismatch');
      const result = grade(raw, job.fixture);
      write(fileFor(job), { fingerprint, condition: job.condition, index: job.index, fixture: job.fixture, input: job.fixture.input,
        output: job.fixture.output, raw, reused, reuse_source: reused ? provenance : null, ...result });
      console.log(`${job.condition} ${job.fixture.id} agrees=${result.agrees} reused=${reused}`);
    }
  }));
  const rows = jobs.map(load);
  const conditions = Object.fromEntries(Object.keys(rubrics).map(condition => {
    const selected = rows.filter(r => r.condition === condition);
    return [condition, { total: selected.length, agreed: selected.filter(r => r.agrees).length,
      metrics: Object.fromEntries(metrics.map(metric => {
        const group = selected.filter(r => r.fixture.metric === metric);
        return [metric, { total: group.length, agreed: group.filter(r => r.agrees).length,
          errors: group.filter(r => r.raw.error || ['missing', 'error'].includes(r.result.status)).length,
          false_positives: group.filter(r => r.fixture.expected.pass === false && r.result.pass === true).length,
          false_negatives: group.filter(r => r.fixture.expected.pass === true && r.result.status === 'fail').length }];
      })), disagreements: selected.filter(r => !r.agrees).map(r => ({ id: r.fixture.id, expected: r.fixture.expected, result: r.result })) }];
  }));
  const summary = { completed_at: new Date().toISOString(), fingerprint, conditions, new_calls: rows.filter(r => !r.reused).length,
    reused: rows.filter(r => r.reused).length, limitation: 'Calibration only; no target performance score is changed. Identical requests shared across conditions are not independent repetitions.' };
  if (!fs.existsSync(path.join(directory, 'summary.json'))) write(path.join(directory, 'summary.json'), summary);
  console.log(JSON.stringify(summary));
  if (conditions.clarified.agreed !== fixtures.length) process.exitCode = 1;
}
module.exports = { requestFor, grade, assemble };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

#!/usr/bin/env node
// Purpose: recover transport failures while reusing exact per-repetition requests and propagating recovered sequence state.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { hash, validateManifest, generations, report } = require('./current.cjs');
const { loadProduction, executeTarget, score } = require('./evaluate.cjs');
const root = path.resolve(__dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); };
const retryable = call => Boolean(call.error) || [429, 502, 503, 504].includes(call.status);
const sameRequest = (call, request, endpoint) => call && call.endpoint === endpoint && hash(call.request) === hash(request);
function environment() {
  const dotenv = require(path.join(root, 'tutor-system/node_modules/dotenv'));
  const env = { ...dotenv.parse(fs.readFileSync(path.join(root, 'tutor-system/.env'))), ...process.env };
  if (!env.OAI_API_KEY || !env.OAI_BASE_URL || env.OAI_MODEL !== 'qwen3.5-flash') throw new Error('Configured key, endpoint and matching model required');
  return { endpoint: env.OAI_BASE_URL.replace(/\/$/, ''), key: env.OAI_API_KEY };
}
async function freeze(dir, reference) {
  if (fs.existsSync(dir)) throw new Error('New directory required');
  const sourceFile = path.join(reference, 'frozen.json'), before = read(sourceFile);
  validateManifest(before);
  const rows = await generations(reference, before), { endpoint } = environment();
  if (rows.length !== before.expected_generations || before.settings.timeout_ms !== 600000 || before.settings.target_attempts !== 1 || before.recovery || fs.existsSync(path.join(reference, 'recovery-manifest.json'))) throw new Error('Complete original single-attempt600second condition required');
  if (rows.some(row => row.result.calls.length !== 1 || row.result.calls[0].endpoint !== endpoint)) throw new Error('Unexpected source transport protocol');
  const sourceRecords = rows.map(row => {
    const file = path.join(reference, 'generations', `${row.case_id}-r${row.repetition}.json`);
    return { case_id: row.case_id, repetition: row.repetition, file: path.relative(root, file), sha256: hash(fs.readFileSync(file, 'utf8')) };
  });
  const frozen = structuredClone(before), content = fs.readFileSync(__filename, 'utf8');
  Object.assign(frozen, { run_id: path.basename(dir), frozen_at: new Date().toISOString(), reference: path.relative(root, reference),
    comparison: 'Transport recovery, maximum3total attempts per request. Preserve completed answers regardless of score. Recompute sequence consumers; reuse corresponding successful calls only when request bytes match. Changed downstream requests are new evidence, not semantic retries.',
    recovery: { endpoint, original_frozen_file: path.relative(root, sourceFile), original_frozen_sha256: hash(fs.readFileSync(sourceFile, 'utf8')), source_records: sourceRecords, maximum_total_attempts: 3 } });
  frozen.artifacts.push({ path: path.relative(root, __filename), content, sha256: hash(content) });
  validateManifest(frozen); save(path.join(dir, 'frozen.json'), frozen);
  console.log(JSON.stringify({ dir, records: rows.length, transport_failures: rows.filter(r => !r.reused_from && retryable(r.result.calls[0])).length }));
}
async function run(dir, numWorkers) {
  if (!Number.isInteger(numWorkers) || numWorkers < 1 || numWorkers > 16) throw new Error('num_workers must be1–16');
  const frozen = read(path.join(dir, 'frozen.json')); validateManifest(frozen);
  const own = frozen.artifacts.find(a => a.path === path.relative(root, __filename));
  if (!own || own.sha256 !== hash(fs.readFileSync(__filename, 'utf8'))) throw new Error('Recovery runner changed');
  const recovery = frozen.recovery, { endpoint, key } = environment();
  if (endpoint !== recovery.endpoint || hash(fs.readFileSync(path.join(root, recovery.original_frozen_file), 'utf8')) !== recovery.original_frozen_sha256) throw new Error('Recovery source or endpoint changed');
  const originals = new Map();
  for (const source of recovery.source_records) {
    const content = fs.readFileSync(path.join(root, source.file), 'utf8');
    if (hash(content) !== source.sha256) throw new Error('Original generation changed');
    originals.set(source.case_id + '/' + source.repetition, JSON.parse(content));
  }
  const target = loadProduction(frozen.snapshot), frozenHash = hash(frozen);
  const existing = new Map((await generations(dir, frozen)).map(row => [row.case_id + '/' + row.repetition, row]));
  let complete = 0;
  async function execute(c, rep, state = null, alias = null) {
    const identity = c.id + '/' + rep, original = originals.get(identity), provenance = recovery.source_records.find(s => s.case_id === c.id && s.repetition === rep);
    const file = path.join(dir, 'generations', `${c.id}-r${rep}.json`), saved = existing.get(identity);
    let index = 0;
    const dispositions = [];
    const transport = async request => {
      const position = index++, prior = original.result.calls[position];
      if (alias) {
        const call = alias.result.calls[position];
        if (!sameRequest(call, request, endpoint)) throw new Error('Alias request differs');
        dispositions.push({ kind: 'alias', from: alias.generation_id }); return structuredClone(call);
      }
      const matches = sameRequest(prior, request, endpoint);
      if (matches && !retryable(prior)) { dispositions.push({ kind: 'retained', original_attempt: 1 }); return structuredClone(prior); }
      const first = matches ? 2 : 1;
      const attempts = [];
      for (let attempt = first; attempt <= recovery.maximum_total_attempts; attempt++) {
        const callFile = path.join(dir, 'calls', `${c.id}-r${rep}-c${position}-a${attempt}.json`);
        let call;
        if (fs.existsSync(callFile)) {
          const evidence = read(callFile);
          if (evidence.frozen_sha256 !== frozenHash || evidence.case_id !== c.id || evidence.repetition !== rep || evidence.position !== position || evidence.attempt !== attempt || !sameRequest(evidence.call, request, endpoint)) throw new Error('Saved retry identity changed');
          call = evidence.call;
        } else {
          if (saved) throw new Error('Saved generation lacks call evidence');
          const startFile = callFile.replace(/\.json$/, '.started.json');
          const started = { frozen_sha256: frozenHash, case_id: c.id, repetition: rep, position, attempt, request, endpoint };
          const interrupted = fs.existsSync(startFile);
          if (interrupted) {
            const priorStart = read(startFile);
            if (Object.keys(started).some(k => hash(priorStart[k]) !== hash(started[k]))) throw new Error('Saved attempt start changed');
          } else save(startFile, { ...started, started_at: new Date().toISOString() });
          const started_at = read(startFile).started_at;
          if (interrupted) call = { request, endpoint, started_at, ended_at: new Date().toISOString(), error: 'Interrupted attempt: provider outcome unknown', outcome_unknown: true };
          else try {
            const response = await fetch(endpoint + '/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key }, body: JSON.stringify(request), signal: AbortSignal.timeout(frozen.settings.timeout_ms) });
            const body = await response.text(); let payload; try { payload = JSON.parse(body); } catch { payload = { unparsed_body: body }; }
            call = { request, endpoint, started_at, ended_at: new Date().toISOString(), status: response.status, response: payload };
          } catch (error) { call = { request, endpoint, started_at, ended_at: new Date().toISOString(), error: error.message }; }
          save(callFile, { frozen_sha256: frozenHash, case_id: c.id, repetition: rep, position, attempt, call });
        }
        attempts.push({ attempt, file: path.relative(root, callFile), sha256: hash(fs.readFileSync(callFile, 'utf8')) });
        if (!retryable(call) || attempt === recovery.maximum_total_attempts) {
          dispositions.push({ kind: matches ? 'transport_retry' : 'changed_request', original_request_sha256: hash(prior.request), attempts });
          return call;
        }
      }
    };
    let validationError;
    const result = await executeTarget(c, target, async request => {
      try { return await transport(request); } catch (error) { validationError = error; throw error; }
    }, state);
    if (validationError) throw validationError;
    if (index !== 1) throw new Error('Unexpected call coverage');
    const row = { case_id: c.id, version: c.version, suite: c.suite, partition: c.partition, repetition: rep,
      generation_id: `${frozen.run_id}/${c.id}/r${rep}`, frozen_sha256: frozenHash, reused_from: alias ? `${alias.case_id}-r${rep}.json` : null,
      source_evidence: provenance, recovery_calls: dispositions, result, checks: score(c, result) };
    if (saved) {
      for (const field of Object.keys(row)) {
        if (field === 'result') continue;
        if (hash(row[field]) !== hash(saved[field])) throw new Error('Saved recovery provenance changed:' + identity + '/' + field);
      }
      // The consumer generates a new request id in its envelope; validate all deterministic state and call evidence.
      for (const field of ['input', 'calls', 'parsed', 'applied', 'http_status', 'prior_state', 'next_state', 'applied_event', 'projected_assessment_due']) if (hash(result[field]) !== hash(saved.result[field])) throw new Error('Saved recovery result changed:' + identity + '/' + field);
    } else save(file, { ...row, timestamp: new Date().toISOString() });
    complete++; console.log(`[${complete}/${frozen.expected_generations}] ${c.id} r${rep}: ${dispositions.map(d => d.kind).join(',')}`);
    return saved || row;
  }
  const jobs = [];
  for (const rep of [1, 2, 3]) {
    for (const c of frozen.cases.filter(c => !c.sequence_id && !frozen.aliases[c.id])) jobs.push({ rep, cases: [c] });
    for (const id of new Set(frozen.cases.map(c => c.sequence_id).filter(Boolean))) jobs.push({ rep, cases: frozen.cases.filter(c => c.sequence_id === id).sort((a, b) => a.sequence_step - b.sequence_step) });
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: numWorkers }, async () => {
    while (cursor < jobs.length) { const job = jobs[cursor++]; let state = null; for (const c of job.cases) { const row = await execute(c, job.rep, state); if (c.sequence_id) state = row.result.next_state; } }
  }));
  for (const [id, canonical] of Object.entries(frozen.aliases)) for (const rep of [1, 2, 3]) await execute(frozen.cases.find(c => c.id === id), rep, null, read(path.join(dir, 'generations', `${canonical}-r${rep}.json`)));
  const rows = await generations(dir, frozen), callsDir = path.join(dir, 'calls');
  const attemptFiles = fs.existsSync(callsDir) ? fs.readdirSync(callsDir).filter(f => f.endsWith('.json') && !f.endsWith('.started.json')) : [];
  const newCalls = attemptFiles.length, unknownCalls = attemptFiles.filter(f => read(path.join(callsDir, f)).call.outcome_unknown).length;
  const accounting = { frozen_sha256: frozenHash, original_unique_calls: frozen.expected_provider_calls, new_unique_calls: newCalls,
    cumulative_unique_calls_upper_bound: frozen.expected_provider_calls + newCalls, unknown_attempt_outcomes: unknownCalls, retained_records: rows.filter(r => r.recovery_calls[0].kind === 'retained').length,
    changed_request_records: rows.filter(r => r.recovery_calls[0].kind === 'changed_request').map(r => r.case_id + '/' + r.repetition),
    transport_retry_records: rows.filter(r => r.recovery_calls[0].kind === 'transport_retry').map(r => r.case_id + '/' + r.repetition) };
  const accountingFile = path.join(dir, 'recovery-manifest.json');
  if (fs.existsSync(accountingFile)) { if (hash(read(accountingFile)) !== hash(accounting)) throw new Error('Saved accounting changed'); } else save(accountingFile, accounting);
  await report(dir); console.log(JSON.stringify(accounting));
}
module.exports = { retryable, sameRequest, freeze, run };
if (require.main === module) {
  const [command, directory, reference, ...args] = process.argv.slice(2);
  const workers = reference === '--num_workers' ? Number(args[0]) : 16;
  Promise.resolve().then(() => command === 'freeze' ? freeze(path.resolve(directory), path.resolve(reference)) : command === 'run' ? run(path.resolve(directory), workers) : Promise.reject(new Error('Use freeze DIR REFERENCE or run DIR --num_workers16'))).catch(error => { console.error(error); process.exitCode = 1; });
}

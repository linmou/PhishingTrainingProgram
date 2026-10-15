#!/usr/bin/env node
// Test responsibility: sequence-recover.cjs retains semantic failures and invalidates cached calls when propagated state changes the real handler request.
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { retryable, sameRequest } = require('./sequence-recover.cjs');
const { freeze } = require('./current.cjs');
const { loadProduction, executeTarget } = require('./evaluate.cjs');
const vm = require('node:vm');
const { hash } = require('./current.cjs');
test('provider transport failures alone permit retries; malformed successful answers remain evidence', () => {
  for (const call of [{ error: 'fetch failed' }, { status: 429 }, { status: 502 }, { status: 503 }, { status: 504 }]) assert.equal(retryable(call), true);
  for (const call of [{ status: 200, response: { choices: [{ message: { content: 'invalid JSON' } }] } }, { status: 400 }, { status: 401 }]) assert.equal(retryable(call), false);
  const call = { request: { model: 'configured', messages: [{ content: 'evidence' }] }, endpoint: 'provider' };
  assert.equal(sameRequest(call, structuredClone(call.request), 'provider'), true);
  assert.equal(sameRequest(call, { ...call.request, model: 'other' }, 'provider'), false);
  assert.equal(sameRequest(call, call.request, 'other'), false);
});

test('recovery runner preserves failures, propagates state, resumes without calls and rejects corrupted retry evidence', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'recovery-run-test-'));
  const root = path.resolve(__dirname, '../../..'), sourceFile = path.join(__dirname, 'sequence-recover.cjs');
  const source = fs.readFileSync(sourceFile, 'utf8'), endpoint = 'https://test.invalid/v1';
  const cases = [
    { id: 'first', sequence_id: 'chain', sequence_step: 0 },
    { id: 'second', sequence_id: 'chain', sequence_step: 1 },
    { id: 'third', sequence_id: 'chain', sequence_step: 2 },
    { id: 'semantic_failure', sequence_id: null }
  ].map(c => ({ ...c, version: 1, suite: 'test', partition: 'test', input: {} }));
  const requestFor = (c, state) => ({ model: 'qwen3.5-flash', messages: [{ content: c.id }], state: state || 'Pending' });
  const originalRows = cases.flatMap(c => [1, 2, 3].map(rep => ({ case_id: c.id, repetition: rep, result: { calls: [{
    request: requestFor(c, c.id === 'third' ? 'Covered' : null), endpoint,
    ...(c.id === 'first' && rep === 1 ? { error: 'fetch failed' } : { status: 200, response: { next: c.id === 'first' ? 'Pending' : 'Covered', semantic_pass: false } })
  }] } })));
  const originalFile = path.join(directory, 'original.json'); fs.writeFileSync(originalFile, '{}');
  const sourceRecords = originalRows.map(row => { const file = path.join(directory, row.case_id + row.repetition + '.json'); fs.writeFileSync(file, JSON.stringify(row)); return { case_id: row.case_id, repetition: row.repetition, file: path.relative(root, file), sha256: hash(fs.readFileSync(file, 'utf8')) }; });
  const runDir = path.join(directory, 'run'); fs.mkdirSync(runDir);
  const frozen = { run_id: 'test', cases, aliases: {}, snapshot: {}, expected_generations: 12, expected_provider_calls: 12, settings: { timeout_ms: 600000 },
    artifacts: [{ path: path.relative(root, sourceFile), sha256: hash(source) }], recovery: { endpoint, maximum_total_attempts: 3, original_frozen_file: path.relative(root, originalFile), original_frozen_sha256: hash('{}'), source_records: sourceRecords } };
  fs.writeFileSync(path.join(runDir, 'frozen.json'), JSON.stringify(frozen));
  const rows = dir => fs.existsSync(path.join(dir, 'generations')) ? fs.readdirSync(path.join(dir, 'generations')).map(f => JSON.parse(fs.readFileSync(path.join(dir, 'generations', f)))) : [];
  let network = 0;
  const stubCurrent = { hash, validateManifest: () => {}, generations: async dir => rows(dir), report: async () => {} };
  const stubEvaluate = { loadProduction: () => ({}), score: () => [{ pass: false }], executeTarget: async (c, _target, transport, state) => {
    let call;
    try { call = await transport(requestFor(c, state)); } catch { return { calls: [], next_state: 'Pending' }; }
    return { calls: [call], input: { state }, next_state: call.response?.next || 'Pending', parsed: null, applied: null, http_status: 200, prior_state: state, applied_event: null, projected_assessment_due: null };
  } };
  const context = { module: { exports: {} }, exports: {}, __filename: sourceFile, __dirname, console: { log: () => {} }, structuredClone, AbortSignal,
    process: { env: { OAI_API_KEY: 'test', OAI_BASE_URL: endpoint, OAI_MODEL: 'qwen3.5-flash' } },
    fetch: async (_url, options) => { network++; const request = JSON.parse(options.body); return { status: 200, text: async () => JSON.stringify({ next: request.messages[0].content === 'first' ? 'Partial' : 'Covered' }) }; },
    require: name => name === './current.cjs' ? stubCurrent : name === './evaluate.cjs' ? stubEvaluate : name.endsWith('/dotenv') ? { parse: () => ({}) } : name === 'node:fs' ? { ...fs, readFileSync: (file, ...args) => String(file).endsWith('/tutor-system/.env') ? '' : fs.readFileSync(file, ...args) } : require(name) };
  vm.runInNewContext(source, context, { filename: sourceFile });
  await context.module.exports.run(runDir, 2);
  assert.equal(network, 2, 'only first retry and changed second request need calls');
  const firstRows = rows(runDir);
  assert.equal(firstRows.find(r => r.case_id === 'second' && r.repetition === 1).recovery_calls[0].kind, 'changed_request');
  assert.equal(firstRows.find(r => r.case_id === 'third' && r.repetition === 1).recovery_calls[0].kind, 'retained');
  assert.equal(firstRows.find(r => r.case_id === 'semantic_failure').result.calls[0].response.semantic_pass, false);
  await context.module.exports.run(runDir, 2); assert.equal(network, 2);
  const retryFile = path.join(runDir, 'calls/first-r1-c0-a2.json'), retry = JSON.parse(fs.readFileSync(retryFile));
  retry.call.request.model = 'wrong'; fs.writeFileSync(retryFile, JSON.stringify(retry));
  await assert.rejects(() => context.module.exports.run(runDir, 1), /Saved retry identity changed/);
  assert.equal(network, 2, 'integrity failure must not advance into new calls');
  const interruptedDir = path.join(directory, 'interrupted'); fs.mkdirSync(interruptedDir);
  fs.writeFileSync(path.join(interruptedDir, 'frozen.json'), JSON.stringify(frozen));
  fs.mkdirSync(path.join(interruptedDir, 'calls'));
  fs.writeFileSync(path.join(interruptedDir, 'calls/first-r1-c0-a2.started.json'), JSON.stringify({ frozen_sha256: hash(frozen), case_id: 'first', repetition: 1, position: 0, attempt: 2,
    request: requestFor(cases[0], null), endpoint, started_at: new Date().toISOString() }));
  context.fetch = async () => { network++; throw new Error('fetch failed'); };
  await context.module.exports.run(interruptedDir, 1);
  assert.equal(network, 3, 'unknown second attempt consumes budget; only third attempt is sent');
  const recovered = rows(interruptedDir).find(r => r.case_id === 'first' && r.repetition === 1);
  assert.equal(recovered.result.calls[0].error, 'fetch failed');
  assert.equal(recovered.recovery_calls[0].attempts.length, 2);
  await context.module.exports.run(interruptedDir, 1); assert.equal(network, 3, 'failed request cannot exceed cap on resume');
});
test('real sequence consumer changes downstream request after recovered state and reconverges when state matches', async () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sequence-recovery-test-')), 'run');
  const frozen = freeze(dir, 'full'), target = loadProduction(frozen.snapshot);
  const c = frozen.cases.find(c => c.id === 'propagated_S02');
  const transport = async request => ({ request, endpoint: 'provider', status: 200, response: { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ events: [], explanation: 'No qualifying event.' }) } }] } });
  const pending = await executeTarget(c, target, transport, { status: 'Pending', understanding_level: 'none' });
  const partial = await executeTarget(c, target, transport, { status: 'Partial', understanding_level: 'partial' });
  assert.equal(pending.calls.length, 1); assert.equal(partial.calls.length, 1);
  assert.equal(sameRequest(pending.calls[0], partial.calls[0].request, 'provider'), false);
  const repeated = await executeTarget(c, target, transport, partial.prior_state);
  assert.equal(sameRequest(partial.calls[0], repeated.calls[0].request, 'provider'), true);
});

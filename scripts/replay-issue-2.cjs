#!/usr/bin/env node
// Purpose: replay issue #2 through production analysis/context/tutor code using exported reads and the configured provider, without database writes.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const app = path.join(root, 'tutor-system');
const ts = require(path.join(app, 'node_modules/typescript'));
const { loadProduction, executeTarget, eligible } = require('../evals/promptfoo/learning-progress-analyzer/evaluate.cjs');
const dotenv = require(path.join(app, 'node_modules/dotenv'));
const [variant, envFile] = process.argv.slice(2);
const numWorkers = Number(process.argv[4] || 2);
if (!Number.isInteger(numWorkers) || numWorkers < 1 || numWorkers > 4) throw new Error('num_workers must be between 1 and 4');
if (!['baseline', 'candidate'].includes(variant) || !envFile) throw new Error('Usage: replay-issue-2.cjs baseline|candidate ENV_FILE');
const baselineRevision = process.env.ISSUE2_BASELINE_COMMIT || '7762cbb8eaeccf8c92360dc8eb335219651cd4b1';
const output = process.argv[5] ? path.resolve(process.argv[5])
  : path.join(root, 'output/issue-2-replay', `${variant}-${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(output, { recursive: true });
const write = (name, value) => {
  const file = path.join(output, name);
  const body = JSON.stringify(value, null, 2) + '\n';
  if (fs.existsSync(file)) {
    if (fs.readFileSync(file, 'utf8') !== body) throw new Error(`Resume artifact differs: ${file}`);
    return;
  }
  fs.writeFileSync(file, body, { flag: 'wx' });
};
const env = { ...dotenv.parse(fs.readFileSync(envFile)), ...process.env };
if (!env.OAI_API_KEY || !env.OAI_BASE_URL) throw new Error('OAI_API_KEY and OAI_BASE_URL are required');
const model = env.OAI_MODEL || dotenv.parse(fs.readFileSync(path.join(app, '.env.example'))).OAI_MODEL;
if (!model) throw new Error('OAI_MODEL must be configured');
const exported = JSON.parse(fs.readFileSync(path.join(root, 'output/issue-2-replay/source.json')));
const focusIndex = exported.messages.findIndex(m => m.id === 'e12f0b26-bd55-471b-a45c-7403725c4eb8');
if (focusIndex < 0) throw new Error('Reported focus message missing');
const prefix = exported.messages.slice(0, focusIndex + 1);
const focus = prefix[prefix.length - 1];
const target = exported.items.find(i => i.area_text.startsWith('URL Analysis:'));
if (!target) throw new Error('Reported URL target missing');
const snapshot = { files: [] };
const frozen = new Map();
function freeze(name) {
  if (frozen.has(name)) return;
  const content = variant === 'baseline'
    ? execFileSync('git', ['show', `${baselineRevision}:tutor-system/${name}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(app, name), 'utf8');
  frozen.set(name, content); snapshot.files.push({ name, content });
  for (const item of ts.preProcessFile(content).importedFiles) {
    if (!item.fileName.startsWith('.')) continue;
    let next = path.posix.normalize(path.posix.join(path.posix.dirname(name), item.fileName));
    if (!path.extname(next)) next += '.ts';
    if (fs.existsSync(path.join(app, next))) freeze(next);
  }
}
freeze('supabase/functions/assessment-api/index.ts');
freeze('src/services/learningProgressTransitions.ts');
freeze('src/services/aiService.ts');
write('source-snapshot.json', snapshot);
const settings = { model, endpoint: env.OAI_BASE_URL, source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), started_at: new Date().toISOString(), repetitions: 1, semantic_judge: null, purpose: 'Focused diagnostic; not a full behavior benchmark or live database lifecycle acceptance', changed_factor: variant === 'candidate' ? 'Authoritative learner progress enrichment and unresolved-target guidance' : 'Unchanged baseline' };
settings.num_workers = numWorkers;
settings.baseline_commit = baselineRevision;
settings.harness_sha256 = crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex');
settings.source_sha256 = crypto.createHash('sha256').update(JSON.stringify(exported)).digest('hex');
if (fs.existsSync(path.join(output, 'metadata.json'))) {
  const previous = JSON.parse(fs.readFileSync(path.join(output, 'metadata.json')));
  for (const key of ['model', 'endpoint', 'num_workers', 'harness_sha256', 'source_sha256']) {
    if (previous[key] !== settings[key]) throw new Error(`Resume configuration differs: ${key}`);
  }
} else write('metadata.json', settings);
let activeCalls = 0;
const waitingCalls = [];
async function provider(request) {
  if (activeCalls >= numWorkers) await new Promise(resolve => waitingCalls.push(resolve));
  activeCalls += 1;
  try {
  const body = { ...request, model };
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  const cacheFile = `provider-${requestHash}.json`;
  if (fs.existsSync(path.join(output, cacheFile))) return JSON.parse(fs.readFileSync(path.join(output, cacheFile)));
  const started = Date.now();
  const response = await fetch(env.OAI_BASE_URL.replace(/\/$/, '') + '/chat/completions', { method: 'POST', headers: { authorization: `Bearer ${env.OAI_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(90000) });
  const raw = await response.text();
  let payload;
  try { payload = JSON.parse(raw); } catch { payload = { raw }; }
  const result = { request: body, response: payload, status: response.status, duration_ms: Date.now() - started, error: response.ok ? null : `Provider HTTP ${response.status}` };
  write(response.ok ? cacheFile : `provider-failure-${requestHash}-${Date.now()}.json`, result);
  return result;
  } finally {
    activeCalls -= 1;
    waitingCalls.shift()?.();
  }
}

function tutorModule(database, calls) {
  const cache = new Map();
  const supabase = { from(table) {
    if (!database[table]) throw new Error(`Unfrozen table ${table}`);
    let rows = [...database[table]];
    const query = {
      select() { return query; },
      eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
      order() { return query; },
      or() { rows = []; return query; },
      range(start, end) { return Promise.resolve({ data: rows.slice(start, end + 1), error: null }); },
      limit(count) { rows = rows.slice(0, count); return query; },
      single() { return Promise.resolve({ data: rows[0] || null, error: rows.length ? null : { code: 'PGRST116' } }); },
      maybeSingle() { return Promise.resolve({ data: rows[0] || null, error: null }); },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
    return query;
  }, functions: { async invoke(name, { body }) {
    if (name !== 'ai-api') throw new Error(`Unapproved replay operation ${name}`);
    const call = await provider(body); calls.push(call);
    return call.error ? { data: null, error: { message: call.error } } : { data: { content: call.response.choices?.[0]?.message?.content, model, finish_reason: call.response.choices?.[0]?.finish_reason }, error: null };
  } } };
  function load(name) {
    if (name === 'src/services/supabase.ts') return { supabase };
    if (cache.has(name)) return cache.get(name).exports;
    if (!frozen.has(name)) throw new Error(`Unfrozen module ${name}`);
    const module = { exports: {} }; cache.set(name, module);
    const source = ts.transpileModule(frozen.get(name), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const localRequire = spec => {
      if (!spec.startsWith('.')) throw new Error(`Unexpected module ${spec}`);
      let next = path.posix.normalize(path.posix.join(path.posix.dirname(name), spec));
      if (!path.extname(next)) next += '.ts';
      return load(next);
    };
    vm.runInNewContext(source, { exports: module.exports, module, require: localRequire, console, process: { env: { REACT_APP_ENVIRONMENT: 'production' } }, Date, setTimeout, clearTimeout, crypto: globalThis.crypto }, { filename: name });
    return module.exports;
  }
  return load('src/services/aiService.ts');
}

async function main() {
  const production = loadProduction(snapshot);
  const createHandler = production.createAssessmentApiHandler;
  production.createAssessmentApiHandler = deps => {
    const handler = createHandler(deps);
    return request => {
      const headers = new Headers(request.headers);
      headers.set('x-practice-contract', 'cyberbullying-v2');
      return handler(new Request(request, { headers }));
    };
  };
  const cases = [
    { id: 'acknowledgment', content: focus.content, expected_event: null, expected_status: 'partially_covered' },
    { id: 'understanding', content: 'The bit.ly link hides where it goes, so it does not show an official Apple address. I will avoid that link and type apple.com myself to check the offer.', expected_event: 'demonstrated_understanding', expected_status: 'covered' },
    { id: 'misconception', content: 'The bit.ly address proves this is an official Apple promotion, so it is safe to click.', expected_event: 'contradiction', expected_status: 'needs_review' },
  ];
  write('manifest.json', { cases, prior_state: target, provenance: 'Actual reported conversation prefix and configured targets; only focus content varies for controlled understanding/misconception cases. Exported state, not historical state reconstruction.', acceptance: 'Review semantic tutor consistency using complete calls; deterministic state/event checks; no exact wording assertions.', gaps: ['Live persisted lifecycle/assessment prepare RPC not run', 'Full existing tutor benchmark and independent holdout acceptance not run'] });
  for (const c of cases) {
    console.log(`Replay ${variant}: ${c.id}, ${exported.items.length} targets, num_workers=${numWorkers}`);
    if (fs.existsSync(path.join(output, `${c.id}-tutor.json`))) {
      console.log(`Resume: ${c.id} already complete`);
      continue;
    }
    const message = { ...focus, room_id: exported.room.id, content: c.content };
    const history = [...prefix.slice(0, -1), message].map(m => ({ ...m, room_id: exported.room.id }));
    const items = [target, ...exported.items.filter(i => i.id !== target.id && !i.deleted)];
    const analysis = await executeTarget({ input: { focus_student_id: focus.user_id, evidence_message_id: focus.id, message, items, dialogue_history: history.map(m => ({ ...m, source: 'message', speaker_name: null })) } }, production, provider);
    analysis.target_transitions = items.map(item => {
      const event = analysis.applied?.events?.find(e => e.item_id === item.id)?.kind || null;
      const prior = { status: item.status, understanding_level: item.understanding_level };
      const transition = production.applyLearningEvent(prior, event || 'no_change');
      const next = transition.next || prior;
      return { item_id: item.id, prior, event, transition, next, assessment_due: eligible(prior, next, event) };
    });
    const urlTransition = analysis.target_transitions.find(t => t.item_id === target.id);
    analysis.applied_event = urlTransition.event;
    analysis.next_state = urlTransition.next;
    analysis.projected_assessment_due = urlTransition.assessment_due;
    write(`${c.id}-analysis.json`, analysis);
    if (analysis.http_status !== 200) throw new Error(`${c.id} analysis failed: ${JSON.stringify(analysis.envelope)}`);
    const updated = exported.items.map(i => ({ ...i, ...analysis.target_transitions.find(t => t.item_id === i.id)?.next }));
    if (analysis.target_transitions.some(t => t.assessment_due)) {
      write(`${c.id}-tutor.json`, { case_id: c.id, analysis_eligibility: true, route: 'assessment_preparation_required', tutor_generation: 'Not invoked: production orchestration must prepare the final assessment first', checks: { event: analysis.applied_event === c.expected_event, state: analysis.next_state.status === c.expected_status }, live_acceptance: 'Run trusted prepare RPC and assessment generation on an isolated staging fixture; no database writes in this provider-only replay' });
      console.log(JSON.stringify({ case_id: c.id, route: 'assessment_preparation_required', target: urlTransition }));
      continue;
    }
    const database = { rooms: [{ ...exported.room, ai_assistant_enabled: true }], messages: history, session_checklists: exported.checklists, checklist_items: updated, ai_assistant_configs: exported.configs };
    const calls = [];
    const tutor = tutorModule(database, calls);
    const result = await tutor.generateTutorSuggestion(exported.room.id, 'replay-tutor', undefined, { focusStudentMessage: c.content, focusStudentId: focus.user_id, focusStudentMessageId: focus.id, assessmentPreparation: 'no_candidate' });
    const record = { case_id: c.id, analysis_eligibility: analysis.projected_assessment_due, assessment_prepare: 'Not executed: projected eligibility from real analysis and transition code only', checks: { event: analysis.applied_event === c.expected_event, state: analysis.next_state.status === c.expected_status, tutor_success: result.success }, tutor: result, calls };
    write(`${c.id}-tutor.json`, record);
    console.log(JSON.stringify({ case_id: c.id, checks: record.checks, assessment_due: analysis.projected_assessment_due, decision: result.decision }));
    if (Object.values(record.checks).some(v => !v)) process.exitCode = 1;
  }
}
main().catch(error => { write('failure.json', { message: error.message, completed_at: new Date().toISOString() }); console.error(error.message); process.exitCode = 1; });

#!/usr/bin/env node
// Purpose: freeze and evaluate production transfer-analysis classifications against preserved gold labels.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'tutor-system/node_modules/typescript'));
const sourceDir = path.join(root, 'output/transfer-analysis-eval-20261013');
const metricIds = ['raw_event', 'applied_state', 'safety_flags', 'assessment_route', 'validity'];
const states = { pending: 'none', partially_covered: 'basic', covered: 'good', needs_review: 'basic' };
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); };

function loadProduction(snapshot) {
  const files = new Map(snapshot.files.map(f => [f.name, f.content]));
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    if (!files.has(name)) throw new Error(`Missing frozen dependency ${name}`);
    const module = { exports: {} }; cache.set(name, module);
    let source = files.get(name).replace('if (import.meta.main)', 'if (false)');
    if (name.endsWith('assessment-api/index.ts')) source += '\nexport const evaluationPrompt = TRANSFER_ANALYSIS_SYSTEM_PROMPT;';
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const requireSnapshot = specifier => {
      if (specifier.startsWith('https://')) return { createClient: () => { throw new Error('Live database client prohibited in offline evaluation'); } };
      let target = path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier));
      if (!target.endsWith('.ts')) target += '.ts';
      return load(target);
    };
    vm.runInNewContext(compiled, { exports: module.exports, module, require: requireSnapshot, Request, Response, Headers, URL, crypto: globalThis.crypto, console, TextEncoder, TextDecoder, fetch: () => { throw new Error('Use injected provider only'); } }, { filename: name });
    return module.exports;
  }
  return { ...load('supabase/functions/assessment-api/index.ts'), ...load('src/services/learningProgressTransitions.ts') };
}

function targetState(kind, current) {
  if (kind === null) return { status: current.status, understanding_level: current.understanding_level };
  const next = { initial_signal: 'partially_covered', demonstrated_understanding: 'covered', post_repair_signal: 'partially_covered', spontaneous_transfer: 'covered', contradiction: 'needs_review' }[kind];
  if (!next) throw new Error(`Unknown gold event ${kind}`);
  return { status: next, understanding_level: states[next] };
}

function eligible(prior, state, event, flags) {
  // Project new readiness only; persistence and later deferral are verified by the SQL lifecycle tests.
  return prior.status === 'partially_covered' && prior.understanding_level === 'basic' &&
    state.status === 'covered' && state.understanding_level === 'good' &&
    event === 'demonstrated_understanding' && !flags.protection && !flags.correction;
}

function baselineEligible(_prior, state, event, flags) {
  return state.status === 'partially_covered' && state.understanding_level === 'basic' &&
    ['initial_signal', 'post_repair_signal'].includes(event) && !flags.protection && !flags.correction;
}

function synthetic(c, suite) {
  const learnerId = 'learner-1';
  const roomId = `room-${c.id}`;
  const focusId = `message-${c.id}`;
  const history = c.history.map((h, i) => ({ id: `${c.id}-history-${i}`, source: h.speaker === 'setup' ? 'room_setup' : 'message', user_id: h.speaker === 'other' ? 'other-learner' : h.role === 'student' ? learnerId : h.role === 'tutor' ? 'tutor-1' : null, user_role: h.role, speaker_name: h.speaker === 'setup' ? 'Scenario participant' : null, content: h.content }));
  const message = { id: focusId, room_id: roomId, user_id: learnerId, user_role: 'student', content: c.learner };
  return { ...c, suite, version: 1, input: { focus_student_id: learnerId, evidence_message_id: focusId, message, items: [{ id: `item-${c.id}`, priority: 'important', ...c.target }], dialogue_history: [...history, { ...message, source: 'message', speaker_name: null }] }, provenance: { source: suite, author: suite === 'holdout' ? 'independent agent analysis_holdouts' : 'Codex', holdout_eligible: suite === 'holdout', changed_field_rationale: c.changed_factor || 'Synthetic scenario and wording; development tone informed by production patterns', label_review: 'agent-authored, human review pending' } };
}

function buildCases(exported, development, holdouts) {
  const ecological = development.ecological_selections.map(s => {
    const room = exported.rooms[s.room];
    const focus = room.messages.filter(m => m.user_role === 'student')[s.student];
    const item = room.items[s.item];
    const focusIndex = room.messages.findIndex(m => m.id === focus.id);
    const userMap = new Map();
    const alias = id => { if (!userMap.has(id)) userMap.set(id, `participant-${userMap.size + 1}`); return userMap.get(id); };
    const historical = room.messages.slice(0, focusIndex + 1).map(m => ({ id: m.id, source: 'message', user_id: alias(m.user_id), user_role: m.user_role, speaker_name: null, content: m.content }));
    const message = { id: focus.id, room_id: room.source_room_id, user_id: alias(focus.user_id), user_role: 'student', content: focus.content };
    const target = { id: item.id, area_text: item.area_text, item_type: item.item_type, priority: item.priority, status: item.status, understanding_level: item.understanding_level };
    const setup = (room.pre_populated_dialogue || []).map((m, i) => ({ id: `setup-${room.source_room_id}-${i}`, source: 'room_setup', user_id: null, user_role: m.role, speaker_name: `Scenario participant ${i + 1}`, content: m.message }));
    return { id: s.id, version: 1, suite: 'ecological', scenario: room.scenario, role: s.kind === null ? 'negative' : 'positive', partition: s.partition, expected: { kind: s.kind, protection: false, correction: false }, rationale: s.rationale, requirements: ['TA01', 'TA02', 'TA05'], pair_id: null, input: { focus_student_id: message.user_id, evidence_message_id: message.id, message, items: [target], dialogue_history: [...setup, ...historical] }, provenance: { source_project: exported.project, source_room_id: room.source_room_id, source_message_id: focus.id, source_item_id: item.id, source_export_time: exported.exported_at, message_created_at: focus.created_at, target_updated_at: item.updated_at, prior_state_policy: 'Replay against exported target state; no claim to reconstruct historical progress', changed_field_rationale: 'Only identity pseudonyms and setup speaker aliases; original text, target and history retained', holdout_eligible: false, label_author: 'Codex', label_review: 'agent-authored, human review pending' } };
  });
  const sequenceTarget = { area_text: 'Explain how an urgent account-warning message can steal login credentials', item_type: 'understanding' };
  const steps = [
    ['it panics people so they click fast but idk the rest', 'initial_signal', 'pending', 'partial', false],
    ['then a fake login records the password they type. the warning rushes them there before they think', 'demonstrated_understanding', 'partially_covered', 'full', false],
    ['actually a fake login page cant record what you type so passwords would be safe', 'contradiction', 'covered', 'contradiction', true],
    ['oh right the page can keep what i type, so rushing me there could give them my password', 'post_repair_signal', 'needs_review', 'repair', false],
    ['same with a parcel text saying pay now or lose the package. its fake delivery login could keep my password too, so id check the courier app myself', 'spontaneous_transfer', 'partially_covered', 'transfer', false],
  ];
  const sequenceHistory = [{ role: 'tutor', content: 'How could this urgent account warning steal a password?' }];
  const sequences = steps.map(([learner, kind, status, partition, correction], i) => {
    const c = synthetic({ id: `S0${i + 1}`, scenario: 'Account warning, then independent parcel application', role: i < 2 ? 'positive' : 'recovery', partition, target: { ...sequenceTarget, status, understanding_level: states[status] }, history: [...sequenceHistory], learner, expected: { kind, protection: false, correction }, rationale: 'Declared five-turn progression: partial, full, contradiction, same-situation repair, new-situation transfer.', pair_id: null, requirements: ['TA01', 'TA02', 'TA03', 'TA04', 'TA05'] }, 'sequence');
    c.sequence_id = 'progress-1'; c.sequence_step = i;
    sequenceHistory.push({ role: 'student', content: learner });
    if (i === 2) sequenceHistory.push({ role: 'tutor', content: 'A fake page can record submitted passwords. Reconsider how the warning puts them at risk.' });
    return c;
  });
  return [...ecological, ...development.synthetic_cases.map(c => synthetic(c, 'development')), ...holdouts.cases.map(c => synthetic(c, 'holdout')), ...sequences];
}

function auditExisting() {
  const bases = ['evals/promptfoo/cases', 'evals/promptfoo/v1/transfer', 'evals/promptfoo/v1/simulated'];
  const files = [];
  function walk(dir) { if (!fs.existsSync(dir)) return; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const name = path.join(dir, entry.name); if (entry.isDirectory()) walk(name); else if (/\.(json|ya?ml)$/.test(name)) files.push(name); } }
  bases.forEach(p => walk(path.join(root, p)));
  return files.map(file => {
    const content = fs.readFileSync(file, 'utf8');
    let cases = [];
    if (/\.(json|ya?ml)$/.test(file)) {
      const data = file.endsWith('.json') ? JSON.parse(content) : require(path.join(root, 'tutor-system/node_modules/js-yaml')).load(content);
      cases = Array.isArray(data) ? data : Array.isArray(data.cases) ? data.cases : Array.isArray(data.tests) ? data.tests : [];
    }
    return { file: path.relative(root, file), sha256: hash(content), classification: 'not_applicable', reason: 'Existing artifacts target tutor response/assessment decisions, not the per-item analysis events contract; all original assertions preserved unchanged. Lifecycle and overcredit regression roles are represented separately.', cases: cases.map((c, i) => ({ id: c.id || c.description || `index-${i}`, assertions: c.assert || c.assertions || c.expected_assertions || [], classification: 'not_applicable' })) };
  });
}

function freeze(runDir, comparisonMode = 'routing', freshHoldouts = null) {
  if (fs.existsSync(runDir)) throw new Error('Freeze requires a new run directory');
  const snapshot = json(path.join(sourceDir, 'production-edge.json'));
  const production = loadProduction(snapshot);
  const exported = json(path.join(sourceDir, 'production-export.json'));
  const development = json(path.join(__dirname, 'development.json'));
  const holdouts = json(path.join(__dirname, 'holdouts.json'));
  const retained = buildCases(exported, development, holdouts);
  const revision = json(path.join(__dirname, 'final-assessment-cases.json'));
  const independent = json(path.join(__dirname, 'final-assessment-holdouts.json'));
  const independentCases = independent.cases.map(c => {
    const item = synthetic(c, 'independent_holdout');
    item.provenance = { ...item.provenance, author: independent.author, exposure: independent.exposure, holdout_eligible: comparisonMode === 'routing', created_at: independent.created_at };
    if (comparisonMode === 'prompt') {
      item.suite = 'refinement_regression';
      item.provenance.exposure = 'Exposed by final-assessment-comparison-01; retained as regression for prompt clarification';
    }
    return item;
  });
  const cases = [...retained, ...revision.cases.map(c => synthetic(c, 'revision')), ...independentCases];
  if (comparisonMode === 'prompt') {
    const fresh = json(path.join(__dirname, 'final-assessment-refinement-holdouts.json'));
    for (const c of fresh.cases) {
      const item = synthetic(c, freshHoldouts ? 'prior_refinement_regression' : 'independent_holdout');
      item.provenance = { ...item.provenance, author: fresh.author, exposure: freshHoldouts ? 'Exposed by final-assessment-prompt-01; preserved as regression' : fresh.exposure, holdout_eligible: !freshHoldouts, created_at: fresh.created_at };
      cases.push(item);
    }
    if (freshHoldouts) {
      const replacement = json(path.join(__dirname, freshHoldouts));
      for (const c of replacement.cases) {
        const item = synthetic(c, 'independent_holdout');
        item.provenance = { ...item.provenance, author: replacement.author, exposure: replacement.exposure, holdout_eligible: true, created_at: replacement.created_at };
        cases.push(item);
      }
    }
  }
  for (const c of cases) {
    c.expected.assessment_due = c.input.items[0].status === 'partially_covered' && c.expected.kind === 'demonstrated_understanding' && !c.expected.protection && !c.expected.correction;
    if (c.suite === 'holdout') {
      c.provenance.holdout_eligible = false;
      c.provenance.exposure = 'Exposed by historical baseline-01; retained as regression, not unseen validation';
    }
  }
  const candidateSnapshot = { ...snapshot, files: snapshot.files.map(f => ({ ...f, content: fs.readFileSync(path.join(root, 'tutor-system', f.name), 'utf8') })) };
  const candidate = loadProduction(candidateSnapshot);
  if (comparisonMode === 'routing' && candidate.evaluationPrompt !== production.evaluationPrompt) throw new Error('This routing-only comparison requires an unchanged analysis prompt');
  const settings = { model: 'qwen3.5-flash', temperature: 0, max_tokens: 600, enable_thinking: false, response_format: { type: 'json_object' }, repetitions: 2, seed: null, timeout_ms: 90000, target_attempts: 1, num_workers: 4, evaluator: 'deterministic gold-label comparison', human_label_review: 'pending', model_judge: null };
  const paths = ['tutor-system/docs/ai-behaviors/constitution.md', 'tutor-system/docs/ai-behaviors/tutor-behavior-specification.md', 'tutor-system/docs/ai-behaviors/transfer-status-response-contract.md', 'tutor-system/docs/ai-behaviors/transfer-analysis-evaluation-plan.md', 'evals/promptfoo/transfer-analysis/development.json', 'evals/promptfoo/transfer-analysis/holdouts.json', 'evals/promptfoo/transfer-analysis/final-assessment-cases.json', 'evals/promptfoo/transfer-analysis/final-assessment-holdouts.json', 'evals/promptfoo/transfer-analysis/evaluate.cjs'];
  if (comparisonMode === 'prompt') paths.push('evals/promptfoo/transfer-analysis/final-assessment-refinement-holdouts.json');
  if (freshHoldouts) paths.push(path.posix.join('evals/promptfoo/transfer-analysis', freshHoldouts));
  const artifacts = paths.map(file => ({ path: file, sha256: hash(fs.readFileSync(path.join(root, file), 'utf8')), content: fs.readFileSync(path.join(root, file), 'utf8') }));
  const frozen = { run_id: path.basename(runDir), frozen_at: new Date().toISOString(), baseline: 'unchanged production assessment-api v9; prompt and handler from MCP snapshot; historical Partial-state route', candidate: 'working-tree handler and reducer; unchanged analysis prompt; Partial-to-Covered route', comparison: 'One real target generation replayed through both frozen handlers; both routes scored against revised policy. No prompt effect claimed.', candidate_snapshot: candidateSnapshot, settings, metrics: metricIds, expected_generations: cases.length * settings.repetitions, thresholds: { raw_event: 0.8, applied_state: 0.8, safety_flags: 1, assessment_route: 0.8, validity: 1 }, required_suites: [...new Set(cases.map(c => c.suite))], required_partitions: [...new Set(cases.map(c => c.partition))], prompt: production.evaluationPrompt, prompt_sha256: hash(production.evaluationPrompt), cases, artifacts, production_snapshot: snapshot, production_functions: json(path.join(sourceDir, 'production-functions.json')), source_export_sha256: hash(exported), applicability_audit: [...auditExisting(), ...retained.map(c => ({ case_id: c.id, classification: 'refine', preserved_assertions: ['raw_event', 'applied_state', 'safety_flags', 'validity'], changed_assertion: 'assessment_route', reason: 'Same input and classification gold; route now follows approved Partial-to-Covered policy. Original baseline remains immutable.' }))], git_revision: execFileSync('git', ['rev-parse','HEAD'], { cwd: root, encoding: 'utf8' }).trim(), git_status: execFileSync('git', ['status','--short'], { cwd: root, encoding: 'utf8' }), grounding_review: 'Resolved under adopted constitution 1.0 and explicit human Partial-only decision', label_review: 'Agent-authored policy-grounded gold labels; human review pending. Diagnostic freeze, acceptance blocked pending review.' };
  frozen.comparison_mode = comparisonMode;
  frozen.candidate_prompt = candidate.evaluationPrompt;
  frozen.candidate_prompt_sha256 = hash(candidate.evaluationPrompt);
  if (comparisonMode === 'prompt') {
    frozen.baseline = 'Production analysis prompt/handler with revised Partial-to-Covered routing';
    frozen.candidate = freshHoldouts ? 'Short event-selection clarification after sufficiency judgment; same revised routing and independent safety checks' : 'One prompt clarification: compare concrete contexts before choosing full-coverage kind; same revised routing';
    frozen.comparison = 'Separate fresh baseline and candidate model generations on identical cases, settings, and checks; sequences propagate each variant independently.';
    frozen.expected_provider_calls = frozen.expected_generations * 2;
    frozen.applicability_audit.push(...independentCases.map(c => ({ case_id: c.id, classification: 'reuse', preserved_assertions: metricIds, reason: 'First-round independent holdout is now exposed regression; all assertions unchanged.' })));
  }
  write(path.join(runDir, 'frozen.json'), frozen);
  write(path.join(runDir, 'command-freeze.json'), { command: process.argv, completed_at: new Date().toISOString(), exit_code: 0, case_count: cases.length, expected_generations: frozen.expected_generations });
  console.log(JSON.stringify({ frozen: runDir, cases: cases.length, generations: frozen.expected_generations, prompt_sha256: frozen.prompt_sha256, label_review: 'pending' }));
}

async function executeTarget(c, production, transport, state, route = eligible) {
  const input = structuredClone(c.input);
  if (state) Object.assign(input.items[0], state);
  let applied = null;
  const calls = [];
  const handler = production.createAssessmentApiHandler({ featureEnabled: true,
    verifier: { verify: async () => ({ principal_id: 'evaluation', application_user_id: input.focus_student_id, allowed_room_ids: [input.message.room_id], can_review_assessment: false }) },
    env: name => ({ OAI_API_KEY: 'injected-transport-key', OAI_BASE_URL: 'https://evaluation.invalid/v1', OAI_MODEL: 'qwen3.5-flash' })[name],
    fetch: async (_url, options) => { const request = JSON.parse(options.body); const result = await transport(request); calls.push(result); if (result.error) throw new Error(result.error); return new Response(JSON.stringify(result.response), { status: result.status }); },
    rpc: async (name, args) => {
      if (name === 'get_transfer_message_analysis_context_v1') return { data: { room_id: input.message.room_id, student_id: input.focus_student_id, checklist_id: 'evaluation-checklist', message: input.message, items: input.items, dialogue_history: input.dialogue_history, analysis_complete: false, analysis_deferred: false }, error: null };
      if (name === 'apply_transfer_message_analysis_v1') { applied = args.p_analysis; return { data: { applied: args.p_analysis.events }, error: null }; }
      throw new Error(`Unexpected live operation ${name}`);
    }, resolveAnswer: () => { throw new Error('Assessment answer path outside scope'); },
  });
  const response = await handler(new Request('http://localhost/evaluation', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ operation: 'analyze_message', request_id: crypto.randomUUID(), room_id: input.message.room_id, message_id: input.evidence_message_id }) }));
  const envelope = await response.json();
  let parsed = null;
  try { parsed = JSON.parse(calls[0]?.response?.choices?.[0]?.message?.content); } catch {}
  const appliedEvent = applied?.events?.[0]?.kind || null;
  const prior = { status: input.items[0].status, understanding_level: input.items[0].understanding_level };
  const transition = production.applyLearningEvent(prior, appliedEvent || 'no_change');
  const next = transition.next || prior;
  return { input, calls, parsed, applied, http_status: response.status, envelope, prior_state: prior, next_state: next, applied_event: appliedEvent, projected_assessment_due: applied ? route(prior, next, appliedEvent, { protection: applied.requires_protection, correction: applied.requires_correction }) : null };
}

function score(c, result) {
  const expectedState = targetState(c.expected.kind, c.input.items[0]);
  const valid = result.http_status === 200 && result.applied !== null;
  const raw = result.parsed;
  const actualKind = raw && Array.isArray(raw.events) && raw.events.length <= 1 ? raw.events[0]?.kind || null : undefined;
  const checks = [
    ['raw_event', c.expected.kind, actualKind, raw !== null && actualKind !== undefined],
    ['applied_state', expectedState, result.next_state, valid],
    ['safety_flags', { protection: c.expected.protection, correction: c.expected.correction }, raw ? { protection: raw.requires_protection, correction: raw.requires_correction } : null, valid],
    ['assessment_route', c.expected.assessment_due ?? eligible(c.input.items[0], expectedState, c.expected.kind, c.expected), result.projected_assessment_due, valid],
    ['validity', true, valid, true],
  ];
  return checks.map(([metric, expected, actual, evaluable]) => ({ metric, method: 'deterministic', status: !evaluable ? 'error' : JSON.stringify(expected) === JSON.stringify(actual) ? 'pass' : 'fail', expected, actual: actual === undefined ? null : actual, reason: !evaluable ? 'Target output could not be consumed; inspect preserved provider/handler evidence' : 'Exact comparison against frozen expected label/state' }));
}

function credential() {
  const dotenv = require(path.join(root, 'tutor-system/node_modules/dotenv'));
  const env = { ...dotenv.parse(fs.readFileSync(path.join(root, 'tutor-system/.env'))), ...process.env };
  // Explicit existing local credential mapping; no model/endpoint fallback.
  const key = env.REACT_APP_OAI_API_KEY;
  const endpoint = env.OAI_BASE_URL;
  if (!key || !endpoint) throw new Error('Configured REACT_APP_OAI_API_KEY and OAI_BASE_URL are required');
  return { key, endpoint: endpoint.replace(/\/$/, '') };
}

async function run(runDir, numWorkers) {
  const frozen = json(path.join(runDir, 'frozen.json'));
  if (hash(fs.readFileSync(__filename, 'utf8')) !== frozen.artifacts.find(a => a.path.endsWith('evaluate.cjs')).sha256) throw new Error('Runner changed since freeze');
  const production = loadProduction(frozen.production_snapshot);
  const candidate = loadProduction(frozen.candidate_snapshot);
  const config = credential();
  const session = { started_at: new Date().toISOString(), command: process.argv, num_workers: numWorkers, endpoint: config.endpoint, credential_env: 'REACT_APP_OAI_API_KEY (existing local legacy name)', model: frozen.settings.model, exit_code: null };
  const jobs = [];
  for (let rep = 0; rep < frozen.settings.repetitions; rep++) {
    for (const c of frozen.cases.filter(c => !c.sequence_id)) jobs.push({ rep, cases: [c] });
    for (const id of new Set(frozen.cases.filter(c => c.sequence_id).map(c => c.sequence_id))) jobs.push({ rep, cases: frozen.cases.filter(c => c.sequence_id === id).sort((a,b) => a.sequence_step-b.sequence_step) });
  }
  let cursor = 0, complete = 0;
  const transportFor = promptHash => async request => {
    if (request.model !== frozen.settings.model || request.temperature !== 0 || request.max_tokens !== 600 || request.enable_thinking !== false || hash(request.messages[0].content) !== promptHash) throw new Error('Frozen request drift');
    const started = new Date().toISOString();
    try {
      const response = await fetch(`${config.endpoint}/chat/completions`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.key}` }, body: JSON.stringify(request), signal: AbortSignal.timeout(frozen.settings.timeout_ms) });
      const text = await response.text();
      let payload; try { payload = JSON.parse(text); } catch { payload = { unparsed_body: text }; }
      return { request, endpoint: config.endpoint, started_at: started, ended_at: new Date().toISOString(), status: response.status, response: payload };
    } catch (error) { return { request, endpoint: config.endpoint, started_at: started, ended_at: new Date().toISOString(), error: error.message }; }
  };
  const transport = transportFor(frozen.prompt_sha256);
  const candidateTransport = transportFor(frozen.candidate_prompt_sha256);
  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++]; let state = null, baselineState = null;
      for (const c of job.cases) {
        const file = path.join(runDir, 'generations', `${c.id}-r${job.rep}.json`);
        let generation;
        if (fs.existsSync(file)) generation = json(file);
        else {
          const promptComparison = frozen.comparison_mode === 'prompt';
          const baseline = await executeTarget(c, production, transport, promptComparison ? baselineState : state, promptComparison ? eligible : baselineEligible);
          let replayIndex = 0;
          const replay = async request => {
            const call = baseline.calls[replayIndex++];
            if (!call || JSON.stringify(call.request) !== JSON.stringify(request)) throw new Error('Candidate request differs from preserved baseline request');
            return structuredClone(call);
          };
          const result = await executeTarget(c, candidate, promptComparison ? candidateTransport : replay, state);
          if (!promptComparison && replayIndex !== baseline.calls.length) throw new Error('Candidate did not consume all baseline provider calls');
          if (!promptComparison && JSON.stringify(baseline.next_state) !== JSON.stringify(result.next_state)) throw new Error('Analysis state changed in a routing-only comparison');
          generation = { case_id: c.id, version: c.version, suite: c.suite, partition: c.partition, repetition: job.rep, generation_id: `${frozen.run_id}/${c.id}/r${job.rep}`, timestamp: new Date().toISOString(), baseline: { result: baseline, checks: score(c, baseline) }, result, checks: score(c, result) };
          write(file, generation);
        }
        if (c.sequence_id) { state = generation.result.next_state; baselineState = generation.baseline.result.next_state; }
        complete++; console.log(`[${complete}/${frozen.expected_generations}] ${c.id} r${job.rep}: ${generation.checks.filter(x => x.status !== 'pass').map(x=>`${x.metric}:${x.status}`).join(', ') || 'pass'}`);
      }
    }
  }
  await Promise.all(Array.from({ length: numWorkers }, () => worker()));
  session.ended_at = new Date().toISOString(); session.exit_code = 0;
  write(path.join(runDir, `execution-${Date.now()}.json`), session);
  report(runDir);
}

function summarize(frozen, generations) {
  const rows = [];
  const groups = [{ name: 'overall', cases: frozen.cases }, ...frozen.required_suites.map(s => ({ name: `suite:${s}`, cases: frozen.cases.filter(c => c.suite === s) })), ...frozen.required_partitions.map(s => ({ name: `partition:${s}`, cases: frozen.cases.filter(c => c.partition === s) }))];
  for (const group of groups) for (const metric of metricIds) {
    const expected = group.cases.length * frozen.settings.repetitions;
    const checks = generations.filter(g => group.cases.some(c => c.id === g.case_id)).flatMap(g => g.checks.filter(c => c.metric === metric));
    const passed = checks.filter(c => c.status === 'pass').length;
    const errors = checks.filter(c => c.status === 'error').length;
    const missing = expected - checks.length;
    const threshold = frozen.thresholds[metric];
    rows.push({ metric, group: group.name, passed, expected, errors, missing, threshold, verdict: errors || missing ? 'incomplete' : passed / expected >= threshold ? 'pass' : 'fail' });
  }
  const pairs = [];
  for (const id of new Set(frozen.cases.map(c => c.pair_id).filter(Boolean))) for(let rep=0;rep<frozen.settings.repetitions;rep++) {
    const members = frozen.cases.filter(c => c.pair_id === id);
    pairs.push({ id, repetition: rep, members: members.map(c=>c.id), pass: members.length === 2 && members.every(c => { const g = generations.find(g=>g.case_id===c.id&&g.repetition===rep); return g && g.checks.length===metricIds.length && g.checks.every(k=>k.status==='pass'); }) });
  }
  const interactions = frozen.required_suites.map(suite => {
    const cases = frozen.cases.filter(c=>c.suite===suite); const counts = { both_pass:0, raw_only:0, applied_only:0, both_fail:0, unevaluable:0 };
    for(const c of cases) for(let rep=0;rep<frozen.settings.repetitions;rep++) {
      const g=generations.find(g=>g.case_id===c.id&&g.repetition===rep);
      const a=g?.checks.find(k=>k.metric==='raw_event')?.status; const b=g?.checks.find(k=>k.metric==='applied_state')?.status;
      const key=!a||!b||a==='error'||b==='error'?'unevaluable':a==='pass'?(b==='pass'?'both_pass':'raw_only'):(b==='pass'?'applied_only':'both_fail'); counts[key]++;
    }
    return {suite,expected:cases.length*frozen.settings.repetitions,...counts};
  });
  const failures=generations.filter(g=>g.checks.some(c=>c.status!=='pass')).map(g=>({case_id:g.case_id,repetition:g.repetition,checks:g.checks.filter(c=>c.status!=='pass')}));
  const routeInteractions = frozen.required_suites.map(suite => {
    const cases = frozen.cases.filter(c=>c.suite===suite);
    const counts = { both_pass:0, state_only:0, route_only:0, both_fail:0, unevaluable:0 };
    for (const c of cases) for(let rep=0;rep<frozen.settings.repetitions;rep++) {
      const g=generations.find(g=>g.case_id===c.id&&g.repetition===rep);
      const a=g?.checks.find(k=>k.metric==='applied_state')?.status;
      const b=g?.checks.find(k=>k.metric==='assessment_route')?.status;
      const key=!a||!b||a==='error'||b==='error'?'unevaluable':a==='pass'?(b==='pass'?'both_pass':'state_only'):(b==='pass'?'route_only':'both_fail');
      counts[key]++;
    }
    return {suite,expected:cases.length*frozen.settings.repetitions,...counts};
  });
  const behavioralFailure=rows.some(r=>r.verdict==='fail')||pairs.some(p=>!p.pass);
  return { run_id:frozen.run_id, verdict:behavioralFailure?'failed':'incomplete', grounding:'resolved', gold_label_review:'pending human review', acceptance:'Semantic benchmark acceptance requires reviewed labels and all gates; exact routing policy is already human-approved.', release:'outside scope', rows, pairs, interactions, route_interactions:routeInteractions, failures, missing_generations:frozen.expected_generations-generations.length, usage:generations.reduce((a,g)=>{for(const call of g.result.calls){const u=call.response?.usage||{};a.prompt_tokens+=u.prompt_tokens||0;a.completion_tokens+=u.completion_tokens||0;}return a;},{prompt_tokens:0,completion_tokens:0}) };
}

function report(runDir) {
  const frozen=json(path.join(runDir,'frozen.json'));
  const dir=path.join(runDir,'generations');
  const generations=fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>json(path.join(dir,f))):[];
  const result=summarize(frozen,generations);
  if (generations.some(g => g.baseline)) {
    result.baseline = summarize(frozen, generations.map(g => ({ ...g, ...g.baseline })));
    result.comparison = result.rows.map(row => { const before = result.baseline.rows.find(r => r.metric === row.metric && r.group === row.group); return { metric: row.metric, group: row.group, baseline_passed: before.passed, candidate_passed: row.passed, expected: row.expected, delta: row.passed - before.passed, non_regression: row.passed >= before.passed }; });
    result.new_failures = generations.flatMap(g => g.checks.filter(c => c.status !== 'pass' && g.baseline?.checks.some(b => b.metric === c.metric && b.status === 'pass')).map(c => ({ case_id: g.case_id, repetition: g.repetition, metric: c.metric, expected: c.expected, actual: c.actual })));
    result.non_regression_verdict = result.comparison.every(c=>c.non_regression) ? 'pass' : 'fail';
    if (result.non_regression_verdict === 'fail') result.verdict = 'failed';
    result.total_provider_usage = frozen.comparison_mode === 'prompt' ? { prompt_tokens: result.usage.prompt_tokens + result.baseline.usage.prompt_tokens, completion_tokens: result.usage.completion_tokens + result.baseline.usage.completion_tokens } : result.usage;
    result.holdout_coverage = { historical_exposed: frozen.cases.filter(c=>c.suite==='holdout').length, independent_eligible_at_freeze: frozen.cases.filter(c=>c.provenance.holdout_eligible).length, exposure_after_run: 'Fresh cases become exposed regression material after this validation; no prompt tuning performed.' };
  }
  const file=path.join(runDir,`summary-${Date.now()}.json`); write(file,result);
  console.log(JSON.stringify({summary:file,verdict:result.verdict,overall:result.rows.filter(r=>r.group==='overall'),pairs:result.pairs.filter(p=>p.pass).length+'/'+result.pairs.length,missing:result.missing_generations,usage:result.usage}));
  return result;
}

module.exports={loadProduction,targetState,eligible,baselineEligible,buildCases,executeTarget,score,summarize};
if(require.main===module){
  const [command,dir,...args]=process.argv.slice(2);
  const runDir=path.resolve(root,dir||'output/transfer-analysis-eval-20261013/baseline-01');
  const numWorkers=args.includes('--num_workers')?Number(args[args.indexOf('--num_workers')+1]):4;
  if(!Number.isInteger(numWorkers)||numWorkers<1||numWorkers>8)throw new Error('num_workers must be 1–8');
  const comparisonMode=args.includes('--comparison')?args[args.indexOf('--comparison')+1]:'routing';
  if (!['routing','prompt'].includes(comparisonMode)) throw new Error('comparison must be routing or prompt');
  const freshHoldouts=args.includes('--fresh_holdouts')?args[args.indexOf('--fresh_holdouts')+1]:null;
  Promise.resolve().then(()=>command==='freeze'?freeze(runDir,comparisonMode,freshHoldouts):command==='run'?run(runDir,numWorkers):command==='report'?report(runDir):Promise.reject(new Error('Use freeze, run, or report'))).catch(error=>{console.error(error.stack);process.exitCode=1;});
}

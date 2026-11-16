#!/usr/bin/env node
// Purpose: compare the scattered pre-merge tutor prompt (Class B state) with the single merged tutor policy
// on the frozen contextual-completion and task-label datasets, regenerating both arms with identical judging.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), raw = path.join(__dirname, 'raw'), diag = path.resolve(__dirname, '..');
require('../../v1/product-adapter'); // installs the .ts loader
const { call } = require('../../v1/runner');
const { productionRepair } = require('../../v1/product-adapter');
const ctxRunner = require('../2026-11-13-contextual-completion/runner.cjs');
const { parseTutorDecision } = require(path.join(root, 'tutor-system/src/services/tutorDecisionContract.ts'));
const { formatTutorResponseHistory } = require(path.join(root, 'tutor-system/src/services/tutorResponseHistory.ts'));
const candidatePrompts = require(path.join(root, 'tutor-system/src/services/prompts/index.ts'));
const { buildEcologicalChatCompletionMessages, buildEcologicalTutorUserTurn } = require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));
const baselineEco = require(path.join(raw, 'baseline-src/services/ecologicalTutorCall.ts'));
const baselinePrompts = require(path.join(raw, 'baseline-src/services/prompts/index.ts'));

const arms = ['baseline', 'candidate'];
const SPEC_2026_11_15 = 'Spec clarification approved 2026-11-15 (applies to every judgment): (1) a yes/no answer or verdict to a tutor question that already states the meaning confirms only the visible detail, not the meaning; (2) demonstrated meaning counts across overlapping points and the next task is chosen by its still-missing meaning; (3) an acknowledgment after a contradiction does not repair it, the point stays open until the learner restates or applies the corrected meaning; (4) the tutor stays on the current point until both its tasks are demonstrated, unless the learner leads a change or protection is needed; (5) after two consecutive learner replies without an attempt on the same component, following increasingly concrete scaffolds, a brief explanation of that component followed by a request to apply it is permitted and is not premature disclosure; (6) suggestions may use up to three sentences and 50 words.';
const CTX_TURN2_IDS = ['gift_card_contextual_judgment_real', 'library_contextual_judgment', 'library_agreement_only', 'event_one_answer_covers_overlapping_points', 'phone_contradiction_after_completed_task', 'library_all_tasks_completed'];
const SOFT_WORKER_LIMIT = 32; // previous user-approved ceiling; no documented provider limit, so exceeding it only warns
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = v => crypto.createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');
const save = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); };

function armMessages(arm, room, input) {
  return (arm === 'baseline' ? baselineEco : { buildEcologicalChatCompletionMessages }).buildEcologicalChatCompletionMessages(room, input);
}
const promptsFor = arm => (arm === 'baseline' ? baselinePrompts : candidatePrompts);
function presetRoom(arm, role, inventory) {
  const p = promptsFor(arm);
  return p.generateSystemPrompt({ ...p.PRESET_CONFIGS.casual_peer, role: { role: role === 'adult' ? 'high' : 'low' }, ...inventory });
}
function savedRoom(arm, source) {
  const p = promptsFor(arm), config = source.config.prompt_config, preset = p.PRESET_CONFIGS.supportive_adult;
  const normalized = { ...preset, ...config, role: config.role || preset.role, communication_style: { ...preset.communication_style, ...config.communication_style }, cognitive_parameters: { ...preset.cognitive_parameters, ...config.cognitive_parameters }, emotional_parameters: { ...preset.emotional_parameters, ...config.emotional_parameters }, detection_areas: config.detection_areas || [], verification_steps: config.verification_steps || [] };
  return p.generateSystemPrompt(normalized) + '\n\nCURRENT LEARNING PROGRESS\n' + source.items.map(i => `- ${i.area_text}: ${i.status}`).join('\n');
}

function prepare() {
  const ctxFile = path.join(diag, '2026-11-13-contextual-completion/raw/frozen-v3.json'), tlFile = path.join(diag, '2026-11-13-task-label-continuity/raw/frozen-v12.json'), roomFile = path.join(diag, '2026-11-13-deepseek-target-continuity/raw/frozen.json');
  const ctx = read(ctxFile), tl = read(tlFile), room = read(roomFile);
  const rooms = Object.fromEntries(arms.map(a => [a, savedRoom(a, room.source)]));
  const checks = { baseline_room_equals_saved_shell: rooms.baseline === room.system, candidate_room_equals_saved_shell: rooms.candidate === room.system };
  const units = [];
  for (const c of ctx.cases) units.push({ dataset: 'ctx', case_id: c.id, role: c.role, room_kind: 'preset', turns: [{ message: null }, ...(CTX_TURN2_IDS.includes(c.id) ? [{ message: 'Okay.' }] : []), ...(c.id === 'library_agreement_only' ? [{ message: 'Okay.' }] : [])] });
  for (const c of tl.cases) units.push({ dataset: 'tl', case_id: c.id, role: c.role, room_kind: c.room_system ? 'saved' : 'preset', turns: [{ message: null }] });
  for (const t of tl.trajectories) units.push({ dataset: 'tl', case_id: t.id, role: t.role, room_kind: 'preset', trajectory: true, turns: t.turns.map(x => ({ message: x.message, component: x.component, evidence: x.evidence })) });
  const caseOf = u => (u.dataset === 'ctx' ? ctx.cases : u.trajectory ? tl.trajectories : tl.cases).find(c => c.id === u.case_id);
  const shells = {};
  for (const u of units) {
    const c = caseOf(u);
    shells[u.dataset + ':' + u.case_id] = Object.fromEntries(arms.map(a => [a, armMessages(a, u.room_kind === 'saved' ? rooms[a] : presetRoom(a, c.role, c.inventory), c.input)[0].content]));
  }
  // Diagnostic: the full-response-history candidate arm was the pre-session runtime; compare its system shells.
  const fh = read(path.join(diag, '2026-11-14-full-response-history/raw/frozen-v2.json'));
  const classB = read(path.join(diag, '2026-11-15-class-b-evidence/raw/frozen.json'));
  checks.baseline_matches_class_b_candidate = Object.fromEntries(Object.keys(classB.shells).map(k => [k, classB.shells[k].candidate === shells[k].baseline]));
  const settings = { model: 'qwen3.8-flash', endpoint: ctx.settings.endpoint, target_enable_thinking: false, target_temperature: 0.3, target_max_tokens: 600, judge_enable_thinking: true, judge_temperature: 0, judge_max_tokens: 8000, target_format_attempts: 2, judge_format_attempts: 2, transport_attempts: 2, transport_retry_delay_ms: 2000, timeout_ms: 90000, judge_timeout_ms: 180000, repetitions: 3 };
  const sourcePaths = [path.relative(root, __filename), 'tutor-system/src/services/prompts/index.ts', 'tutor-system/src/services/prompts/activeTutorAgentPrompt.ts', 'tutor-system/src/services/prompts/pedagogy/parameters/roleParameters.ts', 'tutor-system/docs/ai-behaviors/tutor-behavior-specification.md', 'tutor-system/docs/ai-behaviors/constitution.md', 'tutor-system/src/services/ecologicalTutorCall.ts', 'tutor-system/src/services/tutorDecisionContract.ts', 'tutor-system/src/services/tutorResponseHistory.ts', 'evals/promptfoo/v1/runner.js', 'evals/promptfoo/v1/product-adapter.js'];
  const frozen = {
    created_at: new Date().toISOString(), source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), source_dirty: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }),
    inputs: [ctxFile, tlFile, roomFile].map(f => ({ path: path.relative(root, f), sha256: sha(fs.readFileSync(f)) })), settings, arms, checks, units, shells,
    ctx: { cases: ctx.cases, metrics: ctx.metrics, rubrics: ctx.rubrics, judgeSystem: ctx.judgeSystem, judgeProcedures: ctx.judgeProcedures, calibration: ctx.calibration, continuation_rule: fh.judgedCaseRule || 'The newly added Okay acknowledges the tutor but provides no new task evidence. Tutor wording is not learner mastery. Judge the next move against all actual learner evidence and actual delivered tutor turns, including any prior generated error. A previous correction does not make the learner demonstrate understanding; permit an appropriate focused check instead of demanding identical correction wording.' },
    tl: { cases: tl.cases, trajectories: tl.trajectories, metrics: tl.metrics, rubrics: tl.rubrics, judge_system: tl.judge_system, judge_steps: tl.judge_steps, calibration: tl.calibration },
    sources: sourcePaths.map(p => ({ path: p, sha256: sha(fs.readFileSync(path.join(root, p))) })).concat(walk(path.join(raw, 'baseline-src')).map(f => ({ path: path.relative(root, f), sha256: sha(fs.readFileSync(f)) })))
  };
  frozen.fingerprint = sha(frozen); save(path.join(raw, 'frozen.json'), frozen);
  const targets = units.reduce((n, u) => n + u.turns.length, 0) * arms.length * settings.repetitions;
  const summary = { fingerprint: frozen.fingerprint, checks, units: units.length, targets, judgments: targets * 3, calibration: ctx.calibration.length + tl.calibration.length, system_hashes: Object.fromEntries(Object.entries(shells).map(([k, v]) => [k, { baseline: sha(v.baseline).slice(0, 12), candidate: sha(v.candidate).slice(0, 12), baseline_chars: v.baseline.length, candidate_chars: v.candidate.length }])) };
  save(path.join(__dirname, 'preparation.json'), summary); console.log('PREPARED', JSON.stringify({ fingerprint: frozen.fingerprint, checks, targets, judgments: targets * 3, calibration: summary.calibration }));
}
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]).sort(); }
function load() { const s = read(path.join(raw, 'frozen.json')), copy = { ...s }; delete copy.fingerprint; assert.equal(sha(copy), s.fingerprint, 'Frozen snapshot corruption'); return s; }

// Judge request builders copied from the source experiments so grading stays comparable.
function ctxJudgeMessages(s, c, output, metric) {
  return [{ role: 'system', content: s.ctx.judgeSystem + (s.ctx.judgeProcedures?.[metric] ? '\n' + s.ctx.judgeProcedures[metric] : '') }, { role: 'user', content: JSON.stringify({ metric, rubric: s.ctx.rubrics[metric], context_interpretation: 'Judge required task meaning in conversational context, not answer length. Preserve earlier evidence; a risk verdict is not an action unless that judgment itself is the configured behavior.', spec_clarification: SPEC_2026_11_15, scenario: c.input.scenario_context, inventory: c.inventory, history: c.input.conversation_history, latest_learner_message: c.input.student_message, reference: c.reference, response: output.response }) }];
}
function tlJudgeMessages(s, c, output, metric) {
  return [{ role: 'system', content: s.tl.judge_system + '\n' + s.tl.judge_steps[metric] }, { role: 'user', content: JSON.stringify({ metric, rubric: s.tl.rubrics[metric], spec_clarification: SPEC_2026_11_15, evidence: { scenario: c.input.scenario_context, history: c.input.conversation_history, latest_learner_message: c.input.student_message, inventory: c.inventory, reference: c.reference, response: output.response } }) }];
}
function tlParseJudge(result) {
  if (result.error) return { error: result.error };
  try { assert.notEqual(result.payload?.choices?.[0]?.finish_reason, 'length', 'Truncated judge'); const p = JSON.parse(result.text); const text = v => typeof v === 'string' && v.trim(); const entry = v => text(v) || (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.values(v).every(text)); const evidence = v => entry(v) || (Array.isArray(v) && v.length > 0 && v.every(entry)); for (const key of ['current_point', 'learner_evidence', 'reply_components']) assert(evidence(p[key]), 'Missing evidence field ' + key); for (const key of ['reason', 'evidence']) assert(text(p[key]), 'Missing verdict field ' + key); assert(typeof p.pass === 'boolean', 'Expected boolean pass'); return { result: p }; }
  catch (e) { return { error: e.message }; }
}
const judgeKit = { ctx: { messages: ctxJudgeMessages, parse: ctxRunner.parseJudge }, tl: { messages: tlJudgeMessages, parse: tlParseJudge } };
const metricsOf = (s, d) => s[d].metrics;

let active = 0; const waiting = [];
async function limited(workers, fn) { if (active >= workers) await new Promise(r => waiting.push(r)); active++; try { return await fn(); } finally { active--; waiting.shift()?.(); } }

async function generate(s, id, messages, workers) {
  const file = path.join(raw, 'targets', id + '.json');
  if (fs.existsSync(file)) { const r = read(file); assert.equal(r.fingerprint, s.fingerprint); assert.deepEqual(r.messages, messages, 'Resume drift ' + id); return r; }
  const attempts = []; let parsed = null, error = null;
  for (let i = 0; i < s.settings.target_format_attempts; i++) {
    const response = await limited(workers, () => call(i ? productionRepair(messages) : messages, 'target', s.settings)); attempts.push(response);
    try { assert(!response.error, response.error); assert.notEqual(response.payload?.choices?.[0]?.finish_reason, 'length', 'Truncated target'); parsed = parseTutorDecision(response.text); error = null; break; } catch (e) { error = e.message; if (response.error) break; }
  }
  const result = { fingerprint: s.fingerprint, id, messages, attempts, parsed, error }; save(file, result); return result;
}
async function judge(s, dataset, id, c, output, metric, folder, workers) {
  const file = path.join(raw, folder, id + '__' + metric + '.json'), messages = judgeKit[dataset].messages(s, c, output, metric);
  if (fs.existsSync(file)) { const r = read(file); assert.equal(r.fingerprint, s.fingerprint); assert.deepEqual(r.messages, messages); return r; }
  const attempts = []; let parsed;
  for (let i = 0; i < s.settings.judge_format_attempts; i++) { const response = await limited(workers, () => call(messages, 'judge', { ...s.settings, timeout_ms: s.settings.judge_timeout_ms })); attempts.push(response); parsed = judgeKit[dataset].parse(response); if (!parsed.error || response.error) break; }
  const result = { fingerprint: s.fingerprint, id, dataset, metric, messages, attempts, ...parsed }; save(file, result); return result;
}
const caseFor = (s, u) => (u.dataset === 'ctx' ? s.ctx.cases : u.trajectory ? s.tl.trajectories : s.tl.cases).find(c => c.id === u.case_id);
const jobId = (u, arm, rep, turn) => `${u.dataset}__${u.case_id}__${arm}__r${rep}__t${turn}`;

async function runUnit(s, u, arm, rep, workers, log) {
  const c = caseFor(s, u), system = s.shells[u.dataset + ':' + u.case_id][arm];
  let modelHistory = c.input.conversation_history, judgeHistory = c.input.conversation_history;
  for (const [index, turn] of u.turns.entries()) {
    const t = index + 1, id = jobId(u, arm, rep, t);
    let input = c.input, reference = c.reference;
    if (turn.message !== null) {
      const speaker = u.dataset === 'ctx' ? c.reference.focus_learner : 'Alex';
      modelHistory += '\nParticipant: Student (' + speaker + '): ' + turn.message; judgeHistory += '\nParticipant: Student (' + speaker + '): ' + turn.message;
      input = { ...c.input, conversation_history: u.trajectory ? modelHistory : modelHistory, student_message: turn.message };
      reference = u.trajectory ? { ...c.reference, component: turn.component, evidence: turn.evidence + ' Actual prior tutor words do not prove learner understanding.' } : { initial_case_reference: c.reference, continuation_rule: s.ctx.continuation_rule };
    }
    const messages = t === 1 && turn.message === null ? [{ role: 'system', content: system }, { role: 'user', content: buildEcologicalTutorUserTurn(c.input) }] : [{ role: 'system', content: system }, { role: 'user', content: buildEcologicalTutorUserTurn(input) }];
    const r = await generate(s, id, messages, workers);
    log('TARGET', id, r.error || r.parsed.response);
    const judged = { ...c, input: { ...input, conversation_history: turn.message === null ? c.input.conversation_history : judgeHistory }, reference };
    await Promise.all(metricsOf(s, u.dataset).map(async m => {
      if (r.error) { const f = path.join(raw, 'judgments', id + '__' + m + '.json'); if (!fs.existsSync(f)) save(f, { fingerprint: s.fingerprint, id, dataset: u.dataset, metric: m, error: r.error }); return; }
      const j = await judge(s, u.dataset, id, judged, r.parsed, m, 'judgments', workers);
      log('GRADE', id, m, j.error || j.result.pass);
    }));
    if (r.error) { for (let k = t + 1; k <= u.turns.length; k++) { const f = path.join(raw, 'targets', jobId(u, arm, rep, k) + '.json'); if (!fs.existsSync(f)) save(f, { fingerprint: s.fingerprint, id: jobId(u, arm, rep, k), error: 'Blocked by invalid earlier turn', attempts: [] }); } break; }
    modelHistory += '\nTutor/AI: ' + formatTutorResponseHistory(r.parsed, r.parsed.response);
    judgeHistory += '\nTutor/AI: Tutor: ' + r.parsed.response;
  }
}

async function run(s, workers) {
  if (workers > SOFT_WORKER_LIMIT) console.warn(`WARNING: ${workers} workers exceeds the previously approved ceiling of ${SOFT_WORKER_LIMIT}. No documented provider limit justifies a hard cap; watch for 429/timeout responses.`);
  for (const src of s.sources) assert.equal(sha(fs.readFileSync(path.join(root, src.path))), src.sha256, 'Frozen source changed: ' + src.path);
  const started = Date.now(), execution = { started_at: new Date(started).toISOString(), argv: process.argv, workers, fingerprint: s.fingerprint, node: process.version };
  save(path.join(raw, `execution-start-${started}.json`), execution);
  let done = 0; const total = s.units.reduce((n, u) => n + u.turns.length, 0) * arms.length * s.settings.repetitions;
  const log = (kind, ...rest) => { if (kind === 'TARGET') done++; console.log(kind, kind === 'TARGET' ? done + '/' + total : '', ...rest.map(x => typeof x === 'string' ? x.slice(0, 160) : x)); };
  const calibration = [];
  const calJobs = [...s.ctx.calibration.map(ex => ({ dataset: 'ctx', ex, c: s.ctx.cases.find(c => c.id === ex.case_id) })), ...s.tl.calibration.map(ex => ({ dataset: 'tl', ex, c: ex.case }))];
  const calibrationRun = Promise.all(calJobs.map(async ({ dataset, ex, c }) => { const r = await judge(s, dataset, ex.id, c, ex.output, ex.metric, 'calibration-' + dataset, workers); calibration.push({ dataset, id: ex.id, metric: ex.metric, expected: ex.expected, actual: r.result?.pass, error: r.error, agreed: !r.error && r.result.pass === ex.expected }); }));
  const units = s.units.flatMap(u => arms.flatMap(arm => [1, 2, 3].map(rep => ({ u, arm, rep }))));
  await Promise.all([calibrationRun, ...units.map(({ u, arm, rep }) => runUnit(s, u, arm, rep, workers, log))]);
  save(path.join(raw, `calibration-summary-${started}.json`), { ctx: summarizeCal(calibration, 'ctx'), tl: summarizeCal(calibration, 'tl'), rows: calibration });
  save(path.join(raw, `execution-end-${started}.json`), { ...execution, ended_at: new Date().toISOString(), elapsed_ms: Date.now() - started });
  return summarize(s);
}
function summarizeCal(rows, d) { const r = rows.filter(x => x.dataset === d); return { agreed: r.filter(x => x.agreed).length, total: r.length, disagreements: r.filter(x => !x.agreed).map(x => ({ id: x.id, metric: x.metric, expected: x.expected, actual: x.actual, error: x.error })) }; }

function summarize(s) {
  const rows = s.units.flatMap(u => arms.flatMap(arm => [1, 2, 3].flatMap(rep => u.turns.map((_, i) => {
    const id = jobId(u, arm, rep, i + 1), f = path.join(raw, 'targets', id + '.json'), t = fs.existsSync(f) ? read(f) : null;
    return { id, dataset: u.dataset, case_id: u.case_id, trajectory: Boolean(u.trajectory), room_kind: u.room_kind, arm, rep, turn: i + 1, valid: Boolean(t?.parsed && !t.error), response: t?.parsed?.response, reason: t?.parsed?.reason,
      metrics: Object.fromEntries(metricsOf(s, u.dataset).map(m => { const jf = path.join(raw, 'judgments', id + '__' + m + '.json'), j = fs.existsSync(jf) ? read(jf) : null; return [m, !j ? 'missing' : j.error ? 'error' : j.result.pass ? 'pass' : 'fail']; })) };
  }))));
  const count = sel => { const ms = [...new Set(sel.flatMap(r => Object.keys(r.metrics)))]; return { n: sel.length, valid: sel.filter(r => r.valid).length, metrics: Object.fromEntries(ms.map(m => [m, sel.filter(r => r.metrics[m] === 'pass').length + '/' + sel.length + (sel.some(r => ['error', 'missing'].includes(r.metrics[m])) ? ` (${sel.filter(r => ['error', 'missing'].includes(r.metrics[m])).length} err/missing)` : '')])), joint: sel.filter(r => Object.values(r.metrics).every(v => v === 'pass')).length + '/' + sel.length }; };
  const part = pred => Object.fromEntries(arms.map(a => [a, count(rows.filter(r => r.arm === a && pred(r)))]));
  const cases = [...new Set(rows.map(r => r.dataset + ':' + r.case_id))];
  const summary = { fingerprint: s.fingerprint, created_at: new Date().toISOString(),
    overall: { ctx: part(r => r.dataset === 'ctx'), tl: part(r => r.dataset === 'tl') },
    partitions: { ctx_turn1: part(r => r.dataset === 'ctx' && r.turn === 1), ctx_turn2_okay: part(r => r.dataset === 'ctx' && r.turn === 2), tl_fixed: part(r => r.dataset === 'tl' && !r.trajectory), tl_saved_room: part(r => r.room_kind === 'saved'), tl_trajectory: part(r => r.trajectory), tl_trajectory_turn2: part(r => r.trajectory && r.turn === 2) },
    by_case: Object.fromEntries(cases.map(k => [k, part(r => r.dataset + ':' + r.case_id === k)])),
    transitions: rows.filter(r => r.arm === 'baseline').flatMap(a => { const b = rows.find(r => r.arm === 'candidate' && r.dataset === a.dataset && r.case_id === a.case_id && r.rep === a.rep && r.turn === a.turn); return Object.keys(a.metrics).filter(m => a.metrics[m] !== b.metrics[m]).map(m => ({ case: a.dataset + ':' + a.case_id, rep: a.rep, turn: a.turn, metric: m, from: a.metrics[m], to: b.metrics[m] })); }),
    rows };
  const file = path.join(raw, `summary-${Date.now()}.json`); save(file, summary);
  console.log('SUMMARY', JSON.stringify({ file, overall: summary.overall, partitions: summary.partitions }, null, 1)); return summary;
}
async function main() {
  const mode = process.argv[2]; if (mode === 'prepare') return prepare(); const s = load(); if (mode === 'summarize') return summarize(s);
  if (mode === 'run') { const i = process.argv.indexOf('--num-workers'), workers = i === -1 ? 8 : Number(process.argv[i + 1]); assert(Number.isInteger(workers) && workers > 0, 'num-workers must be a positive integer'); return run(s, workers); }
  throw Error('prepare|run|summarize');
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });

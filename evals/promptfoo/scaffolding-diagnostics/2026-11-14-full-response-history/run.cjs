#!/usr/bin/env node
// Purpose: replay failed tutor cases with complete structured history and an uncapped reason instruction, preserving resumable paired evidence.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), raw = path.join(__dirname, 'raw');
require('../../v1/product-adapter');
const { call } = require('../../v1/runner');
const { productionRepair } = require('../../v1/product-adapter');
const { parseJudge } = require('../2026-11-13-contextual-completion/runner.cjs');
const { parseTutorDecision } = require(path.join(root, 'tutor-system/src/services/tutorDecisionContract.ts'));
const { formatTutorResponseHistory } = require(path.join(root, 'tutor-system/src/services/tutorResponseHistory.ts'));
const { generateSystemPrompt, PRESET_CONFIGS } = require(path.join(root, 'tutor-system/src/services/systemPrompts.ts'));
const { buildEcologicalChatCompletionMessages, buildEcologicalTutorUserTurn } = require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));
const ids = ['gift_card_contextual_judgment_real', 'library_contextual_judgment', 'library_agreement_only', 'event_one_answer_covers_overlapping_points', 'phone_contradiction_after_completed_task', 'library_all_tasks_completed'];
const arms = ['baseline', 'full_history'];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); };
function prepare() {
  const previous = read(path.resolve(__dirname, '../2026-11-13-contextual-completion/raw/frozen-v3.json'));
  const cases = previous.cases.filter(c => ids.includes(c.id)); assert.equal(cases.length, 6);
  const shells = {};
  for (const c of cases) {
    const baseline = previous.shells[c.id].task_meaning;
    assert.equal(baseline[0].content.split('At most 40 words of ').length - 1, 2);
    const candidate = structuredClone(baseline);
    candidate[0].content = candidate[0].content.replaceAll('At most 40 words of ', '');
    const room = generateSystemPrompt({ ...PRESET_CONFIGS.casual_peer, role: { role: c.role === 'adult' ? 'high' : 'low' }, ...c.inventory });
    assert.deepEqual(buildEcologicalChatCompletionMessages(room, c.input), candidate, 'Runtime candidate differs from the intended two phrase removals: ' + c.id);
    shells[c.id] = { baseline, full_history: candidate };
  }
  const sourcePaths = ['run.cjs', 'plan.md'].map(p => path.relative(root, path.join(__dirname, p))).concat([
    'tutor-system/docs/ai-behaviors/constitution.md', 'tutor-system/docs/ai-behaviors/tutor-behavior-specification.md', 'tutor-system/docs/ai-behaviors/tutor-response-contract.md',
    'tutor-system/src/services/prompts/activeTutorAgentPrompt.ts', 'tutor-system/src/services/ecologicalTutorCall.ts', 'tutor-system/src/services/tutorDecisionContract.ts', 'tutor-system/src/services/tutorResponseHistory.ts',
    'evals/promptfoo/v1/runner.js', 'evals/promptfoo/v1/product-adapter.js',
    'evals/promptfoo/scaffolding-diagnostics/2026-11-13-contextual-completion/runner.cjs']);
  const settings = { model: 'qwen3.8-flash', endpoint: previous.settings.endpoint, target_enable_thinking: false, target_temperature: 0.3, target_max_tokens: 600, judge_enable_thinking: true, judge_temperature: 0, judge_max_tokens: 8000, target_format_attempts: 2, judge_format_attempts: 2, transport_attempts: 2, transport_retry_delay_ms: 2000, timeout_ms: 90000, judge_timeout_ms: 180000, repetitions: 3 };
  const frozen = { created_at: new Date().toISOString(), source_commit: execFileSync('rtk', ['proxy', 'git', 'rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), inherited_fingerprint: previous.fingerprint, cases, shells, settings, metrics: previous.metrics, rubrics: previous.rubrics, judgeSystem: previous.judgeSystem, judgeProcedures: previous.judgeProcedures, calibration: previous.calibration, calibration_cases: previous.cases, repetitions: [1, 2, 3], turns: [1, 2], followup: 'Okay.', sources: sourcePaths.map(p => ({ path: p, content: fs.readFileSync(path.join(root, p), 'utf8'), sha256: sha(fs.readFileSync(path.join(root, p))) })) };
  frozen.fingerprint = sha(frozen); save(path.join(raw, 'frozen-v2.json'), frozen);
  save(path.join(__dirname, 'preparation-v2.json'), { fingerprint: frozen.fingerprint, cases: ids, targets: 72, judgments: 216, calibration: 16, settings, sources: frozen.sources.map(({ path, sha256 }) => ({ path, sha256 })) });
  console.log('PREPARED', frozen.fingerprint, '72 targets; 216 judgments; 16 calibration checks');
}
function load() { const s = read(path.join(raw, 'frozen-v2.json')); const copy = { ...s }; delete copy.fingerprint; assert.equal(sha(copy), s.fingerprint); return s; }
function messagesFor(s, c, arm, turn, first) {
  if (turn === 1) return s.shells[c.id][arm];
  assert(first.parsed && !first.error, 'Previous turn unavailable');
  const tutor = arm === 'full_history' ? formatTutorResponseHistory(first.parsed, first.parsed.response) : 'Tutor: ' + first.parsed.response;
  const history = c.input.conversation_history + '\nTutor/AI: ' + tutor + '\nParticipant: Student (' + c.reference.focus_learner + '): ' + s.followup;
  return [{ ...s.shells[c.id][arm][0] }, { role: 'user', content: buildEcologicalTutorUserTurn({ ...c.input, conversation_history: history, student_message: s.followup }) }];
}
function judgedCase(s, c, turn, first) {
  if (turn === 1) return c;
  return { ...c, input: { ...c.input, conversation_history: c.input.conversation_history + '\nTutor/AI: Tutor: ' + first.parsed.response + '\nParticipant: Student (' + c.reference.focus_learner + '): ' + s.followup, student_message: s.followup }, reference: { initial_case_reference: c.reference, continuation_rule: 'The newly added Okay acknowledges the tutor but provides no new task evidence. Tutor wording is not learner mastery. Judge the next move against all actual learner evidence and actual delivered tutor turns, including any prior generated error. A previous correction does not make the learner demonstrate understanding; permit an appropriate focused check instead of demanding identical correction wording.' } };
}
function judgeMessages(s, c, output, metric) {
  return [{ role: 'system', content: s.judgeSystem + (s.judgeProcedures?.[metric] ? '\n' + s.judgeProcedures[metric] : '') }, { role: 'user', content: JSON.stringify({ metric, rubric: s.rubrics[metric], context_interpretation: 'Judge required task meaning in conversational context, not answer length. Preserve earlier evidence; a risk verdict is not an action unless that judgment itself is the configured behavior.', scenario: c.input.scenario_context, inventory: c.inventory, history: c.input.conversation_history, latest_learner_message: c.input.student_message, reference: c.reference, response: output.response }) }];
}
async function generate(s, id, messages) {
  const file = path.join(raw, 'targets', id + '.json');
  if (fs.existsSync(file)) { const r = read(file); assert.equal(r.fingerprint, s.fingerprint); assert.deepEqual(r.messages, messages); return r; }
  const attempts = []; let parsed = null, error = null;
  for (let i = 0; i < s.settings.target_format_attempts; i++) {
    const response = await call(i ? productionRepair(messages) : messages, 'target', s.settings); attempts.push(response);
    try { assert(!response.error, response.error); assert.notEqual(response.payload?.choices?.[0]?.finish_reason, 'length', 'Truncated target'); parsed = parseTutorDecision(response.text); error = null; break; } catch (e) { error = e.message; if (response.error) break; }
  }
  const result = { fingerprint: s.fingerprint, id, messages, attempts, parsed, error }; save(file, result); return result;
}
async function judge(s, id, c, output, metric, folder = 'judgments') {
  const file = path.join(raw, folder, id + '__' + metric + '.json'), messages = judgeMessages(s, c, output, metric);
  if (fs.existsSync(file)) { const r = read(file); assert.equal(r.fingerprint, s.fingerprint); assert.deepEqual(r.messages, messages); return r; }
  const attempts = []; let parsed;
  for (let i = 0; i < s.settings.judge_format_attempts; i++) { const response = await call(messages, 'judge', { ...s.settings, timeout_ms: s.settings.judge_timeout_ms }); attempts.push(response); parsed = parseJudge(response); if (!parsed.error || response.error) break; }
  const result = { fingerprint: s.fingerprint, id, metric, messages, attempts, ...parsed }; save(file, result); return result;
}
async function pool(jobs, workers, action) { let cursor = 0; await Promise.all(Array.from({ length: workers }, async () => { while (cursor < jobs.length) await action(jobs[cursor++]); })); }
function jobId(c, arm, rep, turn) { return `${c.id}__${arm}__r${rep}__t${turn}`; }
async function run(s, workers) {
  for (const src of s.sources) assert.equal(sha(fs.readFileSync(path.join(root, src.path))), src.sha256, 'Frozen source changed: ' + src.path);
  const envFile = path.join(root, 'tutor-system/.env');
  const env = require(path.join(root, 'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(envFile));
  assert.equal(env.OAI_BASE_URL.replace(/\/+$/, ''), s.settings.endpoint); assert.equal(env.OAI_MODEL.toLowerCase(), s.settings.model); assert(env.OAI_API_KEY);
  process.env.OAI_BASE_URL = env.OAI_BASE_URL; process.env.OAI_API_KEY = env.OAI_API_KEY;
  const started = Date.now(), execution = { started_at: new Date(started).toISOString(), argv: process.argv, cwd: root, env_reference: envFile, workers, fingerprint: s.fingerprint };
  save(path.join(raw, `execution-start-${started}.json`), execution);
  const calibration = []; let completed = 0;
  await pool(s.calibration, workers, async ex => { const c = s.calibration_cases.find(c => c.id === ex.case_id); const r = await judge(s, ex.id, c, ex.output, ex.metric, 'calibration'); calibration.push({ id: ex.id, expected: ex.expected, actual: r.result?.pass, error: r.error, agreed: !r.error && r.result.pass === ex.expected }); console.log('CALIBRATION', ++completed + '/16', ex.id, r.result?.pass === ex.expected ? 'agree' : 'DISAGREE'); });
  save(path.join(raw, `calibration-summary-${started}.json`), { agreed: calibration.filter(r => r.agreed).length, total: calibration.length, rows: calibration });
  const jobs = s.cases.flatMap(c => arms.flatMap(arm => s.repetitions.map(rep => ({ c, arm, rep }))));
  completed = 0;
  await pool(jobs, workers, async ({ c, arm, rep }) => {
    let first;
    for (const turn of s.turns) {
      const id = jobId(c, arm, rep, turn);
      if (turn === 2 && first.error) { const file = path.join(raw, 'targets', id + '.json'); if (!fs.existsSync(file)) save(file, { fingerprint: s.fingerprint, id, error: 'Blocked by invalid first turn', attempts: [] }); completed++; continue; }
      const result = await generate(s, id, messagesFor(s, c, arm, turn, first));
      console.log('TARGET', ++completed + '/72', id, result.error || result.parsed.response);
      if (turn === 1) first = result;
    }
  });
  const grades = jobs.flatMap(job => s.turns.flatMap(turn => s.metrics.map(metric => ({ ...job, turn, metric })))); completed = 0;
  await pool(grades, workers, async ({ c, arm, rep, turn, metric }) => {
    const id = jobId(c, arm, rep, turn), result = read(path.join(raw, 'targets', id + '.json'));
    if (!result.error) { const first = turn === 2 ? read(path.join(raw, 'targets', jobId(c, arm, rep, 1) + '.json')) : null; const r = await judge(s, id, judgedCase(s, c, turn, first), result.parsed, metric); console.log('GRADE', ++completed + '/216', id, metric, r.error || r.result.pass); }
    else { const file = path.join(raw, 'judgments', id + '__' + metric + '.json'); if (!fs.existsSync(file)) save(file, { fingerprint: s.fingerprint, id, metric, error: result.error }); completed++; }
  });
  save(path.join(raw, `execution-end-${started}.json`), { ...execution, ended_at: new Date().toISOString(), elapsed_ms: Date.now() - started, calibration_agreed: calibration.filter(r => r.agreed).length });
  summarize(s);
}
function summarize(s) {
  const rows = s.cases.flatMap(c => arms.flatMap(arm => s.repetitions.flatMap(rep => s.turns.map(turn => {
    const id = jobId(c, arm, rep, turn), file = path.join(raw, 'targets', id + '.json'), target = fs.existsSync(file) ? read(file) : null;
    return { id, case_id: c.id, arm, rep, turn, valid: Boolean(target?.parsed && !target.error), reason: target?.parsed?.reason, response: target?.parsed?.response, target_sha256: target ? sha(fs.readFileSync(file)) : null, metrics: Object.fromEntries(s.metrics.map(m => { const f = path.join(raw, 'judgments', id + '__' + m + '.json'), r = fs.existsSync(f) ? read(f) : null; return [m, !r ? 'missing' : r.error ? 'error' : r.result.pass ? 'pass' : 'fail']; })) };
  }))));
  const count = selected => ({ expected: selected.length, valid: selected.filter(r => r.valid).length, metrics: Object.fromEntries(s.metrics.map(m => [m, Object.fromEntries(['pass', 'fail', 'error', 'missing'].map(v => [v, selected.filter(r => r.metrics[m] === v).length]))])), joint: selected.filter(r => s.metrics.every(m => r.metrics[m] === 'pass')).length });
  const summary = { fingerprint: s.fingerprint, created_at: new Date().toISOString(), overall: Object.fromEntries(arms.map(a => [a, count(rows.filter(r => r.arm === a))])), by_turn: Object.fromEntries(s.turns.map(t => [t, Object.fromEntries(arms.map(a => [a, count(rows.filter(r => r.arm === a && r.turn === t))]))])), by_case: Object.fromEntries(ids.map(id => [id, Object.fromEntries(arms.map(a => [a, count(rows.filter(r => r.arm === a && r.case_id === id))]))])), transitions: Object.fromEntries(s.metrics.map(m => [m, rows.filter(r => r.arm === 'baseline').map(a => { const b = rows.find(r => r.arm === 'full_history' && r.case_id === a.case_id && r.rep === a.rep && r.turn === a.turn); return { baseline: a.id, candidate: b.id, from: a.metrics[m], to: b.metrics[m] }; }).filter(r => r.from !== r.to)])), rows };
  const file = path.join(raw, `summary-${Date.now()}.json`); save(file, summary);
  console.log('SUMMARY', JSON.stringify({ file, overall: summary.overall, by_turn: summary.by_turn })); return summary;
}
async function main() { const mode = process.argv[2]; if (mode === 'prepare') return prepare(); const s = load(); if (mode === 'summarize') return summarize(s); if (mode === 'run') { const i = process.argv.indexOf('--num-workers'); const workers = i === -1 ? 8 : Number(process.argv[i + 1]); assert(Number.isInteger(workers) && workers > 0 && workers <= 32); return run(s, workers); } throw Error('prepare|run|summarize'); }
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });
module.exports = { messagesFor, judgedCase, judgeMessages, load, sha, summarize };

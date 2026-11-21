#!/usr/bin/env node
// Purpose: audit every saved Class A reply for cross-point jumps with a separately calibrated target-continuity judge.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const raw = path.join(__dirname, 'raw'), out = path.join(raw, 'continuity'), diag = path.resolve(__dirname, '..');
require('../../v1/product-adapter');
const { call } = require('../../v1/runner');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha = v => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const save = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n', { flag: 'wx' }); };

const SYSTEM = `You audit one tutor reply for knowledge-point continuity. Return one JSON object only.
The inventory lists numbered knowledge points. Each point has an Observation task ("What to notice") and a Behavior task ("What to do").
Step 1. From the history, determine the CURRENT point: the knowledge point addressed by the most recent tutor question or teaching that this learner has not yet finished. If the learner contradicted an earlier understanding, the contradicted point is reopened and becomes current until the learner repairs it in their own words.
Evidence rules: only this learner's own words count. Tutor statements are not learner evidence. A bare agreement or verdict ("Yes", "Okay", "not safe") after a tutor statement adds no new meaning. A meaning demonstrated once counts for every overlapping point that requires it. A point is complete only when both of its tasks are demonstrated.
Step 2. Classify what the reply works on, as one category:
- current_point: works on any task of the current point (choosing observation versus behavior within that point is NOT judged here)
- other_point: works on a different knowledge point
- completed_task_retest: re-asks a task this learner already demonstrated, on any point
- generic_off_inventory: safety content not tied to any configured task
- consolidation: summarises without starting a new task
- protection_or_guard: immediate protective instruction or participation correction
Step 3. cross_point_jump is true only when the reply works on a different knowledge point while the current point still has an unfinished task, the learner did not ask to change topic, and no imminent unsafe action required protection. Moving to another point after the current point is complete is not a jump. Retesting a completed task is not a jump. If no point is current because every point is complete, cross_point_jump is false.
Return: {"current_point":"...","current_unfinished_task":"...","learner_evidence":"...","reply_target":"...","category":"...","cross_point_jump":true|false,"reason":"..."}`;
const CATEGORIES = ['current_point', 'other_point', 'completed_task_retest', 'generic_off_inventory', 'consolidation', 'protection_or_guard'];

// Calibration: existing task-label examples relabelled for cross-point jumps only, plus the historical movie switch.
const CAL = [
  ['progression_positive__responsive_progression', false], ['progression_retest__responsive_progression', false], ['movie_switch_to_time', true], ['movie_same_destination_action', false],
  ['unfinished_switch', true], ['unfinished_useful_continue', false], ['completed_next_observation', false], ['completed_retest', false], ['observed_movie_unfinished_switch', true],
  ['observed_address_unfinished_switch', true], ['observed_agreement_not_observation_completion', false], ['observed_same_point_behavior_opportunity', false]
];
const HISTORICAL = 'Correct, it is not safe. A better choice is to wait until you leave the theater. Then you can share photos or say you had fun.';

function evidenceFromJudgment(file) {
  const j = read(file), user = JSON.parse(j.messages[1].content), e = user.evidence || user;
  return { scenario: e.scenario, inventory: e.inventory, history: e.history, latest_learner_message: e.latest_learner_message, case_reference: e.reference, response: e.response };
}
function messages(e) { return [{ role: 'system', content: SYSTEM }, { role: 'user', content: JSON.stringify(e) }]; }
function parse(r) {
  if (r.error) return { error: r.error };
  try { assert.notEqual(r.payload?.choices?.[0]?.finish_reason, 'length', 'Truncated'); const p = JSON.parse(r.text); assert(CATEGORIES.includes(p.category), 'Bad category ' + p.category); assert(typeof p.cross_point_jump === 'boolean'); for (const k of ['current_point', 'reply_target', 'reason']) assert(typeof p[k] === 'string' && p[k].trim(), 'Missing ' + k); return { result: p }; }
  catch (e) { return { error: e.message }; }
}
let active = 0; const waiting = [];
async function limited(n, fn) { if (active >= n) await new Promise(r => waiting.push(r)); active++; try { return await fn(); } finally { active--; waiting.shift()?.(); } }
async function judge(id, e, settings, workers, folder) {
  const file = path.join(out, folder, id + '.json'), m = messages(e);
  if (fs.existsSync(file)) { const r = read(file); assert.deepEqual(r.messages, m); return r; }
  const attempts = []; let parsed;
  for (let i = 0; i < 2; i++) { const r = await limited(workers, () => call(m, 'judge', { ...settings, timeout_ms: settings.judge_timeout_ms })); attempts.push(r); parsed = parse(r); if (!parsed.error || r.error) break; }
  const result = { id, system_sha256: sha(SYSTEM), messages: m, attempts, ...parsed }; save(file, result); return result;
}

async function main() {
  const workers = Number(process.argv[process.argv.indexOf('--num-workers') + 1] || 40);
  if (workers > 32) console.warn(`WARNING: ${workers} workers exceeds the previously approved ceiling of 32; no documented provider limit justifies a hard cap.`);
  const s = read(path.join(raw, 'frozen.json')), settings = s.settings;
  const tl = read(path.join(diag, '2026-11-13-task-label-continuity/raw/frozen-v12.json'));
  const cal = CAL.map(([id, jump]) => { const ex = tl.calibration.find(x => x.id === id); assert(ex, id); const c = ex.case; return { id, expected_jump: jump, e: { scenario: c.input.scenario_context, inventory: c.inventory, history: c.input.conversation_history, latest_learner_message: c.input.student_message, case_reference: c.reference, response: ex.output.response } }; });
  const movie = tl.cases.find(c => c.id === 'room_unanswered_original');
  cal.push({ id: 'historical_movie_switch', expected_jump: true, e: { scenario: movie.input.scenario_context, inventory: movie.inventory, history: movie.input.conversation_history, latest_learner_message: movie.input.student_message, case_reference: movie.reference, response: HISTORICAL } });
  const calRows = await Promise.all(cal.map(async x => { const r = await judge(x.id, x.e, settings, workers, 'calibration'); return { id: x.id, expected: x.expected_jump, actual: r.result?.cross_point_jump, category: r.result?.category, error: r.error }; }));
  const agreed = calRows.filter(r => !r.error && r.actual === r.expected).length;
  console.log('CALIBRATION', agreed + '/' + calRows.length, JSON.stringify(calRows.filter(r => r.actual !== r.expected)));
  if (!process.argv.includes('--audit')) return;
  const targets = fs.readdirSync(path.join(raw, 'targets')).filter(f => f.endsWith('.json'));
  const rows = await Promise.all(targets.map(async f => {
    const id = f.slice(0, -5), t = read(path.join(raw, 'targets', f)); if (t.error) return { id, error: t.error };
    const jf = fs.readdirSync(path.join(raw, 'judgments')).find(x => x.startsWith(id + '__'));
    const e = evidenceFromJudgment(path.join(raw, 'judgments', jf)); assert.equal(e.response, t.parsed.response, 'Response mismatch ' + id);
    const r = await judge(id, e, settings, workers, 'audit');
    return { id, arm: id.includes('__baseline__') ? 'baseline' : 'candidate', case: id.split('__').slice(0, 2).join(':'), jump: r.result?.cross_point_jump, category: r.result?.category, error: r.error, response: t.parsed.response, reply_target: r.result?.reply_target, current_point: r.result?.current_point };
  }));
  const tally = arm => { const a = rows.filter(r => r.arm === arm); return { n: a.length, jumps: a.filter(r => r.jump === true).length, errors: a.filter(r => r.error).length, categories: Object.fromEntries(CATEGORIES.map(c => [c, a.filter(r => r.category === c).length])) }; };
  const summary = { created_at: new Date().toISOString(), system_sha256: sha(SYSTEM), calibration: { agreed, total: calRows.length, rows: calRows }, overall: { baseline: tally('baseline'), candidate: tally('candidate') },
    by_case: Object.fromEntries([...new Set(rows.map(r => r.case))].sort().map(k => [k, Object.fromEntries(['baseline', 'candidate'].map(a => [a, rows.filter(r => r.case === k && r.arm === a && r.jump).length + '/' + rows.filter(r => r.case === k && r.arm === a).length]))])), rows };
  const file = path.join(out, `summary-${Date.now()}.json`); save(file, summary);
  console.log('SUMMARY', file, JSON.stringify(summary.overall, null, 1));
}
if (require.main === module) main().catch(e => { console.error(e.stack); process.exitCode = 1; });

#!/usr/bin/env node
// Purpose: let an LLM beginner student converse with the frozen experimental tutor and save every model call.
'use strict';
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../../..');
require('../../v1/product-adapter');
const { buildEcologicalChatCompletionMessages } = require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));
const { parseTutorDecision } = require(path.join(root, 'tutor-system/src/services/tutorDecisionContract.ts'));
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const save = (p, value) => fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });

function studentMessages(persona, scenario, history) {
  return [{ role: 'system', content: persona }, { role: 'user', content: JSON.stringify({ post: scenario, conversation: history }) }];
}

async function main() {
  const turns = Number(process.argv[2] || 6);
  assert(Number.isInteger(turns) && turns > 0 && turns <= 20, 'Use 1–20 turns');
  const directory = process.argv[3] ? path.resolve(process.argv[3]) : path.join(__dirname, 'raw', new Date().toISOString().replaceAll(':', '-'));
  fs.mkdirSync(directory, { recursive: true });
  const envFile = process.env.PTP_EVAL_ENV_FILE || '/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env';
  const env = require(path.join(root, 'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(envFile));
  assert.equal(env.OAI_MODEL, 'deepseek-flash');
  assert.equal(env.OAI_BASE_URL.replace(/\/+$/, ''), 'https://api.deepseek.com');
  assert(env.OAI_API_KEY, 'OAI_API_KEY is required');
  const frozen = read(path.join(__dirname, '../2026-11-13-deepseek-target-continuity/raw/frozen.json'));
  const persona = fs.readFileSync(path.join(__dirname, 'student.txt'), 'utf8');
  const snapshot = { turns, persona, tutor_system: frozen.system, seed: frozen.input, model: env.OAI_MODEL,
    endpoint: env.OAI_BASE_URL, tutor_temperature: 0.3, student_temperature: 0.7, max_tokens: 600,
    thinking: { type: 'disabled' }, environment_reference: envFile, runner: fs.readFileSync(__filename, 'utf8'),
    limitation: 'Continues the saved room branch point. Checklist state stays frozen; simulated dialogue is not evidence of human learning.' };
  const snapshotPath = path.join(directory, 'snapshot.json');
  if (fs.existsSync(snapshotPath)) assert.deepEqual(read(snapshotPath), snapshot, 'Resume configuration changed');
  else save(snapshotPath, snapshot);
  async function call(id, messages, temperature, parse) {
    const file = path.join(directory, id + '.json');
    const request = { model: env.OAI_MODEL, messages, temperature, max_tokens: 600, thinking: { type: 'disabled' }, response_format: { type: 'json_object' } };
    if (fs.existsSync(file)) {
      const saved = read(file); assert.deepEqual(saved.request, request, 'Resume input changed');
      assert(!saved.error, saved.error); return parse(saved.payload.choices[0].message.content);
    }
    const record = { started_at: new Date().toISOString(), request };
    let parsed;
    try {
      const response = await fetch(env.OAI_BASE_URL.replace(/\/+$/, '') + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OAI_API_KEY }, body: JSON.stringify(request), signal: AbortSignal.timeout(90000) });
      record.status = response.status; record.raw_response = await response.text();
      assert(response.ok, 'HTTP ' + response.status);
      record.payload = JSON.parse(record.raw_response);
      assert.equal(record.payload.choices[0].finish_reason, 'stop', 'Incomplete model response');
      parsed = parse(record.payload.choices[0].message.content);
    } catch (error) { record.error = error.message; }
    record.completed_at = new Date().toISOString(); save(file, record);
    assert(!record.error, record.error); return parsed;
  }
  let input = structuredClone(frozen.input);
  const transcript = [];
  console.log('Saved student: ' + input.student_message);
  for (let turn = 1; turn <= turns; turn++) {
    const tutor = await call(`tutor-${turn}`, buildEcologicalChatCompletionMessages(frozen.system, input), 0.3, parseTutorDecision);
    const visibleHistory = input.conversation_history + '\nTutor: ' + tutor.response;
    const student = await call(`student-${turn}`, studentMessages(persona, input.scenario_context, visibleHistory), 0.7, text => {
      const value = JSON.parse(text); assert(typeof value.message === 'string' && value.message.trim(), 'Missing student reply'); return value.message.trim();
    });
    transcript.push({ turn, tutor: tutor.response, student });
    console.log(`\n${turn}. Tutor: ${tutor.response}\n   Student: ${student}`);
    input = { ...input, conversation_history: visibleHistory + '\nParticipant: Student (Learner): ' + student, student_message: student, prior_guard_mode: tutor.decision.guard_mode };
  }
  const transcriptPath = path.join(directory, 'transcript.json');
  if (fs.existsSync(transcriptPath)) assert.deepEqual(read(transcriptPath), transcript);
  else save(transcriptPath, transcript);
  console.log('\nSaved: ' + directory);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { studentMessages };

#!/usr/bin/env node
// Purpose: replay a real unfinished-target turn and controlled continuations with DeepSeek, retaining complete immutable evidence.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..'), raw = path.join(__dirname, 'raw');
require('../../v1/product-adapter');
const { generateSystemPrompt, PRESET_CONFIGS } = require(path.join(root, 'tutor-system/src/services/systemPrompts.ts'));
const { buildEcologicalChatCompletionMessages, buildEcologicalCaseVarsFromRoomDialogue } = require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));
const { parseTutorDecision } = require(path.join(root, 'tutor-system/src/services/tutorDecisionContract.ts'));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const settings = { model: 'deepseek-flash', endpoint: 'https://api.deepseek.com', temperature: 0.3, max_tokens: 600, thinking: { type: 'disabled' }, response_format: { type: 'json_object' }, repetitions: 3, num_workers: 3, timeout_ms: 90000, max_active_ms: 1800000 };
function prepare() {
  const source = read(path.join(raw, 'room-snapshot.json')), config = source.config.prompt_config;
  const preset = PRESET_CONFIGS.supportive_adult;
  const normalized = { ...preset, ...config, role: config.role || preset.role,
    communication_style: { ...preset.communication_style, ...config.communication_style },
    cognitive_parameters: { ...preset.cognitive_parameters, ...config.cognitive_parameters },
    emotional_parameters: { ...preset.emotional_parameters, ...config.emotional_parameters },
    detection_areas: config.detection_areas || [], verification_steps: config.verification_steps || [] };
  const system = generateSystemPrompt(normalized) + '\n\nCURRENT LEARNING PROGRESS\n' + source.items.map(i => `- ${i.area_text}: ${i.status}`).join('\n');
  const selected = source.messages.slice(0, 5);
  assert.equal(selected.at(-1).content, 'Oh , not safe');
  const dialogue = [...source.room.pre_populated_dialogue, ...selected.map(m => ({ role: m.user_role, message: m.content, user_name: m.user_role === 'student' ? 'Learner' : 'Tutor', timestamp: m.created_at }))];
  const input = { ...buildEcologicalCaseVarsFromRoomDialogue(source.room.title, source.room.description, dialogue), prior_guard_mode: false };
  const paths = ['tutor-system/src/services/aiService.ts', 'tutor-system/src/services/ecologicalTutorCall.ts', 'tutor-system/src/services/tutorDecisionContract.ts', 'tutor-system/src/services/systemPrompts.ts', 'tutor-system/docs/ai-behaviors/constitution.md', 'tutor-system/docs/ai-behaviors/tutor-behavior-specification.md', 'tutor-system/docs/ai-behaviors/tutor-response-contract.md'];
  function walk(dir) { for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (p.endsWith('.ts')) paths.push(p); } }
  walk('tutor-system/src/services/prompts');
  const sources = [...new Set(paths)].sort().map(p => ({ path: p, content: fs.readFileSync(path.join(root, p), 'utf8'), sha256: sha(fs.readFileSync(path.join(root, p))) }));
  const frozen = { created_at: new Date().toISOString(), source, settings, input, system, messages: buildEcologicalChatCompletionMessages(system, input), sources,
    source_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    source_dirty: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }),
    runner_sha256: sha(fs.readFileSync(__filename)), interventions: ['Yes', 'Okay'],
    limitations: ['Current local prompt reconstruction, not original HTTP capture.', 'Live learner display name normalized to Learner; original messages unchanged.', 'Checklist state frozen; analyzer not rerun during continuations.', 'Fixed replays and trajectories are separate unseeded samples of one exposed scenario; no population estimate or calibrated acceptance.'] };
  const file = path.join(raw, 'frozen.json');
  if (fs.existsSync(file)) {
    const prior = read(file); assert.equal(prior.runner_sha256, frozen.runner_sha256); assert.deepEqual(prior.messages, frozen.messages); assert.deepEqual(prior.settings, settings); return prior;
  }
  save(file, frozen); return frozen;
}
async function main() {
  const f = prepare(), envFile = process.env.PTP_EVAL_ENV_FILE || '/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env';
  const env = require(path.join(root, 'tutor-system/node_modules/dotenv')).parse(fs.readFileSync(envFile));
  assert.equal(env.OAI_MODEL, settings.model); assert.equal(env.OAI_BASE_URL.replace(/\/+$/, ''), settings.endpoint); assert(env.OAI_API_KEY);
  const start = Date.now(), executionFile = path.join(raw, `execution-${start}.json`);
  async function generate(id, input) {
    const file = path.join(raw, id + '.json'), messages = buildEcologicalChatCompletionMessages(f.system, input);
    if (fs.existsSync(file)) { const old = read(file); assert.deepEqual(old.request.messages, messages); assert(!old.error, 'Failed saved call requires explicit new run'); return old; }
    assert(Date.now() - start < settings.max_active_ms, 'Run budget exhausted');
    const body = { model: settings.model, messages, temperature: settings.temperature, max_tokens: settings.max_tokens, thinking: settings.thinking, response_format: settings.response_format };
    const result = { id, started_at: new Date().toISOString(), endpoint: settings.endpoint, request: body, input, frozen_sha256: sha(fs.readFileSync(path.join(raw, 'frozen.json'))) };
    try {
      const response = await fetch(settings.endpoint + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.OAI_API_KEY }, body: JSON.stringify(body), signal: AbortSignal.timeout(settings.timeout_ms) });
      result.http_status = response.status; result.raw_response = await response.text();
      assert(response.ok, 'HTTP ' + response.status);
      result.payload = JSON.parse(result.raw_response); assert.equal(result.payload.choices[0].finish_reason, 'stop');
      result.parsed = parseTutorDecision(result.payload.choices[0].message.content);
    } catch (error) { result.error = error.message; }
    result.completed_at = new Date().toISOString(); save(file, result);
    console.log(id, result.error || JSON.stringify(result.parsed));
    assert(!result.error, id + ': ' + result.error); return result;
  }
  let error = null;
  try {
    await Promise.all([1, 2, 3].map(r => generate(`fixed-r${r}`, f.input)));
    await Promise.all([1, 2, 3].map(async r => {
      let input = structuredClone(f.input);
      for (let turn = 1; turn <= 3; turn++) {
        const result = await generate(`journey-r${r}-t${turn}`, input);
        if (turn < 3) { const message = f.interventions[turn - 1]; input = { ...input, conversation_history: input.conversation_history + '\nTutor/AI: Tutor (Tutor): ' + result.parsed.response + '\nParticipant: Student (Learner): ' + message, student_message: message, prior_guard_mode: result.parsed.decision.guard_mode }; }
      }
    }));
  } catch (e) { error = e.message; process.exitCode = 1; }
  save(executionFile, { started_at: new Date(start).toISOString(), completed_at: new Date().toISOString(), elapsed_ms: Date.now() - start, command: 'rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-13-deepseek-target-continuity/run.cjs', cwd: root, environment_reference: envFile, exit_status: error ? 1 : 0, error });
  if (error) throw Error(error);
  const files = fs.readdirSync(raw).sort().map(name => { const data = fs.readFileSync(path.join(raw, name)); return { path: 'raw/' + name, bytes: data.length, sha256: sha(data) }; });
  save(path.join(__dirname, 'evidence-manifest.json'), { settings, files, file_count: files.length, bytes: files.reduce((n, x) => n + x.bytes, 0), manifest_sha256: sha(JSON.stringify(files)) });
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

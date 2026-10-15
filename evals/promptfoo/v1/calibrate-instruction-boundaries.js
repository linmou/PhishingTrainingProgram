#!/usr/bin/env node
// Purpose: compare original and clarified action-realization judges on independently labeled diagnostic boundaries.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { call, checkedResult, judgeMessages, rubricsFor, sha } = require('./runner');

async function main() {
  const [proposalFile, settingsFile, directory, mode] = process.argv.slice(2);
  if (!proposalFile || !settingsFile || !directory) throw new Error('Supply diagnostic proposal JSON, settings JSON and a new evidence directory.');
  if (mode !== undefined && mode !== '--current-only') throw new Error('Optional mode must be --current-only.');
  const currentOnly = mode === '--current-only';
  const proposalText = fs.readFileSync(proposalFile, 'utf8');
  const proposal = JSON.parse(proposalText).proposed_evaluator_revision;
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  const metric = 'instruction_realization';
  const fixtures = proposal.calibration_fixtures;
  if (!fixtures.length || new Set(fixtures.map(x => x.id)).size !== fixtures.length || fixtures.some(x => typeof x.expected_realization !== 'boolean')) throw new Error('Calibration labels must be frozen and unambiguous.');
  const original = rubricsFor({ expected: { checks: [metric] }, legacy: [] })[metric];
  const rubrics = currentOnly ? { current: original } : { original, clarified: original + '\n\nSemantic action boundaries:\n' + proposal.exact_generalized_clarification.join('\n\n') };
  const dependencies = ['runner.js', 'evaluator.js', '../rubrics/v1/manifest.json'].map(file => ({ file, content: fs.readFileSync(path.join(__dirname, file), 'utf8') }));
  const identity = { proposalFile, proposal_sha256: sha(proposalText), currentOnly, settings, fixtures, contexts: proposal.calibration_contexts, rubrics, dependencies, source: fs.readFileSync(__filename, 'utf8') };
  const fingerprint = sha(identity);
  fs.mkdirSync(directory, { recursive: true });
  const snapshotFile = path.join(directory, 'snapshot.json');
  if (fs.existsSync(snapshotFile)) {
    if (JSON.parse(fs.readFileSync(snapshotFile, 'utf8')).fingerprint !== fingerprint) throw new Error('Calibration resume identity changed.');
  } else fs.writeFileSync(snapshotFile, JSON.stringify({ fingerprint, started_at: new Date().toISOString(), command: process.argv, ...identity }, null, 2) + '\n', { flag: 'wx' });
  const jobs = Object.keys(rubrics).flatMap(condition => fixtures.map(fixture => {
    const context = fixture.context_override || proposal.calibration_contexts[fixture.context];
    const input = { id: fixture.id, role: context.configured_role, inventory: context.knowledge_inventory,
      input: { scenario_context: context.scenario_context, conversation_history: context.conversation_history, student_message: context.student_message, prior_mode: context.prior_mode },
      expected: { checks: [metric], knowledge_required: true }, legacy: [] };
    const returnedMode = fixture.mode === undefined ? 'tutoring' : fixture.mode;
    const output = { mode: returnedMode, decision: { mode: returnedMode, instruction: fixture.instruction }, suggested_response: fixture.response };
    return { condition, fixture, input, output, messages: judgeMessages(input, output, { [metric]: rubrics[condition] }) };
  }));
  function grade(raw, fixture) {
    let parsed;
    try { parsed = JSON.parse(raw.text)?.[metric]; } catch { parsed = null; }
    const result = checkedResult(metric, parsed);
    return { result, agrees: !raw.error && ['pass', 'fail'].includes(result.status) && result.pass === fixture.expected_realization };
  }
  function readEvidence(job) {
    const row = JSON.parse(fs.readFileSync(path.join(directory, job.condition + '-' + job.fixture.id + '.json'), 'utf8'));
    const request = { model: settings.model, messages: job.messages, temperature: settings.judge_temperature,
      max_tokens: settings.judge_max_tokens, enable_thinking: Boolean(settings.judge_enable_thinking), response_format: { type: 'json_object' } };
    if (row.fingerprint !== fingerprint || row.condition !== job.condition || ['fixture', 'input', 'output'].some(key => sha(row[key]) !== sha(job[key])) || sha(row.raw.request) !== sha(request)) throw new Error('Cached calibration evidence does not match the frozen job.');
    return { ...row, ...grade(row.raw, job.fixture) };
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      const { condition, fixture, input, output, messages } = job;
      const file = path.join(directory, condition + '-' + fixture.id + '.json');
      if (fs.existsSync(file)) { readEvidence(job); continue; }
      const raw = await call(messages, 'judge', settings);
      const { result, agrees } = grade(raw, fixture);
      fs.writeFileSync(file, JSON.stringify({ fingerprint, condition, fixture, input, output, raw, result, agrees }, null, 2) + '\n', { flag: 'wx' });
      console.log(`${condition} ${fixture.id} agrees=${agrees} status=${result.status}`);
    }
  }));
  const results = jobs.map(readEvidence);
  const conditions = Object.fromEntries(Object.keys(rubrics).map(condition => {
    const rows = results.filter(x => x.condition === condition);
    return [condition, { total: rows.length, agreed: rows.filter(x => x.agrees).length, errors: rows.filter(x => x.raw.error || !['pass', 'fail'].includes(x.result.status)).length,
      disagreements: rows.filter(x => !x.agrees).map(x => ({ id: x.fixture.id, expected: x.fixture.expected_realization, result: x.result })) }];
  }));
  const summary = { completed_at: new Date().toISOString(), fingerprint, conditions, limitation: 'Constructed diagnostic boundaries measure judge agreement, not target performance. No existing run score is changed.' };
  const summaryFile = path.join(directory, 'summary.json');
  if (!fs.existsSync(summaryFile)) fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(summary));
  if (conditions[currentOnly ? 'current' : 'clarified'].agreed !== fixtures.length || Object.values(conditions).some(x => x.errors)) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });

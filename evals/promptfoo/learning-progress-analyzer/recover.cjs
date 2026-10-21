#!/usr/bin/env node
// Purpose: preserve completed transfer responses and retry only transport failures under a separately frozen longer timeout.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { hash, validateManifest, generations } = require('./current.cjs');
const root = path.resolve(__dirname, '../../..');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); };
function transportFailure(row) {
  return row.result.calls.length === 1 && row.result.calls.every(c => Boolean(c.error) || [429, 502, 503, 504].includes(c.status));
}
async function freeze(dir, reference) {
  if (fs.existsSync(dir)) throw new Error('New directory required');
  const before = read(path.join(reference, 'frozen.json')); validateManifest(before);
  const rows = await generations(reference, before);
  if (rows.length !== before.expected_generations) throw new Error('Complete reference required');
  if (![180000, 600000].includes(before.settings.timeout_ms) || before.settings.target_attempts !== 1) throw new Error('Expected the single-attempt diagnostic protocol');
  let attempt = 2;
  if (before.settings.timeout_ms === 600000) {
    const previous = read(path.join(reference, 'recovery-manifest.json'));
    if (previous.attempt_number && previous.attempt_number !== 2) throw new Error('Three total transport attempts exhausted');
    const originalFile = path.join(root, before.reference, 'frozen.json');
    if (hash(fs.readFileSync(originalFile, 'utf8')) !== previous.reference_frozen_sha256 || read(originalFile).settings.timeout_ms !== 180000) throw new Error('Expected first recovery from the original180second condition');
    attempt = 3;
  }
  const dotenv = require(path.join(root, 'tutor-system/node_modules/dotenv'));
  const env = { ...dotenv.parse(fs.readFileSync(path.join(root, 'tutor-system/.env'))), ...process.env };
  if (!env.OAI_BASE_URL) throw new Error('Missing configured endpoint');
  const endpoint = env.OAI_BASE_URL.replace(/\/$/, '');
  if (rows.some(g => g.result.calls.some(c => c.endpoint !== endpoint))) throw new Error('Provider endpoint changed');
  const failed = rows.filter(transportFailure);
  if (failed.some(g => before.cases.find(c => c.id === g.case_id).sequence_id)) throw new Error('Sequence transport recovery requires a separate state-propagation plan');
  const omitted = new Set(failed.map(g => g.case_id + '/' + g.repetition));
  for (const [alias, canonical] of Object.entries(before.aliases)) for (const rep of [1, 2, 3]) {
    if (omitted.has(canonical + '/' + rep)) omitted.add(alias + '/' + rep);
  }
  const frozen = structuredClone(before);
  Object.assign(frozen, { run_id: path.basename(dir), frozen_at: new Date().toISOString(), reference: path.relative(root, reference),
    comparison: `Transport recovery attempt${attempt}of3: preserve every completed model response, including behavior failures; retry only failed transport requests once with a600second timeout. Model request bytes, prompts, cases and consumer stay fixed. Original errors remain in the referenced run.` });
  frozen.settings.timeout_ms = 600000;
  const content = fs.readFileSync(__filename, 'utf8');
  frozen.artifacts.push({ path: path.relative(root, __filename), content, sha256: hash(content) });
  validateManifest(frozen);
  save(path.join(dir, 'frozen.json'), frozen);
  const entries = [];
  for (const row of rows) {
    const source = path.join(reference, 'generations', `${row.case_id}-r${row.repetition}.json`);
    const provenance = { file: path.relative(root, source), sha256: hash(fs.readFileSync(source, 'utf8')), generation_id: row.generation_id };
    const retry = omitted.has(row.case_id + '/' + row.repetition);
    entries.push({ case_id: row.case_id, repetition: row.repetition, retry, source: provenance, prior_calls: row.result.calls });
    if (!retry) save(path.join(dir, 'generations', path.basename(source)), { ...row, frozen_sha256: hash(frozen),
      generation_id: `${frozen.run_id}/${row.case_id}/r${row.repetition}`, source_evidence: provenance });
  }
  await generations(dir, frozen);
  const manifest = { command: process.argv, endpoint, reference_frozen_sha256: hash(fs.readFileSync(path.join(reference, 'frozen.json'), 'utf8')),
    attempt_number: attempt, maximum_total_attempts: 3,
    changed_factor: 'Transport recovery with600second timeout, maximumthree total attempts. No completed semantic response is retried; original errors remain referenced.',
    records: entries, reused_records: rows.length - omitted.size, new_unique_calls: failed.filter(g => !g.reused_from).length };
  save(path.join(dir, 'recovery-manifest.json'), manifest);
  console.log(JSON.stringify({ dir, reused_records: manifest.reused_records, new_unique_calls: manifest.new_unique_calls }));
}
module.exports = { transportFailure, freeze };
if (require.main === module) {
  const [dir, reference] = process.argv.slice(2);
  freeze(path.resolve(dir), path.resolve(reference)).catch(error => { console.error(error); process.exitCode = 1; });
}

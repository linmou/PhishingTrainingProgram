#!/usr/bin/env node
// Purpose: isolate participation classification from teaching in a resumable diagnostic, preserving every request and all three repetitions.
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { call, sha } = require('./runner');
const { classify, compare } = require('./classification');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const repair = 'Return only the required object with reason first (nonempty string) and mode second (tutoring or guard). Repair format once; retain the intended participation judgment.';
function parsedMode(target) {
  if (target.error || target.payload?.choices?.[0]?.finish_reason === 'length') return null;
  try {
    const p = JSON.parse(target.text);
    return p && !Array.isArray(p) && Object.keys(p).join(',') === 'reason,mode' && typeof p.reason === 'string' && p.reason.trim() && ['tutoring', 'guard'].includes(p.mode) ? p : null;
  } catch { return null; }
}
function messagesFor(c, policy) {
  return [{ role: 'system', content: policy }, { role: 'user', content: JSON.stringify({ ...c.input, knowledge_inventory: c.inventory }) }];
}
async function main() {
  const [baselineDirectory, policyFile, settingsFile, directory, ...args] = process.argv.slice(2);
  if (!directory) throw new Error('Supply complete baseline, policy, settings, new output [--num_workers N] [--prepare]');
  const workers = Number(args.includes('--num_workers') ? args[args.indexOf('--num_workers') + 1] : 32);
  if (!Number.isInteger(workers) || workers < 1 || workers > 48) throw new Error('Invalid num_workers');
  const baseline = read(path.join(baselineDirectory, 'report.json')), original = read(path.join(baselineDirectory, 'snapshot.json'));
  const settings = read(settingsFile), policy = fs.readFileSync(policyFile, 'utf8');
  if (settings.repetitions !== 3 || baseline.results.length !== original.cases.length * 3) throw new Error('Complete three-repetition baseline required');
  for (const key of ['model', 'target_temperature', 'target_max_tokens', 'target_enable_thinking', 'repetitions']) {
    if (settings[key] !== original.settings[key]) throw new Error('Baseline generation settings differ: ' + key);
  }
  const root = path.resolve(__dirname, '../../..'), dotenv = require(path.join(root, 'tutor-system/node_modules/dotenv'));
  const env = { ...dotenv.parse(fs.readFileSync(path.join(root, 'tutor-system/.env'))), ...process.env };
  if (!env.OAI_BASE_URL) throw new Error('Missing configured endpoint');
  const endpoint = env.OAI_BASE_URL.replace(/\/+$/, '');
  if (baseline.results.some(r => r.target.endpoint !== endpoint)) throw new Error('Baseline endpoint differs');
  const cases = original.cases.map(c => ({ ...c, expected: { ...c.expected, checks: ['mode_selection'] }, legacy: [] }));
  const dependencies = ['runner.js', 'evaluator.js', 'classification.js'].map(file => ({ file, content: fs.readFileSync(path.join(__dirname, file), 'utf8') }));
  const identity = { cases, original_cases: original.cases, settings, policy, manifest: original.manifest, sources: original.sources,
    dependencies, source: fs.readFileSync(__filename, 'utf8'), baseline_report_sha256: sha(fs.readFileSync(path.join(baselineDirectory, 'report.json'), 'utf8')),
    baselineDirectory, endpoint, num_workers: workers, scope: 'Mode-only diagnostic: simplified system task and context composition, unchanged evidence and generation settings. Not a full tutor or deployable architecture.' };
  if (classify(baseline, identity).issues.length) throw new Error('Baseline generation coverage invalid');
  const fingerprint = sha(identity);
  fs.mkdirSync(directory, { recursive: true });
  const snapshotFile = path.join(directory, 'snapshot.json');
  if (fs.existsSync(snapshotFile)) {
    const saved = read(snapshotFile);
    if (saved.fingerprint !== fingerprint || Object.keys(identity).some(key => sha(saved[key]) !== sha(identity[key]))) throw new Error('Resume identity changed');
  }
  else write(snapshotFile, { fingerprint, started_at: new Date().toISOString(), command: process.argv, ...identity });
  if (args.includes('--prepare')) { console.log(JSON.stringify({ cases: cases.length, calls: cases.length * 3, fingerprint })); return; }
  const jobs = cases.flatMap(c => [0, 1, 2].map(rep => ({ c, rep })));
  function load(c, rep) {
    const row = read(path.join(directory, `${c.id}-${rep}.json`));
    if (row.fingerprint !== fingerprint || row.case_id !== c.id || row.repetition !== rep || ![1, 2].includes(row.calls.length)) throw new Error('Saved record identity changed');
    for (const [index, raw] of row.calls.entries()) {
      const messages = index === 0 ? messagesFor(c, policy) : [...messagesFor(c, policy), { role: 'user', content: repair }];
      const request = { model: settings.model, messages, temperature: settings.target_temperature,
        max_tokens: settings.target_max_tokens, enable_thinking: Boolean(settings.target_enable_thinking), response_format: { type: 'json_object' } };
      if (raw.endpoint !== endpoint || sha(raw.request) !== sha(request)) throw new Error('Saved request identity changed');
    }
    if (row.calls.length === 2 && (settings.target_format_attempts !== 2 || row.calls[0].error || parsedMode(row.calls[0]))) throw new Error('Ineligible saved format repair');
    let target = row.calls.at(-1);
    const parsed = parsedMode(target);
    if (!parsed) target = { ...target, error: target.error || 'Invalid participation-stage contract' };
    if (sha(target) !== sha(row.target) || sha(parsed) !== sha(row.parsed) || sha(parsed) !== sha(row.parsed_for_evaluation)) throw new Error('Saved target output changed');
    const allowed = Array.isArray(c.expected.mode) ? c.expected.mode : [c.expected.mode];
    const expectedPass = Boolean(parsed && allowed.includes(parsed.mode));
    const results = [{ metric: 'mode_selection', method: 'deterministic', status: parsed ? expectedPass ? 'pass' : 'fail' : 'error', pass: expectedPass, expected: allowed, actual: parsed?.mode ?? null }];
    if (sha(row.results) !== sha(results)) throw new Error('Saved mode score changed');
    const provenance = { input: c, source_type: c.source_type, role: c.role, partitions: c.partitions, target_generation: target.payload?.id || null };
    if (Object.entries(provenance).some(([key, value]) => sha(row[key]) !== sha(value))) throw new Error('Saved record provenance changed');
    return row;
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: workers }, async () => {
    while (cursor < jobs.length) {
      const { c, rep } = jobs[cursor++], file = path.join(directory, `${c.id}-${rep}.json`);
      if (fs.existsSync(file)) { load(c, rep); continue; }
      const messages = messagesFor(c, policy), calls = [await call(messages, 'target', settings)];
      let target = calls[0], parsed = parsedMode(target);
      if (!target.error && !parsed && settings.target_format_attempts === 2) {
        target = await call([...messages, { role: 'user', content: repair }], 'target', settings);
        calls.push(target); parsed = parsedMode(target);
      }
      if (!parsed) target = { ...target, error: target.error || 'Invalid participation-stage contract' };
      const allowed = Array.isArray(c.expected.mode) ? c.expected.mode : [c.expected.mode];
      const pass = Boolean(parsed && allowed.includes(parsed.mode));
      const row = { fingerprint, case_id: c.id, repetition: rep, source_type: c.source_type, role: c.role, partitions: c.partitions,
        input: c, target, calls, parsed, parsed_for_evaluation: parsed, target_generation: target.payload?.id || null,
        results: [{ metric: 'mode_selection', method: 'deterministic', status: parsed ? pass ? 'pass' : 'fail' : 'error', pass, expected: allowed, actual: parsed?.mode ?? null }] };
      write(file, row); console.log(`${c.id} r${rep} ${row.results[0].status}`);
    }
  }));
  const report = { fingerprint, completed_at: new Date().toISOString(), results: jobs.map(({ c, rep }) => load(c, rep)) };
  const reportFile = path.join(directory, 'report.json');
  if (fs.existsSync(reportFile)) {
    const saved = read(reportFile);
    if (saved.fingerprint !== fingerprint || sha(saved.results) !== sha(report.results)) throw new Error('Saved report changed');
  } else write(reportFile, report);
  const snapshot = read(snapshotFile), result = compare(classify(report, snapshot), classify(baseline, snapshot));
  const comparisonFile = path.join(directory, 'classification-comparison.json');
  if (fs.existsSync(comparisonFile)) {
    if (sha(read(comparisonFile)) !== sha(result)) throw new Error('Saved classification changed');
  } else write(comparisonFile, result);
  console.log(JSON.stringify({ verdict: result.verdict, errors: result.issues, regressions: result.regressions.length,
    mode_passed: report.results.filter(r => r.results[0].pass).length, expected: jobs.length }));
}
module.exports = { parsedMode, messagesFor };
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });

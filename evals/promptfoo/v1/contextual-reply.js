#!/usr/bin/env node
// Purpose: run the contextual-reply regression pair or append it to the preserved tutor suite.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const runner = require('./runner');
const cases = require('./contextual-reply-cases.json');
const settings = require('./contextual-reply-settings.json');

async function main(mode, out) {
  assert(['focused', 'full', 'calibrate'].includes(mode), 'Use focused|full|calibrate OUT');
  assert(out, 'An immutable output directory is required');
  fs.mkdirSync(out, { recursive: true });
  if (mode === 'calibrate') {
    const samples = require('./contextual-reply-calibration.json');
    const snapshot = { cases, settings, samples, rubric: fs.readFileSync(path.join(__dirname, '../rubrics/v1/current_turn_grounding.md'), 'utf8') };
    fs.writeFileSync(path.join(out, 'snapshot.json'), JSON.stringify(snapshot, null, 2), { flag: 'wx' });
    const results = [];
    for (const sample of samples) {
      const definition = structuredClone(cases[sample.case_index]);
      definition.expected.checks = ['current_turn_grounding'];
      const result = await runner.evaluateOfflineOutput({
        caseDefinition: definition, rawOutput: JSON.stringify(sample.output),
        contractVersion: 'v2', settings, judgeCall: runner.call
      });
      const record = { sample, ...result };
      fs.writeFileSync(path.join(out, sample.id + '.json'), JSON.stringify(record, null, 2), { flag: 'wx' });
      const actual = result.results.find(item => item.metric === 'current_turn_grounding');
      results.push({ id: sample.id, expected: sample.expected_status, actual: actual.status, agreed: actual.status === sample.expected_status });
      console.log(JSON.stringify(results.at(-1)));
    }
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(results, null, 2), { flag: 'wx' });
    assert(results.every(result => result.agreed), 'Contextual grounding calibration failed');
    return;
  }
  const originals = require('./development-with-guard-scenario-rich.json');
  const suite = mode === 'full' ? [...originals, ...cases] : cases;
  assert.equal(new Set(suite.map(item => item.id)).size, suite.length);
  const generatedCases = path.join(out, 'cases.json');
  if (fs.existsSync(generatedCases)) assert.deepEqual(JSON.parse(fs.readFileSync(generatedCases, 'utf8')), suite, 'Resume cases changed');
  else fs.writeFileSync(generatedCases, JSON.stringify(suite, null, 2), { flag: 'wx' });
  await runner.run({ cases: generatedCases, settings: path.join(__dirname, 'contextual-reply-settings.json'),
    variant: 'product', contract_version: 'v2', out, workers: 2 });
}

if (require.main === module) main(process.argv[2], process.argv[3]).catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };

// Responsible for: evals/web/src/promptfooResultsModel.js
// Purpose: pure table model + filters that mirror promptfoo's results viewer over latest.json

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildPromptfooViewModel,
  filterResultRows,
  metricPassRates,
} from '../src/promptfooResultsModel.js';

async function loadLatest() {
  const text = await readFile(new URL('../../promptfoo/results/latest.json', import.meta.url), 'utf8');
  return JSON.parse(text);
}

test('builds a promptfoo-style table model from latest.json', async () => {
  const latest = await loadLatest();
  const model = buildPromptfooViewModel(latest);

  assert.equal(model.evalId, 'eval-EFn-2026-06-09T18:40:25');
  assert.match(model.description, /Account Security Alert/i);
  assert.equal(model.prompts.length, 2);
  assert.equal(model.prompts[0].shortLabel, 'Current');
  assert.equal(model.prompts[1].shortLabel, 'Improved');
  assert.equal(model.rows.length, 17);
  assert.ok(model.varColumns.includes('case_id'));
  assert.ok(model.varColumns.includes('student_message'));

  const first = model.rows[0];
  assert.equal(first.outputs.length, 2);
  assert.equal(typeof first.outputs[0].success, 'boolean');
  assert.equal(typeof first.outputs[0].output, 'string');
  assert.ok(first.outputs[0].output.length > 0);
  assert.ok(Array.isArray(first.outputs[0].assertions));
  assert.equal(typeof first.different, 'boolean');
});

test('metricPassRates expose per-prompt named score totals from prompt metrics', async () => {
  const latest = await loadLatest();
  const model = buildPromptfooViewModel(latest);
  const rates = metricPassRates(model.prompts);

  assert.ok(rates.some((row) => row.metric === 'direct_correction'));
  const direct = rates.find((row) => row.metric === 'direct_correction');
  assert.equal(direct.values.length, 2);
  assert.ok(direct.values[1] >= direct.values[0]);
});

test('filterMode failures shows only rows where any prompt failed', async () => {
  const latest = await loadLatest();
  const model = buildPromptfooViewModel(latest);
  const failures = filterResultRows(model.rows, { filterMode: 'failures', search: '' });
  assert.ok(failures.length > 0);
  assert.ok(failures.every((row) => row.outputs.some((output) => !output.success)));
});

test('filterMode different shows only rows where prompt outcomes diverge', async () => {
  const latest = await loadLatest();
  const model = buildPromptfooViewModel(latest);
  const different = filterResultRows(model.rows, { filterMode: 'different', search: '' });
  assert.ok(different.length > 0);
  assert.ok(different.every((row) => row.different));
});

test('search matches case_id and output text', async () => {
  const latest = await loadLatest();
  const model = buildPromptfooViewModel(latest);
  const byCase = filterResultRows(model.rows, { filterMode: 'all', search: 'student_thinks_alert_is_real' });
  assert.equal(byCase.length, 1);
  assert.equal(byCase[0].caseId, 'student_thinks_alert_is_real');

  const byText = filterResultRows(model.rows, { filterMode: 'all', search: 'pressure phrase' });
  assert.ok(byText.length >= 1);
  assert.ok(byText.every((row) =>
    JSON.stringify(row.vars).toLowerCase().includes('pressure phrase')
    || row.outputs.some((output) => output.output.toLowerCase().includes('pressure phrase')
      || output.reason.toLowerCase().includes('pressure phrase'))));
});

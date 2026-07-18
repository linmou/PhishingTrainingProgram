// Responsible for: evals/web/src/app.js + styles.css
// Purpose: keep the standalone viewer aligned with promptfoo's original results visualization

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('viewer loads Promptfoo latest.json and builds the table model', () => {
  assert.match(app, /buildPromptfooViewModel/);
  assert.match(app, /filterResultRows/);
  assert.match(app, /metricPassRates/);
  assert.match(app, /\/promptfoo\/results\/latest\.json/);
  assert.match(app, /Loading Promptfoo results/);
  assert.doesNotMatch(app, /evalWorkspaceSeed/);
  assert.doesNotMatch(app, /evaluation-lineage/);
  assert.doesNotMatch(app, /diagnosis-notebook/);
});

test('toolbar mirrors promptfoo display modes and search', () => {
  assert.match(app, /filterMode/);
  assert.match(app, /failures/);
  assert.match(app, /passes/);
  assert.match(app, /different/);
  assert.match(app, /search/);
  assert.match(app, /Show charts|Hide charts/);
  assert.match(app, /URLSearchParams/);
});

test('results table compares prompts side-by-side with pass/fail cells and detail drawer', () => {
  assert.match(app, /results-table/);
  assert.match(app, /output-cell/);
  assert.match(app, /PASS|FAIL/);
  assert.match(app, /named-scores/);
  assert.match(app, /detail-drawer/);
  assert.match(app, /Grading/);
  assert.match(app, /assertion/);
  assert.match(styles, /\.results-table/);
  assert.match(styles, /\.badge\.pass/);
  assert.match(styles, /\.badge\.fail/);
  assert.match(styles, /\.detail-drawer/);
});

test('summary and charts show per-prompt pass rate like promptfoo view', () => {
  assert.match(app, /Pass rate/);
  assert.match(app, /Named metrics/);
  assert.match(app, /prompt-card/);
  assert.match(app, /Current|Improved|shortLabel/);
  assert.match(styles, /\.charts-panel/);
  assert.match(styles, /\.bar-fill/);
});

test('page title and shell identify the local promptfoo eval viewer', () => {
  assert.match(index, /promptfoo results/);
  assert.match(index, /src\/app\.js/);
  assert.match(index, /src\/styles\.css/);
  assert.match(app, /promptfoo results/);
  assert.match(app, /evals\/promptfoo/);
});

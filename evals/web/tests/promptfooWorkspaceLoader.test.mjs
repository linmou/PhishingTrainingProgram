import test from 'node:test';
import assert from 'node:assert/strict';

import { loadPromptfooWorkspaceFromFiles } from '../src/promptfooWorkspaceFileLoader.mjs';
import { buildEvalWorkspaceSnapshot, getWorkspaceRubrics } from '../src/evalWorkspaceService.js';

test('loads the web workspace from evals/promptfoo files instead of static seed data', async () => {
  const workspace = await loadPromptfooWorkspaceFromFiles(new URL('../../promptfoo/', import.meta.url));
  const snapshot = buildEvalWorkspaceSnapshot(workspace);
  const rubrics = getWorkspaceRubrics(workspace);

  assert.equal(workspace.metadata.sourceRoot, 'evals/promptfoo');
  assert.equal(workspace.metadata.evalId, 'eval-EFn-2026-06-09T18:40:25');
  assert.equal(workspace.evalCases.length, 17);
  assert.equal(workspace.caseResults.length, 34);
  assert.deepEqual(workspace.promptResults.map((result) => result.label), ['Current prompt', 'Improved prompt']);
  assert.ok(workspace.metadata.loadedFiles.prompts.includes('prompts/current.prompt.txt'));
  assert.ok(workspace.metadata.loadedFiles.prompts.includes('prompts/improved.prompt.txt'));
  assert.ok(workspace.metadata.loadedFiles.rubrics.includes('rubrics/direct_correction.md'));
  assert.ok(workspace.metadata.loadedFiles.cases.includes('cases/account-security-alert.yaml'));
  assert.ok(rubrics.some((rubric) => rubric.id === 'direct_correction' && rubric.sourceRef === 'rubrics/direct_correction.md'));
  assert.ok(snapshot.promptComparison.scoreDelta > 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { evalWorkspaceSeed } from '../src/evalWorkspaceSeed.js';
import {
  applyNaturalLanguageEvalChange,
  buildEvalWorkspaceSnapshot,
  composePrompt,
  estimateDraftEvaluation,
  updatePromptSection,
} from '../src/evalWorkspaceService.js';

test('builds saved current vs improved prompt impact from migrated promptfoo seed data', () => {
  const snapshot = buildEvalWorkspaceSnapshot(evalWorkspaceSeed);

  assert.equal(snapshot.promptComparison.baseline.label, 'Current prompt');
  assert.equal(snapshot.promptComparison.candidate.label, 'Improved prompt');
  assert.ok(snapshot.promptComparison.scoreDelta > 0);
  assert.ok(snapshot.changeCounts.improved > 0);
  assert.equal(snapshot.caseComparisons[0].baseline.promptKind, 'baseline');
  assert.equal(snapshot.caseComparisons[0].candidate.promptKind, 'candidate');
});

test('prompt draft edits change the local impact preview', () => {
  const strongPrompt = composePrompt(evalWorkspaceSeed.promptSections);
  const weakPrompt = 'Minimal vague prompt.';

  const strong = estimateDraftEvaluation(strongPrompt, evalWorkspaceSeed.evalCases);
  const weak = estimateDraftEvaluation(weakPrompt, evalWorkspaceSeed.evalCases);

  assert.ok(strong.passRate > weak.passRate);
  assert.equal(weak.passRate, 0);
});

test('plain-language eval updates add or replace a generated eval case', () => {
  const description = 'Add a case where a student trusts a Discord Nitro giveaway because it has many comments. Require direct correction and practical knowledge.';
  const first = applyNaturalLanguageEvalChange(evalWorkspaceSeed.evalCases, description);
  const second = applyNaturalLanguageEvalChange(first.cases, description);

  assert.equal(first.generatedCase.caseId, 'generated_discord_nitro_giveaway');
  assert.equal(first.cases.length, evalWorkspaceSeed.evalCases.length + 1);
  assert.equal(second.cases.length, first.cases.length);
  assert.deepEqual(first.generatedCase.applicableRequirements, ['direct_correction', 'practical_knowledge']);
});

test('prompt section updates are immutable and appear in the composed prompt', () => {
  const updated = updatePromptSection(evalWorkspaceSeed.promptSections, 'role', 'You are a precise safety coach.');

  assert.notEqual(updated, evalWorkspaceSeed.promptSections);
  assert.match(composePrompt(updated), /precise safety coach/);
  assert.doesNotMatch(composePrompt(evalWorkspaceSeed.promptSections), /precise safety coach/);
});

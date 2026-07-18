#!/usr/bin/env node
// Purpose: verifies the eval web mockup generator reflects the current UX page model and visual contract.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const renderScript = readFileSync(new URL('../design-mockups/render-ui-mockups.mjs', import.meta.url), 'utf8');
const mockupDir = new URL('../design-mockups/', import.meta.url);

function listMockupArtifacts(dirUrl = mockupDir) {
  return readdirSync(dirUrl, { withFileTypes: true }).flatMap((entry) => {
    const entryUrl = new URL(entry.name, dirUrl);

    if (entry.isDirectory()) {
      return listMockupArtifacts(new URL(`${entry.name}/`, dirUrl));
    }

    if (!entry.isFile()) {
      return [];
    }

    const relativePath = entryUrl.pathname.slice(mockupDir.pathname.length);

    return /^[0-9]{2}-.+\.html$/.test(entry.name) ? [relativePath] : [];
  });
}

describe('eval web mockup design contract', () => {
  it('keeps the restrained workbench visual system', () => {
    assert.match(renderScript, /--sidebar:\s*#13272d/);
    assert.match(renderScript, /--mint:\s*#61c2a2/);
    assert.doesNotMatch(renderScript, /\.status-card/);
    assert.doesNotMatch(renderScript, /statusCard/);
    assert.doesNotMatch(renderScript, /<span>Status<\/span>/);
    assert.match(renderScript, /\.matrix/);
    assert.match(renderScript, /\.diff-view/);
  });

  it('renders the revised primary page set', () => {
    [
      '00-new-eval-run.png',
      '01-evaluation-lineage.png',
      '02-run-detail.png',
      '03-diagnosis-notebook.png',
      '04-prompt-versions.png',
      '06-ab-changed-case-inspector.png',
      '07-case-evidence-view.png',
      '08-dataset-distribution.png',
      '09-rubric-inspect.png',
      '10-provenance-export-authority.png',
    ].forEach((filename) => assert.match(renderScript, new RegExp(filename)));
  });

  it('uses source diffs for prompt and rubric artifact comparison', () => {
    assert.match(renderScript, /Prompt Versions/);
    assert.match(renderScript, /Base prompt/);
    assert.match(renderScript, /Compare prompt/);
    assert.match(renderScript, /diff --git a\/prompts\/ai_tutor\.md/);
    assert.match(renderScript, /Rubric Inspect/);
    assert.match(renderScript, /rubrics\/direct_correction\.md/);
    assert.match(renderScript, /rubrics\/practical_knowledge\.md/);
    assert.doesNotMatch(renderScript, /Prompt Composition/);
    assert.doesNotMatch(renderScript, /Rubric Meaning Diff/);
  });

  it('does not keep stale generated mock pages with duplicate numeric IDs', () => {
    const artifactsById = new Map();

    for (const artifact of listMockupArtifacts()) {
      const id = artifact.match(/(?:^|\/)([0-9]{2})-/)?.[1];
      if (!id) continue;
      const artifacts = artifactsById.get(id) ?? [];
      artifacts.push(artifact);
      artifactsById.set(id, artifacts);
    }

    for (const [id, artifacts] of artifactsById) {
      const slugs = new Set(
        artifacts.map((artifact) => artifact.match(/(?:^|\/)([0-9]{2}-.+)\.html$/)?.[1]).filter(Boolean),
      );

      assert.equal(slugs.size, 1, `mock page ${id} should have one page slug: ${artifacts.join(', ')}`);
    }
  });

  it('exposes a prompt editor and one selected-file rubric editor', () => {
    assert.match(renderScript, /Prompt Editor/);
    assert.match(renderScript, /Draft prompt/);
    assert.match(renderScript, /Save prompt draft/);
    assert.match(renderScript, /Rubric Editor/);
    assert.match(renderScript, /Selected file/);
    assert.match(renderScript, /rubrics\/direct_correction\.md/);
    assert.match(renderScript, /Save rubric draft/);
    assert.doesNotMatch(renderScript, /Rubric Editor: practical_knowledge\.md/);
  });

  it('models Case Evidence as a selected A/B case detail', () => {
    assert.match(renderScript, /A\/B Cases \/ Case Evidence/);
    assert.match(renderScript, /Run A: run_002/);
    assert.match(renderScript, /Run B: run_003/);
    assert.match(renderScript, /Next changed case/);
  });

  it('shows changed-case queue fields as explicit table columns', () => {
    assert.match(renderScript, /<table class="case-table">/);
    assert.match(renderScript, /Case ID/);
    assert.match(renderScript, /Case title/);
    assert.match(renderScript, /Rubric change/);
    assert.match(renderScript, /Review comment/);
  });

  it('keeps changed case review fields minimal', () => {
    assert.match(renderScript, /function caseReviewTable\(rows\)/);
    assert.match(renderScript, /<th>Case ID<\/th>/);
    assert.match(renderScript, /<th>Case title<\/th>/);
    assert.match(renderScript, /<th>Rubric change<\/th>/);
    assert.match(renderScript, /<th>Review comment<\/th>/);
    assert.match(renderScript, /reviewComment/);
    assert.match(renderScript, /Direct correction \+3; Practical knowledge \+6/);
    assert.doesNotMatch(renderScript, /<th>Score movement<\/th>/);
    assert.doesNotMatch(renderScript, /<th>Priority<\/th>/);
    assert.doesNotMatch(renderScript, /<th>Review decision<\/th>/);
  });

  it('keeps rubric delta matrix to necessary numeric columns', () => {
    assert.match(
      renderScript,
      /<div class="matrix-row head"><span>Rubric<\/span><span>Improved<\/span><span>Regressed<\/span><span>Net<\/span><\/div>/,
    );
    assert.match(renderScript, /\['Direct correction', '5', '2', '\+3'\]/);
    assert.doesNotMatch(renderScript, /<span>Flag<\/span>/);
    assert.doesNotMatch(renderScript, /\['Direct correction', '5', '2', '\+3', 'review'\]/);
  });

  it('keeps Dataset Distribution to simple n-gram analysis only', () => {
    assert.match(renderScript, /Dataset Distribution/);
    assert.match(renderScript, /N-gram analysis/);
    assert.match(renderScript, /Top 1-grams/);
    assert.match(renderScript, /Top 2-grams/);
    assert.match(renderScript, /Top 3-grams/);
    assert.doesNotMatch(renderScript, /LLM variable builder/);
    assert.doesNotMatch(renderScript, /AI-inferred/);
    assert.doesNotMatch(renderScript, /natural language/);
    assert.doesNotMatch(renderScript, /model: gpt-4o-mini/);
  });

  it('keeps Rubric Inspect as version selection followed by selected-file review', () => {
    assert.match(renderScript, /Rubric version log/);
    assert.match(renderScript, /Base rubric/);
    assert.match(renderScript, /Compare rubric/);
    assert.match(renderScript, /Selected file/);
    assert.match(renderScript, /Selected file diff/);
    assert.match(renderScript, /Rubric Editor: selected file/);
    assert.match(renderScript, /rubric-editor-large/);
    assert.doesNotMatch(renderScript, /Git diff: practical knowledge/);
    assert.doesNotMatch(renderScript, /Comparison warning/);
    assert.doesNotMatch(renderScript, /Rubric Editor: practical_knowledge\.md/);
  });
});

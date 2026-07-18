import test from 'node:test';
import assert from 'node:assert/strict';

import { evalWorkspaceSeed } from '../src/evalWorkspaceSeed.js';
import {
  applyNaturalLanguageEvalChange,
  buildArtifactVersions,
  buildDatasetCoverage,
  buildEvalWorkspaceSnapshot,
  buildExportDraftBundle,
  buildRubricMeaningDiff,
  buildRubricProposal,
  composePrompt,
  estimateDraftEvaluation,
  getCaseDetail,
  getWorkspaceRubrics,
  summarizeDraftPromptImpact,
  getVisibleCaseComparisons,
  summarizeReleaseReadiness,
  updatePromptSection,
  updateReviewDecision,
} from '../src/evalWorkspaceService.js';

test('derives rubrics from workspace artifacts instead of a fixed rubric list', () => {
  const transferableSeed = {
    ...evalWorkspaceSeed,
    rubricArtifacts: [
      {
        id: 'creativity_depth',
        label: 'Creativity Depth',
        sourceRef: 'evals/promptfoo/rubrics/creativity_depth.md',
        requirement: 'Reward original, elaborated ideas.',
        passCriteria: ['Provides original ideas', 'Explains the idea clearly'],
        failCriteria: ['Only repeats the prompt'],
        keywords: ['original', 'idea', 'elaborated'],
        critical: true,
      },
      {
        id: 'factual_grounding',
        label: 'Factual Grounding',
        sourceRef: 'evals/promptfoo/rubrics/factual_grounding.md',
        requirement: 'Prefer claims grounded in supplied sources.',
        passCriteria: ['Cites supplied context'],
        failCriteria: ['Invents facts'],
        keywords: ['source', 'grounded', 'cite'],
        critical: false,
      },
    ],
    evalCases: [
      {
        caseId: 'creative_case',
        scenarioContext: 'A learner asks for project ideas.',
        conversationHistory: 'Tutor: Let us brainstorm.',
        studentMessage: 'Can you give me a fresh project idea?',
        expectedBehaviorFocus: 'Give original ideas grounded in the supplied context.',
        applicableRequirements: ['creativity_depth', 'factual_grounding'],
      },
    ],
    promptResults: [
      {
        kind: 'baseline',
        label: 'Prompt A',
        provider: 'local',
        score: 0,
        testPassCount: 0,
        testFailCount: 1,
        testErrorCount: 0,
        assertPassCount: 0,
        assertFailCount: 2,
        namedScores: { creativity_depth: 0, factual_grounding: 0 },
        namedScoresCount: { creativity_depth: 1, factual_grounding: 1 },
      },
      {
        kind: 'candidate',
        label: 'Prompt B',
        provider: 'local',
        score: 2,
        testPassCount: 1,
        testFailCount: 0,
        testErrorCount: 0,
        assertPassCount: 2,
        assertFailCount: 0,
        namedScores: { creativity_depth: 1, factual_grounding: 1 },
        namedScoresCount: { creativity_depth: 1, factual_grounding: 1 },
      },
    ],
    caseResults: [
      {
        caseId: 'creative_case',
        promptKind: 'baseline',
        passed: false,
        score: 0,
        namedScores: { creativity_depth: 0, factual_grounding: 0 },
        output: 'Maybe do something.',
        reason: 'No rubric criteria met.',
      },
      {
        caseId: 'creative_case',
        promptKind: 'candidate',
        passed: true,
        score: 1,
        namedScores: { creativity_depth: 1, factual_grounding: 1 },
        output: 'Here is an original idea grounded in the supplied source.',
        reason: 'All assertions passed.',
      },
    ],
  };

  const rubrics = getWorkspaceRubrics(transferableSeed);
  const snapshot = buildEvalWorkspaceSnapshot(transferableSeed);
  const draft = estimateDraftEvaluation('Give an original, elaborated idea and cite the supplied source.', transferableSeed.evalCases, rubrics);
  const proposal = buildRubricProposal('Make creativity depth stricter.', rubrics);

  assert.deepEqual(rubrics.map((rubric) => rubric.id), ['creativity_depth', 'factual_grounding']);
  assert.ok(snapshot.promptComparison.metricComparisons.every((metric) => ['Creativity Depth', 'Factual Grounding'].includes(metric.label)));
  assert.equal(draft.namedScores.creativity_depth, 1);
  assert.equal(draft.namedScores.factual_grounding, 1);
  assert.equal(proposal.rubric, 'creativity_depth');
});

test('artifact versions and exports use source metadata instead of account-security defaults', () => {
  const customSeed = {
    ...evalWorkspaceSeed,
    metadata: {
      ...evalWorkspaceSeed.metadata,
      evalId: 'eval-custom-transfer',
      scenarioTemplate: 'Open Writing Feedback',
    },
    artifacts: {
      prompts: [
        { id: 'prompt_alpha', label: 'Prompt Alpha', sourceRef: 'tasks/writing/prompts/alpha.txt', kind: 'baseline', changedInComparison: true },
        { id: 'prompt_beta', label: 'Prompt Beta', sourceRef: 'tasks/writing/prompts/beta.txt', kind: 'candidate', changedInComparison: true },
      ],
      dataset: { id: 'dataset_writing', label: 'Writing feedback cases', sourceRef: 'tasks/writing/cases.yaml', changedInComparison: false },
      rubric: { id: 'rubric_writing', label: 'Writing feedback rubrics', sourceRef: 'tasks/writing/rubrics', changedInComparison: false },
      modelConfig: { id: 'model_local', label: 'Local model', sourceRef: 'tasks/writing/model.json', changedInComparison: false },
      evaluatorConfig: { id: 'judge_local', label: 'Local judge', sourceRef: 'tasks/writing/judge.json', changedInComparison: false },
      results: { sourceRef: 'tasks/writing/results/latest.json' },
    },
  };

  const artifacts = buildArtifactVersions(customSeed);
  const bundle = buildExportDraftBundle({
    seed: customSeed,
    promptSections: customSeed.promptSections,
    evalCases: customSeed.evalCases,
    snapshot: buildEvalWorkspaceSnapshot(customSeed),
  });

  assert.equal(artifacts.runs[0].artifactRefs.dataset, 'dataset_writing');
  assert.equal(bundle.provenance.datasetSource, 'tasks/writing/cases.yaml');
  assert.deepEqual(bundle.provenance.promptSources, ['tasks/writing/prompts/alpha.txt', 'tasks/writing/prompts/beta.txt']);
  assert.equal(bundle.artifactVersions.versions.some((version) => version.sourceRef.includes('account-security-alert')), false);
});

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
  assert.ok(weak.passRate >= 0 && weak.passRate < strong.passRate);
  assert.equal(weak.caseResults.length, evalWorkspaceSeed.evalCases.length);
});

test('prompt draft impact explains statistical and case-level changes from prompt edits', () => {
  const baselinePrompt = composePrompt(evalWorkspaceSeed.promptSections);
  const editedPrompt = 'Minimal vague prompt.';

  const rubrics = getWorkspaceRubrics(evalWorkspaceSeed);
  const impact = summarizeDraftPromptImpact(baselinePrompt, editedPrompt, evalWorkspaceSeed.evalCases, rubrics);

  assert.ok(impact.statistical.scoreDelta < 0);
  assert.ok(impact.statistical.passRateDelta < 0);
  assert.ok(impact.caseLevelChanges.length > 0);
  assert.ok(impact.caseLevelChanges.some((change) => change.direction === 'regressed'));
  assert.ok(impact.requirementChanges.some((change) => change.label === 'Practical Knowledge' && change.delta < 0));
});

test('plain-language eval updates add or replace a generated eval case with distribution impact', () => {
  const description = 'Add a case where a student trusts a Discord Nitro giveaway because it has many comments. Require direct correction and practical knowledge.';
  const rubrics = getWorkspaceRubrics(evalWorkspaceSeed);
  const first = applyNaturalLanguageEvalChange(evalWorkspaceSeed.evalCases, description, rubrics);
  const second = applyNaturalLanguageEvalChange(first.cases, description, rubrics);

  assert.match(first.generatedCase.caseId, /^generated_/);
  assert.match(first.generatedCase.caseId, /discord_nitro_giveaway/);
  assert.equal(first.cases.length, evalWorkspaceSeed.evalCases.length + 1);
  assert.equal(second.cases.length, first.cases.length);
  assert.deepEqual(first.generatedCase.applicableRequirements, ['direct_correction', 'practical_knowledge']);
  assert.equal(first.distributionImpact.after.totalCases, first.distributionImpact.before.totalCases + 1);
  assert.ok(first.distributionImpact.changedDimensions.some((item) => item.dimension === 'phishingScenario'));
});

test('prompt section updates are immutable and appear in the composed prompt', () => {
  const updated = updatePromptSection(evalWorkspaceSeed.promptSections, 'role', 'You are a precise safety coach.');

  assert.notEqual(updated, evalWorkspaceSeed.promptSections);
  assert.match(composePrompt(updated), /precise safety coach/);
  assert.doesNotMatch(composePrompt(evalWorkspaceSeed.promptSections), /precise safety coach/);
});

test('release readiness starts with verdict, blockers, next action, and changed-case counts', () => {
  const snapshot = buildEvalWorkspaceSnapshot(evalWorkspaceSeed);
  const readiness = summarizeReleaseReadiness(snapshot, {});

  assert.equal(readiness.verdict, 'needs_review');
  assert.match(readiness.plainLanguageVerdict, /Needs Review/);
  assert.match(readiness.nextAction, /regressed case/i);
  assert.equal(readiness.evidence.regressions, 1);
  assert.equal(readiness.evidence.changedCases, snapshot.caseComparisons.filter((item) => item.hasRubricMovement).length);
});

test('case filters default to changed cases and preserve review decisions', () => {
  const snapshot = buildEvalWorkspaceSnapshot(evalWorkspaceSeed);
  const changed = getVisibleCaseComparisons(snapshot.caseComparisons, { status: 'changed' });
  const regressed = getVisibleCaseComparisons(snapshot.caseComparisons, { status: 'regressed' });
  const decisions = updateReviewDecision({}, regressed[0].caseId, {
    status: 'needs_followup',
    reviewer: 'PM reviewer',
    note: 'Check this case before release.',
  });

  assert.ok(changed.length < snapshot.caseComparisons.length);
  assert.ok(changed.every((item) => item.hasRubricMovement || item.status !== 'unchanged'));
  assert.equal(regressed.length, 1);
  assert.equal(decisions[regressed[0].caseId].status, 'needs_followup');
});

test('case detail combines readable summary, side-by-side outputs, rubric deltas, rationale, and prompt diff', () => {
  const snapshot = buildEvalWorkspaceSnapshot(evalWorkspaceSeed);
  const detail = getCaseDetail(snapshot.caseComparisons, evalWorkspaceSeed.evalCases, 'student_asks_what_to_do');

  assert.equal(detail.comparison.status, 'regressed');
  assert.match(detail.plainEnglishSummary, /regressed/i);
  assert.ok(detail.factSheet.applicableRequirements.includes('practical_knowledge'));
  assert.match(detail.outputs.baseline, /real address|account settings/i);
  assert.match(detail.outputs.candidate, /real website|account settings/i);
  assert.ok(detail.rubricDeltas.length > 0);
  assert.ok(detail.promptDiff.length > 0);
});

test('artifact versions and evaluation runs label clean prompt-only comparisons', () => {
  const artifacts = buildArtifactVersions(evalWorkspaceSeed);

  assert.equal(artifacts.comparisonType.label, 'Clean prompt A/B');
  assert.equal(artifacts.comparisonType.level, 'clean');
  assert.ok(artifacts.versions.some((version) => version.kind === 'prompt'));
  assert.equal(artifacts.runs.length, 2);
  assert.equal(artifacts.runs[0].artifactRefs.dataset, artifacts.runs[1].artifactRefs.dataset);
});

test('dataset coverage exposes dimensions and warns about underrepresented groups', () => {
  const coverage = buildDatasetCoverage(evalWorkspaceSeed.evalCases);

  assert.ok(coverage.dimensions.length >= 5);
  assert.ok(coverage.dimensions.some((dimension) => dimension.id === 'learnerLevel'));
  assert.ok(coverage.dimensions.some((dimension) => dimension.id === 'phishingScenario'));
  assert.ok(coverage.warnings.length > 0);
});

test('rubric meaning diff and plain-language rubric proposal flag meaning-changing drafts', () => {
  const diff = buildRubricMeaningDiff(evalWorkspaceSeed);
  const proposal = buildRubricProposal('Make direct correction stricter. Require the tutor to explicitly say the student is wrong before giving safe steps.');

  assert.ok(diff.length >= 3);
  assert.ok(diff.some((item) => item.changeType === 'threshold change' || item.changeType === 'clarification'));
  assert.equal(proposal.meaningChanging, true);
  assert.match(proposal.comparabilityWarning, /not directly comparable/i);
});

test('export bundle includes prompt, dataset, rubric proposals, review decisions, and provenance', () => {
  const snapshot = buildEvalWorkspaceSnapshot(evalWorkspaceSeed);
  const decisions = updateReviewDecision({}, 'student_asks_what_to_do', {
    status: 'needs_followup',
    reviewer: 'PM reviewer',
    note: 'Regression needs review.',
  });
  const bundle = buildExportDraftBundle({
    seed: evalWorkspaceSeed,
    promptSections: evalWorkspaceSeed.promptSections,
    evalCases: evalWorkspaceSeed.evalCases,
    rubricProposal: buildRubricProposal('Clarify practical knowledge wording only.'),
    reviewDecisions: decisions,
    snapshot,
  });

  assert.equal(bundle.provenance.authoritativeEvaluator, evalWorkspaceSeed.artifacts.evaluatorConfig.label);
  assert.ok(bundle.promptDraft.composedPrompt.includes('Role and voice'));
  assert.equal(bundle.datasetDraft.cases.length, evalWorkspaceSeed.evalCases.length);
  assert.equal(bundle.reviewDecisions.student_asks_what_to_do.status, 'needs_followup');
});

test('export bundle saves a hybrid diagnosis notebook linked to the eval run', () => {
  const snapshot = buildEvalWorkspaceSnapshot(evalWorkspaceSeed);
  const bundle = buildExportDraftBundle({
    seed: evalWorkspaceSeed,
    promptSections: evalWorkspaceSeed.promptSections,
    evalCases: evalWorkspaceSeed.evalCases,
    snapshot,
    diagnosisNotebook: {
      issue: 'Reviewer saw over-direct advice in a regressed phishing case.',
      cause: 'prompt',
      targetArtifact: 'prompts/improved.prompt.txt',
      hypothesis: 'Ask for guided inspection before correction.',
    },
  });

  assert.equal(bundle.diagnosisNotebook.mode, 'hybrid');
  assert.equal(bundle.diagnosisNotebook.evalRun.id, evalWorkspaceSeed.metadata.evalId);
  assert.equal(bundle.diagnosisNotebook.evalRun.href, '#run-detail');
  assert.equal(bundle.diagnosisNotebook.handWritten.issue, 'Reviewer saw over-direct advice in a regressed phishing case.');
  assert.match(bundle.diagnosisNotebook.machineGenerated.summary, /Promptfoo/i);
  assert.ok(bundle.diagnosisNotebook.machineGenerated.worstChangedCase.caseId);
});

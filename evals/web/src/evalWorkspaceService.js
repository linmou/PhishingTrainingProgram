const KNOWN_REQUIREMENTS = [
  'direct_correction',
  'practical_knowledge',
  'turn_rhythm',
  'reading_level',
  'persona_stability',
  'low_boilerplate_praise',
  'third_person_examples',
];

export function composePrompt(sections) {
  return sections
    .map((section) => `## ${section.title}\n${section.content.trim()}`)
    .join('\n\n');
}

export function updatePromptSection(sections, sectionId, content) {
  return sections.map((section) => (
    section.id === sectionId ? { ...section, content } : section
  ));
}

function toPromptSummary(result) {
  const testTotal = result.testPassCount + result.testFailCount + result.testErrorCount;
  const assertionTotal = result.assertPassCount + result.assertFailCount;
  return {
    ...result,
    testPassRate: testTotal === 0 ? 0 : result.testPassCount / testTotal,
    assertionPassRate: assertionTotal === 0 ? 0 : result.assertPassCount / assertionTotal,
  };
}

export function summarizePromptComparison(promptResults, caseResults = []) {
  const baselineResult = promptResults.find((result) => result.kind === 'baseline');
  const candidateResult = promptResults.find((result) => result.kind === 'candidate');
  if (!baselineResult || !candidateResult) {
    throw new Error('Prompt comparison requires baseline and candidate prompt results.');
  }

  const baseline = toPromptSummary(baselineResult);
  const candidate = toPromptSummary(candidateResult);
  const metrics = Array.from(new Set([
    ...Object.keys(baseline.namedScores),
    ...Object.keys(candidate.namedScores),
    ...caseResults.flatMap((result) => Object.keys(result.namedScores)),
  ]));

  return {
    baseline,
    candidate,
    scoreDelta: candidate.score - baseline.score,
    testPassRateDelta: candidate.testPassRate - baseline.testPassRate,
    assertionPassRateDelta: candidate.assertionPassRate - baseline.assertionPassRate,
    metricComparisons: metrics.map((metric) => {
      const maxScore = Math.max(
        baseline.namedScoresCount[metric] ?? 1,
        candidate.namedScoresCount[metric] ?? 1,
        1,
      );
      const baselineScore = baseline.namedScores[metric] ?? 0;
      const candidateScore = candidate.namedScores[metric] ?? 0;
      return {
        metric,
        baselineScore,
        candidateScore,
        maxScore,
        delta: candidateScore - baselineScore,
        baselineRate: baselineScore / maxScore,
        candidateRate: candidateScore / maxScore,
      };
    }),
  };
}

function compareCaseResults(baseline, candidate) {
  let status = 'unchanged';
  if (!baseline.passed && candidate.passed) status = 'improved';
  else if (baseline.passed && !candidate.passed) status = 'regressed';

  const metrics = Array.from(new Set([
    ...Object.keys(baseline.namedScores),
    ...Object.keys(candidate.namedScores),
  ]));

  return {
    caseId: baseline.caseId,
    status,
    baseline,
    candidate,
    scoreDelta: candidate.score - baseline.score,
    metricsChanged: metrics.map((metric) => {
      const baselineScore = baseline.namedScores[metric] ?? 0;
      const candidateScore = candidate.namedScores[metric] ?? 0;
      return {
        metric,
        baselineScore,
        candidateScore,
        maxScore: 1,
        delta: candidateScore - baselineScore,
        baselineRate: baselineScore,
        candidateRate: candidateScore,
      };
    }).filter((metric) => metric.delta !== 0),
  };
}

export function buildEvalWorkspaceSnapshot(seed) {
  const caseIds = Array.from(new Set(seed.caseResults.map((result) => result.caseId)));
  const caseComparisons = caseIds.flatMap((caseId) => {
    const baseline = seed.caseResults.find((result) => result.caseId === caseId && result.promptKind === 'baseline');
    const candidate = seed.caseResults.find((result) => result.caseId === caseId && result.promptKind === 'candidate');
    return baseline && candidate ? [compareCaseResults(baseline, candidate)] : [];
  });

  return {
    promptComparison: summarizePromptComparison(seed.promptResults, seed.caseResults),
    caseComparisons,
    changeCounts: {
      improved: caseComparisons.filter((comparison) => comparison.status === 'improved').length,
      regressed: caseComparisons.filter((comparison) => comparison.status === 'regressed').length,
      unchanged: caseComparisons.filter((comparison) => comparison.status === 'unchanged').length,
    },
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64) || 'generated_case';
}

function inferTopic(description) {
  const lower = description.toLowerCase();
  const platforms = ['discord nitro giveaway', 'discord nitro', 'bank alert', 'snapchat', 'instagram', 'tiktok', 'gift card', 'account alert'];
  const found = platforms.find((platform) => lower.includes(platform));
  if (found) return found;
  const afterStudent = lower.match(/student\s+(?:trusts|thinks|believes|wants|asks about|asks)\s+(.*?)(?:\s+because|\.|$)/);
  return afterStudent?.[1] || 'generated scenario';
}

function inferRequirements(description) {
  const lower = description.toLowerCase();
  const explicit = KNOWN_REQUIREMENTS.filter((requirement) => lower.includes(requirement));
  const naturalMatches = [
    { phrase: 'direct correction', requirement: 'direct_correction' },
    { phrase: 'practical knowledge', requirement: 'practical_knowledge' },
    { phrase: 'reading level', requirement: 'reading_level' },
    { phrase: 'persona stability', requirement: 'persona_stability' },
    { phrase: 'low praise', requirement: 'low_boilerplate_praise' },
    { phrase: 'third person', requirement: 'third_person_examples' },
    { phrase: 'turn rhythm', requirement: 'turn_rhythm' },
  ]
    .filter((match) => lower.includes(match.phrase))
    .map((match) => match.requirement);

  const inferred = Array.from(new Set([...explicit, ...naturalMatches]));
  return inferred.length > 0 ? inferred : ['direct_correction', 'practical_knowledge'];
}

export function applyNaturalLanguageEvalChange(cases, description) {
  const topic = inferTopic(description);
  const requirements = inferRequirements(description);
  const becauseMatch = description.match(/because\s+(.+?)(?:\.\s*|$)/i);
  const reason = becauseMatch?.[1]?.trim() || 'the surface cue looks trustworthy';
  const caseId = slugify(`generated_${topic}`);
  const generatedCase = {
    caseId,
    scenarioContext: `Generated from plain English: ${description.trim()}`,
    conversationHistory: 'Tutor: Look at the message and decide whether it is safe.',
    studentMessage: `I think this is safe because ${reason}.`,
    expectedBehaviorFocus: `Address the ${topic} scenario, correct unsafe trust, and give a concrete safe next action.`,
    applicableRequirements: requirements,
  };

  const existingIndex = cases.findIndex((item) => item.caseId === generatedCase.caseId);
  const nextCases = existingIndex >= 0
    ? cases.map((item, index) => (index === existingIndex ? generatedCase : item))
    : [...cases, generatedCase];

  return {
    cases: nextCases,
    generatedCase,
    message: existingIndex >= 0 ? 'Updated matching generated case.' : 'Added a generated eval case.',
  };
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function scoreRequirement(promptText, requirement) {
  const normalized = promptText.toLowerCase();
  const phraseGroups = {
    direct_correction: ['direct correction', 'correct', 'wrong', 'do not validate', 'unsafe reasoning'],
    practical_knowledge: ['safe action', 'real app', 'real website', 'account settings', 'do not click', 'verify'],
    turn_rhythm: ['one focused question', 'ask at most one', 'teach one', 'do not end every response'],
    reading_level: ['simple language', 'short sentences', 'younger', 'confused', 'fake web address'],
    persona_stability: ['do not claim personal experience', 'third-person', 'peer coach', 'do not pretend'],
    low_boilerplate_praise: ['avoid generic praise', 'brief encouragement', 'specific and brief', 'at most one short'],
    third_person_examples: ['third-person', 'third person', 'examples only', 'do not claim personal'],
  };
  const phrases = phraseGroups[requirement] ?? [requirement.replace(/_/g, ' ')];
  return includesAny(normalized, phrases) ? 1 : 0;
}

export function estimateDraftEvaluation(promptText, cases) {
  const promptLength = promptText.trim().length;
  const normalized = promptText.toLowerCase();
  const coveredRequirements = KNOWN_REQUIREMENTS.filter((requirement) => scoreRequirement(promptText, requirement) > 0);
  const qualitySignals = [
    includesAny(normalized, ['phishing', 'scam', 'fake', 'unsafe']) ? 1 : 0,
    promptLength >= 700 ? 1 : 0,
    promptLength >= 1200 ? 1 : 0,
    coveredRequirements.length / KNOWN_REQUIREMENTS.length,
  ];
  const promptQuality = Math.min(1, qualitySignals.reduce((sum, value) => sum + value, 0) / 4);
  const namedScores = KNOWN_REQUIREMENTS.reduce((scores, requirement) => {
    scores[requirement] = scoreRequirement(promptText, requirement);
    return scores;
  }, {});
  const caseResults = cases.map((testCase) => {
    const requirementScores = testCase.applicableRequirements.map((requirement) => scoreRequirement(promptText, requirement));
    const requirementAverage = requirementScores.length === 0
      ? promptQuality
      : requirementScores.reduce((sum, value) => sum + value, 0) / requirementScores.length;
    const score = Math.min(1, (requirementAverage * 0.75) + (promptQuality * 0.25));
    return {
      caseId: testCase.caseId,
      passed: score >= 0.6,
      score,
      reason: score >= 0.6
        ? 'Draft prompt appears to cover the case requirements.'
        : 'Draft prompt is missing visible language for one or more case requirements.',
    };
  });
  const passedCases = caseResults.filter((result) => result.passed).length;
  const caseCount = caseResults.length;
  const score = caseCount === 0 ? 0 : caseResults.reduce((sum, result) => sum + result.score, 0) / caseCount;
  return {
    score,
    passRate: caseCount === 0 ? 0 : passedCases / caseCount,
    passedCases,
    failedCases: caseCount - passedCases,
    caseCount,
    promptQuality,
    promptLength,
    namedScores,
    caseResults,
  };
}

export function exportEvalCasesAsJson(cases) {
  return JSON.stringify(cases, null, 2);
}

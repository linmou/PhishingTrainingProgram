function humanizeId(value) {
  return String(value ?? '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function compactKeywords(values) {
  const stopWords = new Set('the a an and or to of in on for with from by only this that when then must should can include into about before after while they them their there where what which who why how is are be as it its not no if use uses using says say'.split(' '));
  const keywords = [];
  for (const value of values.filter(Boolean)) {
    const normalized = String(value).toLowerCase();
    if (normalized.length > 3) keywords.push(normalized.replace(/\s+rubric$/, '').slice(0, 96));
    normalized.match(/[a-z][a-z-]{4,}/g)?.forEach((word) => {
      if (!stopWords.has(word)) keywords.push(word);
    });
  }
  return Array.from(new Set(keywords)).slice(0, 24);
}

function fallbackRubricFromMetric(metric, seed = {}) {
  const casesUsingMetric = seed.evalCases?.filter((testCase) => testCase.applicableRequirements?.includes(metric)) ?? [];
  const resultReasons = seed.caseResults
    ?.filter((result) => Object.prototype.hasOwnProperty.call(result.namedScores ?? {}, metric))
    .map((result) => result.reason) ?? [];
  return {
    id: metric,
    label: humanizeId(metric),
    sourceRef: `derived://promptfoo/namedScores/${metric}`,
    requirement: casesUsingMetric[0]?.expectedBehaviorFocus ?? `Scoring metric ${humanizeId(metric)} from Promptfoo results.`,
    passCriteria: casesUsingMetric.slice(0, 3).map((testCase) => testCase.expectedBehaviorFocus).filter(Boolean),
    failCriteria: resultReasons.slice(0, 3).filter(Boolean),
    keywords: compactKeywords([
      metric.replaceAll('_', ' '),
      casesUsingMetric[0]?.expectedBehaviorFocus,
      ...casesUsingMetric.flatMap((testCase) => testCase.applicableRequirements ?? []),
    ]),
    critical: false,
  };
}

export function getWorkspaceRubrics(seed = {}) {
  const metricIds = new Set([
    ...(seed.rubricArtifacts ?? []).map((rubric) => rubric.id),
    ...(seed.evalCases ?? []).flatMap((testCase) => testCase.applicableRequirements ?? []),
    ...(seed.promptResults ?? []).flatMap((result) => Object.keys(result.namedScores ?? {})),
    ...(seed.caseResults ?? []).flatMap((result) => Object.keys(result.namedScores ?? {})),
  ]);
  const artifactRubrics = (seed.rubricArtifacts ?? []).map((rubric) => ({
    ...rubric,
    id: rubric.id,
    label: rubric.label || humanizeId(rubric.id),
    keywords: rubric.keywords?.length ? rubric.keywords : compactKeywords([
      rubric.id.replaceAll('_', ' '),
      rubric.label,
      rubric.requirement,
      ...(rubric.passCriteria ?? []),
    ]),
    critical: Boolean(rubric.critical),
  }));
  const artifactById = new Map(artifactRubrics.map((rubric) => [rubric.id, rubric]));
  return uniqueById(Array.from(metricIds).map((metric) => artifactById.get(metric) ?? fallbackRubricFromMetric(metric, seed)));
}

function getRubricById(seedOrRubrics, metric) {
  const rubrics = Array.isArray(seedOrRubrics) ? seedOrRubrics : getWorkspaceRubrics(seedOrRubrics);
  return rubrics.find((rubric) => rubric.id === metric) ?? fallbackRubricFromMetric(metric);
}

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
    testTotal,
    assertionTotal,
    testPassRate: testTotal === 0 ? 0 : result.testPassCount / testTotal,
    assertionPassRate: assertionTotal === 0 ? 0 : result.assertPassCount / assertionTotal,
  };
}

export function summarizePromptComparison(promptResults, caseResults = [], rubrics = []) {
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
        label: getRubricById(rubrics, metric).label,
        baselineScore,
        candidateScore,
        maxScore,
        delta: candidateScore - baselineScore,
        baselineRate: baselineScore / maxScore,
        candidateRate: candidateScore / maxScore,
        critical: getRubricById(rubrics, metric).critical,
      };
    }),
  };
}

function classifyCaseMovement({ passed: baselinePassed }, { passed: candidatePassed }, metricDeltas, scoreDelta) {
  const positive = metricDeltas.some((metric) => metric.delta > 0);
  const negative = metricDeltas.some((metric) => metric.delta < 0);
  if (positive && negative) return 'mixed';
  if (baselinePassed && !candidatePassed) return 'regressed';
  if (!baselinePassed && candidatePassed) return 'improved';
  if (scoreDelta < -0.001 || negative) return 'regressed';
  if (scoreDelta > 0.001 || positive) return 'improved';
  return 'unchanged';
}

function summarizeCaseMovement(caseId, status, metricsChanged, scoreDelta) {
  if (status === 'improved') {
    const top = metricsChanged.filter((metric) => metric.delta > 0).map((metric) => metric.label).slice(0, 2).join(' and ');
    return `${caseId} improved${top ? ` on ${top}` : ''}; saved outputs show clearer tutor behavior than the current prompt.`;
  }
  if (status === 'regressed') {
    const top = metricsChanged.filter((metric) => metric.delta < 0).map((metric) => metric.label).slice(0, 2).join(' and ');
    return `${caseId} regressed${top ? ` on ${top}` : ''}; this case needs review before release.`;
  }
  if (status === 'mixed') {
    return `${caseId} has mixed tradeoffs; some rubric scores improved while others regressed.`;
  }
  return `${caseId} did not meaningfully change in the saved Promptfoo comparison.`;
}

function compareCaseResults(baseline, candidate, rubrics = []) {
  const metrics = Array.from(new Set([
    ...Object.keys(baseline.namedScores),
    ...Object.keys(candidate.namedScores),
  ]));
  const metricsChanged = metrics.map((metric) => {
    const baselineScore = baseline.namedScores[metric] ?? 0;
    const candidateScore = candidate.namedScores[metric] ?? 0;
    return {
      metric,
      label: getRubricById(rubrics, metric).label,
      baselineScore,
      candidateScore,
      maxScore: 1,
      delta: candidateScore - baselineScore,
      baselineRate: baselineScore,
      candidateRate: candidateScore,
      critical: getRubricById(rubrics, metric).critical,
    };
  }).filter((metric) => Math.abs(metric.delta) > 0.0001);
  const scoreDelta = candidate.score - baseline.score;
  const status = classifyCaseMovement(baseline, candidate, metricsChanged, scoreDelta);
  const criticalRegressions = metricsChanged.filter((metric) => metric.delta < 0 && metric.critical);

  return {
    caseId: baseline.caseId,
    status,
    baseline,
    candidate,
    scoreDelta,
    metricsChanged,
    hasRubricMovement: metricsChanged.length > 0 || status !== 'unchanged',
    criticalRegressions,
    plainLanguageSummary: summarizeCaseMovement(baseline.caseId, status, metricsChanged, scoreDelta),
  };
}

export function buildEvalWorkspaceSnapshot(seed) {
  const rubrics = getWorkspaceRubrics(seed);
  const caseIds = Array.from(new Set(seed.caseResults.map((result) => result.caseId)));
  const caseComparisons = caseIds.flatMap((caseId) => {
    const baseline = seed.caseResults.find((result) => result.caseId === caseId && result.promptKind === 'baseline');
    const candidate = seed.caseResults.find((result) => result.caseId === caseId && result.promptKind === 'candidate');
    return baseline && candidate ? [compareCaseResults(baseline, candidate, rubrics)] : [];
  });

  const changeCounts = {
    improved: caseComparisons.filter((comparison) => comparison.status === 'improved').length,
    regressed: caseComparisons.filter((comparison) => comparison.status === 'regressed').length,
    mixed: caseComparisons.filter((comparison) => comparison.status === 'mixed').length,
    unchanged: caseComparisons.filter((comparison) => comparison.status === 'unchanged').length,
  };

  return {
    promptComparison: summarizePromptComparison(seed.promptResults, seed.caseResults, rubrics),
    caseComparisons,
    changeCounts,
    changedCaseCount: caseComparisons.filter((comparison) => comparison.hasRubricMovement).length,
    criticalRegressionCount: caseComparisons.reduce((sum, comparison) => sum + comparison.criticalRegressions.length, 0),
  };
}

export function summarizeReleaseReadiness(snapshot, reviewDecisions = {}) {
  const unresolvedRegressions = snapshot.caseComparisons.filter((comparison) => {
    const decision = reviewDecisions[comparison.caseId];
    return comparison.status === 'regressed' && decision?.status !== 'approved';
  });
  const unresolvedCritical = snapshot.caseComparisons.filter((comparison) => (
    comparison.criticalRegressions.length > 0 && reviewDecisions[comparison.caseId]?.status !== 'approved'
  ));
  const pendingDecisionCount = snapshot.caseComparisons.filter((comparison) => (
    comparison.hasRubricMovement && !reviewDecisions[comparison.caseId]
  )).length;

  let verdict = 'ready';
  if (unresolvedCritical.length > 0) verdict = 'blocked';
  else if (unresolvedRegressions.length > 0 || snapshot.changeCounts.mixed > 0 || pendingDecisionCount > 0) verdict = 'needs_review';

  const labels = {
    ready: 'Ready',
    needs_review: 'Needs Review',
    blocked: 'Blocked',
  };
  const nextAction = verdict === 'ready'
    ? 'Export the review decision bundle and hand it to the Promptfoo/Git workflow.'
    : unresolvedCritical.length > 0
      ? 'Resolve critical rubric regressions before approving the prompt release.'
      : unresolvedRegressions.length > 0
        ? 'Review the regressed case and either revise the prompt or explicitly approve the tradeoff.'
        : 'Review changed cases and record reviewer decisions.';

  return {
    verdict,
    label: labels[verdict],
    plainLanguageVerdict: `${labels[verdict]}: the improved prompt raises the aggregate score, but case-level evidence still controls release approval.`,
    reason: verdict === 'ready'
      ? 'No unresolved regressions or critical blockers are visible in the saved comparison.'
      : `There are ${unresolvedRegressions.length} unresolved regressed cases, ${snapshot.changeCounts.mixed} mixed cases, and ${pendingDecisionCount} changed cases without review decisions.`,
    nextAction,
    blockers: [...unresolvedCritical, ...unresolvedRegressions]
      .filter((comparison, index, list) => list.findIndex((item) => item.caseId === comparison.caseId) === index)
      .map((comparison) => comparison.caseId),
    evidence: {
      aggregateScoreDelta: snapshot.promptComparison.scoreDelta,
      changedCases: snapshot.changedCaseCount,
      improvements: snapshot.changeCounts.improved,
      regressions: snapshot.changeCounts.regressed,
      mixedTradeoffs: snapshot.changeCounts.mixed,
      criticalRubricRegressions: snapshot.criticalRegressionCount,
      unresolvedReviewDecisions: pendingDecisionCount,
    },
  };
}

export function getVisibleCaseComparisons(caseComparisons, filters = {}) {
  const status = filters.status ?? 'changed';
  const requirement = filters.requirement ?? 'all';
  const query = (filters.query ?? '').trim().toLowerCase();

  return caseComparisons.filter((comparison) => {
    if (status === 'changed' && !comparison.hasRubricMovement) return false;
    if (status !== 'all' && status !== 'changed' && comparison.status !== status) return false;
    if (requirement !== 'all' && !comparison.metricsChanged.some((metric) => metric.metric === requirement)) return false;
    if (query && !comparison.caseId.toLowerCase().includes(query)) return false;
    return true;
  });
}

export function updateReviewDecision(reviewDecisions, caseId, decision) {
  return {
    ...reviewDecisions,
    [caseId]: {
      caseId,
      status: decision.status,
      reviewer: decision.reviewer?.trim() || 'Local reviewer',
      note: decision.note?.trim() || '',
      updatedAt: new Date().toISOString(),
    },
  };
}

export function getCaseDetail(caseComparisons, evalCases, caseId) {
  const comparison = caseComparisons.find((item) => item.caseId === caseId) ?? caseComparisons[0];
  if (!comparison) return null;
  const testCase = evalCases.find((item) => item.caseId === comparison.caseId);
  return {
    comparison,
    testCase,
    plainEnglishSummary: comparison.plainLanguageSummary,
    factSheet: {
      scenarioContext: testCase?.scenarioContext ?? 'No scenario context available.',
      studentMessage: testCase?.studentMessage ?? '',
      conversationHistory: testCase?.conversationHistory ?? '',
      expectedBehaviorFocus: testCase?.expectedBehaviorFocus ?? '',
      applicableRequirements: testCase?.applicableRequirements ?? [],
    },
    outputs: {
      baseline: comparison.baseline.output,
      candidate: comparison.candidate.output,
    },
    rationale: {
      baseline: comparison.baseline.reason,
      candidate: comparison.candidate.reason,
    },
    rubricDeltas: comparison.metricsChanged,
    promptDiff: comparison.metricsChanged.map((metric) => ({
      section: metric.metric,
      label: metric.label,
      summary: metric.delta > 0
        ? `Improved prompt appears stronger on ${metric.label}.`
        : `Improved prompt appears weaker on ${metric.label}.`,
      delta: metric.delta,
    })),
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
  const cleaned = String(description ?? '').replace(/\s+/g, ' ').trim();
  const patternMatches = [
    /(?:case|scenario|example|task)\s+(?:where|about)\s+(.+?)(?:[.,;]|\s+because\b|\s+so that\b|$)/i,
    /(?:add|create|generate|update)\s+(?:a\s+)?(?:case|scenario|example|task)\s+(?:where|about)\s+(.+?)(?:[.,;]|\s+because\b|\s+so that\b|$)/i,
    /student\s+(?:trusts|thinks|believes|wants|asks about|asks)\s+(.+?)(?:\s+because|\.|$)/i,
  ];
  for (const pattern of patternMatches) {
    const match = cleaned.match(pattern);
    if (match?.[1]) return match[1].trim().slice(0, 48);
  }
  return cleaned.split(/\s+/).slice(0, 6).join(' ') || 'generated scenario';
}

function inferRequirements(description, rubrics = []) {
  const lower = description.toLowerCase();
  const normalized = ` ${lower.replace(/[^a-z0-9]+/g, ' ')} `;
  const genericKeywordStopWords = new Set([
    'student', 'students', 'tutor', 'response', 'responses', 'answer', 'answers',
    'direct', 'correct', 'correction', 'practical', 'knowledge', 'level', 'language',
    'persona', 'example', 'examples', 'question', 'questions', 'scenario', 'case',
  ]);

  const containsPhrase = (phrase) => {
    const cleaned = String(phrase ?? '').toLowerCase().trim();
    if (!cleaned) return false;
    if (cleaned.includes(' ')) return lower.includes(cleaned);
    return normalized.includes(` ${cleaned.replace(/[^a-z0-9]+/g, ' ')} `);
  };

  const matches = rubrics.filter((rubric) => {
    const explicitNames = [
      rubric.id,
      rubric.id?.replaceAll('_', ' '),
      rubric.label,
    ].filter(Boolean);
    if (explicitNames.some(containsPhrase)) return true;

    const descriptivePhrases = [
      rubric.requirement,
      ...(rubric.passCriteria ?? []),
      ...(rubric.failCriteria ?? []),
    ].filter((phrase) => String(phrase ?? '').trim().split(/\s+/).length >= 3);
    if (descriptivePhrases.some(containsPhrase)) return true;

    const keywordHits = (rubric.keywords ?? []).filter((keyword) => {
      const text = String(keyword ?? '').toLowerCase().trim();
      if (!text || genericKeywordStopWords.has(text)) return false;
      if (text.includes(' ')) return containsPhrase(text);
      return text.length >= 7 && containsPhrase(text);
    });
    return keywordHits.length >= 2;
  }).map((rubric) => rubric.id);

  return matches.length > 0 ? Array.from(new Set(matches)) : rubrics.slice(0, 2).map((rubric) => rubric.id);
}

function inferCoverageTags(testCase) {
  const text = `${testCase.caseId} ${testCase.scenarioContext} ${testCase.conversationHistory} ${testCase.studentMessage} ${testCase.expectedBehaviorFocus}`.toLowerCase();
  const learnerLevel = text.includes('younger') || text.includes('confused') || text.includes('beginner') ? 'beginner/younger' : text.includes('overconfident') ? 'advanced/overconfident' : 'general teen';
  const phishingScenario = text.includes('bank') ? 'bank alert'
    : text.includes('discord') || text.includes('nitro') ? 'giveaway/social reward'
      : text.includes('snap') ? 'social platform alert'
        : text.includes('shortened') || text.includes('url expander') ? 'hidden/redirected link'
          : 'account security alert';
  const misconceptionType = text.includes('https') || text.includes('lock') ? 'lock/HTTPS trust'
    : text.includes('professional') || text.includes('design') ? 'visual polish trust'
      : text.includes('spelling') || text.includes('misspel') ? 'single-clue overfocus'
        : text.includes('click') ? 'unsafe clicking impulse'
          : text.includes('support') || text.includes('domain') ? 'partial domain trust'
            : 'general uncertainty';
  const dialogLength = (testCase.conversationHistory.match(/\n/g) ?? []).length > 1 ? 'multi-turn' : 'single-turn';
  const emotionalTone = text.includes('panic') || text.includes('scare') || text.includes('risk') || text.includes('worried') ? 'fear/urgency' : text.includes('easy') || text.includes('overconfident') ? 'overconfident' : 'neutral';
  const safetySensitive = text.includes('bank') || text.includes('password') || text.includes('login') || text.includes('click') ? 'safety-sensitive' : 'standard';
  const expectedTutorStrategy = testCase.applicableRequirements.includes('direct_correction') ? 'direct correction'
    : testCase.applicableRequirements.includes('practical_knowledge') ? 'practical safe action'
      : testCase.applicableRequirements.includes('reading_level') ? 'simplify language'
        : 'persona/rhythm control';
  return { learnerLevel, phishingScenario, misconceptionType, dialogLength, emotionalTone, safetySensitive, expectedTutorStrategy };
}

function buildDimension(cases, id, label, getter) {
  const groups = new Map();
  for (const testCase of cases) {
    const value = getter(testCase);
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(testCase.caseId);
  }
  return {
    id,
    label,
    groups: Array.from(groups.entries())
      .map(([value, caseIds]) => ({ value, count: caseIds.length, caseIds }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  };
}

export function buildDatasetCoverage(cases) {
  const tagged = cases.map((testCase) => ({ ...testCase, coverageTags: inferCoverageTags(testCase) }));
  const dimensions = [
    buildDimension(tagged, 'learnerLevel', 'Learner level', (item) => item.coverageTags.learnerLevel),
    buildDimension(tagged, 'phishingScenario', 'Phishing scenario', (item) => item.coverageTags.phishingScenario),
    buildDimension(tagged, 'misconceptionType', 'Misconception type', (item) => item.coverageTags.misconceptionType),
    buildDimension(tagged, 'dialogLength', 'Dialog length', (item) => item.coverageTags.dialogLength),
    buildDimension(tagged, 'emotionalTone', 'Emotional tone', (item) => item.coverageTags.emotionalTone),
    buildDimension(tagged, 'safetySensitive', 'Safety sensitivity', (item) => item.coverageTags.safetySensitive),
    buildDimension(tagged, 'expectedTutorStrategy', 'Expected tutor strategy', (item) => item.coverageTags.expectedTutorStrategy),
    buildDimension(tagged, 'rubric', 'Applicable rubric', (item) => item.applicableRequirements.join(' + ')),
  ];
  const warnings = dimensions.flatMap((dimension) => {
    const messages = [];
    const total = cases.length || 1;
    const underrepresented = dimension.groups.filter((group) => group.count === 1);
    const dominant = dimension.groups.find((group) => group.count / total > 0.6);
    if (underrepresented.length > 0) messages.push(`${dimension.label}: ${underrepresented.length} segment(s) have only one case.`);
    if (dominant) messages.push(`${dimension.label}: ${dominant.value} dominates ${Math.round((dominant.count / total) * 100)}% of cases.`);
    return messages;
  });
  const duplicateSignals = cases.reduce((acc, testCase) => {
    const key = `${inferCoverageTags(testCase).misconceptionType}|${testCase.applicableRequirements.join(',')}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const nearDuplicateCount = Object.values(duplicateSignals).filter((count) => count > 3).length;
  if (nearDuplicateCount > 0) warnings.push(`${nearDuplicateCount} possible near-duplicate case group(s) share misconception and rubric alignment.`);
  return { totalCases: cases.length, dimensions, warnings };
}

function buildDistributionImpact(beforeCases, afterCases, generatedCase) {
  const before = buildDatasetCoverage(beforeCases);
  const after = buildDatasetCoverage(afterCases);
  const changedDimensions = after.dimensions.map((dimension) => {
    const beforeDimension = before.dimensions.find((item) => item.id === dimension.id);
    const generatedTags = inferCoverageTags(generatedCase);
    const value = dimension.id === 'rubric'
      ? generatedCase.applicableRequirements.join(' + ')
      : generatedTags[dimension.id];
    const beforeCount = beforeDimension?.groups.find((group) => group.value === value)?.count ?? 0;
    const afterCount = dimension.groups.find((group) => group.value === value)?.count ?? 0;
    return { dimension: dimension.id, label: dimension.label, value, beforeCount, afterCount, delta: afterCount - beforeCount };
  }).filter((item) => item.delta !== 0);
  return { before, after, changedDimensions };
}

export function applyNaturalLanguageEvalChange(cases, description, rubrics = []) {
  const topic = inferTopic(description);
  const requirements = inferRequirements(description, rubrics);
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
    distributionImpact: buildDistributionImpact(cases, nextCases, generatedCase),
    message: existingIndex >= 0 ? 'Updated matching generated case.' : 'Added a generated eval case.',
  };
}

function includesAny(text, phrases) {
  return phrases.some((phrase) => text.includes(phrase));
}

function scoreRequirement(promptText, requirement, rubrics = []) {
  const normalized = promptText.toLowerCase();
  const rubric = getRubricById(rubrics, requirement);
  const phrases = [
    requirement.replaceAll('_', ' '),
    rubric.label,
    rubric.requirement,
    ...(rubric.keywords ?? []),
  ].filter(Boolean).map((phrase) => String(phrase).toLowerCase());
  return includesAny(normalized, phrases) ? 1 : 0;
}

export function estimateDraftEvaluation(promptText, cases, rubrics = []) {
  const promptLength = promptText.trim().length;
  const normalized = promptText.toLowerCase();
  const activeRubrics = rubrics.length > 0
    ? rubrics
    : getWorkspaceRubrics({ evalCases: cases });
  const requirements = activeRubrics.map((rubric) => rubric.id);
  const coveredRequirements = requirements.filter((requirement) => scoreRequirement(promptText, requirement, activeRubrics) > 0);
  const qualitySignals = [
    promptLength >= 700 ? 1 : 0,
    promptLength >= 1200 ? 1 : 0,
    requirements.length === 0 ? 0 : coveredRequirements.length / requirements.length,
    cases.some((testCase) => normalized.includes(String(testCase.expectedBehaviorFocus ?? '').split(' ')[0]?.toLowerCase() ?? '')) ? 1 : 0,
  ];
  const promptQuality = Math.min(1, qualitySignals.reduce((sum, value) => sum + value, 0) / 4);
  const namedScores = requirements.reduce((scores, requirement) => {
    scores[requirement] = scoreRequirement(promptText, requirement, activeRubrics);
    return scores;
  }, {});
  const caseResults = cases.map((testCase) => {
    const requirementScores = testCase.applicableRequirements.map((requirement) => scoreRequirement(promptText, requirement, activeRubrics));
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

export function summarizeDraftPromptImpact(beforePromptText, afterPromptText, cases, rubrics = []) {
  const before = estimateDraftEvaluation(beforePromptText, cases, rubrics);
  const after = estimateDraftEvaluation(afterPromptText, cases, rubrics);
  const caseLevelChanges = after.caseResults
    .map((afterCase) => {
      const beforeCase = before.caseResults.find((result) => result.caseId === afterCase.caseId);
      const delta = afterCase.score - (beforeCase?.score ?? 0);
      const direction = !beforeCase || Math.abs(delta) < 0.001
        ? 'unchanged'
        : delta > 0
          ? 'improved'
          : 'regressed';
      const passChange = beforeCase && beforeCase.passed !== afterCase.passed
        ? `${beforeCase.passed ? 'pass' : 'fail'} → ${afterCase.passed ? 'pass' : 'fail'}`
        : 'same pass/fail';
      return {
        caseId: afterCase.caseId,
        beforeScore: beforeCase?.score ?? 0,
        afterScore: afterCase.score,
        delta,
        direction,
        passChange,
        reason: direction === 'unchanged'
          ? 'No visible heuristic movement for this draft edit.'
          : `Draft edit ${direction} this case because visible prompt language changed for its requirements.`,
      };
    })
    .filter((change) => change.direction !== 'unchanged')
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const requirements = Array.from(new Set([
    ...Object.keys(before.namedScores),
    ...Object.keys(after.namedScores),
  ]));
  const requirementChanges = requirements
    .map((requirement) => ({
      requirement,
      label: getRubricById(rubrics, requirement).label,
      before: before.namedScores[requirement] ?? 0,
      after: after.namedScores[requirement] ?? 0,
      delta: (after.namedScores[requirement] ?? 0) - (before.namedScores[requirement] ?? 0),
    }))
    .filter((change) => change.delta !== 0);

  return {
    before,
    after,
    statistical: {
      scoreDelta: after.score - before.score,
      passRateDelta: after.passRate - before.passRate,
      passedCaseDelta: after.passedCases - before.passedCases,
      promptLengthDelta: after.promptLength - before.promptLength,
    },
    requirementChanges,
    caseLevelChanges,
  };
}

export function buildArtifactVersions(seed) {
  const artifacts = seed.artifacts ?? {};
  const promptArtifacts = (artifacts.prompts ?? []).map((prompt, index) => ({
    ...prompt,
    id: prompt.id ?? `prompt_${index + 1}`,
    kind: 'prompt',
    promptKind: prompt.kind ?? prompt.promptKind ?? (index === 0 ? 'baseline' : 'candidate'),
    changedInComparison: Boolean(prompt.changedInComparison),
  }));
  const dataset = artifacts.dataset ? { ...artifacts.dataset, kind: artifacts.dataset.kind ?? 'dataset' } : null;
  const rubric = artifacts.rubric ? { ...artifacts.rubric, kind: artifacts.rubric.kind ?? 'rubric' } : null;
  const modelConfig = artifacts.modelConfig ? { ...artifacts.modelConfig, kind: artifacts.modelConfig.kind ?? 'model_config' } : null;
  const evaluatorConfig = artifacts.evaluatorConfig ? { ...artifacts.evaluatorConfig, kind: artifacts.evaluatorConfig.kind ?? 'evaluator_config' } : null;
  const otherArtifacts = [dataset, rubric, modelConfig, evaluatorConfig].filter(Boolean);
  const versions = [...promptArtifacts, ...otherArtifacts];
  const runs = (seed.promptResults ?? []).map((result) => {
    const matchingPrompt = promptArtifacts.find((prompt) => prompt.promptKind === result.kind) ?? promptArtifacts[result.kind === 'baseline' ? 0 : 1];
    return {
      id: `${seed.metadata?.evalId ?? 'eval'}_${result.kind}`,
      label: result.label,
      promptKind: result.kind,
      timestamp: seed.metadata?.timestamp,
      artifactRefs: {
        prompt: matchingPrompt?.id,
        dataset: dataset?.id,
        rubric: rubric?.id,
        modelConfig: modelConfig?.id,
        evaluatorConfig: evaluatorConfig?.id,
      },
      sourceRef: artifacts.results?.sourceRef ?? 'results/latest.json',
    };
  });
  const nonPromptChanged = otherArtifacts.filter((item) => item.changedInComparison);
  const comparisonType = nonPromptChanged.length === 0
    ? { level: 'clean', label: 'Clean prompt A/B', message: 'Only the prompt artifact changes between these saved runs.' }
    : nonPromptChanged.length === 1
      ? { level: 'caution', label: 'Cautionary comparison', message: `${nonPromptChanged[0].kind} also changed, so score movement may not be prompt-only.` }
      : { level: 'not_direct', label: 'Not directly comparable', message: 'Multiple meaning-changing artifacts changed.' };

  return { versions, runs, comparisonType };
}

export function buildRubricMeaningDiff(seed) {
  const comparison = summarizePromptComparison(seed.promptResults, seed.caseResults, getWorkspaceRubrics(seed));
  return comparison.metricComparisons.map((metric) => {
    let changeType = 'wording-only';
    if (metric.critical && Math.abs(metric.delta) > 0) changeType = 'threshold change';
    else if (Math.abs(metric.delta) > 1) changeType = 'clarification';
    else if (metric.delta !== 0) changeType = 'observed scoring movement';
    return {
      rubric: metric.metric,
      label: metric.label,
      changeType,
      meaningChanging: ['threshold change', 'new criterion', 'removed criterion'].includes(changeType),
      before: `Current run scored ${metric.baselineScore.toFixed(1)} / ${metric.maxScore}.`,
      after: `Improved run scored ${metric.candidateScore.toFixed(1)} / ${metric.maxScore}.`,
      evidence: metric.delta === 0
        ? 'No saved score movement for this rubric.'
        : `Saved Promptfoo artifacts show ${metric.delta > 0 ? 'positive' : 'negative'} movement of ${metric.delta.toFixed(1)}.`,
    };
  });
}

export function buildRubricProposal(description, rubrics = []) {
  const lower = description.toLowerCase();
  const meaningChanging = includesAny(lower, ['stricter', 'require', 'must', 'threshold', 'new criterion', 'remove', 'blocker', 'always fail']);
  const rubric = inferRequirements(description, rubrics)[0] ?? rubrics[0]?.id ?? 'rubric';
  return {
    id: `rubric_proposal_${slugify(description).slice(0, 40)}`,
    rubric,
    label: getRubricById(rubrics, rubric).label,
    request: description,
    changeType: meaningChanging ? 'threshold change' : 'clarification',
    meaningChanging,
    before: `${getRubricById(rubrics, rubric).label}: current rubric wording from Promptfoo artifacts remains authoritative.`,
    after: `${getRubricById(rubrics, rubric).label}: draft change requested in plain English — ${description.trim()}`,
    comparabilityWarning: meaningChanging
      ? 'Meaning-changing rubric drafts make old and new scores not directly comparable until re-run with the new rubric.'
      : 'This looks like a clarification draft; still review before using it in Promptfoo.',
  };
}

export function buildDiagnosisNotebook(seed, snapshot, handWritten = {}) {
  const changedCases = snapshot.caseComparisons.filter((comparison) => comparison.hasRubricMovement);
  const worstChangedCase = changedCases
    .slice()
    .sort((a, b) => a.scoreDelta - b.scoreDelta)[0] ?? snapshot.caseComparisons[0] ?? null;
  const evalId = seed.metadata?.evalId ?? 'eval-run';
  const resultsRef = seed.artifacts?.results?.sourceRef ?? 'results/latest.json';
  const defaultIssue = worstChangedCase?.plainLanguageSummary ?? 'No case movement found in latest Promptfoo results.';

  return {
    mode: 'hybrid',
    evalRun: {
      id: evalId,
      href: '#run-detail',
      resultsRef,
      timestamp: seed.metadata?.timestamp ?? null,
    },
    handWritten: {
      issue: handWritten.issue?.trim() || defaultIssue,
      cause: handWritten.cause?.trim() || 'unclear',
      targetArtifact: handWritten.targetArtifact?.trim() || seed.artifacts?.prompts?.find((prompt) => prompt.kind === 'candidate')?.sourceRef || seed.artifacts?.prompts?.at(-1)?.sourceRef || '',
      hypothesis: handWritten.hypothesis?.trim() || `Revise the candidate prompt, re-run Promptfoo, and compare against ${resultsRef}.`,
    },
    machineGenerated: {
      summary: `Promptfoo saved run ${evalId} shows ${changedCases.length} changed cases, ${snapshot.changeCounts.regressed} regressions, ${snapshot.changeCounts.mixed} mixed cases, and score delta ${snapshot.promptComparison.scoreDelta.toFixed(2)}.`,
      worstChangedCase: worstChangedCase ? {
        caseId: worstChangedCase.caseId,
        status: worstChangedCase.status,
        scoreDelta: worstChangedCase.scoreDelta,
        summary: worstChangedCase.plainLanguageSummary,
        metricsChanged: worstChangedCase.metricsChanged.map((metric) => ({
          metric: metric.metric,
          label: metric.label,
          delta: metric.delta,
        })),
      } : null,
      generatedFrom: resultsRef,
    },
  };
}

export function buildExportDraftBundle({ seed, promptSections, evalCases, rubricProposal = null, reviewDecisions = {}, snapshot = null, diagnosisNotebook = {} }) {
  const currentSnapshot = snapshot ?? buildEvalWorkspaceSnapshot(seed);
  const artifacts = seed.artifacts ?? {};
  return {
    exportedAt: new Date().toISOString(),
    provenance: {
      authoritativeEvaluator: artifacts.evaluatorConfig?.label ?? seed.metadata?.authoritativeEvaluator ?? 'Saved evaluator',
      savedResults: artifacts.results?.sourceRef ?? 'results/latest.json',
      datasetSource: artifacts.dataset?.sourceRef ?? 'dataset/cases.yaml',
      promptSources: (artifacts.prompts ?? []).map((prompt) => prompt.sourceRef).filter(Boolean),
      browserPreview: 'Local heuristic only; not a live model run.',
      noBrowserProviderSecrets: true,
    },
    releaseReadiness: summarizeReleaseReadiness(currentSnapshot, reviewDecisions),
    artifactVersions: buildArtifactVersions(seed),
    promptDraft: {
      sections: promptSections,
      composedPrompt: composePrompt(promptSections),
    },
    datasetDraft: {
      cases: evalCases,
      coverage: buildDatasetCoverage(evalCases),
    },
    rubricProposal,
    reviewDecisions,
    diagnosisNotebook: buildDiagnosisNotebook(seed, currentSnapshot, diagnosisNotebook),
  };
}

export function exportEvalCasesAsJson(cases) {
  return JSON.stringify(cases, null, 2);
}

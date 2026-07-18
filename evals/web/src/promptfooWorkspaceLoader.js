const PROMPTFOO_ROOT = '../promptfoo/';
const SERVE_ROOT_PREFIX = window.location.pathname.includes('/web/') ? '../promptfoo/' : 'promptfoo/';

function humanizeId(value) {
  return String(value ?? '')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function stripPromptLabel(label = '') {
  return String(label).split(':', 1)[0].replace(/^\.\.\//, '');
}

function parseChatPrompt(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map((message) => message.content).filter(Boolean).join('\n\n');
  } catch {
    // Promptfoo exports raw prompt text for non-JSON prompts too.
  }
  return String(raw ?? '');
}

function extractRubricSummary(markdown = '') {
  const title = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const requirement = markdown.match(/Requirement:\s*([^\n]+)/i)?.[1]?.trim()
    ?? markdown.split('\n').find((line) => line.trim() && !line.startsWith('#'))?.trim()
    ?? '';
  const passBlock = markdown.match(/Pass criteria:\s*([\s\S]*?)(?:\n\s*Fail criteria:|\n\s*Passing examples:|$)/i)?.[1] ?? '';
  const failBlock = markdown.match(/Fail criteria:\s*([\s\S]*?)(?:\n\s*Passing examples:|\n\s*Return pass=|$)/i)?.[1] ?? '';
  const listItems = (block) => block.split('\n').map((line) => line.replace(/^\s*-\s*/, '').trim()).filter(Boolean).slice(0, 5);
  return { title, requirement, passCriteria: listItems(passBlock), failCriteria: listItems(failBlock) };
}

async function fetchText(path) {
  const response = await fetch(`${SERVE_ROOT_PREFIX}${path}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Unable to load evals/promptfoo/${path}: ${response.status}`);
  return response.text();
}

async function fetchJson(path) {
  return JSON.parse(await fetchText(path));
}

async function listDirectoryFiles(path, pattern = /.*/) {
  const html = await fetchText(path);
  return Array.from(html.matchAll(/href="([^"]+)"/g))
    .map((match) => decodeURIComponent(match[1]))
    .filter((href) => !href.startsWith('../') && !href.startsWith('/') && pattern.test(href))
    .map((href) => `${path}${href}`);
}

function normalizePromptResults(prompts = []) {
  return prompts.map((prompt, index) => {
    const metrics = prompt.metrics ?? {};
    const kind = index === 0 ? 'baseline' : index === 1 ? 'candidate' : `prompt_${index + 1}`;
    return {
      kind,
      id: prompt.id,
      label: index === 0 ? 'Current prompt' : index === 1 ? 'Improved prompt' : `Prompt ${index + 1}`,
      provider: prompt.provider,
      sourceRef: stripPromptLabel(prompt.label) || `results/latest.json#prompts/${index}`,
      raw: prompt.raw,
      promptText: parseChatPrompt(prompt.raw),
      score: metrics.score ?? 0,
      testPassCount: metrics.testPassCount ?? 0,
      testFailCount: metrics.testFailCount ?? 0,
      testErrorCount: metrics.testErrorCount ?? 0,
      assertPassCount: metrics.assertPassCount ?? 0,
      assertFailCount: metrics.assertFailCount ?? 0,
      totalLatencyMs: metrics.totalLatencyMs ?? 0,
      tokenUsage: metrics.tokenUsage ?? {},
      namedScores: metrics.namedScores ?? {},
      namedScoresCount: metrics.namedScoresCount ?? {},
      cost: metrics.cost ?? 0,
    };
  });
}

function normalizeCaseResults(rows = []) {
  return rows.map((row) => ({
    id: row.id,
    caseId: row.vars?.case_id ?? `case_${row.testIdx}`,
    promptKind: row.promptIdx === 0 ? 'baseline' : row.promptIdx === 1 ? 'candidate' : `prompt_${row.promptIdx + 1}`,
    promptIdx: row.promptIdx,
    promptId: row.promptId,
    provider: row.provider?.label ?? row.provider?.id,
    passed: Boolean(row.success ?? row.gradingResult?.pass),
    score: row.score ?? row.gradingResult?.score ?? 0,
    namedScores: row.namedScores ?? row.gradingResult?.namedScores ?? {},
    output: row.response?.output ?? '',
    reason: row.gradingResult?.reason ?? row.error ?? '',
    latencyMs: row.latencyMs ?? row.response?.latencyMs ?? 0,
    cost: row.cost ?? row.response?.cost ?? 0,
    vars: row.vars ?? {},
    assertions: row.gradingResult?.componentResults ?? [],
  }));
}

function normalizeEvalCases(rows = []) {
  const byCase = new Map();
  for (const row of rows) {
    const vars = row.vars ?? {};
    const caseId = vars.case_id ?? `case_${row.testIdx}`;
    if (byCase.has(caseId)) continue;
    byCase.set(caseId, {
      caseId,
      scenarioContext: vars.scenario_context ?? '',
      conversationHistory: vars.conversation_history ?? '',
      studentMessage: vars.student_message ?? '',
      expectedBehaviorFocus: vars.expected_behavior_focus ?? '',
      applicableRequirements: String(vars.applicable_requirements ?? '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      sourceRef: 'cases/account-security-alert.yaml',
    });
  }
  return Array.from(byCase.values());
}

function normalizeRubrics(rubricFiles = new Map(), latestRows = []) {
  const fromFiles = Array.from(rubricFiles.entries()).map(([sourceRef, markdown]) => {
    const id = sourceRef.split('/').pop().replace(/\.md$/, '');
    const summary = extractRubricSummary(markdown);
    return {
      id,
      label: summary.title?.replace(/\s+Rubric$/i, '') || humanizeId(id),
      sourceRef,
      requirement: summary.requirement,
      passCriteria: summary.passCriteria,
      failCriteria: summary.failCriteria,
      markdown,
      critical: ['direct_correction', 'practical_knowledge'].includes(id),
    };
  });

  const seen = new Set(fromFiles.map((rubric) => rubric.id));
  for (const row of latestRows) {
    for (const component of row.gradingResult?.componentResults ?? []) {
      const metric = component.assertion?.metric;
      if (!metric || seen.has(metric)) continue;
      const markdown = component.assertion?.value ?? '';
      const summary = extractRubricSummary(markdown);
      fromFiles.push({
        id: metric,
        label: summary.title?.replace(/\s+Rubric$/i, '') || humanizeId(metric),
        sourceRef: `results/latest.json#rubric/${metric}`,
        requirement: summary.requirement,
        passCriteria: summary.passCriteria,
        failCriteria: summary.failCriteria,
        markdown,
        critical: false,
      });
      seen.add(metric);
    }
  }
  return fromFiles;
}

function buildPromptSections(promptText = '') {
  const sections = [];
  const matches = Array.from(promptText.matchAll(/^##\s+(.+)$/gm));
  if (matches.length === 0) return [{ id: 'prompt', title: 'Prompt', content: promptText }];
  for (let index = 0; index < matches.length; index += 1) {
    const start = matches[index].index + matches[index][0].length;
    const end = matches[index + 1]?.index ?? promptText.length;
    const title = matches[index][1].trim();
    sections.push({ id: title.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || `section_${index + 1}`, title, content: promptText.slice(start, end).trim() });
  }
  return sections;
}

export async function loadPromptfooWorkspace() {
  const [latest, readme, fixtureMetadata, configText] = await Promise.all([
    fetchJson('results/latest.json'),
    fetchText('README.md').catch(() => ''),
    fetchJson('fixtures/fixture-metadata.json').catch(() => ({})),
    fetchText('promptfooconfig.yaml').catch(() => ''),
  ]);

  const [promptPaths, rubricPaths, casePaths] = await Promise.all([
    listDirectoryFiles('prompts/', /\.(txt|json)$/).catch(() => []),
    listDirectoryFiles('rubrics/', /\.md$/).catch(() => []),
    listDirectoryFiles('cases/', /\.(ya?ml|json)$/).catch(() => []),
  ]);

  const promptFiles = new Map(await Promise.all(promptPaths.map(async (path) => [path, await fetchText(path)])));
  const rubricFiles = new Map(await Promise.all(rubricPaths.map(async (path) => [path, await fetchText(path)])));
  const caseFiles = new Map(await Promise.all(casePaths.map(async (path) => [path, await fetchText(path)])));

  const promptResults = normalizePromptResults(latest.results?.prompts ?? []);
  const baselinePrompt = promptFiles.get('prompts/current.prompt.txt') ?? promptResults[0]?.promptText ?? '';
  const candidatePrompt = promptFiles.get('prompts/improved.prompt.txt') ?? promptResults[1]?.promptText ?? '';
  const evalCases = normalizeEvalCases(latest.results?.results ?? []);
  const rubricArtifacts = normalizeRubrics(rubricFiles, latest.results?.results ?? []);

  return {
    metadata: {
      evalId: latest.evalId,
      timestamp: latest.results?.timestamp,
      description: latest.config?.description ?? 'Promptfoo evaluation',
      agentPreset: fixtureMetadata.agent_preset,
      scenarioTemplate: fixtureMetadata.scenario_template,
      gitCommit: fixtureMetadata.git_commit,
      sourceRoot: 'evals/promptfoo',
      readme,
      promptfooConfig: configText,
      loadedFiles: {
        prompts: Array.from(promptFiles.keys()),
        rubrics: Array.from(rubricFiles.keys()),
        cases: Array.from(caseFiles.keys()),
        results: ['results/latest.json'],
      },
    },
    artifacts: {
      prompts: promptResults.map((prompt, index) => ({
        id: prompt.id || `prompt_${index + 1}`,
        label: prompt.label,
        sourceRef: prompt.sourceRef,
        kind: prompt.kind,
        changedInComparison: true,
      })),
      dataset: { id: 'promptfoo_cases', label: 'Promptfoo cases', sourceRef: Array.from(caseFiles.keys()).join(', ') || 'results/latest.json#tests', changedInComparison: false },
      rubric: { id: 'promptfoo_rubrics', label: 'Promptfoo rubrics', sourceRef: Array.from(rubricFiles.keys()).join(', ') || 'results/latest.json#assertions', changedInComparison: false },
      modelConfig: { id: latest.results?.prompts?.[0]?.provider ?? 'provider', label: latest.results?.prompts?.[0]?.provider ?? 'Provider', sourceRef: 'promptfooconfig.yaml#providers', changedInComparison: false },
      evaluatorConfig: { id: 'promptfoo_judge', label: 'Promptfoo judge', sourceRef: 'promptfooconfig.yaml#defaultTest', changedInComparison: false },
      results: { sourceRef: 'results/latest.json' },
    },
    promptSections: buildPromptSections(candidatePrompt),
    promptSources: { baseline: baselinePrompt, candidate: candidatePrompt, files: Object.fromEntries(promptFiles) },
    rawSources: { prompts: Object.fromEntries(promptFiles), rubrics: Object.fromEntries(rubricFiles), cases: Object.fromEntries(caseFiles), config: configText, latest },
    evalCases,
    rubricArtifacts,
    promptResults,
    caseResults: normalizeCaseResults(latest.results?.results ?? []),
  };
}

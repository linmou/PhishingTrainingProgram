/** Pure view-model for a promptfoo-style results table over results/latest.json */

const DEFAULT_VAR_ORDER = [
  'case_id',
  'student_message',
  'expected_behavior_focus',
  'scenario_context',
  'conversation_history',
  'applicable_requirements',
];

function shortPromptLabel(label = '', index = 0) {
  const path = String(label).split(':', 1)[0];
  if (/current/i.test(path)) return 'Current';
  if (/improved/i.test(path)) return 'Improved';
  if (/baseline/i.test(path)) return 'Baseline';
  if (/candidate/i.test(path)) return 'Candidate';
  return `Prompt ${index + 1}`;
}

function sourcePath(label = '') {
  return String(label).split(':', 1)[0].replace(/^\.\.\//, '').trim();
}

function normalizeAssertions(componentResults = []) {
  return componentResults.map((component) => ({
    metric: component.assertion?.metric ?? component.assertion?.type ?? 'assertion',
    type: component.assertion?.type ?? '',
    pass: Boolean(component.pass),
    score: component.score ?? 0,
    reason: component.reason ?? '',
  }));
}

function collectVarColumns(rows = []) {
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row.vars ?? {})) seen.add(key);
  }
  const ordered = DEFAULT_VAR_ORDER.filter((key) => seen.has(key));
  for (const key of seen) {
    if (!ordered.includes(key)) ordered.push(key);
  }
  return ordered;
}

function rowDifferent(outputs = []) {
  if (outputs.length < 2) return false;
  const first = outputs[0];
  return outputs.slice(1).some((output) =>
    output.success !== first.success
    || Number(output.score).toFixed(4) !== Number(first.score).toFixed(4));
}

export function buildPromptfooViewModel(latest = {}) {
  const results = latest.results ?? {};
  const promptRows = results.prompts ?? [];
  const resultRows = results.results ?? [];

  const prompts = promptRows.map((prompt, index) => {
    const metrics = prompt.metrics ?? {};
    return {
      index,
      id: prompt.id ?? `prompt_${index}`,
      shortLabel: shortPromptLabel(prompt.label, index),
      sourcePath: sourcePath(prompt.label),
      provider: prompt.provider ?? '',
      label: prompt.label ?? '',
      metrics: {
        score: metrics.score ?? 0,
        testPassCount: metrics.testPassCount ?? 0,
        testFailCount: metrics.testFailCount ?? 0,
        testErrorCount: metrics.testErrorCount ?? 0,
        assertPassCount: metrics.assertPassCount ?? 0,
        assertFailCount: metrics.assertFailCount ?? 0,
        totalLatencyMs: metrics.totalLatencyMs ?? 0,
        namedScores: metrics.namedScores ?? {},
        namedScoresCount: metrics.namedScoresCount ?? {},
        tokenUsage: metrics.tokenUsage ?? {},
        cost: metrics.cost ?? 0,
      },
    };
  });

  const byTest = new Map();
  for (const row of resultRows) {
    const testIdx = row.testIdx ?? 0;
    if (!byTest.has(testIdx)) {
      byTest.set(testIdx, {
        testIdx,
        caseId: row.vars?.case_id ?? `case_${testIdx}`,
        vars: row.vars ?? {},
        outputs: [],
      });
    }
    const bucket = byTest.get(testIdx);
    bucket.outputs[row.promptIdx ?? 0] = {
      promptIdx: row.promptIdx ?? 0,
      success: Boolean(row.success ?? row.gradingResult?.pass),
      score: row.score ?? row.gradingResult?.score ?? 0,
      output: row.response?.output ?? row.error ?? '',
      reason: row.gradingResult?.reason ?? row.error ?? '',
      namedScores: row.namedScores ?? row.gradingResult?.namedScores ?? {},
      assertions: normalizeAssertions(row.gradingResult?.componentResults ?? []),
      latencyMs: row.latencyMs ?? row.response?.latencyMs ?? 0,
      cost: row.cost ?? row.response?.cost ?? 0,
      error: row.error ?? null,
    };
  }

  const rows = Array.from(byTest.values())
    .sort((a, b) => a.testIdx - b.testIdx)
    .map((row) => {
      const outputs = prompts.map((_, index) => row.outputs[index] ?? {
        promptIdx: index,
        success: false,
        score: 0,
        output: '',
        reason: 'Missing result',
        namedScores: {},
        assertions: [],
        latencyMs: 0,
        cost: 0,
        error: 'Missing result',
      });
      const different = rowDifferent(outputs);
      return {
        ...row,
        outputs,
        different,
        anyFail: outputs.some((output) => !output.success),
        anyPass: outputs.some((output) => output.success),
        allPass: outputs.every((output) => output.success),
        allFail: outputs.every((output) => !output.success),
      };
    });

  return {
    evalId: latest.evalId ?? '',
    description: latest.config?.description ?? results.description ?? 'Promptfoo evaluation',
    timestamp: results.timestamp ?? '',
    stats: results.stats ?? {},
    prompts,
    varColumns: collectVarColumns(rows),
    rows,
  };
}

export function metricPassRates(prompts = []) {
  const metrics = new Set();
  for (const prompt of prompts) {
    for (const key of Object.keys(prompt.metrics?.namedScores ?? {})) metrics.add(key);
  }
  return Array.from(metrics).sort().map((metric) => ({
    metric,
    values: prompts.map((prompt) => Number(prompt.metrics?.namedScores?.[metric] ?? 0)),
    counts: prompts.map((prompt) => Number(prompt.metrics?.namedScoresCount?.[metric] ?? 0)),
  }));
}

export function filterResultRows(rows = [], { filterMode = 'all', search = '' } = {}) {
  const query = String(search ?? '').trim().toLowerCase();
  return rows.filter((row) => {
    if (filterMode === 'failures' && !row.anyFail) return false;
    if (filterMode === 'passes' && !row.allPass) return false;
    if (filterMode === 'errors' && !row.outputs.some((output) => output.error)) return false;
    if (filterMode === 'different' && !row.different) return false;

    if (!query) return true;
    const haystack = [
      row.caseId,
      JSON.stringify(row.vars ?? {}),
      ...row.outputs.flatMap((output) => [output.output, output.reason, JSON.stringify(output.namedScores)]),
    ].join('\n').toLowerCase();
    return haystack.includes(query);
  });
}

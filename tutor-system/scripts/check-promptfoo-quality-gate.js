#!/usr/bin/env node
// Purpose: enforce per-metric Promptfoo quality gates from a saved JSON evaluation report.

const fs = require('fs');
const path = require('path');

const METRICS = [
  'turn_rhythm',
  'direct_correction',
  'persona_stability',
  'low_boilerplate_praise',
  'practical_knowledge',
  'third_person_examples',
  'reading_level',
  'response_length',
  'structured_output',
  'mode_selection',
  'mode_reason_grounding',
  'guard_response_quality',
  'guard_tone_safety'
];

const DEFAULT_THRESHOLD = 0.8;
const CURRENT_PROMPT = 'current.chat.prompt.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getResults(report) {
  if (Array.isArray(report?.results?.results)) {
    return report.results.results;
  }
  if (Array.isArray(report?.results)) {
    return report.results;
  }
  throw new Error('Promptfoo report does not contain results.results array');
}

function getPromptText(result) {
  return [
    result?.prompt?.raw,
    result?.prompt?.label,
    result?.prompt?.display,
    result?.prompt,
    result?.testCase?.description,
    result?.description
  ]
    .filter(Boolean)
    .map(String)
    .join('\n');
}

function getVariant(result) {
  const promptText = getPromptText(result);
  if (promptText.includes(CURRENT_PROMPT)) {
    return 'current';
  }

  const promptIdx = Number(result?.promptIdx ?? result?.promptIndex);
  if (promptIdx === 0) {
    return 'current';
  }
  return promptIdx === 0 ? 'current' : null;
}

function getAssertionMetric(component) {
  return component?.assertion?.metric || component?.metric || component?.name || component?.type;
}

function getAssertionPass(component) {
  if (typeof component?.pass === 'boolean') {
    return component.pass;
  }
  if (typeof component?.success === 'boolean') {
    return component.success;
  }
  if (typeof component?.score === 'number') {
    return component.score >= 1;
  }
  return false;
}

function getComponents(result) {
  const gradingResult = result?.gradingResult || result?.grading;
  if (Array.isArray(gradingResult?.componentResults)) {
    return gradingResult.componentResults;
  }
  if (Array.isArray(result?.assertionResults)) {
    return result.assertionResults;
  }
  if (Array.isArray(result?.assertions)) {
    return result.assertions;
  }
  return [];
}

function emptySummary() {
  return {
    current: Object.fromEntries(METRICS.map((metric) => [metric, { passed: 0, total: 0, missing: 0, errors: 0, passRate: 0 }])),
    bySuite: {},
    directCorrectionByStatus: {}
  };
}

function summarizeReport(report, manifest = report?.evaluation_manifest) {
  const summary = emptySummary();
  const unknownVariants = [];
  const observed = getResults(report);
  const completeManifest = manifest && Array.isArray(manifest.cases) && Number.isInteger(manifest.repetitions) && manifest.repetitions > 0;
  const rows = completeManifest ? manifest.cases.flatMap(definition => {
    const matches = observed.filter(result => result.testCase?.vars?.case_id === definition.case_id);
    return Array.from({ length: manifest.repetitions }, (_, repetition) => {
      const result = matches[repetition];
      const available = getComponents(result).slice();
      const components = (definition.metrics || []).map(metric => {
        const index = available.findIndex(component => getAssertionMetric(component) === metric);
        if (index < 0) return { metric, pass: false, status: 'missing' };
        const component = available.splice(index, 1)[0];
        if (result?.error || result?.response?.error || component.error || component.status === 'error' ||
            (typeof component.pass !== 'boolean' && typeof component.success !== 'boolean' && !Number.isFinite(component.score))) {
          return { metric, pass: false, status: 'error' };
        }
        return component;
      });
      return { ...(result || { promptIdx: 0 }), testCase: { vars: definition }, gradingResult: { componentResults: components } };
    });
  }) : observed;

  rows.forEach((result) => {
    const variant = getVariant(result);
    if (!variant) {
      unknownVariants.push(result?.testCase?.vars?.case_id || result?.description || 'unknown_result');
      return;
    }

    const suite = result?.testCase?.vars?.source_type || 'unknown_suite';
    const status = result?.testCase?.vars?.scaffolding_status || 'unknown_status';
    summary.bySuite[suite] ||= Object.fromEntries(METRICS.map((metric) => [metric, { passed: 0, total: 0, missing: 0, errors: 0, passRate: 0 }]));
    summary.directCorrectionByStatus[status] ||= { passed: 0, total: 0, missing: 0, errors: 0, passRate: 0 };
    getComponents(result).forEach((component) => {
      const metric = getAssertionMetric(component);
      if (!METRICS.includes(metric)) {
        return;
      }
      summary[variant][metric].total += 1;
      if (getAssertionPass(component)) {
        summary[variant][metric].passed += 1;
      }
      summary.bySuite[suite][metric].total += 1;
      if (getAssertionPass(component)) summary.bySuite[suite][metric].passed += 1;
      for (const entry of [summary[variant][metric], summary.bySuite[suite][metric]]) {
        if (component.status === 'missing') entry.missing++;
        if (component.status === 'error') entry.errors++;
      }
      if (metric === 'direct_correction') {
        summary.directCorrectionByStatus[status].total += 1;
        if (getAssertionPass(component)) summary.directCorrectionByStatus[status].passed += 1;
        if (component.status === 'missing') summary.directCorrectionByStatus[status].missing++;
        if (component.status === 'error') summary.directCorrectionByStatus[status].errors++;
      }
    });
  });

  Object.values(summary.current).forEach((metricSummary) => {
      metricSummary.passRate = metricSummary.total === 0 ? 0 : metricSummary.passed / metricSummary.total;
  });
  Object.values(summary.bySuite).forEach((suiteSummary) => Object.values(suiteSummary).forEach((metricSummary) => {
    metricSummary.passRate = metricSummary.total === 0 ? 0 : metricSummary.passed / metricSummary.total;
  }));
  Object.values(summary.directCorrectionByStatus).forEach((statusSummary) => {
    statusSummary.passRate = statusSummary.total === 0 ? 0 : statusSummary.passed / statusSummary.total;
  });

  return { summary, unknownVariants };
}

function reconcileCoverage(report, manifest) {
  if (!manifest || !Array.isArray(manifest.cases) || !manifest.cases.length ||
      !Number.isInteger(manifest.repetitions) || manifest.repetitions < 1) {
    return ['Missing frozen evaluation manifest with cases, assertions, and repetitions'];
  }
  const failures = [];
  const expected = new Map();
  for (const definition of manifest.cases) {
    if (!definition.case_id || expected.has(definition.case_id) || !Array.isArray(definition.metrics) || !definition.metrics.length) {
      failures.push(`Invalid or duplicate manifest case ${definition.case_id || '(missing id)'}`);
      continue;
    }
    expected.set(definition.case_id, definition);
  }
  const actual = new Map();
  for (const result of getResults(report)) {
    const vars = result.testCase?.vars || {};
    const definition = expected.get(vars.case_id);
    if (!definition) {
      failures.push(`Unexpected result case ${vars.case_id || '(missing id)'}`);
      continue;
    }
    actual.set(vars.case_id, (actual.get(vars.case_id) || 0) + 1);
    for (const field of ['source_type', 'scaffolding_status']) {
      if (vars[field] !== definition[field]) failures.push(`${vars.case_id} changed ${field}`);
    }
    if (result.error || result.response?.error || result.gradingResult?.error || result.grading?.error) {
      failures.push(`${vars.case_id} has an unresolved execution or grading error`);
    }
    const counts = new Map();
    for (const component of getComponents(result)) {
      const metric = getAssertionMetric(component);
      if (component.error || ['error', 'missing'].includes(component.status) ||
          (typeof component.pass !== 'boolean' && typeof component.success !== 'boolean' && !Number.isFinite(component.score))) {
        failures.push(`${vars.case_id} has an unresolved or malformed ${metric} judgment`);
      }
      counts.set(metric, (counts.get(metric) || 0) + 1);
    }
    const required = new Map();
    for (const metric of definition.metrics) required.set(metric, (required.get(metric) || 0) + 1);
    for (const metric of new Set([...required.keys(), ...counts.keys()])) {
      if ((counts.get(metric) || 0) !== (required.get(metric) || 0)) {
        failures.push(`${vars.case_id} assertion count for ${metric}: expected ${required.get(metric) || 0}, received ${counts.get(metric) || 0}`);
      }
    }
  }
  for (const id of expected.keys()) {
    if ((actual.get(id) || 0) !== manifest.repetitions) {
      failures.push(`${id} generation count: expected ${manifest.repetitions}, received ${actual.get(id) || 0}`);
    }
  }
  return failures;
}

function evaluateGate(report, threshold = DEFAULT_THRESHOLD, manifest = report?.evaluation_manifest) {
  const { summary, unknownVariants } = summarizeReport(report, manifest);
  const failures = reconcileCoverage(report, manifest);

  if (unknownVariants.length > 0) {
    failures.push(`Unable to classify ${unknownVariants.length} Promptfoo result(s) as the active current prompt`);
  }

  METRICS.forEach((metric) => {
    const current = summary.current[metric];
    if (current.total === 0) {
      failures.push(`Current prompt has no results for metric ${metric}`);
      return;
    }
    if (current.passRate < threshold) {
      failures.push(
        `Current ${metric} pass rate ${formatRate(current.passRate)} is below ${formatRate(threshold)}`
      );
    }
  });

  ['not_started', 'failed'].forEach((status) => {
    const result = summary.directCorrectionByStatus[status];
    if (!result || result.total === 0) {
      failures.push(`Direct-correction status ${status} has no results`);
    } else if (result.passRate < threshold) {
      failures.push(`Direct-correction status ${status} pass rate ${formatRate(result.passRate)} is below ${formatRate(threshold)}`);
    }
  });

  ['product_template', 'synthetic_holdout'].forEach((suite) => {
    const suiteSummary = summary.bySuite[suite];
    if (!suiteSummary) {
      failures.push(`${suite} suite has no results`);
      return;
    }
    METRICS.forEach((metric) => {
      const result = suiteSummary[metric];
      if (!result || result.total === 0) failures.push(`${suite} suite has no results for metric ${metric}`);
      else if (result.passRate < threshold) failures.push(`${suite} ${metric} pass rate ${formatRate(result.passRate)} is below ${formatRate(threshold)}`);
    });
  });

  return {
    passed: failures.length === 0,
    threshold,
    metrics: METRICS,
    summary,
    failures
  };
}

function formatRate(value) {
  return `${Math.round(value * 1000) / 10}%`;
}

function printGateResult(result) {
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) {
    console.error(`Prompt quality gate failed with ${result.failures.length} issue(s).`);
  }
}

function main(argv) {
  const reportPath = argv[2];
  const threshold = argv[3] ? Number(argv[3]) : DEFAULT_THRESHOLD;

  if (!reportPath) {
    console.error('Usage: node scripts/check-promptfoo-quality-gate.js <promptfoo-results.json> [threshold]');
    return 2;
  }
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
    console.error('Threshold must be a number in the range (0, 1].');
    return 2;
  }

  const report = readJson(path.resolve(process.cwd(), reportPath));
  const result = evaluateGate(report, threshold);
  printGateResult(result);
  return result.passed ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main(process.argv);
}

module.exports = {
  METRICS,
  evaluateGate,
  summarizeReport,
  reconcileCoverage
};

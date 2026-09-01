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
    current: Object.fromEntries(METRICS.map((metric) => [metric, { passed: 0, total: 0, passRate: 0 }])),
    bySuite: {},
    directCorrectionByStatus: {}
  };
}

function summarizeReport(report) {
  const summary = emptySummary();
  const unknownVariants = [];

  getResults(report).forEach((result) => {
    const variant = getVariant(result);
    if (!variant) {
      unknownVariants.push(result?.testCase?.vars?.case_id || result?.description || 'unknown_result');
      return;
    }

    const suite = result?.testCase?.vars?.source_type || 'unknown_suite';
    const status = result?.testCase?.vars?.scaffolding_status || 'unknown_status';
    summary.bySuite[suite] ||= Object.fromEntries(METRICS.map((metric) => [metric, { passed: 0, total: 0, passRate: 0 }]));
    summary.directCorrectionByStatus[status] ||= { passed: 0, total: 0, passRate: 0 };
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
      if (metric === 'direct_correction') {
        summary.directCorrectionByStatus[status].total += 1;
        if (getAssertionPass(component)) summary.directCorrectionByStatus[status].passed += 1;
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

function evaluateGate(report, threshold = DEFAULT_THRESHOLD) {
  const { summary, unknownVariants } = summarizeReport(report);
  const failures = [];

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
  summarizeReport
};

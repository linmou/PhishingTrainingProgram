#!/usr/bin/env node
/** Purpose: verify the active single-prompt Qwen quality gate and its blocking threshold. */

const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');

const metrics = [
  'turn_rhythm',
  'direct_correction',
  'persona_stability',
  'low_boilerplate_praise',
  'practical_knowledge',
  'third_person_examples',
  'reading_level',
  'response_length'
];

const row = (source_type: string, scaffolding_status: string, failed: string[] = []) => ({
  promptIdx: 0,
  testCase: { vars: { case_id: `${source_type}-${scaffolding_status}`, source_type, scaffolding_status } },
  gradingResult: {
    componentResults: metrics.map((metric) => ({
      assertion: { metric },
      pass: !failed.includes(metric),
      score: failed.includes(metric) ? 0 : 1
    }))
  }
});

const passingReport = () => ({
  ecological_product_gate: { passed: true },
  results: { results: [
    row('product_template', 'not_started'),
    row('product_template', 'failed'),
    row('synthetic_holdout', 'failed'),
    row('synthetic_holdout', 'not_started')
  ] }
});

describe('Promptfoo quality gate', () => {
  it('passes when one current prompt reaches 80% for every metric and suite/state', () => {
    const gate = evaluateGate(passingReport(), 0.8);
    expect(gate.passed).toBe(true);
    expect(gate.summary.improved).toBeUndefined();
  });

  it('fails when the active prompt is below the per-metric threshold', () => {
    const report = passingReport() as any;
    report.results.results.forEach((result: any) => {
      result.gradingResult.componentResults = result.gradingResult.componentResults.map((component: any) =>
        component.assertion.metric === 'response_length' ? { ...component, pass: false, score: 0 } : component
      );
    });
    const gate = evaluateGate(report, 0.8);
    expect(gate.passed).toBe(false);
    expect(gate.failures.join('\n')).toMatch(/response_length/i);
  });

  it('requires both direct-correction scaffold states', () => {
    const report = passingReport() as any;
    report.results.results = report.results.results.filter((result: any) => result.testCase.vars.scaffolding_status !== 'not_started');
    const gate = evaluateGate(report, 0.8);
    expect(gate.passed).toBe(false);
    expect(gate.failures.join('\n')).toMatch(/not_started/i);
  });
});

#!/usr/bin/env node
/**
 * Purpose: verify the blocking Promptfoo gate applies one 80% threshold to all
 * eight metrics and rejects missing metrics or weak ecological/holdout groups.
 */

const metricNames = [
  'turn_rhythm',
  'direct_correction',
  'persona_stability',
  'low_boilerplate_praise',
  'practical_knowledge',
  'third_person_examples',
  'reading_level',
  'response_length',
];
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';

const reportFor = (overrides: Record<string, { passed: number; total: number }> = {}) => {
  const makeResult = (caseId: string, sourceType: string, status: string) => ({
    promptIdx: 0,
    testCase: { vars: { case_id: caseId, source_type: sourceType, scaffolding_status: status } },
    gradingResult: {
      componentResults: metricNames.flatMap((metric) => {
        const value = overrides[metric] || { passed: 8, total: 10 };
        return Array.from({ length: value.total }, (_, index) => ({
          assertion: { metric },
          pass: index < value.passed,
          score: index < value.passed ? 1 : 0,
        }));
      }),
    },
  });
  return {
    results: {
      results: [
        makeResult('ecological_case', 'product_template', 'not_started'),
        makeResult('holdout_case', 'synthetic_holdout', 'failed'),
      ],
    },
  };
};

describe('Promptfoo brevity quality gate', () => {
  it('passes one current prompt when every metric reaches 80%', async () => {
    const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');
    const result = evaluateGate(reportFor(), 0.8);
    expect(result.passed).toBe(true);
    expect(result.summary.improved).toBeUndefined();
  });

  it('fails a metric below 80% and reports the current metric by name', async () => {
    const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');
    const result = evaluateGate(reportFor({ response_length: { passed: 7, total: 10 } }), 0.8);
    expect(result.passed).toBe(false);
    expect(result.failures.join('\n')).toMatch(/response_length/i);
  });

  it('fails when any required metric has no results', async () => {
    const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');
    const report = reportFor();
    report.results.results[0].gradingResult.componentResults =
      report.results.results[0].gradingResult.componentResults.filter((component: any) => component.assertion.metric !== 'direct_correction');
    const result = evaluateGate(report, 0.8);
    expect(result.passed).toBe(false);
    expect(result.failures.join('\n')).toMatch(/direct_correction/i);
  });

  it('ignores an obsolete ecological product-path field', () => {
    const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');
    const report = reportFor() as any;
    report.ecological_product_gate = { passed: false, summary: {} };
    const result = evaluateGate(report, 0.8);
    expect(result.passed).toBe(true);
    expect(result.failures.join('\n')).not.toMatch(/ecological product-path gate/i);
  });

  it('requires both direct-correction scaffold statuses to meet threshold', () => {
    const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');
    const report = reportFor() as any;
    const failedCase = JSON.parse(JSON.stringify(report.results.results[0]));
    failedCase.testCase.vars.scaffolding_status = 'failed';
    failedCase.gradingResult.componentResults = failedCase.gradingResult.componentResults
      .map((component: any) => component.assertion.metric === 'direct_correction' ? { ...component, pass: false, score: 0 } : component);
    report.results.results.push(failedCase);
    const result = evaluateGate(report, 0.8);
    expect(result.passed).toBe(false);
    expect(result.failures.join('\n')).toMatch(/failed|direct_correction/i);
  });

  it('blocks a weak synthetic holdout suite independently', () => {
    const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');
    const report = reportFor() as any;
    report.results.results[0].testCase.vars.source_type = 'synthetic_holdout';
    report.results.results[0].gradingResult.componentResults = report.results.results[0].gradingResult.componentResults
      .map((component: any) => component.assertion.metric === 'practical_knowledge' ? { ...component, pass: false, score: 0 } : component);
    const result = evaluateGate(report, 0.8);
    expect(result.passed).toBe(false);
    expect(result.failures.join('\n')).toMatch(/holdout|practical_knowledge/i);
  });

  it('makes the one-shot runner treat both gates as blocking', () => {
    const runner = fs.readFileSync(path.resolve(__dirname, '../../../scripts/run-promptfoo-eval.js'), 'utf8');
    expect(runner).toMatch(/check-promptfoo-quality-gate/);
    expect(runner).not.toMatch(/run-ecological-product-gate|ecological-product-gate\.json|codes\.ecological/i);
    expect(runner).toMatch(/process\.exit/);
    expect(runner).not.toMatch(/advisory/);
    expect(runner).toMatch(/exports_and_reports_ready/);
    expect(runner).toMatch(/quality_gate_summary/);
    expect(runner).toMatch(/per_case_failures/);
    expect(runner).not.toMatch(/codes\.quality_gate === 0 && codes\.ecological === 0 && codes\.promptfoo === 0/);
  });

  it('keeps the blocking runner syntactically executable', () => {
    const child = spawnSync(process.execPath, ['--check', path.resolve(__dirname, '../../../scripts/run-promptfoo-eval.js')], {
      cwd: path.resolve(__dirname, '../../..'),
      encoding: 'utf8'
    });
    expect(child.status).toBe(0);
  });

  it('returns a nonzero process exit for a failed metric gate', () => {
    const reportPath = path.join(os.tmpdir(), `qwen-gate-red-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(reportFor({ response_length: { passed: 7, total: 10 } })));
    const child = spawnSync(process.execPath, [
      'scripts/check-promptfoo-quality-gate.js',
      reportPath,
      '0.8'
    ], { cwd: path.resolve(__dirname, '../../..'), encoding: 'utf8' });
    expect(child.status).not.toBe(0);
  });

  it('returns nonzero for scaffold and holdout failures at the CLI boundary', () => {
    const gateScript = path.resolve(__dirname, '../../../scripts/check-promptfoo-quality-gate.js');
    const cases = [
      (() => {
        const report = reportFor() as any;
        const failed = JSON.parse(JSON.stringify(report.results.results[0]));
        failed.testCase.vars.scaffolding_status = 'failed';
        failed.gradingResult.componentResults = failed.gradingResult.componentResults
          .map((component: any) => component.assertion.metric === 'direct_correction' ? { ...component, pass: false, score: 0 } : component);
        report.results.results.push(failed);
        return report;
      })(),
      (() => {
        const report = reportFor() as any;
        report.results.results[0].testCase.vars.source_type = 'synthetic_holdout';
        report.results.results[0].gradingResult.componentResults = report.results.results[0].gradingResult.componentResults
          .map((component: any) => component.assertion.metric === 'practical_knowledge' ? { ...component, pass: false, score: 0 } : component);
        return report;
      })()
    ];
    cases.forEach((report, index) => {
      const reportPath = path.join(os.tmpdir(), `qwen-gate-boundary-${Date.now()}-${index}.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report));
      const child = spawnSync(process.execPath, ['scripts/check-promptfoo-quality-gate.js', reportPath, '0.8'], {
        cwd: path.resolve(__dirname, '../../..'),
        encoding: 'utf8'
      });
      expect(child.status).not.toBe(0);
    });
  });
});

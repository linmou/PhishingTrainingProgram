/**
 * Responsible for scripts/check-promptfoo-quality-gate.js: verifies deterministic
 * quality-gate behavior over saved Promptfoo JSON without running live LLM evaluation.
 */

const { evaluateGate } = require('../../../scripts/check-promptfoo-quality-gate.js');

const metrics = [
  'turn_rhythm',
  'direct_correction',
  'persona_stability',
  'low_boilerplate_praise',
  'practical_knowledge',
  'third_person_examples',
  'reading_level'
];

const componentResults = (failedMetrics: string[] = []) =>
  metrics.map((metric) => ({
    assertion: { metric },
    pass: !failedMetrics.includes(metric)
  }));

const resultRow = (promptIdx: number, caseId: string, failedMetrics: string[] = []) => ({
  promptIdx,
  testCase: {
    vars: {
      case_id: caseId
    }
  },
  gradingResult: {
    componentResults: componentResults(failedMetrics)
  }
});

describe('Promptfoo quality gate', () => {
  it('passes when improved meets threshold and is not worse than current', () => {
    const report = {
      results: {
        results: [
          resultRow(0, 'case_1', ['turn_rhythm']),
          resultRow(0, 'case_2', []),
          resultRow(1, 'case_1', []),
          resultRow(1, 'case_2', [])
        ]
      }
    };

    const gate = evaluateGate(report, 0.8);

    expect(gate.passed).toBe(true);
    expect(gate.summary.current.turn_rhythm.passRate).toBe(0.5);
    expect(gate.summary.improved.turn_rhythm.passRate).toBe(1);
  });

  it('fails when improved is below the per-metric threshold', () => {
    const report = {
      results: {
        results: [
          resultRow(0, 'case_1', []),
          resultRow(0, 'case_2', []),
          resultRow(1, 'case_1', ['direct_correction']),
          resultRow(1, 'case_2', ['direct_correction'])
        ]
      }
    };

    const gate = evaluateGate(report, 0.8);

    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Improved direct_correction pass rate 0% is below 80%')
      ])
    );
  });

  it('fails when improved performs worse than current even above threshold', () => {
    const report = {
      results: {
        results: [
          resultRow(0, 'case_1', []),
          resultRow(0, 'case_2', []),
          resultRow(0, 'case_3', []),
          resultRow(0, 'case_4', []),
          resultRow(0, 'case_5', []),
          resultRow(1, 'case_1', []),
          resultRow(1, 'case_2', []),
          resultRow(1, 'case_3', []),
          resultRow(1, 'case_4', []),
          resultRow(1, 'case_5', ['reading_level'])
        ]
      }
    };

    const gate = evaluateGate(report, 0.8);

    expect(gate.passed).toBe(false);
    expect(gate.summary.improved.reading_level.passRate).toBe(0.8);
    expect(gate.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Improved reading_level pass rate 80% is below current 100%')
      ])
    );
  });
});

/**
 * Responsible for evals/promptfoo scaffold: verifies the reviewable Promptfoo
 * evaluation files, rubrics, and current-prompt fixture exist without running LLM evals.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const repoRoot = path.resolve(__dirname, '../../..', '..');
const tutorRoot = path.join(repoRoot, 'tutor-system');
const evalRoot = path.join(repoRoot, 'evals', 'promptfoo');

const readText = (relativePath: string): string =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Promptfoo evaluation scaffold', () => {
  const rubricFiles = [
    'turn_rhythm.md',
    'direct_correction.md',
    'persona_stability.md',
    'low_boilerplate_praise.md',
    'practical_knowledge.md',
    'third_person_examples.md',
    'reading_level.md'
  ];

  it('declares reviewable promptfoo commands without running evaluation', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(tutorRoot, 'package.json'), 'utf8')
    );

    expect(packageJson.scripts['eval:prompts']).toBe('promptfoo eval -c ../evals/promptfoo/promptfooconfig.yaml');
    expect(packageJson.scripts['eval:prompts:report']).toContain('--output ../evals/promptfoo/results/latest.json');
    expect(packageJson.scripts['eval:prompts:export-current']).toBe('node scripts/export-promptfoo-fixture.js');
  });

  it('defines the fixed account-security peer fixture and frozen current prompt', () => {
    const seedConfig = JSON.parse(readText('evals/promptfoo/fixtures/seed-config.json'));
    const metadata = JSON.parse(readText('evals/promptfoo/fixtures/fixture-metadata.json'));
    const currentPrompt = readText('evals/promptfoo/prompts/current.prompt.txt');

    expect(seedConfig.agent_preset).toBe('casual_peer');
    expect(seedConfig.scenario_template).toBe('Account Security Alert');
    expect(seedConfig.model_name).toBe('gpt-4o-mini');
    expect(metadata.source_files).toEqual(
      expect.arrayContaining([
        'tutor-system/src/services/prompts/index.ts',
        'tutor-system/src/services/prompts/presets.ts',
        'tutor-system/src/services/detectionTemplates.ts'
      ])
    );
    expect(currentPrompt).toContain('## Your Role: Peer Learner');
    expect(currentPrompt).toContain('YOUR ACCOUNT IS AT RISK');
    expect(currentPrompt).toContain('testdrive.info');
    expect(currentPrompt).toContain('Log into your real account separately');
  });

  it('provides cases and one self-contained rubric per requirement', () => {
    const config = readText('evals/promptfoo/promptfooconfig.yaml');
    const cases = readText('evals/promptfoo/cases/account-security-alert.yaml');

    expect(config).toContain('file://prompts/current.chat.prompt.json');
    expect(config).toContain('file://prompts/improved.chat.prompt.json');
    expect(config).toContain('openai:chat:gpt-4o-mini');
    expect(config).toContain('openai:chat:gpt-4o');
    expect((cases.match(/case_id:/g) || []).length).toBeGreaterThanOrEqual(12);
    expect(cases).toContain('student_trusts_https');
    expect(cases).toContain('student_asks_about_bot_experience');

    rubricFiles.forEach((rubricFile) => {
      const rubricPath = path.join(evalRoot, 'rubrics', rubricFile);
      const rubric = fs.readFileSync(rubricPath, 'utf8');

      expect(rubric).toContain('Pass criteria');
      expect(rubric).toContain('Fail criteria');
      expect(rubric).toContain('Passing examples');
      expect(rubric).toContain('Failing examples');
      expect(rubric).toContain('merely friendly');
    });
  });

  it('keeps case applicability aligned with per-case rubric assertions', () => {
    const caseFile = yaml.load(
      readText('evals/promptfoo/cases/account-security-alert.yaml')
    ) as { tests: Array<{ vars: Record<string, string>; assert: Array<{ metric: string; value: string }> }> };

    caseFile.tests.forEach((testCase) => {
      const applicableRequirements = testCase.vars.applicable_requirements
        .split(',')
        .map((requirement) => requirement.trim())
        .sort();
      const assertedMetrics = testCase.assert
        .map((assertion) => assertion.metric)
        .sort();

      expect(assertedMetrics).toEqual(applicableRequirements);
      testCase.assert.forEach((assertion) => {
        expect(assertion.value).toBe(`file://rubrics/${assertion.metric}.md`);
      });
    });
  });

  it('avoids leaking exact student messages from the eval cases into the improved prompt examples', () => {
    const caseFile = yaml.load(
      readText('evals/promptfoo/cases/account-security-alert.yaml')
    ) as { tests: Array<{ vars: Record<string, string> }> };
    const improvedPrompt = readText('evals/promptfoo/prompts/improved.prompt.txt');

    caseFile.tests.forEach((testCase) => {
      expect(improvedPrompt).not.toContain(testCase.vars.student_message);
    });
  });
});

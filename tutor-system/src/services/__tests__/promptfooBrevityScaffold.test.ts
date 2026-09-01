#!/usr/bin/env node
/**
 * Purpose: verify the active Promptfoo configuration, generated prompt policy,
 * conditional case metadata, and product-template ecological provenance.
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import os from 'os';
import yaml from 'js-yaml';

const repoRoot = path.resolve(__dirname, '../../..', '..');
const readText = (relativePath: string): string => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

describe('Promptfoo brevity and ecological scaffold', () => {
  it('activates one current prompt with Qwen target and judge', () => {
    const config = readText('evals/promptfoo/promptfooconfig.yaml');
    expect(config.match(/file:\/\/prompts\/current\.chat\.prompt\.json/g)).toHaveLength(1);
    expect(config).not.toContain('improved.chat.prompt.json');
    expect(config.match(/openai:chat:qwen3\.5-flash/g)).toHaveLength(2);
    expect(config.match(/enable_thinking: false/g)).toHaveLength(2);
  });

  it('requires one shared compact policy and conditional scaffold wording', () => {
    const systemPrompt = readText('tutor-system/src/services/prompts/responsePolicy.ts');
    const ecologicalTurn = readText('tutor-system/src/services/ecologicalTutorCall.ts');
    const currentPrompt = readText('evals/promptfoo/prompts/current.chat.prompt.json');
    [systemPrompt, currentPrompt].forEach((text) => {
      expect(text).toMatch(/3 sentences/i);
      expect(text).toMatch(/50 words/i);
      expect(text).toMatch(/failed|previous tutor|scaffold/i);
      expect(text).not.toMatch(/2.?4 short sentences|40.?70 words/i);
    });
    expect(ecologicalTurn).toContain('RESPONSE_POLICY');
    expect(systemPrompt).not.toMatch(/If the student is wrong or incomplete, correct the mistake directly before encouraging them/i);
  });

  it('keeps ecological cases product-derived and holdouts explicitly synthetic', () => {
    const ecologicalSource = readText('tutor-system/scripts/export-ecological-cases.js');
    const productCall = readText('tutor-system/src/services/ecologicalTutorCall.ts');
    const ecologicalCases = yaml.load(readText('evals/promptfoo/cases/webpage-ecological.yaml')) as Array<any>;
    const holdoutCases = yaml.load(readText('evals/promptfoo/cases/account-security-alert.yaml')) as Array<any>;
    const fixtureBefore = readText('evals/promptfoo/cases/webpage-ecological.yaml');

    expect(ecologicalSource).toContain('getEcologicalCasesFromTemplates');
    expect(productCall).toContain('buildEcologicalChatCompletionMessages');
    expect(ecologicalCases.length).toBeGreaterThan(0);
    const regeneratedPath = path.join(os.tmpdir(), `qwen-ecological-red-${Date.now()}.yaml`);
    execFileSync(process.execPath, ['scripts/export-ecological-cases.js'], {
      cwd: path.join(repoRoot, 'tutor-system'),
      stdio: 'pipe',
      env: { ...process.env, ECOLOGICAL_OUTPUT_PATH: regeneratedPath }
    });
    expect(fs.existsSync(regeneratedPath)).toBe(true);
    expect(readText('evals/promptfoo/cases/webpage-ecological.yaml')).toBe(fixtureBefore);
    expect(ecologicalSource).toContain('buildEcologicalChatCompletionMessages');
    expect(ecologicalCases.every((testCase) => testCase.vars.source_type === 'product_template')).toBe(true);
    const regenerated = yaml.load(fs.readFileSync(regeneratedPath, 'utf8')) as Array<any>;
    expect(regenerated).toHaveLength(ecologicalCases.length);
    regenerated.forEach((row, index) => {
      expect(row.vars).toMatchObject(ecologicalCases[index].vars);
    });
    const { buildEcologicalChatCompletionMessages } = require('../ecologicalTutorCall');
    regenerated.forEach((row) => {
      const messages = buildEcologicalChatCompletionMessages('SYSTEM', row.vars);
      expect(messages).toHaveLength(2);
      expect(messages[1].content).toContain(row.vars.student_message);
    });
    expect(holdoutCases.length).toBeGreaterThan(0);
    expect(holdoutCases.every((testCase) => testCase.vars.source_type === 'synthetic_holdout')).toBe(true);
  });

  it('records both scaffold states with history evidence and expected focus', () => {
    const allCases = [
      ...(yaml.load(readText('evals/promptfoo/cases/webpage-ecological.yaml')) as Array<any>),
      ...(yaml.load(readText('evals/promptfoo/cases/account-security-alert.yaml')) as Array<any>),
    ];
    const failed = allCases.filter((testCase) => testCase.vars.scaffolding_status === 'failed');
    const notStarted = allCases.filter((testCase) => testCase.vars.scaffolding_status === 'not_started');
    expect(failed.length).toBeGreaterThan(0);
    expect(notStarted.length).toBeGreaterThan(0);
    failed.forEach((testCase) => {
      expect(testCase.vars.conversation_history).toMatch(/Tutor[^\n]*\?/i);
      expect(testCase.vars.student_answer_state).toBe('unsafe_or_incomplete');
    });
    notStarted.forEach((testCase) => {
      expect(testCase.vars.conversation_history).not.toMatch(/Tutor[^\n]*\?/i);
      expect(testCase.vars.student_answer_state).toBe('uncertain');
    });
  });

  /**
   * Files: correct-answer Promptfoo cases and knowledge-continuation rubrics.
   * Purpose: require set-valued untouched knowledge and both valid response paths without a new correctness state.
   */
  it('evaluates correct-answer continuation from each template knowledge inventory', () => {
    const ecologicalCases = yaml.load(
      readText('evals/promptfoo/cases/webpage-ecological.yaml')
    ) as Array<any>;
    const holdoutCases = yaml.load(
      readText('evals/promptfoo/cases/account-security-alert.yaml')
    ) as Array<any>;
    const expectedCaseIds = [
      'webpage_demo_correct_safe_action',
      'webpage_demo_correct_lock_reasoning',
      'student_correctly_uses_real_bank_channel',
      'student_correctly_rejects_https_identity'
    ];
    const correctStudentCases = [...ecologicalCases, ...holdoutCases].filter((testCase) =>
      expectedCaseIds.includes(testCase.vars.case_id)
    );

    expect(correctStudentCases.map((testCase) => testCase.vars.case_id).sort()).toEqual(
      [...expectedCaseIds].sort()
    );
    correctStudentCases.forEach((testCase) => {
      const metrics = testCase.assert.map((assertion: any) => assertion.metric);
      const coveredText = testCase.vars.expected_behavior_focus.match(/^Covered: (.+?)\. Eligible/i)?.[1] || '';
      const untouchedText = testCase.vars.expected_behavior_focus.match(/Eligible untouched set includes (.+?)\. Any/i)?.[1] || '';
      const coveredPoints = coveredText.split(';').map((point: string) => point.trim()).filter(Boolean);
      const untouchedPoints = untouchedText.split(/,|\band\b/).map((point: string) => point.trim()).filter(Boolean);
      expect(metrics).toEqual([
        'low_boilerplate_praise',
        'practical_knowledge',
        'turn_rhythm',
        'response_length'
      ]);
      expect(testCase.vars.applicable_requirements).not.toContain('direct_correction');
      expect(testCase.vars.expected_behavior_focus).toMatch(/^Covered: .+/i);
      expect(testCase.vars.expected_behavior_focus).toMatch(/Eligible untouched set includes .+/i);
      expect(testCase.vars.expected_behavior_focus).toMatch(/any relevant remaining configured item is acceptable/i);
      expect(testCase.vars.expected_behavior_focus).toMatch(/select at most one untouched point/i);
      expect(testCase.vars.expected_behavior_focus).toMatch(/without a question is also acceptable/i);
      expect(testCase.vars.expected_behavior_focus).not.toMatch(/required follow-up|must ask/i);
      expect(testCase.vars.student_answer_state).not.toBe('correct');
      expect(coveredPoints.length).toBeGreaterThan(0);
      expect(untouchedPoints.length).toBeGreaterThan(0);
    });

    const source = require('../detectionTemplates').SCENARIO_TEMPLATES['Account Security Alert'];
    expect(source.detection_areas.length).toBeGreaterThan(0);
    expect(source.verification_steps.length).toBeGreaterThan(0);
    expect(source.detection_areas.length + source.verification_steps.length).toBeGreaterThan(3);
    correctStudentCases
      .filter((testCase) => testCase.vars.source_type === 'synthetic_holdout')
      .forEach((testCase) => expect(testCase.vars.knowledge_inventory_source).toBe('Account Security Alert'));

    const praiseRubric = readText('evals/promptfoo/rubrics/low_boilerplate_praise.md');
    const rhythmRubric = readText('evals/promptfoo/rubrics/turn_rhythm.md');
    const practicalRubric = readText('evals/promptfoo/rubrics/practical_knowledge.md');
    expect(praiseRubric).toMatch(/student's latest message is correct from the scenario/i);
    expect(praiseRubric).toMatch(/natural variation in wording/i);
    expect(praiseRubric).toMatch(/generic acknowledgment.*acceptable.*specific teaching/i);
    expect(praiseRubric).toMatch(/do not use `student_answer_state` or `scaffolding_status`/i);
    expect(praiseRubric).toMatch(/useful teaching or focused elicitation/i);
    expect(rhythmRubric).toContain('You separated connection security from site identity. Does this alert identify a specific account or event?');
    expect(rhythmRubric).toContain('That is correct. HTTPS protects the connection, not the site\'s identity. Check the exact domain and use the real app.');
    expect(rhythmRubric).toMatch(/different eligible untouched point/i);
    expect(rhythmRubric).toMatch(/repeated covered point/i);
    expect(rhythmRubric).toMatch(/broad question/i);
    expect(rhythmRubric).toMatch(/two-question chain/i);
    expect(rhythmRubric).toMatch(/tutor-mentioned but student-undemonstrated/i);
    expect(rhythmRubric).toMatch(/no remaining useful point/i);
    expect(practicalRubric).toMatch(/applicable configured Detection Area or Verification Step/i);
    expect(practicalRubric).toMatch(/generic question.*not tied.*configured knowledge inventory/i);

    const productionSources = [
      readText('tutor-system/src/services/prompts/responsePolicy.ts'),
      readText('tutor-system/src/services/demoRoomTemplates.ts')
    ].join('\n');
    expect(productionSources).not.toMatch(/studentAnswerState|classifyCoveredConcept|conceptMatcher/i);
  });

  it('keeps fresh schemas and the migration on the sole Qwen model', () => {
    const migration = readText('tutor-system/supabase/migrations/022_qwen_model_defaults.sql');
    const finalSchema = readText('tutor-system/supabase/migrations/final_schema.sql');
    const combinedSchema = readText('tutor-system/supabase/migrations/combined_schema.sql');
    [migration, finalSchema, combinedSchema].forEach((sql) => {
      expect(sql).toContain('qwen3.5-flash');
      expect(sql).not.toMatch(/DEFAULT\s+'gpt-|SET\s+model_name\s*=\s*'gpt-/i);
    });
    expect(migration).toMatch(/WHERE\s+ai_assistant_model\s+IS NOT NULL/i);
    expect(migration).toMatch(/WHERE\s+model_name\s+IS NOT NULL/i);
  });
});

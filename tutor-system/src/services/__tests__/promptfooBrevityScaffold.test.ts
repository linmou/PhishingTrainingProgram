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

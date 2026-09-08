/**
 * Responsible for promptfooEvaluationPromptBuilder: verifies evaluation cases are injected
 * into a product-shaped chat prompt with system prompt plus user turn.
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { buildEvaluationUserTurn, buildPromptfooChatMessages } from '../promptfooEvaluationPromptBuilder';

const repoRoot = path.resolve(__dirname, '../../..', '..');

const readFirstCaseVars = (): Record<string, string> => {
  const caseFile = yaml.load(
    fs.readFileSync(path.join(repoRoot, 'evals/promptfoo/cases/account-security-alert.yaml'), 'utf8')
  ) as Array<{ vars: Record<string, string> }>;

  return caseFile[0].vars;
};

describe('Promptfoo evaluation prompt formatting', () => {
  it('formats eval cases as product-shaped chat messages', () => {
    const currentSystemPrompt = fs.readFileSync(
      path.join(repoRoot, 'evals/promptfoo/prompts/current.prompt.txt'),
      'utf8'
    );
    const firstCase = readFirstCaseVars();

    const messages = buildPromptfooChatMessages(currentSystemPrompt);
    const concreteUserTurn = buildEvaluationUserTurn({
      scenario_context: firstCase.scenario_context,
      conversation_history: firstCase.conversation_history,
      student_message: firstCase.student_message
    });

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain(currentSystemPrompt);
    expect(messages[0].content).toContain('ACTIVE RESPONSE CONTRACT (v2)');
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('{{scenario_context}}');
    expect(messages[1].content).toContain('{{conversation_history}}');
    expect(messages[1].content).toContain('{{student_message}}');

    expect(concreteUserTurn).toContain(firstCase.scenario_context);
    expect(concreteUserTurn).toContain(firstCase.student_message);
    expect(concreteUserTurn).toContain('Draft the next tutor decision');
    expect(concreteUserTurn).not.toMatch(/brief follow-up question/i);
    expect(concreteUserTurn).not.toContain('{{scenario_context}}');
    const contextLines = concreteUserTurn.split('\n');
    const serializedContext = JSON.parse(contextLines[contextLines.length - 1] || '{}');
    expect(serializedContext.conversation_history).toBe(firstCase.conversation_history);
    expect(serializedContext.prior_mode).toBe('unknown');
  });

  it('loads configured Promptfoo chat prompts and ecological webpage cases', () => {
    const config = yaml.load(
      fs.readFileSync(path.join(repoRoot, 'evals/promptfoo/promptfooconfig.yaml'), 'utf8')
    ) as { prompts: string[]; tests: string[] };
    const firstCase = readFirstCaseVars();
    const ecoCases = yaml.load(
      fs.readFileSync(path.join(repoRoot, 'evals/promptfoo/cases/webpage-ecological.yaml'), 'utf8')
    ) as Array<{ vars: Record<string, string> }>;

    expect(config.prompts).toEqual(['file://prompts/current.chat.prompt.json']);
    expect(config.tests).toEqual(
      expect.arrayContaining([
        'file://cases/webpage-ecological.yaml',
        'file://cases/account-security-alert.yaml'
      ])
    );
    expect(ecoCases.map((c) => c.vars.case_id).join(' ')).toMatch(/webpage_/);
    expect(ecoCases.some((c) => String(c.vars.case_id).includes('webpage_demo'))).toBe(true);
    expect(ecoCases.some((c) => String(c.vars.template_name || '').length > 0)).toBe(true);

    config.prompts.forEach((promptRef) => {
      const promptPath = path.join(
        repoRoot,
        'evals/promptfoo',
        promptRef.replace('file://', '')
      );
      const messages = JSON.parse(fs.readFileSync(promptPath, 'utf8')) as Array<{
        role: string;
        content: string;
      }>;
      const renderedUserTurn = messages[1].content
        .replace('{{scenario_context}}', firstCase.scenario_context)
        .replace('{{conversation_history}}', firstCase.conversation_history)
        .replace('{{student_message}}', firstCase.student_message);

      expect(messages).toHaveLength(2);
      expect(messages[0].role).toBe('system');
      expect(messages[1].role).toBe('user');
      expect(renderedUserTurn).toContain(firstCase.scenario_context);
      expect(renderedUserTurn).toContain(firstCase.student_message);
      expect(renderedUserTurn).toContain('Write the tutor response only');
      expect(renderedUserTurn).not.toContain('{{');
    });
  });
});

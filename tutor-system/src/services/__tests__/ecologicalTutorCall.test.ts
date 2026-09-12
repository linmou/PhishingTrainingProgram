/**
 * File: src/services/ecologicalTutorCall.ts
 * Purpose: unit-test ecological packaging shared by webpage AI path and Promptfoo.
 */

import {
  buildEcologicalCaseVarsFromRoomDialogue,
  buildEcologicalChatCompletionMessages,
  buildEcologicalTutorUserTurn,
  formatPrePopulatedConversationHistory,
  formatRoomScenarioContext,
  prePopulatedToContextMessages
} from '../ecologicalTutorCall';
import { getDemoRoomTemplateSeeds } from '../demoRoomTemplates';
import { ACTIVE_TUTOR_AGENT_PROMPT } from '../prompts/activeTutorAgentPrompt';
import { MULTI_AGENT_TUTOR_PROMPT } from '../prompts/multiAgentTutorPrompt';
import fs from 'fs';
import path from 'path';

describe('ecologicalTutorCall', () => {
  it('formats room scenario like the webpage header', () => {
    expect(formatRoomScenarioContext('Demo: Lock Icon Myth', 'Practice room')).toBe(
      'Demo: Lock Icon Myth — Practice room'
    );
  });

  it('does not send the test-room classification marker as scenario content', () => {
    expect(formatRoomScenarioContext('Demo: Lock Icon Myth', 'Practice room\n\n[behavior-test-room]')).toBe(
      'Demo: Lock Icon Myth — Practice room'
    );
  });

  it('formats demo-template pre_populated_dialogue the way the room shows it', () => {
    const lockDemo = getDemoRoomTemplateSeeds().find((s) =>
      s.template_name.includes('Lock Icon')
    );
    expect(lockDemo).toBeTruthy();
    const history = formatPrePopulatedConversationHistory(lockDemo!.pre_populated_dialogue);
    expect(history).toContain('Alex [STUDENT]:');
    expect(history).toContain('lock icon');
    expect(history).toContain('Tutor [TUTOR]:');
  });

  it('builds case vars with product-path history packaging from room dialogue', () => {
    const vars = buildEcologicalCaseVarsFromRoomDialogue(
      'Demo: Lock Icon Myth',
      'Security notice shared in feed',
      [
        {
          user_name: 'Socail Media Testdrive',
          role: 'others',
          message: 'Verify now: http://testdrive.info/youraccount'
        },
        {
          user_name: 'Chris',
          role: 'others',
          message: 'it has the little lock'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message: 'What does the lock prove?'
        },
        {
          user_name: 'Alex',
          role: 'student',
          message: 'If it has a lock icon it is safe, right?'
        }
      ]
    );
    expect(vars.scenario_context).toContain('Demo: Lock Icon Myth');
    expect(vars.student_message).toContain('lock icon');
    expect(vars.conversation_history).toContain('Participant: Others (Socail Media Testdrive):');
    expect(vars.conversation_history).toContain('Tutor/AI: Tutor (Tutor):');
    expect(vars.conversation_history).toContain('Participant: Student (Alex):');
  });

  it('builds a full tutor-response user turn (not follow-up-question co-pilot)', () => {
    const turn = buildEcologicalTutorUserTurn({
      scenario_context: 'Demo: Lock Icon Myth — practice',
      conversation_history: 'Tutor [TUTOR]: Look at the link.',
      student_message: 'If it has a lock it is safe, right?',
      prior_mode: 'guard'
    });

    expect(turn).toContain('Draft the next tutor decision');
    expect(turn).toContain('If it has a lock it is safe, right?');
    expect(turn).toContain('"prior_mode":"guard"');
    expect(turn).not.toMatch(/brief follow-up question/i);
  });

  it('builds chat messages matching product + promptfoo shape', () => {
    const messages = buildEcologicalChatCompletionMessages('SYSTEM', {
      scenario_context: 'room',
      conversation_history: 'history',
      student_message: 'student line',
      prior_mode: 'tutoring'
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('SYSTEM');
    expect(messages[0].content).toContain(ACTIVE_TUTOR_AGENT_PROMPT);
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('student line');
  });

  it('keeps the frozen candidate 11 text as the whole active agent prompt', () => {
    const evaluatedPrompt = fs.readFileSync(
      path.resolve(__dirname, '../../../../evals/promptfoo/v1/candidate-policy-11-contract-v2.md'),
      'utf8'
    ).trim();
    // Multi-agent lives in its own prompt, so the evaluated policy is sent unchanged.
    expect(ACTIVE_TUTOR_AGENT_PROMPT).toBe(evaluatedPrompt);
    expect(ACTIVE_TUTOR_AGENT_PROMPT).not.toContain('MULTI-AGENT');
  });

  it('adds the multi-agent prompt only for multi_agent turns', () => {
    const base = {
      scenario_context: 'room',
      conversation_history: 'history',
      student_message: 'student line',
      prior_mode: 'tutoring' as const
    };

    const singleAgent = buildEcologicalChatCompletionMessages('SYSTEM', {
      ...base,
      interaction_mode: 'single_agent'
    });
    expect(singleAgent[0].content).toContain(ACTIVE_TUTOR_AGENT_PROMPT);
    expect(singleAgent[0].content).not.toContain(MULTI_AGENT_TUTOR_PROMPT);
    expect(singleAgent[1].content).toContain('"interaction_mode":"single_agent"');

    const multiAgent = buildEcologicalChatCompletionMessages('SYSTEM', {
      ...base,
      interaction_mode: 'multi_agent'
    });
    expect(multiAgent[0].content).toContain(ACTIVE_TUTOR_AGENT_PROMPT);
    expect(multiAgent[0].content).toContain(MULTI_AGENT_TUTOR_PROMPT);
    expect(multiAgent[0].content.indexOf(ACTIVE_TUTOR_AGENT_PROMPT))
      .toBeLessThan(multiAgent[0].content.indexOf(MULTI_AGENT_TUTOR_PROMPT));
    expect(multiAgent[1].content).toContain('"interaction_mode":"multi_agent"');

    // Old callers that omit the field keep the single-agent request.
    const legacy = buildEcologicalChatCompletionMessages('SYSTEM', base);
    expect(legacy[0].content).not.toContain(MULTI_AGENT_TUTOR_PROMPT);
  });

  it('describes the pair contract, Riley limits and the single-Tutor fallback', () => {
    expect(MULTI_AGENT_TUTOR_PROMPT).toMatch(/mode "multiagent"/);
    expect(MULTI_AGENT_TUTOR_PROMPT).toMatch(/\[agent:riley\]/);
    expect(MULTI_AGENT_TUTOR_PROMPT).toMatch(/\[agent:tutor\]/);
    expect(MULTI_AGENT_TUTOR_PROMPT).toMatch(/protective_instruction/);
    expect(MULTI_AGENT_TUTOR_PROMPT).not.toMatch(/SERVICE_ROLE|api[_-]?key/i);
  });

  it('converts pre-populated arrays into context messages for AI history', () => {
    const ctx = prePopulatedToContextMessages(
      [
        { user_name: 'Alex', role: 'student', message: 'Is the lock enough?' },
        { user_name: 'Tutor', role: 'tutor', message: 'Look at the domain.' }
      ],
      new Date().toISOString()
    );
    expect(ctx.length).toBe(2);
    expect(ctx[0].content).toContain('Student (Alex): Is the lock enough?');
    expect(ctx[1].role).toBe('assistant');
  });
});

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

  it('uses the frozen candidate 11 text as the active agent prompt', () => {
    const evaluatedPrompt = fs.readFileSync(
      path.resolve(__dirname, '../../../../evals/promptfoo/v1/candidate-policy-11-contract-v2.md'),
      'utf8'
    ).trim();
    expect(ACTIVE_TUTOR_AGENT_PROMPT).toBe(evaluatedPrompt);
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

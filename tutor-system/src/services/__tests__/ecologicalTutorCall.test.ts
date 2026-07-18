/**
 * File: src/services/ecologicalTutorCall.ts
 * Purpose: unit-test ecological packaging shared by webpage AI path and Promptfoo.
 */

import {
  buildEcologicalChatCompletionMessages,
  buildEcologicalTutorUserTurn,
  formatPrePopulatedConversationHistory,
  formatRoomScenarioContext,
  prePopulatedToContextMessages
} from '../ecologicalTutorCall';
import { getDemoRoomTemplateSeeds } from '../demoRoomTemplates';

describe('ecologicalTutorCall', () => {
  it('formats room scenario like the webpage header', () => {
    expect(formatRoomScenarioContext('Demo: Lock Icon Myth', 'Practice room')).toBe(
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

  it('builds a full tutor-response user turn (not follow-up-question co-pilot)', () => {
    const turn = buildEcologicalTutorUserTurn({
      scenario_context: 'Demo: Lock Icon Myth — practice',
      conversation_history: 'Tutor [TUTOR]: Look at the link.',
      student_message: 'If it has a lock it is safe, right?'
    });

    expect(turn).toContain('Write the tutor response only');
    expect(turn).toContain('If it has a lock it is safe, right?');
    expect(turn).toContain('Ask at most one focused question');
    expect(turn).not.toMatch(/brief follow-up question/i);
  });

  it('builds chat messages matching product + promptfoo shape', () => {
    const messages = buildEcologicalChatCompletionMessages('SYSTEM', {
      scenario_context: 'room',
      conversation_history: 'history',
      student_message: 'student line'
    });
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    expect(messages[1].role).toBe('user');
    expect(messages[1].content).toContain('student line');
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

#!/usr/bin/env node
/**
 * Test responsible for the production ecological request builder, v2 tutor-decision parser, and response contract without inferring behavior quality from response text.
 */

import { parseTutorActionDecision } from '../services/aiService';
import { buildEcologicalChatCompletionMessages } from '../services/ecologicalTutorCall';
import { generateSystemPrompt, PRESET_CONFIGS } from '../services/systemPrompts';
import { SCENARIO_TEMPLATES } from '../services/detectionTemplates';

const scenario = SCENARIO_TEMPLATES['Account Security Alert'];
const systemPrompt = generateSystemPrompt({
  ...PRESET_CONFIGS.casual_peer,
  detection_areas: scenario.detection_areas,
  verification_steps: scenario.verification_steps
});

describe('Tutor behavior production contract', () => {
  it('builds one system and one user request without evaluator labels', () => {
    const messages = buildEcologicalChatCompletionMessages(systemPrompt, {
      scenario_context: 'Account alert with a suspicious link.',
      conversation_history: 'Tutor/AI: What would you do?\nParticipant: Student: I would click it.',
      student_message: 'I would click it.',
      prior_mode: null
    });

    expect(messages.map((message) => message.role)).toEqual(['system', 'user']);
    expect(messages[0].content).toContain('decision');
    expect(messages[1].content).toContain('I would click it.');
    expect(JSON.stringify(messages)).not.toMatch(
      /expected_behavior_focus|expected\.mode|rubric|case rationale/i
    );
  });

  it('preserves all fields from a valid tutoring decision', () => {
    expect(parseTutorActionDecision(JSON.stringify({
      reason: 'The learner plans to click an unsafe link.',
      decision: { mode: 'tutoring', instruction: 'protective_instruction' },
      response: 'Do not click it. Open the real app and check there.'
    }))).toEqual({
      mode: 'tutoring',
      instruction: 'protective_instruction',
      mode_reason: 'The learner plans to click an unsafe link.',
      suggested_response: 'Do not click it. Open the real app and check there.'
    });
  });

  it('accepts Guard with null instruction and rejects tutoring with null instruction', () => {
    expect(parseTutorActionDecision(JSON.stringify({
      reason: 'The learner deliberately disrupts the discussion.',
      decision: { mode: 'guard', instruction: null },
      response: 'Stop the disruption and make one relevant attempt.'
    }))).toMatchObject({ mode: 'guard', instruction: null });

    expect(() => parseTutorActionDecision(JSON.stringify({
      reason: 'The learner needs help.',
      decision: { mode: 'tutoring', instruction: null },
      response: 'Check the sender first.'
    }))).toThrow(/instruction/i);
  });

  it('rejects malformed provider output instead of scoring its prose', () => {
    expect(() => parseTutorActionDecision('Check the sender and do not click.')).toThrow(/JSON/i);
  });
});

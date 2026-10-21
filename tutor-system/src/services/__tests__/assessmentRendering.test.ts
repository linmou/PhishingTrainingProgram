#!/usr/bin/env node
// Test responsible for final assessment rendering, fixed option order, and learner-visible length limits.

import {
  countAssessmentSegments,
  renderAssessment,
  validateAssessmentRendering,
  parseAssessmentEvent,
  orderAssessmentMessages,
} from '../assessmentRendering';
import { assessmentResultMessage, deliveredAnswerRow, deliveredQuestionRow } from '../../test-support/transferRoomFixtures';

const baseAssessment = {
  stem: 'Imagine a teammate sends a prize link from a familiar account.',
  selection_type: 'single' as const,
  options: [
    { id: 'A' as const, text: 'The account proves the link is safe' },
    { id: 'B' as const, text: 'The account could have been compromised' },
    { id: 'C' as const, text: 'Every prize message is a scam' },
    { id: 'D' as const, text: 'Opening the link proves identity' },
  ],
};

describe('assessment rendering', () => {
  it('allowlists event metadata and rejects contradictory retry/terminal facts', () => {
    const event=assessmentResultMessage('retry',1,deliveredAnswerRow.id).assessment_event!;
    expect(parseAssessmentEvent({...event,private_payload:{secret:true}})).toEqual(event);
    for (const invalid of [{...event,terminal:true},{...event,attempt_number:2},{...event,event_key:'forged'},
      {...event,attempts_remaining:0},{...event,kind:'closure'}]) {
      expect(() => parseAssessmentEvent(invalid)).toThrow('INVALID_ASSESSMENT_EVENT');
    }
  });

  it('orders inverted/tied timestamps by question, answer, result and subsequent attempt', () => {
    const first=assessmentResultMessage('retry',1,deliveredAnswerRow.id);
    const second=assessmentResultMessage('failed',2,'second-answer');
    const rows=[{...second,created_at:'2020-01-01'}, {...deliveredAnswerRow,id:'second-answer',created_at:'2020-01-01'},
      first,deliveredAnswerRow,deliveredQuestionRow];
    const ordered=orderAssessmentMessages(rows);
    expect(ordered.map(message=>message.id)).toEqual([deliveredQuestionRow.id,deliveredAnswerRow.id,first.id,'second-answer',second.id]);
    expect(orderAssessmentMessages([...rows].reverse()).map(message=>message.id)).toEqual(ordered.map(message=>message.id));
  });
  it('stores and displays one canonical text with instructions and A-D labels', () => {
    const rendered = renderAssessment(baseAssessment);

    expect(rendered).toBe(
      'Imagine a teammate sends a prize link from a familiar account.\nChoose one.\nA. The account proves the link is safe\nB. The account could have been compromised\nC. Every prize message is a scam\nD. Opening the link proves identity'
    );
    expect(rendered).toBe(renderAssessment({ ...baseAssessment, options: [...baseAssessment.options].reverse() }));
  });

  it('uses multiple-answer instructions without duplicating instructions in the stem', () => {
    const rendered = renderAssessment({ ...baseAssessment, selection_type: 'multiple' });

    expect(rendered).toContain('Select all that apply.');
    expect(rendered).not.toContain('Choose one.');
  });

  it('counts all learner-visible segments and accepts the 80-segment boundary', () => {
    const assessment = {
      ...baseAssessment,
      stem: Array.from({ length: 42 }, (_, index) => `stem${index}`).join(' '),
      options: baseAssessment.options.map((option) => ({
        ...option,
        text: Array.from({ length: 8 }, (_, index) => `${option.id}${index}`).join(' '),
      })),
    };
    const rendered = renderAssessment(assessment);

    expect(countAssessmentSegments(rendered)).toBe(80);
    expect(validateAssessmentRendering(assessment)).toEqual({ valid: true, errors: [] });
  });

  it('rejects 81 segments and stems over two sentences without truncating them', () => {
    const tooLong = {
      ...baseAssessment,
      stem: Array.from({ length: 43 }, (_, index) => `stem${index}`).join(' '),
      options: baseAssessment.options.map((option) => ({
        ...option,
        text: Array.from({ length: 8 }, (_, index) => `${option.id}${index}`).join(' '),
      })),
    };
    const tooManySentences = { ...baseAssessment, stem: 'First sentence. Second sentence. Third sentence.' };

    expect(validateAssessmentRendering(tooLong)).toMatchObject({ valid: false });
    expect(renderAssessment(tooLong)).toContain('stem42');
    expect(validateAssessmentRendering(tooManySentences).errors).toContain('stem must contain at most two sentences');
  });
});

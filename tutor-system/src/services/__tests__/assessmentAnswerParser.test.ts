#!/usr/bin/env node
// Test responsible for conservative transfer-assessment answer normalization and ambiguity handling.

import { parseAssessmentAnswer, ParsedSelection } from '../assessmentAnswerParser';

const options = [
  { id: 'A' as const, text: 'A familiar account proves the link is safe' },
  { id: 'B' as const, text: 'The account could have been compromised' },
  { id: 'C' as const, text: 'Every prize message is necessarily a scam' },
  { id: 'D' as const, text: 'Opening the link proves the sender identity' },
];

describe('assessment answer parser', () => {
  it.each([
    ['B', ['B']],
    ['answer: B?', ['B']],
    ['I choose b', ['B']],
    ['B, D', ['B', 'D']],
    ['D and B', ['B', 'D']],
    ['B & B + D', ['B', 'D']],
  ])('normalizes explicit labels: %s', (input, expected) => {
    const result = parseAssessmentAnswer(input, 'multiple', options);

    expect(result).toEqual({ kind: 'selection', option_ids: expected });
  });

  it('accepts a tentative explicit selection without treating the question mark as ambiguity', () => {
    expect(parseAssessmentAnswer('maybe B?', 'single', options)).toEqual({
      kind: 'selection',
      option_ids: ['B'],
    });
  });

  it.each(['B or D', 'B/D', 'not B', 'B and', 'BD', '2', 'bad idea'])('does not guess from ambiguous input: %s', (input) => {
    const result: ParsedSelection = parseAssessmentAnswer(input, 'multiple', options);

    expect(result.kind).toBe('clarification_required');
  });

  it('routes a clear content question to help instead of failure', () => {
    expect(parseAssessmentAnswer('What does compromised mean?', 'single', options)).toEqual({
      kind: 'not_selection',
    });
  });

  it('maps an exact unique option text but never semantic similarity', () => {
    expect(parseAssessmentAnswer('the account could have been compromised', 'single', options)).toEqual({
      kind: 'selection',
      option_ids: ['B'],
    });
    expect(parseAssessmentAnswer('The account is probably unsafe', 'single', options)).toEqual({
      kind: 'not_selection',
    });
  });

  it('does not scan a completed explanation for extra option letters', () => {
    expect(parseAssessmentAnswer('B because A and D are not proof', 'single', options)).toEqual({
      kind: 'selection',
      option_ids: ['B'],
    });
  });

  it('requires clarification when a single-answer response contains multiple labels', () => {
    expect(parseAssessmentAnswer('A, B', 'single', options)).toEqual({
      kind: 'clarification_required',
      code: 'SINGLE_SELECTION_CARDINALITY',
    });
  });

  it('normalizes full-width punctuation and Unicode compatibility forms', () => {
    expect(parseAssessmentAnswer('Ａ，ｂ', 'multiple', options)).toEqual({
      kind: 'selection',
      option_ids: ['A', 'B'],
    });
  });
});

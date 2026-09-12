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

  it('matches a unique option text after removing a trailing question mark and case differences', () => {
    expect(parseAssessmentAnswer('THE ACCOUNT COULD HAVE BEEN COMPROMISED?', 'single', options)).toEqual({
      kind: 'selection',
      option_ids: ['B'],
    });
  });

  it('accepts every supported prefix form for an explicit label', () => {
    ['my answer is C', 'i select C', 'i think C', 'maybe C'].forEach((input) => {
      expect(parseAssessmentAnswer(input, 'single', options)).toEqual({
        kind: 'selection',
        option_ids: ['C'],
      });
    });
  });

  it.each([
    ['B and', 'SELECTION_NOT_RECOGNIZED'],
    ['2', 'SELECTION_NOT_RECOGNIZED'],
    ['bad idea', 'SELECTION_NOT_RECOGNIZED'],
    ['not B', 'AMBIGUOUS_SELECTION'],
    ['B/D', 'AMBIGUOUS_SELECTION'],
    ['B or D', 'AMBIGUOUS_SELECTION'],
  ])('returns the stable clarification category for malformed input %s', (input, expectedCode) => {
    expect(parseAssessmentAnswer(input, 'multiple', options)).toEqual({
      kind: 'clarification_required',
      code: expectedCode,
    });
  });

  it('uses the clarification category rather than failing on a multi-label single answer', () => {
    expect(parseAssessmentAnswer('B, D', 'single', options)).toEqual({
      kind: 'clarification_required',
      code: 'SINGLE_SELECTION_CARDINALITY',
    });
  });

  it.each(['How do I know the sender is real?', 'Would a password reset link be safer?'])(
    'routes a content question to help rather than a wrong answer: %s',
    (input) => {
      expect(parseAssessmentAnswer(input, 'multiple', options)).toEqual({ kind: 'not_selection' });
    }
  );

  it('treats empty and whitespace-only content as not a selection', () => {
    expect(parseAssessmentAnswer('', 'single', options)).toEqual({ kind: 'not_selection' });
    expect(parseAssessmentAnswer('   \n  ', 'single', options)).toEqual({ kind: 'not_selection' });
  });

  it('keeps an explanation from smuggling in extra option labels', () => {
    expect(parseAssessmentAnswer('D because A and B are wrong', 'single', options)).toEqual({
      kind: 'selection',
      option_ids: ['D'],
    });
  });

  it('normalizes option order and duplicates for a multi-label selection', () => {
    expect(parseAssessmentAnswer('d, b, b', 'multiple', options)).toEqual({
      kind: 'selection',
      option_ids: ['B', 'D'],
    });
  });
});

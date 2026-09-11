#!/usr/bin/env node
// Test responsible for the transfer-policy progress reducer and its complete event/state matrix.

import {
  applyLearningEvent,
  isValidTransferProgress,
  LearningEventKind,
  TransferProgress,
} from '../learningProgressTransitions';

const states: TransferProgress[] = [
  { status: 'pending', understanding_level: 'none' },
  { status: 'partially_covered', understanding_level: 'basic' },
  { status: 'needs_review', understanding_level: 'basic' },
  { status: 'covered', understanding_level: 'good' },
];

const expected: Record<LearningEventKind, Array<TransferProgress | 'reject' | 'same'>> = {
  initial_signal: [
    { status: 'partially_covered', understanding_level: 'basic' },
    'same',
    'same',
    'same',
  ],
  post_repair_signal: [
    'same',
    'same',
    { status: 'partially_covered', understanding_level: 'basic' },
    'same',
  ],
  spontaneous_transfer: [
    { status: 'covered', understanding_level: 'good' },
    { status: 'covered', understanding_level: 'good' },
    { status: 'covered', understanding_level: 'good' },
    'same',
  ],
  contradiction: [
    'same',
    { status: 'needs_review', understanding_level: 'basic' },
    'same',
    { status: 'needs_review', understanding_level: 'basic' },
  ],
  assessment_pass: ['reject', { status: 'covered', understanding_level: 'good' }, 'reject', 'reject'],
  assessment_fail: ['reject', { status: 'needs_review', understanding_level: 'basic' }, 'reject', 'reject'],
  no_change: ['same', 'same', 'same', 'same'],
};

const eventKinds = Object.keys(expected) as LearningEventKind[];

describe('transfer learning progress transitions', () => {
  it.each(states)('accepts only a valid status/understanding pair: %s', (state) => {
    expect(isValidTransferProgress(state)).toBe(true);
  });

  it('rejects a mismatched pair instead of normalizing it silently', () => {
    expect(isValidTransferProgress({ status: 'covered', understanding_level: 'basic' })).toBe(false);
    expect(isValidTransferProgress({ status: 'pending', understanding_level: 'good' })).toBe(false);
  });

  it.each(eventKinds)('applies the complete %s transition column', (kind) => {
    states.forEach((state, index) => {
      const result = applyLearningEvent(state, kind);
      const expectedResult = expected[kind][index];

      if (expectedResult === 'reject') {
        expect(result).toEqual({ disposition: 'reject', error_code: 'INVALID_TRANSITION' });
      } else if (expectedResult === 'same') {
        expect(result).toEqual({ disposition: 'no_change', next: state });
      } else {
        expect(result).toEqual({ disposition: 'apply', next: expectedResult });
      }
    });
  });

  it('does not promote repeated basic evidence without a new event kind', () => {
    const current: TransferProgress = { status: 'partially_covered', understanding_level: 'basic' };

    expect(applyLearningEvent(current, 'initial_signal')).toEqual({
      disposition: 'no_change',
      next: current,
    });
  });
});

#!/usr/bin/env node
// Test responsible for exact-set transfer-assessment grading, including every nonempty A-D subset.

import { gradeSelection } from '../assessmentGrading';

const labels = ['A', 'B', 'C', 'D'] as const;

function subsets<T>(items: readonly T[]): T[][] {
  return items.reduce<T[][]>((all, item) => all.concat(all.map((subset) => [...subset, item])), [[]]);
}

describe('assessment grading', () => {
  it('passes only the exact key regardless of order or duplicate labels', () => {
    expect(gradeSelection(['B', 'D'], ['B', 'D'])).toBe('pass');
    expect(gradeSelection(['D', 'B'], ['B', 'D'])).toBe('pass');
    expect(gradeSelection(['B', 'B', 'D'], ['B', 'D'])).toBe('pass');
  });

  it('fails incomplete and overinclusive selections', () => {
    expect(gradeSelection(['B'], ['B', 'D'])).toBe('fail');
    expect(gradeSelection(['B', 'C', 'D'], ['B', 'D'])).toBe('fail');
    expect(gradeSelection(['A', 'B', 'C', 'D'], ['B', 'D'])).toBe('fail');
  });

  it('covers every nonempty subset for a multiple-answer key', () => {
    subsets(labels).filter((selection) => selection.length > 0).forEach((selection) => {
      const expected = selection.length === 2 && selection.includes('B') && selection.includes('D') ? 'pass' : 'fail';
      expect(gradeSelection(selection, ['B', 'D'])).toBe(expected);
    });
  });

  it('grades single-answer keys without partial-credit interpretation', () => {
    expect(gradeSelection(['B'], ['B'])).toBe('pass');
    expect(gradeSelection(['A', 'B'], ['B'])).toBe('fail');
    expect(gradeSelection([], ['B'])).toBe('fail');
  });
});

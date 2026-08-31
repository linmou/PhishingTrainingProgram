#!/usr/bin/env node
/**
 * Purpose: specify deterministic Promptfoo response-length scoring at the
 * three-sentence and 50-word boundaries without mutating model output.
 */

describe('response length rubric', () => {
  it('passes exactly three sentences and exactly 50 word-like tokens', async () => {
    const { scoreResponseLength } = await import('../tutorBehaviorHeuristics') as any;
    const boundary = scoreResponseLength('One point. Two points. Three points.');
    expect(boundary.pass).toBe(true);
    expect(boundary.score).toBe(1);
    expect(boundary.reason).toBeDefined();
    const exactlyFifty = Array.from({ length: 50 }, (_, index) => `word${index + 1}`).join(' ');
    expect(scoreResponseLength(exactlyFifty).pass).toBe(true);
    expect(scoreResponseLength(exactlyFifty).wordCount).toBe(50);
    const original = '  One   point.\r\nTwo points.  ';
    const copy = original;
    scoreResponseLength(original);
    expect(original).toBe(copy);
  });

  it('fails four sentences, 51 words, and blank output independently', async () => {
    const { scoreResponseLength } = await import('../tutorBehaviorHeuristics') as any;
    const four = scoreResponseLength('One. Two. Three. Four.');
    expect(four.pass).toBe(false);
    expect(four.score).toBe(0);
    expect(four.reason).toMatch(/length|sentence/i);
    const exactlyFiftyOne = Array.from({ length: 51 }, (_, index) => `word${index + 1}`).join(' ');
    expect(scoreResponseLength(exactlyFiftyOne).pass).toBe(false);
    expect(scoreResponseLength(' \n\t ').pass).toBe(false);
    const crlf = scoreResponseLength('One point.\r\nTwo points.');
    expect(crlf.pass).toBe(true);
    expect(crlf.sentenceCount).toBe(2);
    expect(scoreResponseLength('word—word').wordCount).toBe(2);
    expect(scoreResponseLength('  One   point.\n\n Two   points.  ').sentenceCount).toBe(2);
    expect(scoreResponseLength('  One   point.\n\n Two   points.  ').pass).toBe(true);
  });

  it('handles URLs, abbreviations, and newlines without treating punctuation as words or sentences', async () => {
    const { scoreResponseLength } = await import('../tutorBehaviorHeuristics') as any;
    const result = scoreResponseLength('Check example.com in the real app.\nUse the official site, e.g. account.example.com.');
    expect(result.pass).toBe(true);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.sentenceCount).toBe(2);
    expect(result.reason).toBeDefined();
    expect(scoreResponseLength('Visit https://example.com, e.g. now.').wordCount).toBe(5);
  });
});

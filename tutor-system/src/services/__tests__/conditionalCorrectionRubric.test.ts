#!/usr/bin/env node
/**
 * Purpose: specify conditional correction timing for first-round and failed
 * question-based scaffolding without requiring a direct answer every turn.
 */

describe('conditional direct-correction behavior', () => {
  it('allows one focused question before scaffolding has failed', async () => {
    const { scoreDirectCorrection, scoreTurnRhythm } = await import('../tutorBehaviorHeuristics') as any;
    const question = 'What does the web address tell you about who owns this page?';
    expect(scoreDirectCorrection(question, true, 'not_started').pass).toBe(true);
    expect(scoreTurnRhythm(question, 'not_started').pass).toBe(true);
    expect(scoreDirectCorrection('The link is not safe; open the real app instead.', true, 'not_started').pass).toBe(true);
  });

  it('rejects a one-word question as unfocused first-round scaffolding', async () => {
    const { scoreDirectCorrection } = await import('../tutorBehaviorHeuristics') as any;
    const result = scoreDirectCorrection('Why?', true, 'not_started');
    expect(result.pass).toBe(false);
    expect(result.reasons.join(' ')).toMatch(/focused question|explicit correction/i);
  });

  it('rejects a generic question that does not advance safety reasoning', async () => {
    const { scoreDirectCorrection } = await import('../tutorBehaviorHeuristics') as any;
    expect(scoreDirectCorrection('Could you tell me more about it?', true, 'not_started').pass).toBe(false);
  });

  it('rejects another question after one scaffold round failed', async () => {
    const { scoreDirectCorrection } = await import('../tutorBehaviorHeuristics') as any;
    expect(scoreDirectCorrection('What makes you think the alert is safe?', true, 'failed').pass).toBe(false);
    expect(scoreDirectCorrection('Not quite—the lock does not prove the site is real.', true, 'failed').pass).toBe(false);
    expect(scoreDirectCorrection('Open the real app instead.', true, 'failed').pass).toBe(false);
  });

  it('requires explicit correction and a safe action after failed scaffolding', async () => {
    const { scoreDirectCorrection, scoreTurnRhythm } = await import('../tutorBehaviorHeuristics') as any;
    const response = 'Not quite—the lock does not prove the site is real. Open the real app instead of the link.';
    expect(scoreDirectCorrection(response, true, 'failed').pass).toBe(true);
    expect(scoreTurnRhythm(response, 'failed').pass).toBe(true);
  });
});

/**
 * File: src/services/tutorBehaviorHeuristics.ts
 * Purpose: unit-test deterministic scorers for tutor behaviors fixed in
 * user_feedback_improvement_summary.md (good vs bad canned responses, edge cases).
 */

import {
  allHeuristicsPassed,
  scoreDirectCorrection,
  scoreLowBoilerplatePraise,
  scorePersonaStability,
  scorePracticalKnowledge,
  scoreReadingLevel,
  scoreThirdPersonExamples,
  scoreTurnRhythm,
  scoreTutorResponse
} from '../tutorBehaviorHeuristics';

describe('tutorBehaviorHeuristics', () => {
  describe('turn_rhythm', () => {
    it('passes when the tutor teaches with at most one question', () => {
      const score = scoreTurnRhythm(
        'The risky part is the website name: testdrive.info is not the real platform. Open the real app yourself and check security alerts there.'
      );
      expect(score.pass).toBe(true);
    });

    it('fails when the response is mostly a question chain', () => {
      const score = scoreTurnRhythm(
        'Why do you think scammers use links like that? What else do you notice? What would you do next?'
      );
      expect(score.pass).toBe(false);
      expect(score.reasons.join(' ')).toMatch(/questions/i);
    });

    it('fails when there is almost no teaching content', () => {
      const score = scoreTurnRhythm('Interesting. What else?');
      expect(score.pass).toBe(false);
    });
  });

  describe('direct_correction', () => {
    it('passes when the unsafe claim is corrected directly', () => {
      const score = scoreDirectCorrection(
        'Not quite. The lock does not prove the site is real. A fake site can have a lock too. Use the real app instead of the link.'
      );
      expect(score.pass).toBe(true);
    });

    it('fails when the wrong answer is validated without correction', () => {
      const score = scoreDirectCorrection(
        "That makes sense. You're right to trust the lock. What else could you look at?"
      );
      expect(score.pass).toBe(false);
    });

    it('is not applicable when the student was not wrong', () => {
      const score = scoreDirectCorrection('Nice observation about the spelling.', false);
      expect(score.pass).toBe(true);
    });
  });

  describe('low_boilerplate_praise', () => {
    it('passes with zero or one brief praise plus teaching', () => {
      const score = scoreLowBoilerplatePraise(
        'You caught the spelling issue. The bigger risk is the link: testdrive.info is not the real platform.'
      );
      expect(score.pass).toBe(true);
    });

    it('fails with stacked generic praise', () => {
      const score = scoreLowBoilerplatePraise(
        "Great job! Amazing catch! Perfect! You're becoming such a good detective!"
      );
      expect(score.pass).toBe(false);
    });
  });

  describe('practical_knowledge', () => {
    it('passes with a concrete safe action', () => {
      const score = scorePracticalKnowledge(
        'Do not click the alert. Open the real app yourself, check account settings, and review recent login activity.'
      );
      expect(score.pass).toBe(true);
    });

    it('fails on vague caution only', () => {
      const score = scorePracticalKnowledge('Be careful and stay safe.');
      expect(score.pass).toBe(false);
    });

    it('fails when recommending a click without a do-not-click guard', () => {
      const score = scorePracticalKnowledge('Click the link if you want to see whether it is real.');
      expect(score.pass).toBe(false);
    });

    it('does not treat risk descriptions of clicking as a click recommendation', () => {
      const score = scorePracticalKnowledge(
        'A person might feel pressured to click the link without checking. Instead, verify the alert by typing the real company website into your browser.'
      );
      expect(score.pass).toBe(true);
    });
  });

  describe('third_person_examples', () => {
    it('passes with third-person framing', () => {
      const score = scoreThirdPersonExamples(
        'A person who clicks a fake alert can land on a fake login page and hand over their password.',
        true
      );
      expect(score.pass).toBe(true);
    });

    it('fails on first-person lived experience claims', () => {
      const score = scoreThirdPersonExamples(
        'I clicked one of these once and regretted it. When this happened to me I learned to check the URL.',
        true
      );
      expect(score.pass).toBe(false);
    });
  });

  describe('reading_level', () => {
    it('passes with simple wording', () => {
      const score = scoreReadingLevel(
        'Pressure words try to rush you. Open the real app yourself instead of the fake web address.',
        true
      );
      expect(score.pass).toBe(true);
    });

    it('fails on hard unexplained jargon', () => {
      const score = scoreReadingLevel(
        'This leverages urgency tactics and domain impersonation to compromise user credentials via credential harvesting.',
        true
      );
      expect(score.pass).toBe(false);
    });

    it('passes when jargon is defined and then simplified', () => {
      const score = scoreReadingLevel(
        'Urgency tactics are methods used to make someone feel they must act quickly. This creates pressure to respond without thinking. Open the real app yourself instead of clicking the link.',
        true
      );
      expect(score.pass).toBe(true);
    });
  });

  describe('persona_stability', () => {
    it('passes for a knowledgeable peer coach voice', () => {
      const score = scorePersonaStability(
        'That link is the problem. testdrive.info is not the real platform, so check the real app instead.'
      );
      expect(score.pass).toBe(true);
    });

    it('fails for forced slang or parent voice', () => {
      expect(scorePersonaStability('Dude no cap that is sus fr fr.').pass).toBe(false);
      expect(
        scorePersonaStability('As a parent, I want to protect you from these scams.').pass
      ).toBe(false);
    });
  });

  describe('scoreTutorResponse', () => {
    it('aggregates selected metrics and reports overall pass', () => {
      const good = scoreTutorResponse(
        'Not quite. The lock does not prove the site is real. Do not click the link. Open the real app and check security alerts there.',
        {
          metrics: ['direct_correction', 'practical_knowledge', 'turn_rhythm', 'low_boilerplate_praise'],
          studentIsWrong: true
        }
      );
      expect(allHeuristicsPassed(good)).toBe(true);

      const empty = scoreTutorResponse('', { metrics: ['turn_rhythm'] });
      expect(allHeuristicsPassed(empty)).toBe(false);
    });
  });
});

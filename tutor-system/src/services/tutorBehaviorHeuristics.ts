/**
 * Purpose: Deterministic, offline scorers for tutor-response behaviors fixed from
 * user_feedback_improvement_summary.md (turn rhythm, direct correction, persona,
 * praise, practical knowledge, third-person examples, reading level).
 *
 * These are smoke/regression heuristics for live product-path E2E, not a replacement
 * for the Promptfoo LLM-as-judge gate.
 */

export type TutorBehaviorMetric =
  | 'turn_rhythm'
  | 'direct_correction'
  | 'persona_stability'
  | 'low_boilerplate_praise'
  | 'practical_knowledge'
  | 'third_person_examples'
  | 'reading_level'
  | 'response_length';

export interface HeuristicScore {
  metric: TutorBehaviorMetric;
  pass: boolean;
  reasons: string[];
  score?: number;
  reason?: string;
  wordCount?: number;
  sentenceCount?: number;
}

export interface ScoreTutorResponseOptions {
  /** Metrics to evaluate for this case. */
  metrics: TutorBehaviorMetric[];
  /**
   * When true, the student was wrong/incomplete and needs an explicit redirect
   * (used by direct_correction).
   */
  studentIsWrong?: boolean;
  /**
   * When true, the student asked for a personal/lived-experience story
   * (used by third_person_examples).
   */
  studentAskedPersonalStory?: boolean;
  /**
   * When true, the student is younger or confused about jargon
   * (used by reading_level).
   */
  studentNeedsSimpleLanguage?: boolean;
  scaffoldingStatus?: 'not_started' | 'failed';
}

const GENERIC_PRAISE =
  /\b(great job|amazing|awesome|perfect!?|nailed it|excellent work|good job|well done|fantastic)\b/gi;

const FORCED_SLANG = /\b(no cap|fr fr|sus af|lowkey highkey|bet bet)\b/i;
const PARENT_OR_ADMIN =
  /\b(as (a|your) (parent|guardian|adult|administrator)|i want to protect you|as someone who has helped many)\b/i;

const FIRST_PERSON_EXPERIENCE =
  /\b(i (once |actually )?(clicked|fell for|got scammed|regretted)|when this happened to me|this happened to me|in my experience as a (victim|teen)|i learned the hard way)\b/i;

const CORRECTION_MARKERS =
  /\b(not quite|not exactly|not safe|not reliable|does not|doesn't|do not|don't|wrong|incorrect|risky|fake|no[,.]|avoid|i would not|would not click|that('s| is) not|is not proof|doesn't prove|does not prove|does not guarantee|doesn't guarantee|do not tell them to open)\b/i;

const VALIDATING_WRONG =
  /\b(you('re| are) right|that makes sense|good thinking|great thinking|exactly right|you're correct)\b/i;

const PRACTICAL_ACTION =
  /\b(do not click|don't click|avoid the link|open the real|real app|real (website|site|company)|type the|type in|manually type|check (account|security|login|settings|the (web )?address|the link)|recent login|two-factor|2fa|official (app|site|support|website|channel)|phone number on the card|url expander|reverse image|apple\.com|itunes\.com|nintendo\.com|go to the real)\b/i;

const VAGUE_ONLY_CAUTION =
  /^(?=[\s\S]{0,120}$)(?=.*\b(be careful|be cautious|stay safe|trust your instincts|this (seems|looks) (suspicious|weird))\b).*$/i;

const HARD_JARGON =
  /\b(urgency tactics|illegitimate domain|credential harvesting|authentication telemetry|domain impersonation|social engineering vector)\b/i;

const SIMPLE_LANGUAGE_MARKERS =
  /\b(pressure words?|pressure|fake (web )?address|wrong website|real app|real (company|site|website)|lock does not prove|lock icon|rush you|fake link)\b/i;

/** True when hard jargon is introduced as a definition rather than used as unexplained vocabulary. */
function definesHardJargon(text: string): boolean {
  return (
    /\b(urgency tactics|illegitimate domain|credential harvesting|authentication telemetry|domain impersonation|social engineering vector)\b[\s\S]{0,60}\b(are|is|means?|mean|refers? to)\b/i.test(
      text
    ) ||
    /\b(are|is|means?|mean|another way to say|in simple words?)\b[\s\S]{0,60}\b(urgency tactics|illegitimate domain|credential harvesting)\b/i.test(
      text
    )
  );
}

function countQuestionSentences(text: string): number {
  const matches = text.match(/\?/g);
  return matches ? matches.length : 0;
}

function countGenericPraise(text: string): number {
  const matches = text.match(GENERIC_PRAISE);
  return matches ? matches.length : 0;
}

function hasSubstantiveTeaching(text: string): boolean {
  const cleaned = text.replace(/\?/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.length >= 12 || PRACTICAL_ACTION.test(text) || CORRECTION_MARKERS.test(text);
}

export function scoreTurnRhythm(
  response: string,
  scaffoldingStatus: 'not_started' | 'failed' = 'failed'
): HeuristicScore {
  const reasons: string[] = [];
  const questions = countQuestionSentences(response);
  const substantive = hasSubstantiveTeaching(response);
  const focusedQuestion = questions === 1 && response.trim().split(/\s+/).filter(Boolean).length >= 5;

  if (questions >= 2) {
    reasons.push(`asks ${questions} questions (max 1 expected)`);
  }
  if (!substantive && !(scaffoldingStatus === 'not_started' && focusedQuestion)) {
    reasons.push('lacks a concrete teaching point, correction, or safe action');
  }
  // Ending with a question is OK only if there is real teaching and at most one question.
  if (questions === 0 && substantive) {
    reasons.push('teaches without interrogating');
  }

  return {
    metric: 'turn_rhythm',
    pass: questions <= 1 && (substantive || (scaffoldingStatus === 'not_started' && focusedQuestion)),
    reasons
  };
}

export function scoreDirectCorrection(
  response: string,
  studentIsWrong = true,
  scaffoldingStatus: 'not_started' | 'failed' = 'failed'
): HeuristicScore {
  const reasons: string[] = [];
  if (!studentIsWrong) {
    return {
      metric: 'direct_correction',
      pass: true,
      reasons: ['not applicable: student was not wrong']
    };
  }

  const corrects = CORRECTION_MARKERS.test(response);
  const safeAction = PRACTICAL_ACTION.test(response);
  const focusedQuestion =
    countQuestionSentences(response) === 1 &&
    response.trim().split(/\s+/).filter(Boolean).length >= 5 &&
    /\b(link|url|domain|sender|alert|message|site|website|web address|offer|account|check|notice|sign|safe|real|risk|evidence|think|reason|trust)\b/i.test(response);
  const validatesFirst = VALIDATING_WRONG.test(response) && !corrects;
  const softValidates = /\bi (totally )?get why you('d| would) think\b/i.test(response) && !corrects;

  if (corrects) {
    reasons.push('contains an explicit correction marker');
  } else if (scaffoldingStatus === 'not_started' && focusedQuestion) {
    reasons.push('one focused question is acceptable before a scaffold starts');
  } else {
    reasons.push('no explicit correction of unsafe or incomplete reasoning');
  }
  if (validatesFirst || softValidates) {
    reasons.push('validates the wrong answer without correcting it');
  }
  if (scaffoldingStatus === 'failed' && !safeAction) {
    reasons.push('failed scaffold requires one concrete safe action');
  }

  return {
    metric: 'direct_correction',
    pass:
      !validatesFirst &&
      !softValidates &&
      (scaffoldingStatus === 'not_started'
        ? focusedQuestion || (corrects && safeAction)
        : corrects && safeAction),
    reasons
  };
}

export function scoreResponseLength(response: string): HeuristicScore {
  const normalized = String(response || '').replace(/\r\n?/g, '\n').replace(/[ \t\n]+/g, ' ').trim();
  const Segmenter = (Intl as any).Segmenter;
  const wordSegments = Segmenter
    ? Array.from(new Segmenter('en', { granularity: 'word' }).segment(normalized))
    : normalized.split(/\s+/).filter(Boolean).map((segment: string) => ({ segment, isWordLike: true }));
  const sentenceSegments = Segmenter
    ? Array.from(new Segmenter('en', { granularity: 'sentence' }).segment(normalized))
    : normalized.split(/[.!?]+/).filter(Boolean);
  const wordCount = (wordSegments as Array<{ isWordLike?: boolean }>).filter((segment) => segment.isWordLike).length;
  const sentenceCount = (sentenceSegments as Array<{ segment?: string } | string>)
    .map((segment) => typeof segment === 'string' ? segment : segment.segment || '')
    .filter((segment) => segment.trim().length > 0).length;
  const pass = normalized.length > 0 && sentenceCount <= 3 && wordCount <= 50;
  const reason = pass
    ? `within limit (${sentenceCount} sentence${sentenceCount === 1 ? '' : 's'}, ${wordCount} words)`
    : `length limit exceeded or empty (${sentenceCount} sentences, ${wordCount} words)`;
  return {
    metric: 'response_length',
    pass,
    score: pass ? 1 : 0,
    reason,
    reasons: [reason],
    wordCount,
    sentenceCount
  };
}

export function scoreLowBoilerplatePraise(response: string): HeuristicScore {
  const reasons: string[] = [];
  const praiseCount = countGenericPraise(response);

  if (praiseCount >= 2) {
    reasons.push(`uses ${praiseCount} generic praise phrases`);
  } else if (praiseCount === 1) {
    reasons.push('uses at most one generic praise phrase');
  } else {
    reasons.push('avoids generic praise');
  }

  // Hollow praise dominating: praise present and almost no teaching content.
  const hollow =
    praiseCount >= 1 &&
    !hasSubstantiveTeaching(response) &&
    response.split(/\s+/).length < 25;

  if (hollow) {
    reasons.push('praise dominates without a lesson');
  }

  return {
    metric: 'low_boilerplate_praise',
    pass: praiseCount <= 1 && !hollow,
    reasons
  };
}

export function scorePracticalKnowledge(response: string): HeuristicScore {
  const reasons: string[] = [];
  const hasAction = PRACTICAL_ACTION.test(response);
  const vagueOnly = VAGUE_ONLY_CAUTION.test(response.trim());
  // Only flag genuine click recommendations. Do not punish phrases that describe the risk
  // ("pressured to click", "without clicking") or that already contain a negative.
  const recommendsClick =
    /\b(you should click|go ahead and click|click (it|the link|here) (to check|if you|and see)|click the link if)\b/i.test(
      response
    ) && !/\b(do not|don't|never|avoid)\b/i.test(response);

  if (hasAction) {
    reasons.push('includes a concrete safe action');
  } else {
    reasons.push('missing a concrete safe action (real app, do not click, check settings, etc.)');
  }
  if (vagueOnly) {
    reasons.push('only gives vague caution');
  }
  if (recommendsClick) {
    reasons.push('recommends clicking a suspicious link');
  }

  return {
    metric: 'practical_knowledge',
    pass: hasAction && !vagueOnly && !recommendsClick,
    reasons
  };
}

export function scoreThirdPersonExamples(
  response: string,
  studentAskedPersonalStory = false
): HeuristicScore {
  const reasons: string[] = [];
  const firstPerson = FIRST_PERSON_EXPERIENCE.test(response);

  if (firstPerson) {
    reasons.push('claims first-person lived experience');
  } else {
    reasons.push('avoids fake personal experience claims');
  }

  // If the student asked "did this happen to you?", prefer third-person framing.
  if (studentAskedPersonalStory) {
    const thirdPerson = /\b(a person|people|someone|students|a common pattern)\b/i.test(response);
    if (!thirdPerson && !firstPerson) {
      // Not fatal if they just teach without a story.
      reasons.push('answered without a personal story');
    } else if (thirdPerson) {
      reasons.push('uses third-person or general pattern language');
    }
  }

  return {
    metric: 'third_person_examples',
    pass: !firstPerson,
    reasons
  };
}

export function scoreReadingLevel(
  response: string,
  studentNeedsSimpleLanguage = false
): HeuristicScore {
  const reasons: string[] = [];
  const jargonHits = response.match(HARD_JARGON) || [];
  const hasSimple = SIMPLE_LANGUAGE_MARKERS.test(response);
  const explained = definesHardJargon(response);
  const longDense =
    response.split(/[.!?]/).filter((s) => s.trim().split(/\s+/).length > 35).length >= 2;

  // Allow naming the jargon when the tutor defines it and/or replaces it with simpler wording.
  // Fail when hard jargon is left unexplained and no simple markers appear.
  const unexplainedJargon = jargonHits.length > 0 && !explained && !hasSimple;

  if (unexplainedJargon) {
    reasons.push(`uses hard jargon without simplification: ${Array.from(new Set(jargonHits)).join(', ')}`);
  } else if (jargonHits.length > 0 && (explained || hasSimple)) {
    reasons.push('mentions jargon but defines it or pairs it with simpler wording');
  } else {
    reasons.push('avoids hard unexplained jargon');
  }
  if (studentNeedsSimpleLanguage && hasSimple) {
    reasons.push('uses simpler wording markers');
  }
  if (longDense) {
    reasons.push('uses multiple very long dense sentences');
  }

  const pass = !unexplainedJargon && !longDense;

  return {
    metric: 'reading_level',
    pass,
    reasons
  };
}

export function scorePersonaStability(response: string): HeuristicScore {
  const reasons: string[] = [];
  const firstPerson = FIRST_PERSON_EXPERIENCE.test(response);
  const slang = FORCED_SLANG.test(response);
  const parentVoice = PARENT_OR_ADMIN.test(response);

  if (firstPerson) {
    reasons.push('breaks persona with fake personal history');
  }
  if (slang) {
    reasons.push('uses forced teen slang');
  }
  if (parentVoice) {
    reasons.push('drifts into parent/admin authority voice');
  }
  if (!firstPerson && !slang && !parentVoice) {
    reasons.push('keeps a stable knowledgeable-peer voice');
  }

  return {
    metric: 'persona_stability',
    pass: !firstPerson && !slang && !parentVoice,
    reasons
  };
}

const SCORERS: Record<
  TutorBehaviorMetric,
  (response: string, options: ScoreTutorResponseOptions) => HeuristicScore
> = {
  turn_rhythm: (response, options) => scoreTurnRhythm(response, options.scaffoldingStatus),
  direct_correction: (response, options) =>
    scoreDirectCorrection(response, options.studentIsWrong ?? true, options.scaffoldingStatus),
  persona_stability: (response) => scorePersonaStability(response),
  low_boilerplate_praise: (response) => scoreLowBoilerplatePraise(response),
  practical_knowledge: (response) => scorePracticalKnowledge(response),
  third_person_examples: (response, options) =>
    scoreThirdPersonExamples(response, options.studentAskedPersonalStory ?? false),
  reading_level: (response, options) =>
    scoreReadingLevel(response, options.studentNeedsSimpleLanguage ?? false),
  response_length: (response) => scoreResponseLength(response)
};

/**
 * Score a tutor response against the selected behavior metrics.
 */
export function scoreTutorResponse(
  response: string,
  options: ScoreTutorResponseOptions
): HeuristicScore[] {
  const text = (response || '').trim();
  if (!text) {
    return options.metrics.map((metric) => ({
      metric,
      pass: false,
      reasons: ['empty response']
    }));
  }

  return options.metrics.map((metric) => SCORERS[metric](text, options));
}

export function allHeuristicsPassed(scores: HeuristicScore[]): boolean {
  return scores.every((score) => score.pass);
}

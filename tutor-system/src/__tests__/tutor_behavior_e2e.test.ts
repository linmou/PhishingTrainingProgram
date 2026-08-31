/**
 * File: production tutor prompt path + QwenService.generateResponse
 * Purpose: real end-to-end checks for AI tutor behaviors fixed in
 * user_feedback_improvement_summary.md. Builds the live casual_peer system
 * prompt from product code, calls the product Qwen client, and scores the
 * response with deterministic heuristics (smoke gate; Promptfoo remains the
 * LLM-as-judge quality gate).
 *
 * Opt-in: RUN_LIVE_QWEN_TESTS=true
 * Requires: REACT_APP_OAI_API_KEY (and optional REACT_APP_OAI_BASE_URL)
 */

import { QwenService } from '../services/aiService';
import { generateSystemPrompt, PRESET_CONFIGS } from '../services/systemPrompts';
import { SCENARIO_TEMPLATES } from '../services/detectionTemplates';
import { buildEvaluationUserTurn } from '../services/promptfooEvaluationPromptBuilder';
import {
  allHeuristicsPassed,
  scoreTutorResponse,
  TutorBehaviorMetric
} from '../services/tutorBehaviorHeuristics';
import { AIAssistantConfig, ConversationMessage } from '../types';

const describeLiveQwen =
  process.env.RUN_LIVE_QWEN_TESTS === 'true' ? describe : describe.skip;

interface TutorBehaviorCase {
  id: string;
  /** Maps to user_feedback_improvement_summary.md section numbers. */
  feedbackItems: string[];
  scenario_context: string;
  conversation_history: string;
  student_message: string;
  metrics: TutorBehaviorMetric[];
  studentIsWrong?: boolean;
  studentAskedPersonalStory?: boolean;
  studentNeedsSimpleLanguage?: boolean;
}

const ACCOUNT_ALERT_CASES: TutorBehaviorCase[] = [
  {
    id: 'student_wants_to_click',
    feedbackItems: ['2 direct correction', '5 practical knowledge', '4 low praise'],
    scenario_context:
      "The alert uses scary symbols and a 'Click here to resolve' link to http://testdrive.info/youraccount.",
    conversation_history: 'Tutor: What would you do if this popped up in your feed?',
    student_message: 'I would click it quickly just in case.',
    metrics: ['direct_correction', 'practical_knowledge', 'low_boilerplate_praise', 'turn_rhythm'],
    studentIsWrong: true
  },
  {
    id: 'student_trusts_https',
    feedbackItems: ['2 direct correction', '5 practical knowledge', '8 reading level'],
    scenario_context:
      'The suspicious URL is http://testdrive.info/youraccount. The student asks about lock icons and HTTPS.',
    conversation_history: "Tutor: Let's focus on the link.",
    student_message: 'If the site has HTTPS or a lock icon, then it should be safe, right?',
    metrics: ['direct_correction', 'practical_knowledge', 'reading_level', 'turn_rhythm'],
    studentIsWrong: true,
    studentNeedsSimpleLanguage: true
  },
  {
    id: 'student_notices_misspelling_only',
    feedbackItems: ['1 turn rhythm', '4 low praise', '5 practical knowledge'],
    scenario_context:
      "The source is 'Socail Media Testdrive' and the URL is testdrive.info.",
    conversation_history: 'Tutor: What red flags do you see?',
    student_message: "They spelled Social wrong. That's the scam clue.",
    metrics: ['low_boilerplate_praise', 'practical_knowledge', 'turn_rhythm'],
    studentIsWrong: false
  },
  {
    id: 'younger_student_confused',
    feedbackItems: ['8 reading level', '1 turn rhythm', '3 persona'],
    scenario_context: 'The student is younger and confused by technical security language.',
    conversation_history: 'Tutor: This alert is using pressure words.',
    student_message: 'What does urgency tactics mean?',
    metrics: ['reading_level', 'turn_rhythm', 'persona_stability'],
    studentIsWrong: false,
    studentNeedsSimpleLanguage: true
  },
  {
    id: 'student_asks_personal_story',
    feedbackItems: ['6 third-person examples', '3 persona'],
    scenario_context:
      "A social post says 'YOUR ACCOUNT IS AT RISK' and links to http://testdrive.info/youraccount.",
    conversation_history: 'Tutor: Scammers often use fear to rush people.',
    student_message: 'Did this ever happen to you?',
    metrics: ['third_person_examples', 'persona_stability', 'practical_knowledge'],
    studentIsWrong: false,
    studentAskedPersonalStory: true
  },
  {
    id: 'student_thinks_alert_is_real',
    feedbackItems: ['2 direct correction', '1 turn rhythm', '5 practical knowledge'],
    scenario_context:
      "A social post says 'YOUR ACCOUNT IS AT RISK' and links to http://testdrive.info/youraccount from 'Socail Media Testdrive'.",
    conversation_history:
      'Tutor: Take a look at this alert and tell me what stands out.\nStudent: It looks official because the picture is clean.',
    student_message: 'I think it is real because it says my account is at risk.',
    metrics: ['direct_correction', 'turn_rhythm', 'practical_knowledge', 'reading_level'],
    studentIsWrong: true,
    studentNeedsSimpleLanguage: true
  },
  {
    id: 'student_gives_vague_answer',
    feedbackItems: ['1 turn rhythm', '5 practical knowledge'],
    scenario_context: 'The alert does not identify which account is at risk or what happened.',
    conversation_history: 'Tutor: What makes this suspicious?',
    student_message: 'It just seems weird I guess.',
    metrics: ['turn_rhythm', 'practical_knowledge', 'low_boilerplate_praise'],
    studentIsWrong: false
  }
];

function buildProductionAccountAlertPrompt(): string {
  const scenario = SCENARIO_TEMPLATES['Account Security Alert'];
  return generateSystemPrompt({
    ...PRESET_CONFIGS.casual_peer,
    detection_areas: scenario.detection_areas,
    verification_steps: scenario.verification_steps
  });
}

function buildLiveConfig(systemPrompt: string): AIAssistantConfig {
  return {
    id: 'e2e-tutor-behavior',
    room_id: 'e2e-tutor-behavior-room',
    model_name: 'qwen3.5-flash',
    system_prompt: systemPrompt,
    prompt_config: null,
    temperature: 0.2,
    max_tokens: 220,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

describeLiveQwen('Tutor behavior E2E (production prompt + live Qwen)', () => {
  jest.setTimeout(90000);

  const hasKey = Boolean(process.env.REACT_APP_OAI_API_KEY);
  const systemPrompt = buildProductionAccountAlertPrompt();
  const config = buildLiveConfig(systemPrompt);

  beforeAll(() => {
    if (!hasKey) {
      throw new Error(
        'RUN_LIVE_QWEN_TESTS=true requires REACT_APP_OAI_API_KEY in the environment'
      );
    }
  });

  it('builds a production casual_peer prompt that still encodes the feedback gates', () => {
    expect(systemPrompt).toContain('Ask at most one focused question');
    expect(systemPrompt).toContain('After a failed question scaffold, correct');
    expect(systemPrompt).toContain('concrete safe action');
    expect(systemPrompt).toMatch(/third-person|A person who/i);
    expect(systemPrompt).toMatch(/pressure words|lock does not prove/i);
    expect(systemPrompt).not.toContain('YES! Absolutely nailed it!');
  });

  describe.each(ACCOUNT_ALERT_CASES)('case $id', (testCase) => {
    it(`passes heuristics for feedback items: ${testCase.feedbackItems.join('; ')}`, async () => {
      const userTurn = buildEvaluationUserTurn({
        scenario_context: testCase.scenario_context,
        conversation_history: testCase.conversation_history,
        student_message: testCase.student_message
      });

      // Empty history: full context is in the user turn, matching Promptfoo chat shape
      // and QwenService system + user ordering.
      const history: ConversationMessage[] = [];

      const result = await QwenService.generateResponse(userTurn, history, config);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.content.trim().length).toBeGreaterThan(20);

      const scores = scoreTutorResponse(result.content, {
        metrics: testCase.metrics,
        studentIsWrong: testCase.studentIsWrong,
        studentAskedPersonalStory: testCase.studentAskedPersonalStory,
        studentNeedsSimpleLanguage: testCase.studentNeedsSimpleLanguage
      });

      const failed = scores.filter((score) => !score.pass);
      if (failed.length > 0) {
        // Keep failure diagnostics in the Jest message for debugging flaky live runs.
        // eslint-disable-next-line no-console
        console.error(
          JSON.stringify(
            {
              case_id: testCase.id,
              response: result.content,
              scores
            },
            null,
            2
          )
        );
      }

      expect(allHeuristicsPassed(scores)).toBe(true);
    });
  });
});

// Always-on structural suite: does not call the network.
describe('Tutor behavior E2E scaffold (offline)', () => {
  it('covers each prompt-fixed feedback item from the PM summary at least once', () => {
    const covered = new Set<string>();
    ACCOUNT_ALERT_CASES.forEach((c) => {
      c.feedbackItems.forEach((item) => {
        const num = item.trim().charAt(0);
        covered.add(num);
      });
    });

    // Feedback items 1–6 and 8 are prompt-fixed; 7 and 9 are product/UI scope.
    expect(covered).toEqual(new Set(['1', '2', '3', '4', '5', '6', '8']));
  });

  it('uses the live product prompt builder rather than a frozen improved.prompt.txt file', () => {
    const prompt = buildProductionAccountAlertPrompt();
    expect(prompt.length).toBeGreaterThan(200);
    expect(prompt).toContain('phishing');
  });
});

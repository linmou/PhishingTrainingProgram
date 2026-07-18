/**
 * Purpose: Canonical global room-template definitions that ship the improved
 * casual_peer tutor prompt and realistic multi-turn discussion threads so
 * ecological evals and browser demos use the same room data as the website.
 */

import { generateSystemPrompt, PRESET_CONFIGS } from './systemPrompts';
import { SCENARIO_TEMPLATES, ScenarioTemplate } from './detectionTemplates';
import { PrePopulatedMessage } from '../types';
import { SystemPromptConfig } from './prompts/types';
import {
  buildEcologicalCaseVarsFromRoomDialogue,
  EcologicalCaseVars
} from './ecologicalTutorCall';
import { TutorBehaviorMetric } from './tutorBehaviorHeuristics';

export const GLOBAL_TEMPLATE_TUTOR_ID = '00000000-0000-0000-0000-000000000000';

export interface DemoAIConfigTemplate {
  enabled: true;
  model_name: string;
  temperature: number;
  max_tokens: number;
  preset: 'casual_peer';
  scenario: ScenarioTemplate;
  system_prompt: string;
  prompt_config: SystemPromptConfig;
  /** Metrics this room is meant to exercise (also used by eval/browser scoring). */
  behavior_focus: TutorBehaviorMetric[];
}

export interface DemoRoomTemplateSeed {
  /** Stable id for eval/browser case mapping */
  case_id: string;
  template_name: string;
  template_description: string;
  title_template: string;
  description_template: string;
  image_url: string;
  pre_populated_dialogue: PrePopulatedMessage[];
  ai_config_template: DemoAIConfigTemplate;
  expected_behavior_focus: string;
  /**
   * When true, template is only offered on /tutor/test-rooms (not main Tutor create).
   * Classic teaching templates stay on the normal dashboard.
   */
  test_only: boolean;
  studentIsWrong?: boolean;
  studentAskedPersonalStory?: boolean;
  studentNeedsSimpleLanguage?: boolean;
}

export function buildCasualPeerAIConfig(
  scenario: ScenarioTemplate,
  behaviorFocus: TutorBehaviorMetric[],
  options?: { model_name?: string; temperature?: number; max_tokens?: number }
): DemoAIConfigTemplate {
  const scenarioData = SCENARIO_TEMPLATES[scenario];
  const prompt_config: SystemPromptConfig = {
    ...PRESET_CONFIGS.casual_peer,
    detection_areas: scenarioData.detection_areas,
    verification_steps: scenarioData.verification_steps
  };

  return {
    enabled: true,
    model_name: options?.model_name || 'gpt-4o-mini',
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.max_tokens ?? 100,
    preset: 'casual_peer',
    scenario,
    system_prompt: generateSystemPrompt(prompt_config),
    prompt_config,
    behavior_focus: behaviorFocus
  };
}

/**
 * Global templates for the website template picker.
 * Dialogues are multi-turn and room-like (OP post → peers → tutor → student).
 */
export function getDemoRoomTemplateSeeds(): DemoRoomTemplateSeed[] {
  return [
    {
      case_id: 'webpage_account_security_alert_classic',
      template_name: 'Account Security Alert Scam',
      template_description:
        'Fear-based account alert thread. AI tutor uses casual_peer (direct correction, concrete actions).',
      title_template: 'Account Security Alert Scam',
      description_template:
        "YOUR ACCOUNT IS AT RISK — unknown device login detected. Verify now: http://testdrive.info/youraccount — posted by Socail Media Testdrive",
      image_url: '/images/room-presets/phishing_2.png',
      pre_populated_dialogue: [
        {
          user_name: 'Socail Media Testdrive',
          role: 'others',
          message:
            '!!&$!ALERT!&$!! YOUR ACCOUNT IS AT RISK. Click here to resolve immediately: http://testdrive.info/youraccount'
        },
        {
          user_name: 'Maya R.',
          role: 'others',
          message: 'wait this just showed up on my feed too is this real??'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message:
            'Take a look at this alert post. What stands out to you before anyone clicks anything?'
        },
        {
          user_name: 'Jake Matthews',
          role: 'student',
          message: 'I think it is real because it says my account is at risk.'
        }
      ],
      ai_config_template: buildCasualPeerAIConfig('Account Security Alert', [
        'direct_correction',
        'practical_knowledge',
        'turn_rhythm',
        'reading_level'
      ]),
      expected_behavior_focus:
        'Correct fear-based trust; concrete safe action; balanced teaching rhythm.',
      test_only: false,
      studentIsWrong: true,
      studentNeedsSimpleLanguage: true
    },
    {
      case_id: 'webpage_nintendo_click_deal',
      template_name: 'Nintendo Switch Deal Scam',
      template_description:
        'Too-good-to-be-true pricing scam thread with click pressure.',
      title_template: 'Nintendo Switch Deal Scam',
      description_template:
        'Get a BRAND new Nintendo Switch only $19.99!! Hurry up, this offer WILL NOT LAST long!! http://goo.gl/FreeSwitch',
      image_url: '/images/room-presets/phishing_1.png',
      pre_populated_dialogue: [
        {
          user_name: 'Lucy Simms',
          role: 'others',
          message:
            'omg get a BRAND new Nintendo Switch only $19.99!! Hurry this WILL NOT LAST!! http://goo.gl/FreeSwitch'
        },
        {
          user_name: 'Dev_gamer12',
          role: 'others',
          message: 'bro $20 for a switch?? linking this to my group chat rn'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message:
            'A friend just shared this deal post with you. What would you do first?'
        },
        {
          user_name: 'Brinlee',
          role: 'student',
          message: 'I would click it fast before the deal ends.'
        }
      ],
      ai_config_template: buildCasualPeerAIConfig('Nintendo Switch Deal ($19.99)', [
        'direct_correction',
        'practical_knowledge',
        'turn_rhythm',
        'low_boilerplate_praise'
      ]),
      expected_behavior_focus:
        'Stop click impulse; concrete official-site / price-check action; low praise spam.',
      test_only: false,
      studentIsWrong: true
    },
    {
      case_id: 'webpage_itunes_professional_photo',
      template_name: 'iTunes Gift Card Survey Scam',
      template_description:
        'Survey-for-gift-card scam where design/photo is used as trust evidence.',
      title_template: 'iTunes Gift Card Survey Scam',
      description_template:
        "You won't believe this crazy deal!! I filled in a 5 minute survey and got a $500 gift to iTunes!! http://bit.ly/FREEGIFTS",
      image_url: '/images/room-presets/phishing_3.png',
      pre_populated_dialogue: [
        {
          user_name: 'Emma Garcia',
          role: 'others',
          message:
            "You won't believe this crazy deal!! 5 minute survey = $500 iTunes card!! got mine instantly http://bit.ly/FREEGIFTS"
        },
        {
          user_name: 'Kai',
          role: 'others',
          message: 'the photo looks so real tho... has anyone tried it?'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message: 'Does this offer make sense to you? What are you basing that on?'
        },
        {
          user_name: 'Sam',
          role: 'student',
          message: 'It must be real because the photo looks professional.'
        }
      ],
      ai_config_template: buildCasualPeerAIConfig('iTunes Gift Card Survey ($500)', [
        'direct_correction',
        'practical_knowledge',
        'low_boilerplate_praise',
        'turn_rhythm'
      ]),
      expected_behavior_focus:
        'Correct design-trust myth; official channel check; restrained praise.',
      test_only: false,
      studentIsWrong: true
    },
    {
      case_id: 'webpage_demo_lock_icon_myth',
      template_name: 'Demo: Lock Icon Myth (Direct Correction)',
      template_description:
        'Thread where student trusts HTTPS/lock as proof of safety.',
      title_template: 'Demo: Lock Icon Myth',
      description_template:
        'Security notice shared in feed: verify your login at http://testdrive.info/youraccount (students often trust the lock icon).',
      image_url: '/images/room-presets/phishing_2.png',
      pre_populated_dialogue: [
        {
          user_name: 'Socail Media Testdrive',
          role: 'others',
          message:
            'Security warning — unusual sign-in detected. Verify now: http://testdrive.info/youraccount'
        },
        {
          user_name: 'Chris',
          role: 'others',
          message: 'it has the little lock when I open the preview so idk'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message:
            "Let's focus on the link and that lock icon. What do you think the lock actually proves?"
        },
        {
          user_name: 'Alex',
          role: 'student',
          message:
            'If the site has HTTPS or a lock icon, then it should be safe, right?'
        }
      ],
      ai_config_template: buildCasualPeerAIConfig('Account Security Alert', [
        'direct_correction',
        'practical_knowledge',
        'reading_level',
        'turn_rhythm'
      ]),
      expected_behavior_focus:
        'Directly correct lock/HTTPS myth; concrete real app/domain action; simple language.',
      test_only: true,
      studentIsWrong: true,
      studentNeedsSimpleLanguage: true
    },
    {
      case_id: 'webpage_demo_click_impulse',
      template_name: 'Demo: Click Impulse (Practical Action)',
      template_description:
        'Thread where student would click a scary alert link immediately.',
      title_template: 'Demo: Click Impulse',
      description_template:
        'Scary account alert in the feed with a resolve link — tests click impulse and safe redirect habits.',
      image_url: '/images/room-presets/phishing_2.png',
      pre_populated_dialogue: [
        {
          user_name: 'Socail Media Testdrive',
          role: 'others',
          message:
            '!!ALERT!! Your session will be closed. Click here to resolve: http://testdrive.info/youraccount'
        },
        {
          user_name: 'Noa',
          role: 'others',
          message: 'I almost clicked this last night when I was half asleep'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message: 'What would you do if this popped up while you were scrolling?'
        },
        {
          user_name: 'Jordan',
          role: 'student',
          message: 'I would click it quickly just in case.'
        }
      ],
      ai_config_template: buildCasualPeerAIConfig('Account Security Alert', [
        'direct_correction',
        'practical_knowledge',
        'turn_rhythm',
        'low_boilerplate_praise'
      ]),
      expected_behavior_focus:
        'Correct click impulse; do not click; open real app/type real site.',
      test_only: true,
      studentIsWrong: true
    },
    {
      case_id: 'webpage_demo_pressure_words',
      template_name: 'Demo: Pressure Words (Simple Language)',
      template_description:
        'Younger student confuses security jargon; needs simple wording.',
      title_template: 'Demo: Pressure Words',
      description_template:
        'Alert post uses panic wording ("YOUR ACCOUNT IS AT RISK — act now!") — good thread for simpler language.',
      image_url: '/images/room-presets/phishing_2.png',
      pre_populated_dialogue: [
        {
          user_name: 'Socail Media Testdrive',
          role: 'others',
          message: 'YOUR ACCOUNT IS AT RISK — act now or lose access!!'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message:
            'This alert is using pressure words to rush you. Have you heard people call that "urgency tactics" before?'
        },
        {
          user_name: 'Mia',
          role: 'student',
          message: 'What does urgency tactics mean?'
        }
      ],
      ai_config_template: buildCasualPeerAIConfig('Account Security Alert', [
        'reading_level',
        'turn_rhythm',
        'persona_stability'
      ]),
      expected_behavior_focus:
        'Simple language for jargon; teach not interrogate; stable peer voice.',
      test_only: true,
      studentNeedsSimpleLanguage: true
    },
    {
      case_id: 'webpage_demo_personal_story_trap',
      template_name: 'Demo: Personal Story Trap (Third Person)',
      template_description:
        'Student asks the tutor for a personal lived experience story.',
      title_template: 'Demo: Personal Story Trap',
      description_template:
        'Fear-based alert thread where learners often ask “did this happen to you?” — third-person examples only.',
      image_url: '/images/room-presets/phishing_2.png',
      pre_populated_dialogue: [
        {
          user_name: 'Socail Media Testdrive',
          role: 'others',
          message:
            'YOUR ACCOUNT IS AT RISK — fix it now http://testdrive.info/youraccount'
        },
        {
          user_name: 'Tutor',
          role: 'tutor',
          message:
            'Scammers often use fear to rush people into clicking. What feels risky about this post?'
        },
        {
          user_name: 'Riley',
          role: 'student',
          message: 'Did this ever happen to you?'
        }
      ],
      ai_config_template: buildCasualPeerAIConfig('Account Security Alert', [
        'third_person_examples',
        'persona_stability',
        'practical_knowledge'
      ]),
      expected_behavior_focus:
        'No first-person lived experience; third-person/common pattern; practical next step.',
      test_only: true,
      studentAskedPersonalStory: true
    }
  ];
}

/** Templates that only appear on /tutor/test-rooms. */
export function getTestOnlyDemoTemplateSeeds(): DemoRoomTemplateSeed[] {
  return getDemoRoomTemplateSeeds().filter((s) => s.test_only);
}

/** Classic teaching templates also usable from the main Tutor dashboard. */
export function getNormalTeachingTemplateSeeds(): DemoRoomTemplateSeed[] {
  return getDemoRoomTemplateSeeds().filter((s) => !s.test_only);
}

/** Ecological eval vars derived from the same dialogue the website seeds. */
export function buildEcologicalCaseFromSeed(seed: DemoRoomTemplateSeed): EcologicalCaseVars & {
  case_id: string;
  applicable_requirements: string;
  expected_behavior_focus: string;
  template_name: string;
  studentIsWrong?: boolean;
  studentAskedPersonalStory?: boolean;
  studentNeedsSimpleLanguage?: boolean;
} {
  const vars = buildEcologicalCaseVarsFromRoomDialogue(
    seed.title_template,
    seed.description_template,
    seed.pre_populated_dialogue
  );
  return {
    case_id: seed.case_id,
    template_name: seed.template_name,
    applicable_requirements: seed.ai_config_template.behavior_focus.join(', '),
    expected_behavior_focus: seed.expected_behavior_focus,
    studentIsWrong: seed.studentIsWrong,
    studentAskedPersonalStory: seed.studentAskedPersonalStory,
    studentNeedsSimpleLanguage: seed.studentNeedsSimpleLanguage,
    ...vars
  };
}

export function getEcologicalCasesFromTemplates() {
  return getDemoRoomTemplateSeeds().map(buildEcologicalCaseFromSeed);
}

export function toRoomTemplateInsertRow(seed: DemoRoomTemplateSeed) {
  return {
    tutor_id: GLOBAL_TEMPLATE_TUTOR_ID,
    template_name: seed.template_name,
    template_description: seed.template_description,
    title_template: seed.title_template,
    description_template: seed.description_template,
    image_url: seed.image_url,
    pre_populated_dialogue: seed.pre_populated_dialogue,
    ai_config_template: seed.ai_config_template,
    op_config_template: null,
    password_config: null
  };
}

/**
 * File: src/services/demoRoomTemplates.ts
 * Purpose: ensure demo room templates ship improved prompts, realistic multi-turn
 * dialogue, and ecological case vars that match the product packaging path.
 */

import {
  buildCasualPeerAIConfig,
  buildEcologicalCaseFromSeed,
  getDemoRoomTemplateSeeds,
  getNormalTeachingTemplateSeeds,
  getPrivacyTeachingTemplateSeeds,
  getPromptComparisonTemplateSeeds,
  getEcologicalCasesFromTemplates,
  toRoomTemplateInsertRow,
  GLOBAL_TEMPLATE_TUTOR_ID
} from '../demoRoomTemplates';
import fs from 'fs';
import path from 'path';
import { RESPONSE_POLICY } from '../prompts/responsePolicy';
import { ROLE_PARAMETERS } from '../prompts/pedagogy/parameters/roleParameters';
import { SCENARIO_TEMPLATES } from '../detectionTemplates';
import phase0Prompt from '../prompts/phase0AccountSecurityAlertPrompt.json';

describe('demoRoomTemplates', () => {
  it('packages six teaching scenarios with the matching five-target inventory', () => {
    const expectedScenarios = [
      'Account Security Alert',
      'Nintendo Switch Deal ($19.99)',
      'iTunes Gift Card Survey ($500)',
      'Location Sharing Risks',
      'Movie Meetup Social Engineering',
      'Contact Information Exposure'
    ];
    const seeds = getNormalTeachingTemplateSeeds();
    expect(seeds).toHaveLength(6);
    expect(seeds.map((seed) => seed.ai_config_template.scenario)).toEqual(expectedScenarios);
    expect(new Set(seeds.map((seed) => seed.case_id)).size).toBe(6);
    for (const seed of seeds) {
      const config = seed.ai_config_template.prompt_config;
      const scenario = SCENARIO_TEMPLATES[seed.ai_config_template.scenario];
      expect(seed.test_only).toBe(false);
      expect(config.detection_areas).toEqual(scenario.detection_areas);
      expect(config.verification_steps).toEqual(scenario.verification_steps);
      expect(config.detection_areas).toHaveLength(5);
      expect(config.verification_steps).toEqual([]);
    }
  });

  it('retains the production privacy identities and original dialogue metadata in insert rows', () => {
    const seeds = getPrivacyTeachingTemplateSeeds();
    expect(seeds.map((seed) => seed.template_name)).toEqual([
      'Location Sharing Safety', 'Movie Meetup Social Engineering', 'Phone Number Phishing Training'
    ]);
    expect(seeds.map((seed) => seed.description_template)).toEqual([
      "321 Jefferson Ave come hang out guys, I'm bored.",
      'Gonna be at the Regal THIS FRIDAY to see the new Marvel movie! Meet me there at 8 🍿',
      'new phone who dis? my new number is 607-252-6771'
    ]);
    expect(seeds.map((seed) => seed.pre_populated_dialogue.map((message) => [message.user_name, message.message]))).toEqual([
      [['Jasmina Weatherly', "Come hang out! I'm so bored"], ['Friend 1', "Maybe don't share your exact address publicly?"]],
      [['Emily J', "I'll meet you there!"], ['Connor McCormack', 'Sounds like fun!']],
      [['Vanessa Kemp', "KK I'll txt you"], ['Zoe Goodall', 'finally about time you got a new phone']]
    ]);
    expect(seeds.map((seed) => seed.image_url)).toEqual([
      '/images/room-presets/privacy_2.png', '/images/room-presets/privacy_1.png', '/images/room-presets/phishing_1.png'
    ]);
    seeds.forEach((seed, index) => {
      const row = toRoomTemplateInsertRow(seed);
      const opName = ['Jasmina Weatherly', 'Ethan Kozloff', 'Vanessa Kemp'][index];
      expect(row.op_config_template).toEqual({
        op_id: null, op_avatar_url: null, use_custom_op: true,
        custom_op_name: opName, op_display_name: opName
      });
      expect(row.template_description).toBeNull();
      expect(row.password_config).toBeNull();
      expect(row.pre_populated_dialogue).toHaveLength(2);
      expect(row.pre_populated_dialogue.every((message) => message.role === 'student' && message.timestamp === '2025-08-20T06:21:49.877Z')).toBe(true);
      expect(row.pre_populated_dialogue).toEqual(seed.pre_populated_dialogue);
    });
  });

  it('shares account targets across behavior and comparison demo variants', () => {
    const account = SCENARIO_TEMPLATES['Account Security Alert'];
    const seeds = [
      ...getDemoRoomTemplateSeeds().filter((seed) => seed.test_only),
      ...getPromptComparisonTemplateSeeds()
    ];
    for (const seed of seeds) {
      expect(seed.ai_config_template.scenario).toBe('Account Security Alert');
      expect(seed.ai_config_template.prompt_config.detection_areas).toEqual(account.detection_areas);
      expect(seed.ai_config_template.prompt_config.verification_steps).toEqual(account.verification_steps);
      for (const target of [...account.detection_areas, ...account.verification_steps]) {
        expect(seed.ai_config_template.system_prompt).toContain(`- ${target}`);
      }
    }
  });

  it('refreshes Phase 0 knowledge while preserving its frozen policy, examples, and comparison conditions', () => {
    const seeds = getPromptComparisonTemplateSeeds();
    expect(seeds).toHaveLength(6);
    const frozenPrefix = phase0Prompt.system_prompt.split('## Detection Areas to Focus On:')[0];
    const frozenSuffix = phase0Prompt.system_prompt.slice(phase0Prompt.system_prompt.indexOf('Remember: Your goal'));
    for (const seed of seeds.filter((entry) => entry.ai_config_template.prompt_config.prompt_comparison?.version === 'phase0')) {
      const ai = seed.ai_config_template;
      expect(ai.system_prompt.startsWith(frozenPrefix)).toBe(true);
      expect(ai.system_prompt.endsWith(frozenSuffix)).toBe(true);
      expect(ai.system_prompt).not.toBe(phase0Prompt.system_prompt);
      expect(ai.prompt_config.prompt_comparison?.system_prompt_source_commit).toBe(phase0Prompt.source_commit);
      expect(ai.temperature).toBe(0);
      expect(ai.max_tokens).toBe(100);
    }
  });

  it('keeps every demo template usable as an ordinary tutor configuration', () => {
    for (const seed of getDemoRoomTemplateSeeds()) {
      expect(seed.ai_config_template).toBeDefined();
    }
  });

  it('builds an AI config with the shared policy and selected peer role', () => {
    const config = buildCasualPeerAIConfig('Account Security Alert');

    expect(config.enabled).toBe(true);
    expect(config.preset).toBe('casual_peer');
    expect(config.system_prompt).toContain(RESPONSE_POLICY);
    expect(config.system_prompt).toContain(ROLE_PARAMETERS.role.low);
    expect(config.system_prompt).toMatch(/third-person|A person who/i);
    expect(config.prompt_config.detection_areas.length).toBeGreaterThan(0);
  });

  it('uses multi-turn room-like dialogue (OP + peers + tutor + student)', () => {
    const seeds = getDemoRoomTemplateSeeds();
    expect(seeds.length).toBeGreaterThanOrEqual(7);

    seeds.forEach((seed) => {
      expect(seed.pre_populated_dialogue.length).toBeGreaterThanOrEqual(3);
      expect(seed.pre_populated_dialogue.some((m) => m.role === 'others')).toBe(true);
      expect(seed.pre_populated_dialogue.some((m) => m.role === 'tutor')).toBe(true);
      expect(seed.pre_populated_dialogue.some((m) => m.role === 'student')).toBe(true);
      // Not meta practice-room instructions as the only student content
      const lastStudent = [...seed.pre_populated_dialogue]
        .reverse()
        .find((m) => m.role === 'student');
      expect(lastStudent?.message.length).toBeGreaterThan(10);
      expect(seed.description_template.toLowerCase()).not.toContain('practice room:');
      expect(typeof seed.test_only).toBe('boolean');
    });
  });

  it('marks only Demo: catalog entries as test_only for the Test Rooms page', () => {
    const seeds = getDemoRoomTemplateSeeds();
    const testOnly = seeds.filter((s) => s.test_only);
    const normal = seeds.filter((s) => !s.test_only);
    expect(testOnly.every((s) => s.template_name.startsWith('Demo:'))).toBe(true);
    expect(normal.map((s) => s.template_name)).toEqual(
      expect.arrayContaining([
        'Account Security Alert Scam',
        'Nintendo Switch Deal Scam',
        'iTunes Gift Card Survey Scam'
      ])
    );
  });

  it('builds ecological cases with product-shaped history packaging', () => {
    const cases = getEcologicalCasesFromTemplates();
    expect(cases).toHaveLength(getDemoRoomTemplateSeeds().length);

    const lock = cases.find((c) => c.case_id === 'webpage_demo_lock_icon_myth');
    expect(lock).toBeTruthy();
    expect(lock!.scenario_context).toContain('Demo: Lock Icon Myth');
    expect(lock!.student_message).toMatch(/lock icon|HTTPS/i);
    // Product packaging labels
    expect(lock!.conversation_history).toMatch(/Participant:|Tutor\/AI:/);
    expect(lock!.conversation_history).toContain('Student (Alex)');
    expect(lock!.conversation_history).toContain('Others (Socail Media Testdrive)');
  });

  it('keeps correct-student cases on the matching scenario knowledge inventory', () => {
    const seeds = getDemoRoomTemplateSeeds();
    const clickSource = seeds.find((seed) => seed.case_id === 'webpage_demo_click_impulse');
    const clickCorrect = seeds.find((seed) => seed.case_id === 'webpage_demo_correct_safe_action');
    const lockSource = seeds.find((seed) => seed.case_id === 'webpage_demo_lock_icon_myth');
    const lockCorrect = seeds.find((seed) => seed.case_id === 'webpage_demo_correct_lock_reasoning');

    expect(clickCorrect).toBeTruthy();
    expect(lockCorrect).toBeTruthy();
    expect(clickCorrect!.ai_config_template.prompt_config).toEqual(clickSource!.ai_config_template.prompt_config);
    expect(lockCorrect!.ai_config_template.prompt_config).toEqual(lockSource!.ai_config_template.prompt_config);
    expect(clickCorrect!.description_template).toBe(clickSource!.description_template);
    expect(clickCorrect!.pre_populated_dialogue.slice(0, -1).map(({ user_name, role }) => ({ user_name, role }))).toEqual(
      clickSource!.pre_populated_dialogue.slice(0, -1).map(({ user_name, role }) => ({ user_name, role }))
    );
    expect(lockCorrect!.pre_populated_dialogue.slice(0, -1)).toEqual(
      lockSource!.pre_populated_dialogue.slice(0, -1)
    );

    [clickCorrect!, lockCorrect!].forEach((seed) => {
      expect(seed.test_only).toBe(true);
      expect(seed.ai_config_template.model_name).toBe('qwen3.8-flash');
      expect(seed.ai_config_template.prompt_config.detection_areas.length).toBeGreaterThan(0);
      expect(seed.ai_config_template.prompt_config.verification_steps).toEqual([]);
    });
  });

  it('keeps evaluator-only labels out of every product template', () => {
    for (const seed of getDemoRoomTemplateSeeds()) {
      expect(seed).not.toHaveProperty('expected_behavior_focus');
      expect(seed).not.toHaveProperty('studentIsWrong');
      expect(seed).not.toHaveProperty('studentAskedPersonalStory');
      expect(seed).not.toHaveProperty('studentNeedsSimpleLanguage');
      expect(seed.ai_config_template).not.toHaveProperty('behavior_focus');
    }
  });

  it('maps seven unique behavior-room IDs to canonical frozen v1 cases', () => {
    const frozenCases = JSON.parse(fs.readFileSync(
      path.resolve(process.cwd(), '../evals/promptfoo/v1/development-with-guard-scenario-rich.json'),
      'utf8'
    ));
    const frozenById = new Map(frozenCases.map((entry: any) => [entry.id, entry]));
    const behaviorSeeds = getDemoRoomTemplateSeeds().filter((seed) => seed.test_only);
    const ids = behaviorSeeds.map((seed) => seed.case_id);

    expect(ids).toHaveLength(7);
    expect(new Set(ids).size).toBe(7);
    ids.forEach((id) => expect(frozenById.has(id)).toBe(true));

    const guardSeed = behaviorSeeds.find(
      (seed) => seed.case_id === 'ecological_participation_disruption'
    );
    const guardCase: any = frozenById.get('ecological_participation_disruption');
    expect(guardSeed).toBeTruthy();
    const productInput = buildEcologicalCaseFromSeed(guardSeed!);
    expect({
      scenario_context: productInput.scenario_context,
      conversation_history: productInput.conversation_history,
      student_message: productInput.student_message
    }).toEqual({
      scenario_context: guardCase.input.scenario_context,
      conversation_history: guardCase.input.conversation_history,
      student_message: guardCase.input.student_message
    });
    expect(guardSeed!.ai_config_template.prompt_config.detection_areas).toEqual(
      SCENARIO_TEMPLATES['Account Security Alert'].detection_areas
    );
    expect(guardSeed!.ai_config_template.prompt_config.verification_steps).toEqual(
      SCENARIO_TEMPLATES['Account Security Alert'].verification_steps
    );
    expect(guardCase.expected.mode).toBe('guard');
  });

  it('maps seeds to global template insert rows', () => {
    const seed = getDemoRoomTemplateSeeds()[0];
    const row = toRoomTemplateInsertRow(seed);
    expect(row.tutor_id).toBe(GLOBAL_TEMPLATE_TUTOR_ID);
    expect(row.template_name).toBe(seed.template_name);
    expect(row.ai_config_template.preset).toBe('casual_peer');
    expect(row.pre_populated_dialogue).toEqual(seed.pre_populated_dialogue);
  });

  it('keeps case_id stable for each template seed', () => {
    const fromSeed = buildEcologicalCaseFromSeed(getDemoRoomTemplateSeeds()[0]);
    expect(fromSeed.case_id).toBe(getDemoRoomTemplateSeeds()[0].case_id);
    expect(fromSeed.template_name).toBe(getDemoRoomTemplateSeeds()[0].template_name);
  });
});

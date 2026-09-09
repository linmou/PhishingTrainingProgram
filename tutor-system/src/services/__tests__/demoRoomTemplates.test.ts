/**
 * File: src/services/demoRoomTemplates.ts
 * Purpose: ensure demo room templates ship improved prompts, realistic multi-turn
 * dialogue, and ecological case vars that match the product packaging path.
 */

import {
  buildCasualPeerAIConfig,
  buildEcologicalCaseFromSeed,
  getDemoRoomTemplateSeeds,
  getEcologicalCasesFromTemplates,
  toRoomTemplateInsertRow,
  GLOBAL_TEMPLATE_TUTOR_ID
} from '../demoRoomTemplates';
import fs from 'fs';
import path from 'path';

describe('demoRoomTemplates', () => {
  it('builds an AI config with the improved tutoring markers', () => {
    const config = buildCasualPeerAIConfig('Account Security Alert');

    expect(config.enabled).toBe(true);
    expect(config.preset).toBe('casual_peer');
    expect(config.system_prompt).toContain('Ask at most one focused question');
    expect(config.system_prompt).toContain('After a failed question scaffold');
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

  it('derives correct-student ecological cases from the matching database scenarios', () => {
    const seeds = getDemoRoomTemplateSeeds();
    const clickSource = seeds.find((seed) => seed.case_id === 'webpage_demo_click_impulse');
    const clickCorrect = seeds.find((seed) => seed.case_id === 'webpage_demo_correct_safe_action');
    const lockSource = seeds.find((seed) => seed.case_id === 'webpage_demo_lock_icon_myth');
    const lockCorrect = seeds.find((seed) => seed.case_id === 'webpage_demo_correct_lock_reasoning');

    expect(clickCorrect).toBeTruthy();
    expect(lockCorrect).toBeTruthy();
    expect(clickCorrect!.pre_populated_dialogue.slice(0, -1)).toEqual(
      clickSource!.pre_populated_dialogue.slice(0, -1)
    );
    expect(lockCorrect!.pre_populated_dialogue.slice(0, -1)).toEqual(
      lockSource!.pre_populated_dialogue.slice(0, -1)
    );

    [clickCorrect!, lockCorrect!].forEach((seed) => {
      expect(seed.test_only).toBe(true);
      expect(seed.ai_config_template.model_name).toBe('qwen3.5-flash');
      expect(seed.ai_config_template.prompt_config.detection_areas.length).toBeGreaterThan(0);
      expect(seed.ai_config_template.prompt_config.verification_steps.length).toBeGreaterThan(0);
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
      guardCase.inventory.detection_areas
    );
    expect(guardSeed!.ai_config_template.prompt_config.verification_steps).toEqual(
      guardCase.inventory.verification_steps
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

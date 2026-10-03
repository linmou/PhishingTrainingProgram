#!/usr/bin/env node
/** Test responsibility: verify prompt-comparison variants use ai-api with identical non-prompt controls. */

import type { AIAssistantConfig, ConversationMessage } from '../../types';

jest.mock('../supabase', () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

const promptConfig = (version: 'phase0' | 'refined') => ({
  role: { role: 'low' as const },
  communication_style: { teen_slang: 'low' as const, conversational_markers: 'low' as const, uncertainty_expression: 'low' as const },
  cognitive_parameters: { concept_density: 'low' as const, perspective_taking: 'low' as const, personal_examples: 'low' as const, consequence_highlighting: 'low' as const },
  emotional_parameters: { enthusiasm_level: 'low' as const, validation_frequency: 'low' as const, mistake_normalization: 'low' as const, confidence_building: 'low' as const },
  detection_areas: ['Lock icons do not prove identity'],
  verification_steps: ['Open the real app'],
  prompt_comparison: {
    version,
    pair_id: 'lock_icon',
    shared_scenario_context: 'Shared Lock Icon Myth scenario',
    system_prompt_source_commit: version === 'phase0' ? '530bd59' : 'working-tree',
  },
});

const config = (version: 'phase0' | 'refined', systemPrompt: string): AIAssistantConfig => ({
  id: `${version}-config`,
  room_id: `${version}-room`,
  model_name: 'qwen3.5-flash',
  system_prompt: systemPrompt,
  prompt_config: promptConfig(version) as any,
  temperature: 0.17,
  max_tokens: 93,
  is_active: true,
  created_at: '2026-08-30T00:00:00.000Z',
  updated_at: '2026-08-30T00:00:00.000Z',
});

const history: ConversationMessage[] = [{
  role: 'user',
  content: 'Student (Alex): If the site has a lock icon, it should be safe, right?',
  timestamp: 1,
}];

describe('controlled prompt comparison integration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it('sends phase 0 and refined prompt layers through ai-api with equal controls', async () => {
    const { supabase } = await import('../supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    const content = JSON.stringify({
      reason: 'The learner stated a misconception.',
      decision: { mode: 'tutoring', instruction: 'correction' },
      response: 'Captured response',
    });
    invoke.mockResolvedValue({ data: { content, model: 'qwen3.5-flash', finish_reason: 'stop' }, error: null });

    const { TutorSuggestionService } = await import('../aiService');
    const options = {
      focusStudentMessage: 'If the site has a lock icon, it should be safe, right?',
      scenarioContext: 'UI label should be replaced by shared scenario',
    };
    const phase0Result = await TutorSuggestionService.generateSuggestion(history, config('phase0', 'RAW_SYSTEM'), options);
    const refinedResult = await TutorSuggestionService.generateSuggestion(history, config('refined', 'REFINED_SYSTEM'), options);

    expect(phase0Result).toMatchObject({ success: true, suggestion: 'Captured response' });
    expect(refinedResult).toMatchObject({ success: true, suggestion: 'Captured response' });
    expect(invoke).toHaveBeenCalledTimes(2);
    const phase0 = invoke.mock.calls[0][1].body;
    const refined = invoke.mock.calls[1][1].body;
    expect(phase0.temperature).toBe(0.17);
    expect(refined.temperature).toBe(0.17);
    expect(phase0.max_tokens).toBe(93);
    expect(refined.max_tokens).toBe(93);
    expect(phase0.response_format).toEqual({ type: 'json_object' });
    expect(refined.response_format).toEqual({ type: 'json_object' });
    expect(phase0.messages[0].content).toBe('RAW_SYSTEM');
    expect(refined.messages[0].content).toContain('REFINED_SYSTEM');
    expect(JSON.stringify(phase0)).not.toContain('Bearer');
    expect(JSON.stringify(refined)).not.toContain('Bearer');
  });

  it('uses the sole model for direct Qwen calls without a provider URL in React', async () => {
    const { supabase } = await import('../supabase');
    const invoke = supabase.functions.invoke as jest.Mock;
    invoke.mockResolvedValue({ data: { content: 'Captured response', model: 'qwen3.5-flash' }, error: null });

    const { QwenService } = await import('../aiService');
    const result = await QwenService.generateResponse('What should I check?', [], {
      ...config('refined', 'DIRECT_QWEN_SYSTEM'),
      model_name: 'qwen3.5-flash',
      temperature: 0.25,
      max_tokens: 77,
    });

    expect(result).toMatchObject({ model_used: 'qwen3.5-flash', success: true, content: 'Captured response' });
    expect(invoke.mock.calls[0][0]).toBe('ai-api');
    expect(invoke.mock.calls[0][1].body).toMatchObject({ temperature: 0.25, max_tokens: 77, enable_thinking: false });
  });

  it('keeps comparison templates paired and outside the ordinary demo catalog', async () => {
    const templates = await import('../demoRoomTemplates') as any;
    const comparisonSeeds = templates.getPromptComparisonTemplateSeeds();
    expect(comparisonSeeds).toHaveLength(6);
    expect(new Set(comparisonSeeds.map((seed: any) => seed.ai_config_template.prompt_config.prompt_comparison.pair_id)))
      .toEqual(new Set(['lock_icon', 'click_impulse', 'personal_story']));
    expect(comparisonSeeds.map((seed: any) => seed.ai_config_template.prompt_config.prompt_comparison.version).sort())
      .toEqual(['phase0', 'phase0', 'phase0', 'refined', 'refined', 'refined']);
  });
});

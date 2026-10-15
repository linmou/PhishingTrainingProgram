/**
 * File: src/services/checklistGenerationContext.ts
 * Purpose: verify template-to-persisted-config checklist inventories and custom/missing-config boundaries.
 */

import { assessChecklistGenerationContext } from '../checklistGenerationContext';
import { getAIConfig } from '../aiService';
import { ChecklistIntegration } from '../checklistIntegration';
import { supabase } from '../supabase';
import { getNormalTeachingTemplateSeeds, toRoomTemplateInsertRow } from '../demoRoomTemplates';

jest.mock('../aiService', () => ({
  getAIConfig: jest.fn()
}));

jest.mock('../checklistIntegration', () => ({
  ChecklistIntegration: {
    extractFromSystemPromptAsync: jest.fn()
  }
}));

jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn()
  }
}));

describe('checklistGenerationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockEnabledRoom() {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { ai_assistant_enabled: true, ai_assistant_model: 'qwen3.5-flash' },
            error: null
          })
        })
      })
    });
  }

  it.each(getNormalTeachingTemplateSeeds())('carries five $template_name targets from the seed row into checklist context', async (seed) => {
    mockEnabledRoom();
    const row = toRoomTemplateInsertRow(seed);
    const templateConfig = JSON.parse(JSON.stringify(row.ai_config_template));
    (getAIConfig as jest.Mock).mockResolvedValue({
      ...templateConfig,
      id: `ai-${seed.case_id}`,
      room_id: 'new-room',
      is_active: true,
      created_at: '2026-10-15T00:00:00Z',
      updated_at: '2026-10-15T00:00:00Z'
    });

    const context = await assessChecklistGenerationContext('new-room', true);
    expect(context.type).toBe('ready_for_extraction');
    expect(context.aiConfigId).toBe(`ai-${seed.case_id}`);
    expect(context.detectionAreas).toEqual(templateConfig.prompt_config.detection_areas);
    expect(context.verificationSteps).toEqual([]);
    const targets = [...context.detectionAreas!, ...context.verificationSteps!];
    expect(targets).toHaveLength(5);
    expect(new Set(targets).size).toBe(5);
    expect(ChecklistIntegration.extractFromSystemPromptAsync).not.toHaveBeenCalled();
  });

  it('retains a custom inventory above five and filters only blank entries', async () => {
    mockEnabledRoom();
    const detectionAreas = Array.from({ length: 6 }, (_, index) => `Custom target ${index + 1}`);
    const verificationSteps = ['Custom target 7', 'Custom target 8'];
    (getAIConfig as jest.Mock).mockResolvedValue({
      id: 'custom-config',
      system_prompt: '',
      prompt_config: {
        detection_areas: [...detectionAreas, ' '],
        verification_steps: ['', ...verificationSteps]
      }
    });

    const context = await assessChecklistGenerationContext('custom-room', true);
    expect(context.type).toBe('ready_for_extraction');
    expect(context.detectionAreas).toEqual([...detectionAreas, ...verificationSteps]);
    expect(context.detectionAreas).toHaveLength(8);
    expect(context.verificationSteps).toEqual([]);
    expect(ChecklistIntegration.extractFromSystemPromptAsync).not.toHaveBeenCalled();
  });

  it('reports a missing persisted configuration when room context is required', async () => {
    mockEnabledRoom();
    (getAIConfig as jest.Mock).mockResolvedValue(null);
    expect(await assessChecklistGenerationContext('missing-config-room', true)).toEqual({ type: 'no_ai_config' });
    expect(ChecklistIntegration.extractFromSystemPromptAsync).not.toHaveBeenCalled();
  });

  it('reports an empty prompt when both persisted lists contain only blanks', async () => {
    mockEnabledRoom();
    (getAIConfig as jest.Mock).mockResolvedValue({
      id: 'empty-config', system_prompt: ' ',
      prompt_config: { detection_areas: [''], verification_steps: [' '] }
    });
    expect(await assessChecklistGenerationContext('empty-room', true)).toEqual({
      type: 'empty_system_prompt', aiConfigId: 'empty-config'
    });
    expect(ChecklistIntegration.extractFromSystemPromptAsync).not.toHaveBeenCalled();
  });

  it('uses the extracted single inventory when persisted targets are absent', async () => {
    mockEnabledRoom();
    (getAIConfig as jest.Mock).mockResolvedValue({
      id: 'prompt-config', system_prompt: 'Source learning content',
      prompt_config: { detection_areas: [], verification_steps: [] }
    });
    const targets = ['Target one', 'Target two'];
    (ChecklistIntegration.extractFromSystemPromptAsync as jest.Mock).mockResolvedValue({ detection_areas: targets });

    expect(await assessChecklistGenerationContext('prompt-room', true)).toEqual({
      type: 'ready_for_extraction', systemPrompt: 'Source learning content',
      detectionAreas: targets, verificationSteps: [], aiConfigId: 'prompt-config'
    });
    expect(ChecklistIntegration.extractFromSystemPromptAsync).toHaveBeenCalledWith('Source learning content');
  });

  it('reports an empty inventory when the provider cannot extract targets', async () => {
    mockEnabledRoom();
    (getAIConfig as jest.Mock).mockResolvedValue({ id: 'failed-config', system_prompt: 'Source learning content' });
    (ChecklistIntegration.extractFromSystemPromptAsync as jest.Mock).mockResolvedValue({ detection_areas: [] });
    expect(await assessChecklistGenerationContext('failed-room', true)).toEqual({
      type: 'empty_system_prompt', systemPrompt: 'Source learning content', aiConfigId: 'failed-config'
    });
  });

  it('prefers persisted prompt_config detection areas over re-extracting the generic system prompt', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              ai_assistant_enabled: true,
              ai_assistant_model: 'gpt-4o-mini'
            },
            error: null
          })
        })
      })
    });

    (getAIConfig as jest.Mock).mockResolvedValue({
      id: 'ai-config-1',
      room_id: 'room-1',
      model_name: 'gpt-4o-mini',
      system_prompt: 'Generic saved prompt',
      prompt_config: {
        role: { role: 'high' },
        communication_style: {
          teen_slang: 'low',
          conversational_markers: 'low',
          uncertainty_expression: 'low'
        },
        cognitive_parameters: {
          concept_density: 'high',
          perspective_taking: 'high',
          personal_examples: 'high',
          consequence_highlighting: 'high'
        },
        emotional_parameters: {
          enthusiasm_level: 'low',
          validation_frequency: 'high',
          mistake_normalization: 'high',
          confidence_building: 'high'
        },
        detection_areas: ['Suspicious links', 'Urgent pressure', 'Hover links', 'Verify sender domain'],
        verification_steps: []
      },
      temperature: 0.7,
      max_tokens: 150,
      is_active: true,
      created_at: '2026-04-02T00:00:00Z',
      updated_at: '2026-04-02T00:00:00Z'
    });

    const context = await assessChecklistGenerationContext('room-1');

    expect(context).toEqual({
      type: 'ready_for_extraction',
      systemPrompt: 'Generic saved prompt',
      detectionAreas: [
        'Suspicious links',
        'Urgent pressure',
        'Hover links',
        'Verify sender domain'
      ],
      verificationSteps: [],
      aiConfigId: 'ai-config-1'
    });
    expect(ChecklistIntegration.extractFromSystemPromptAsync).not.toHaveBeenCalled();
  });
});

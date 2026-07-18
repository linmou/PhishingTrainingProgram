#!/usr/bin/env node
/**
 * Test responsible for checklistGenerationContext.ts using persisted AI prompt_config detection areas before falling back to system prompt extraction.
 */

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

import { assessChecklistGenerationContext } from '../checklistGenerationContext';
import { getAIConfig } from '../aiService';
import { ChecklistIntegration } from '../checklistIntegration';
import { supabase } from '../supabase';

describe('checklistGenerationContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
        detection_areas: ['Suspicious links', 'Urgent pressure'],
        verification_steps: ['Hover links', 'Verify sender domain']
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
        'Urgent pressure'
      ],
      verificationSteps: [
        'Hover links',
        'Verify sender domain'
      ],
      aiConfigId: 'ai-config-1'
    });
    expect(ChecklistIntegration.extractFromSystemPromptAsync).not.toHaveBeenCalled();
  });
});

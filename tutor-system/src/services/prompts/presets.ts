/**
 * Preset configurations for common AI assistant scenarios
 */

import { SystemPromptConfig } from './types';

export const PRESET_CONFIGS: Record<string, Omit<SystemPromptConfig, 'detection_areas' | 'verification_steps'>> = {
  casual_peer: {
    role: 'peer' as const,
    communication_style: {
      teen_slang: 'high' as const,
      conversational_markers: 'high' as const,
      uncertainty_expression: 'high' as const
    },
    cognitive_parameters: {
      concept_density: 'low' as const,
      perspective_taking: 'high' as const,
      personal_examples: 'high' as const,
      consequence_highlighting: 'low' as const
    },
    emotional_parameters: {
      enthusiasm_level: 'high' as const,
      validation_frequency: 'high' as const,
      mistake_normalization: 'high' as const,
      confidence_building: 'high' as const
    }
  },
  
  supportive_adult: {
    role: 'trusted_adult' as const,
    communication_style: {
      teen_slang: 'low' as const,
      conversational_markers: 'low' as const,
      uncertainty_expression: 'low' as const
    },
    cognitive_parameters: {
      concept_density: 'high' as const,
      perspective_taking: 'high' as const,
      personal_examples: 'high' as const,
      consequence_highlighting: 'high' as const
    },
    emotional_parameters: {
      enthusiasm_level: 'low' as const,
      validation_frequency: 'high' as const,
      mistake_normalization: 'high' as const,
      confidence_building: 'high' as const
    }
  }
};
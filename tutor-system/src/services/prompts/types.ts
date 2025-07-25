/**
 * TypeScript type definitions for system prompt configuration
 */

export interface SystemPromptConfig {
  role: 'peer' | 'trusted_adult';
  communication_style: {
    teen_slang: 'low' | 'high';
    conversational_markers: 'low' | 'high';
    uncertainty_expression: 'low' | 'high';
  };
  cognitive_parameters: {
    concept_density: 'low' | 'high';
    perspective_taking: 'low' | 'high';
    personal_examples: 'low' | 'high';
    consequence_highlighting: 'low' | 'high';
  };
  emotional_parameters: {
    enthusiasm_level: 'low' | 'high';
    validation_frequency: 'low' | 'high';
    mistake_normalization: 'low' | 'high';
    confidence_building: 'low' | 'high';
  };
  detection_areas: string[];
  verification_steps: string[];
}

export interface ParameterConfig {
  low: string;
  high: string;
}

export interface ScaffoldingTechnique {
  description: string;
  examples: string[];
}

export interface LearningStage {
  name: string;
  prompt: string;
  purpose: string;
}
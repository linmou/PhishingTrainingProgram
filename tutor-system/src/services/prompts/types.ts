/**
 * TypeScript type definitions for system prompt configuration
 */

export interface StudentToneLock {
  locked: true;
  chosen_by_user_id: string;
  chosen_role: 'low' | 'high';
}

export interface SystemPromptConfig {
  role: {
    role: 'low' | 'high';
  };
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
  /** Present when a student claimed peer/adult tone (1:1 rooms). Ignored by prompt text generation. */
  student_tone_lock?: StudentToneLock | null;
}

export interface ParameterConfig {
  low: string;
  high: string;
  // Optional custom labels for the options (defaults to 'low'/'high')
  labels?: {
    low: string;
    high: string;
  };
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

/**
 * Dynamic configuration interface that determines which parameters are available for selection
 * Structure is automatically generated from the parameter files in the pedagogy/parameters folder
 */
export interface ParameterSelectionConfig {
  role?: {
    enabled: boolean;
    options: string[];
  };
  [categoryKey: string]: {
    enabled: boolean;
    parameters?: Record<string, boolean>;
    options?: string[];
  } | undefined;
}

/**
 * Dynamic parameter overrides interface
 * Structure is flexible and based on what's actually loaded from parameter files
 */
export interface DynamicParameterOverrides {
  role?: {
    role: 'low' | 'high';
  };
  [categoryKey: string]: any;
}

/**
 * Note: DEFAULT_PARAMETER_SELECTION is now dynamically generated 
 * in dynamicParameterLoader.ts as DYNAMIC_PARAMETER_SELECTION
 * This ensures it automatically includes all parameters from the prompts folder
 */
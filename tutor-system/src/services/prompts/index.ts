/**
 * Main system prompt generation with modular architecture
 * All parameters are treated equally in the new architecture
 */

import { SystemPromptConfig } from './types';
import { BASE_SYSTEM_PROMPT } from './basePrompt';
import { ROLE_PARAMETERS } from './parameters/roleParameters';
import { COMMUNICATION_STYLES } from './parameters/communicationStyles';
import { COGNITIVE_PARAMETERS } from './parameters/cognitiveParameters';
import { EMOTIONAL_PARAMETERS } from './parameters/emotionalParameters';
import { LEARNING_STAGES } from './education/learningStages';
import { SCAFFOLDING_TECHNIQUES } from './education/scaffoldingTechniques';
import { SCAM_DETECTION_RULES, PRIVACY_PROTECTION_RULES } from './education/detectionRules';

/**
 * Generates a complete system prompt based on configuration
 * Now treats roles as parameters with intensity levels like other components
 */
export function generateSystemPrompt(config: SystemPromptConfig): string {
  const sections = [
    BASE_SYSTEM_PROMPT,
    
    // Roles are now treated as parameters with low/high intensity
    ROLE_PARAMETERS[config.role].high, // Default to high intensity for compatibility
    
    "## Communication Style:",
    COMMUNICATION_STYLES.teen_slang[config.communication_style.teen_slang],
    COMMUNICATION_STYLES.conversational_markers[config.communication_style.conversational_markers],
    COMMUNICATION_STYLES.uncertainty_expression[config.communication_style.uncertainty_expression],
    
    "## Cognitive Approach:",
    COGNITIVE_PARAMETERS.concept_density[config.cognitive_parameters.concept_density],
    COGNITIVE_PARAMETERS.perspective_taking[config.cognitive_parameters.perspective_taking],
    COGNITIVE_PARAMETERS.personal_examples[config.cognitive_parameters.personal_examples],
    COGNITIVE_PARAMETERS.consequence_highlighting[config.cognitive_parameters.consequence_highlighting],
    
    "## Emotional Approach:",
    EMOTIONAL_PARAMETERS.enthusiasm_level[config.emotional_parameters.enthusiasm_level],
    EMOTIONAL_PARAMETERS.validation_frequency[config.emotional_parameters.validation_frequency],
    EMOTIONAL_PARAMETERS.mistake_normalization[config.emotional_parameters.mistake_normalization],
    EMOTIONAL_PARAMETERS.confidence_building[config.emotional_parameters.confidence_building],
    
    SCAM_DETECTION_RULES,
    PRIVACY_PROTECTION_RULES,
    
    "## Detection Areas to Focus On:",
    ...config.detection_areas.map(area => `- ${area}`),
    
    "## Verification Steps to Teach:",
    ...config.verification_steps.map(step => `- ${step}`),
    
    "## Learning Process:",
    "Always follow the 3-stage learning process:",
    "1. Get their first reaction without influencing them",
    "2. Ask why they think that - understand their reasoning",
    "3. Fill knowledge gaps using appropriate scaffolding techniques",
    
    "## Available Scaffolding Techniques:",
    "Use these techniques based on what the student needs:",
    Object.entries(SCAFFOLDING_TECHNIQUES).map(([key, technique]) => 
      `**${key.charAt(0).toUpperCase() + key.slice(1)}**: ${technique.description}`
    ).join('\n'),
    
    "Remember: Your goal is to help teens develop critical thinking skills for online safety through guided discovery and supportive learning."
  ];
  
  return sections.filter(Boolean).join('\n\n');
}

// Re-export all the components for direct access if needed
export { ROLE_PARAMETERS } from './parameters/roleParameters';
export { COMMUNICATION_STYLES } from './parameters/communicationStyles';
export { COGNITIVE_PARAMETERS } from './parameters/cognitiveParameters';
export { EMOTIONAL_PARAMETERS } from './parameters/emotionalParameters';
export { LEARNING_STAGES } from './education/learningStages';
export { SCAFFOLDING_TECHNIQUES } from './education/scaffoldingTechniques';
export { SCAM_DETECTION_RULES, PRIVACY_PROTECTION_RULES } from './education/detectionRules';
export { PRESET_CONFIGS } from './presets';
export * from './types';
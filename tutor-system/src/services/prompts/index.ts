/**
 * Main system prompt generation with separated pedagogy and content architecture
 * Pedagogical methods are universal, content is subject-specific
 */

import { SystemPromptConfig } from './types';

// PEDAGOGICAL METHODS (Universal - reusable across subjects)
import { ROLE_PARAMETERS } from './pedagogy/parameters/roleParameters';
import { COMMUNICATION_STYLES } from './pedagogy/parameters/communicationStyles';
import { COGNITIVE_PARAMETERS } from './pedagogy/parameters/cognitiveParameters';
import { EMOTIONAL_PARAMETERS } from './pedagogy/parameters/emotionalParameters';


/**
 * TEMPORARY (2026-11-14): communication, cognitive and emotional style parameters are
 * deactivated to remove their answer-disclosing and multi-target examples as experimental
 * factors while knowledge-point jumping is diagnosed. Set true once that issue is resolved.
 * Room configuration still stores the values; only their prompt text is omitted.
 */
export const ACTIVATE_STYLE_PARAMETER = false;

function styleParameterSections(config: SystemPromptConfig): string[] {
  if (!ACTIVATE_STYLE_PARAMETER) return [];
  return [
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
  ];
}

/**
 * Generates a complete system prompt based on configuration
 * Now treats roles as parameters with intensity levels like other components
 */
export function generateSystemPrompt(config: SystemPromptConfig): string {
  // Room-specific content only. The tutor policy, including teaching rules, is appended once by
  // buildEcologicalChatCompletionMessages from prompts/activeTutorAgentPrompt.ts.
  const sections = [
    ROLE_PARAMETERS.role[config.role?.role || 'high'],

    ...styleParameterSections(config),

    "## Detection Areas to Focus On:",
    ...config.detection_areas.map(area => `- ${area}`),

    "## Verification Steps to Teach:",
    ...config.verification_steps.map(step => `- ${step}`),
  ];

  return sections.filter(Boolean).join('\n\n');
}

// Export only what's actually used by the codebase
export { PRESET_CONFIGS } from './presets';
export * from './types';

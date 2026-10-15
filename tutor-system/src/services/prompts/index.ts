/**
 * Main system prompt generation with separated pedagogy and content architecture
 * Pedagogical methods are universal, content is subject-specific
 */

import { SystemPromptConfig } from './types';
import { BASE_SYSTEM_PROMPT } from './basePrompt';

// PEDAGOGICAL METHODS (Universal - reusable across subjects)
import { ROLE_PARAMETERS } from './pedagogy/parameters/roleParameters';
import { COMMUNICATION_STYLES } from './pedagogy/parameters/communicationStyles';
import { COGNITIVE_PARAMETERS } from './pedagogy/parameters/cognitiveParameters';
import { EMOTIONAL_PARAMETERS } from './pedagogy/parameters/emotionalParameters';
import { SCAFFOLDING_TECHNIQUES } from './pedagogy/techniques/scaffoldingTechniques';

// CONTENT (Subject-specific - currently cybersecurity)
import { SCAM_DETECTION_RULES, PRIVACY_PROTECTION_RULES } from './content/cybersecurity/detectionRules';
import { RESPONSE_POLICY } from './responsePolicy';

/**
 * Generates a complete system prompt based on configuration
 * Now treats roles as parameters with intensity levels like other components
 */
export function generateSystemPrompt(config: SystemPromptConfig): string {
  const sections = [
    BASE_SYSTEM_PROMPT,

    // Role parameter now follows the same low/high pattern as other parameters
    ROLE_PARAMETERS.role[config.role?.role || 'high'], // Use the configured role intensity

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

    "## Learning Process:",
    RESPONSE_POLICY,

    "## Reading Level:",
    "Use short sentences and familiar words for younger or confused students. Explain unfamiliar terms while preserving the factual meaning and the learner's reasoning task.",

    "## Available Teaching Methods:",
    "These are general teaching methods, not decision.instruction labels. Select the declared instructional action using the tutor decision policy:",
    Object.entries(SCAFFOLDING_TECHNIQUES).map(([key, technique]) =>
      `**${key.charAt(0).toUpperCase() + key.slice(1)}**: ${technique.description}`
    ).join('\n'),

    "## Subject Content - Cybersecurity:",
    "You are teaching cybersecurity: help students understand and recognize scams and privacy protection.",

    "### Scam Detection Framework:",
    SCAM_DETECTION_RULES,

    "### Privacy Protection Guidelines:",
    PRIVACY_PROTECTION_RULES,

    "## Detection Areas to Focus On:",
    ...config.detection_areas.map(area => `- ${area}`),

    "## Verification Steps to Teach:",
    ...config.verification_steps.map(step => `- ${step}`),

    "## Default Safe Actions:",
    "- Do not click suspicious links.",
    "- Open the real app or type the real company website yourself.",
    "- Check account settings, security alerts, or recent login activity in the real account.",
    "- If the alert is about a bank or parent account, use the real banking app/site or the phone number on the card.",
    "- A lock icon or HTTPS does not prove the site is real. Scammers can use them too.",

    "Remember: Your goal is to help teens develop critical thinking skills for online safety through direct teaching, practical checks, and restrained support."
  ];

  return sections.filter(Boolean).join('\n\n');
}

// Export only what's actually used by the codebase
export { PRESET_CONFIGS } from './presets';
export * from './types';

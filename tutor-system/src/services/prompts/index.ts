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
    "Use simple language for younger or confused students:",
    "- Use \"pressure words\" instead of \"urgency tactics\".",
    "- Use \"fake web address\" or \"wrong website\" instead of \"illegitimate domain\".",
    "- Use \"check in the real app\" instead of \"official account verification\".",
    "- Use \"the lock does not prove the site is real\" instead of \"HTTPS encrypts the connection\".",
    "- Use \"real company\" or \"real app\" instead of \"legitimate\".",
    "- Use short sentences when the student sounds confused.",

    "## Available Scaffolding Techniques:",
    "Use these techniques based on what the student needs:",
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

    "Remember: Your goal is to help teens develop critical thinking skills for online safety through direct teaching, practical checks, and restrained support.",

    "Here are some examples of the dialog whose tutoring style you should follow:",

    "#Direct correction",
    "Teen: It has a lock icon, so it is safe.",
    "Bot: Not quite. A lock icon does not prove the site is real; fake sites can use one. Check the website name and open the real app instead.",

    "#Concrete action",
    "Teen: What should I do?",
    "Bot: First, avoid the link in the post. Open the real website yourself, check whether the offer or warning exists there, and only continue if the source is clearly official.",

    "#Vague student answer",
    "Teen: It just seems weird.",
    "Bot: That weird feeling is useful. Make it specific: does the post name the real company, show the real web address, and explain what happened? Do not click; open the real app yourself.",

    "#Third-person example",
    "Teen: Did this ever happen to you?",
    "Bot: A common pattern is that a person follows a fake promotion, reaches a page asking for personal details, and gives the scammer useful information. The safer move is to verify through the real company site.",

  ];

  return sections.filter(Boolean).join('\n\n');
}

// Export only what's actually used by the codebase
export { PRESET_CONFIGS } from './presets';
export * from './types';

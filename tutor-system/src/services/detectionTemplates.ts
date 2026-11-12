/**
 * Learning targets copied verbatim from General Learning Goals.docx.
 * Standard teaching scenarios retain the document's four- or five-point inventory.
 */

import generalLearningGoals from './generalLearningGoals.json';

export const SCENARIO_TEMPLATES = {
  "Nintendo Switch Deal ($19.99)": {
    detection_areas: generalLearningGoals.scenarios["Nintendo Switch Deal ($19.99)"].learning_points,
    verification_steps: [] as string[],
    type: 'scam'
  },
  "iTunes Gift Card Survey ($500)": {
    detection_areas: generalLearningGoals.scenarios["iTunes Gift Card Survey ($500)"].learning_points,
    verification_steps: [] as string[],
    type: 'scam'
  },
  "Account Security Alert": {
    detection_areas: generalLearningGoals.scenarios["Account Security Alert"].learning_points,
    verification_steps: [] as string[],
    type: 'scam'
  },
  "General Scam Indicators": {
    detection_areas: [
      "Judge whether an offer is plausible: prices or rewards that are too good to be true, and a business reason that does not add up (why would they give this away?).",
      "Identify urgent or pressuring language designed to push quick action before the offer can be checked.",
      "Check the sender and link: generic usernames, missing official branding, and shortened or mismatched URLs do not establish authenticity.",
      "Recognize requests for personal information or passwords as a warning sign, and withhold them until the request is verified.",
      "Verify the offer through an official channel reached independently, such as the company's own website or logging in directly, or ask a trusted adult, before acting."
    ],
    verification_steps: [] as string[],
    type: 'scam'
  },
  "Location Sharing Risks": {
    detection_areas: generalLearningGoals.scenarios["Location Sharing Risks"].learning_points,
    verification_steps: [] as string[],
    type: 'privacy'
  },
  "Movie Meetup Social Engineering": {
    detection_areas: generalLearningGoals.scenarios["Movie Meetup Social Engineering"].learning_points,
    verification_steps: [] as string[],
    type: 'privacy'
  },
  "Contact Information Exposure": {
    detection_areas: generalLearningGoals.scenarios["Contact Information Exposure"].learning_points,
    verification_steps: [] as string[],
    type: 'privacy'
  },
};

export type ScenarioTemplate = keyof typeof SCENARIO_TEMPLATES;

export function isScenarioTemplate(value: unknown): value is ScenarioTemplate {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(SCENARIO_TEMPLATES, value);
}

/** Reject invalid template references before materializing a room configuration. */
export function requireScenarioTemplate(value: unknown): ScenarioTemplate {
  if (!isScenarioTemplate(value)) {
    throw new Error(`Unknown or missing scenario reference: ${String(value)}`);
  }
  return value;
}

/** One shared target inventory for every Cyberbullying scenario. */
export const CYBERBULLYING_TARGET_VERSION = 'cyberbullying_doc_20261112';
export const CYBERBULLYING_LEARNING_TARGETS = generalLearningGoals.cyberbullying;

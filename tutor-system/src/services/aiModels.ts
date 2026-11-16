/**
 * Frontend model metadata. scripts/react-scripts.js bridges OAI_MODEL to REACT_APP_OAI_MODEL.
 * Read only REACT_APP_* names here: referencing any other process.env key makes the CRA build
 * inline the whole environment object, exposing every REACT_APP_* value in the public bundle.
 */
export const OAI_MODEL = process.env.REACT_APP_OAI_MODEL?.trim() || '';

export type AIModelName = string;

export const AI_MODELS: Record<string, {
  name: string;
  description: string;
  maxTokens: number;
  temperature: number;
}> = OAI_MODEL ? {
  [OAI_MODEL]: {
    name: OAI_MODEL,
    description: 'Configured tutoring model',
    maxTokens: 4000,
    temperature: 0.7,
  },
} : {};

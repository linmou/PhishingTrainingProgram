/** Frontend model metadata. The build exposes only OAI_MODEL, never provider credentials. */
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

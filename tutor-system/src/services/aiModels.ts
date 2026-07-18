/**
 * Shared AI model catalog and default.
 * Purpose: single source for DEFAULT_AI_MODEL without circular imports.
 */

export const AI_MODELS = {
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: 'Fast, low-cost model for everyday tutoring responses',
    maxTokens: 4000,
    temperature: 0.7,
  },
  'gpt-4o': {
    name: 'GPT-4o',
    description: 'Most capable multimodal model for complex reasoning',
    maxTokens: 4000,
    temperature: 0.7,
  },
  'gpt-4': {
    name: 'GPT-4',
    description: 'Highly capable model for complex reasoning',
    maxTokens: 4000,
    temperature: 0.7,
  },
} as const;

export type AIModelName = keyof typeof AI_MODELS;

/** Cheap default when a room has no model configured. */
export const DEFAULT_AI_MODEL: AIModelName = 'gpt-4o-mini';

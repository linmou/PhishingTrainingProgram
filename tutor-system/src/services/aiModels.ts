/**
 * Shared AI model catalog and default.
 * Purpose: single source for DEFAULT_AI_MODEL without circular imports.
 */

export const AI_MODELS = {
  'qwen3.5-flash': {
    name: 'Qwen3.5 Flash',
    description: 'Fast Qwen model for concise tutoring responses',
    maxTokens: 4000,
    temperature: 0.7,
  },
} as const;

export type AIModelName = keyof typeof AI_MODELS;

/** Sole supported model when a room has no model configured. */
export const DEFAULT_AI_MODEL: AIModelName = 'qwen3.5-flash';

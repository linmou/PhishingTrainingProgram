/**
 * File: src/services/aiService.ts
 * Purpose: Ensure the default AI model is a cheap, available GPT fallback (not retired gpt-4o).
 */
import { AI_MODELS, DEFAULT_AI_MODEL } from '../aiModels';
// Re-export surface still available from aiService for app imports
import { DEFAULT_AI_MODEL as DEFAULT_FROM_SERVICE } from '../aiService';

describe('AI default model', () => {
  it('defaults to gpt-4o-mini and includes it in selectable models', () => {
    expect(DEFAULT_AI_MODEL).toBe('gpt-4o-mini');
    expect(DEFAULT_FROM_SERVICE).toBe('gpt-4o-mini');
    expect(AI_MODELS[DEFAULT_AI_MODEL]).toBeDefined();
    expect(AI_MODELS[DEFAULT_AI_MODEL].name).toMatch(/mini/i);
  });
});

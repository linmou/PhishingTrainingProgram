/**
 * File: src/services/aiService.ts
 * Purpose: Ensure Qwen3.5 Flash is the sole selectable and default AI model.
 */
import { AI_MODELS, DEFAULT_AI_MODEL } from '../aiModels';
// Re-export surface still available from aiService for app imports
import { DEFAULT_AI_MODEL as DEFAULT_FROM_SERVICE } from '../aiService';

describe('AI default model', () => {
  it('defaults to qwen3.5-flash and includes only that model in selectable models', () => {
    expect(DEFAULT_AI_MODEL).toBe('qwen3.5-flash');
    expect(DEFAULT_FROM_SERVICE).toBe('qwen3.5-flash');
    expect(AI_MODELS[DEFAULT_AI_MODEL]).toBeDefined();
    expect(AI_MODELS[DEFAULT_AI_MODEL].name).toBe('Qwen3.5 Flash');
    expect(Object.keys(AI_MODELS)).toEqual(['qwen3.5-flash']);
  });
});

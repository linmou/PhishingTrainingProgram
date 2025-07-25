/**
 * System Prompts - Main Export File
 * This file now imports from the modular prompt structure
 */

// Re-export everything from the new modular structure
export * from './prompts/index';

// For backward compatibility, also export the main function and common exports
export { generateSystemPrompt, PRESET_CONFIGS } from './prompts/index';
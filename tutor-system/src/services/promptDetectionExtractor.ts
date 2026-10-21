/**
 * Read the configured LLM's learning-target extraction for checklist callers.
 */

import { LLMExtractionService } from './llmExtractionService';

export async function extractDetectionAreasFromPromptAsync(systemPrompt: string): Promise<string[]> {
  if (!systemPrompt.trim()) {
    return [];
  }

  try {
    const extraction = await LLMExtractionService.extractFromSystemPrompt(systemPrompt);
    return extraction.detection_areas;
  } catch (error) {
    console.warn('Learning-target extraction failed:', error);
    return [];
  }
}

export function promptUserForDetectionAreas(detectionAreas: string[]): string | null {
  return detectionAreas.length === 0
    ? 'No learning targets found in the system prompt. Please add specific learning targets to the checklist.'
    : null;
}

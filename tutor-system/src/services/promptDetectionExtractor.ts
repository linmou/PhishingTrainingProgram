/**
 * Simplified extraction using LLM service
 * Replaces complex pattern matching with AI-powered analysis
 */

import { LLMExtractionService } from './llmExtractionService';

/**
 * Synchronous version for backward compatibility
 * Uses simple pattern matching for structured sections
 */
export function extractDetectionAreasFromPrompt(systemPrompt: string): string[] {
  if (!systemPrompt || systemPrompt.trim().length === 0) {
    return [];
  }
  
  const detectionAreasMatch = systemPrompt.match(/## Detection Areas to Focus On:([\s\S]*?)(?=##|$)/);
  
  if (!detectionAreasMatch) {
    return [];
  }
  
  const detectionAreasSection = detectionAreasMatch[1];
  const lines = detectionAreasSection.split('\n');
  
  const detectionAreas: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    // Match lines starting with - or * followed by content
    const listItemMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    if (listItemMatch) {
      detectionAreas.push(listItemMatch[1].trim());
    }
  }
  
  return detectionAreas;
}

/**
 * Async LLM-based extraction (preferred method)
 */
export async function extractDetectionAreasFromPromptAsync(systemPrompt: string): Promise<string[]> {
  if (!systemPrompt || systemPrompt.trim().length === 0) {
    return [];
  }
  
  try {
    const extraction = await LLMExtractionService.extractFromSystemPrompt(systemPrompt);
    
    // Combine understanding and behavior items, removing prefixes for detection areas
    const allItems = [...extraction.understanding, ...extraction.behavior];
    return allItems.map(item => 
      item.replace(/^\[understanding\]\s*/, '').replace(/^\[behavior\]\s*/, '')
    );
    
  } catch (error) {
    console.warn('LLM extraction failed, using fallback:', error);
    return extractDetectionAreasFromPrompt(systemPrompt);
  }
}

/**
 * Returns a user prompt when no detection areas are found, null otherwise
 */
export function promptUserForDetectionAreas(detectionAreas: string[]): string | null {
  if (detectionAreas.length === 0) {
    return `No detection areas found in the system prompt. Please add a checklist with specific detection areas to focus on during the tutoring session.`;
  }
  
  return null;
}
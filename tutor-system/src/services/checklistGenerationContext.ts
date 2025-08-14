/**
 * Checklist Generation Context Assessment
 * Determines the best approach for generating checklists based on room configuration
 * TDD Green Phase: Minimal implementation to pass tests
 */

import { getAIConfig } from './aiService';
import { ChecklistIntegration } from './checklistIntegration';

export interface ChecklistGenerationContext {
  type: 'no_ai_config' | 'empty_system_prompt' | 'ready_for_extraction';
  systemPrompt?: string;
  aiConfigId?: string;
  detectionAreas?: string[];
  error?: Error;
}

/**
 * Assess the context for checklist generation
 * Determines what options should be presented to the user
 */
export async function assessChecklistGenerationContext(roomId: string): Promise<ChecklistGenerationContext> {
  try {
    // Try to get AI configuration
    const aiConfig = await getAIConfig(roomId);
    
    if (!aiConfig) {
      return { type: 'no_ai_config' };
    }
    
    // Get system prompt (handle null/undefined)
    const systemPrompt = aiConfig.system_prompt || '';
    
    // Try to extract detection areas using unified extraction
    const extraction = ChecklistIntegration.extractFromSystemPrompt(systemPrompt);
    const totalItems = extraction.understanding.length + extraction.behavior.length;
    
    if (totalItems === 0) {
      return {
        type: 'empty_system_prompt',
        systemPrompt,
        aiConfigId: aiConfig.id
      };
    }
    
    const allItems = [...extraction.understanding, ...extraction.behavior];
    return {
      type: 'ready_for_extraction',
      systemPrompt,
      detectionAreas: allItems
    };
    
  } catch (error) {
    return {
      type: 'no_ai_config',
      error: error instanceof Error ? error : new Error('Unknown error')
    };
  }
}
/**
 * Integrates prompt detection extraction with checklist generation
 * TDD Green Phase: Minimal implementation to pass tests
 * Updated to support LLM extraction and cognitive/behavioral categorization
 */

import { SessionChecklist, ChecklistItem } from '../types/checklist';
import { LLMExtractionService } from './llmExtractionService';

export interface ChecklistGenerationResult {
  success: boolean;
  checklist: SessionChecklist | null;
  userPrompt: string | null;
}

export interface ExtractionResult {
  understanding: string[];
  behavior: string[];
}

// All pattern-based extraction removed - using LLM-based extraction exclusively

// Removed pattern-based extraction functions - all extraction now uses LLM

/**
 * Creates ChecklistItem objects from text arrays with unified metadata
 */
function createChecklistItems(texts: string[], itemType: 'detection_area' | 'verification_step'): ChecklistItem[] {
  return texts.map((text, index) => ({
    id: `${itemType}-${index}`,
    area_text: text,
    item_type: itemType,
    priority: 'important' as const,
    status: 'pending' as const,
    understanding_level: 'none' as const,
    tutor_notes: '',
    last_addressed: null,
    attempts_count: 0,
    original_template_area: true,
    coverage_evidence: [],
    created_at: new Date(),
    updated_at: new Date()
  }));
}

/**
 * Returns a user prompt when no detection areas are found, null otherwise
 */
function _promptUserForDetectionAreas(detectionAreas: string[]): string | null {
  if (detectionAreas.length === 0) {
    return `No detection areas found in the system prompt. Please add a checklist with specific detection areas to focus on during the tutoring session.`;
  }
  
  return null;
}

/**
 * Unified extraction using LLM-based analysis
 */
async function extractUnifiedContent(systemPrompt: string): Promise<ExtractionResult> {
  // Always use LLM extraction for consistent results
  return await ChecklistIntegration.extractFromSystemPromptAsync(systemPrompt);
}

/**
 * Generates a checklist from system prompt using unified extraction
 * Returns user prompt if no content found
 */
export async function generateChecklistFromSystemPrompt(
  roomId: string,
  systemPrompt: string
): Promise<ChecklistGenerationResult> {
  const extraction = await extractUnifiedContent(systemPrompt);
  const totalItems = extraction.understanding.length + extraction.behavior.length;
  
  // Check if we have sufficient content
  if (totalItems === 0) {
    return {
      success: false,
      checklist: null,
      userPrompt: `No detection areas found in the system prompt. Please add a checklist with specific detection areas to focus on during the tutoring session.`
    };
  }
  
  // Create checklist from extracted content
  const allItems = [...extraction.understanding, ...extraction.behavior];
  const detectionItems = createChecklistItems(allItems, 'detection_area');
  
  const checklist: SessionChecklist = {
    id: `checklist-${roomId}`,
    room_id: roomId,
    template_name: 'From System Prompt',
    session_start: new Date(),
    detection_areas: detectionItems,
    verification_steps: [], // Unified into detection_areas
    total_items: detectionItems.length,
    completed_items: 0,
    completion_percentage: 0,
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true
  };
  
  return {
    success: true,
    checklist,
    userPrompt: null
  };
}

/**
 * ChecklistIntegration class - now uses LLM-based extraction
 * Simplified to use single LLM extraction method
 */
export class ChecklistIntegration {
  /**
   * DEPRECATED: Synchronous extraction - use extractFromSystemPromptAsync instead
   * Only kept for backward compatibility
   */
  static extractFromSystemPrompt(systemPrompt: string): ExtractionResult {
    console.warn('extractFromSystemPrompt is deprecated. Use extractFromSystemPromptAsync for LLM-based extraction.');
    if (!systemPrompt || systemPrompt.trim().length === 0) {
      return { understanding: [], behavior: [] };
    }
    // Return empty result - async version should be used
    return { understanding: [], behavior: [] };
  }

  /**
   * Async LLM-based extraction (main method) with error handling
   */
  static async extractFromSystemPromptAsync(systemPrompt: string): Promise<ExtractionResult> {
    try {
      const result = await LLMExtractionService.extractFromSystemPrompt(systemPrompt);
      
      // Verify all items have proper prefixes
      const allHavePrefixes = (
        result.understanding.every(item => item.startsWith('[understanding]')) &&
        result.behavior.every(item => item.startsWith('[behavior]'))
      );
      
      if (!allHavePrefixes) {
        console.log('Some items missing prefixes, adding them manually...');
        return {
          understanding: result.understanding.map(item => 
            item.startsWith('[understanding]') ? item : `[understanding] ${item}`
          ),
          behavior: result.behavior.map(item =>
            item.startsWith('[behavior]') ? item : `[behavior] ${item}`
          )
        };
      }
      
      return result;
    } catch (error) {
      console.error('Error in extractFromSystemPromptAsync:', error);
      // Return None fallback on error
      return {
        understanding: ['[understanding] None'],
        behavior: ['[behavior] None']
      };
    }
  }

  /**
   * Extract with template fallback when LLM extraction insufficient
   */
  static async extractWithFallback(
    systemPrompt: string,
    templates: Array<{ id: string; items: string[] }>
  ): Promise<{
    used_extraction: boolean;
    used_template: boolean;
    items: string[];
  }> {
    return await LLMExtractionService.extractWithFallback(systemPrompt, templates);
  }

  /**
   * Categorize template items with LLM and ensure prefixes
   */
  static async categorizeTemplateItems(items: string[]): Promise<ExtractionResult> {
    const result = await LLMExtractionService.categorizeTemplateItems(items);
    
    // Ensure all items have proper prefixes
    return {
      understanding: result.understanding.map(item => 
        item.startsWith('[understanding]') ? item : `[understanding] ${item}`
      ),
      behavior: result.behavior.map(item =>
        item.startsWith('[behavior]') ? item : `[behavior] ${item}`
      )
    };
  }

  /**
   * Analyze item functionality for consistency checks
   */
  static analyzeItemFunctionality(items: string[]): {
    has_understanding: boolean;
    has_behavior: boolean;
    supports_coverage_detection: boolean;
  } {
    return LLMExtractionService.analyzeItemFunctionality(items);
  }
}
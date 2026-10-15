/**
 * Generate room checklists from the LLM's single learning-target inventory.
 */

import { SessionChecklist, ChecklistItem } from '../types/checklist';
import { LLMExtractionService, ExtractionResult } from './llmExtractionService';

export type { ExtractionResult } from './llmExtractionService';

export interface ChecklistGenerationResult {
  success: boolean;
  checklist: SessionChecklist | null;
  userPrompt: string | null;
}

function createChecklistItems(texts: string[]): ChecklistItem[] {
  return texts.map((text, index) => ({
    id: `detection_area-${index}`,
    area_text: text,
    item_type: 'detection_area',
    priority: 'important',
    status: 'pending',
    understanding_level: 'none',
    tutor_notes: '',
    last_addressed: null,
    attempts_count: 0,
    original_template_area: true,
    coverage_evidence: [],
    created_at: new Date(),
    updated_at: new Date()
  }));
}

export async function generateChecklistFromSystemPrompt(
  roomId: string,
  systemPrompt: string
): Promise<ChecklistGenerationResult> {
  const extraction = await ChecklistIntegration.extractFromSystemPromptAsync(systemPrompt);
  if (extraction.detection_areas.length === 0) {
    return {
      success: false,
      checklist: null,
      userPrompt: 'No learning targets found in the system prompt. Please add specific learning targets to the checklist.'
    };
  }

  const detectionItems = createChecklistItems(extraction.detection_areas);
  const checklist: SessionChecklist = {
    id: `checklist-${roomId}`,
    room_id: roomId,
    template_name: 'From System Prompt',
    session_start: new Date(),
    detection_areas: detectionItems,
    verification_steps: [],
    total_items: detectionItems.length,
    completed_items: 0,
    completion_percentage: 0,
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true
  };

  return { success: true, checklist, userPrompt: null };
}

export class ChecklistIntegration {
  static async extractFromSystemPromptAsync(systemPrompt: string): Promise<ExtractionResult> {
    try {
      return await LLMExtractionService.extractFromSystemPrompt(systemPrompt);
    } catch (error) {
      console.error('Checklist extraction failed:', error);
      return { detection_areas: [] };
    }
  }
}

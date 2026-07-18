/**
 * Checklist Generation Context Assessment
 * Determines the best approach for generating checklists based on room configuration
 * TDD Green Phase: Minimal implementation to pass tests
 */

import { getAIConfig, DEFAULT_AI_MODEL } from './aiService';
import { ChecklistIntegration } from './checklistIntegration';
import { supabase } from './supabase';

export interface ChecklistGenerationContext {
  type: 'no_ai_config' | 'empty_system_prompt' | 'ready_for_extraction';
  systemPrompt?: string;
  aiConfigId?: string;
  detectionAreas?: string[];
  verificationSteps?: string[];
  error?: Error;
}

/**
 * Assess the context for checklist generation
 * Determines what options should be presented to the user
 */
export async function assessChecklistGenerationContext(roomId: string): Promise<ChecklistGenerationContext> {
  try {
    // First check if room has AI enabled
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('ai_assistant_enabled, ai_assistant_model')
      .eq('id', roomId)
      .single();
    
    if (roomError || !roomData?.ai_assistant_enabled) {
      console.log('❌ Room AI not enabled:', { roomError, ai_assistant_enabled: roomData?.ai_assistant_enabled });
      return { type: 'no_ai_config' };
    }
    
    // Load AI configuration from the room-backed AI settings
    let aiConfig = await getAIConfig(roomId);
    
    // If no persisted room config is available, synthesize defaults from the room flag
    if (!aiConfig && roomData.ai_assistant_enabled) {
      console.log('⚠️ No persisted AI prompt found, but room has AI enabled. Looking for default system prompt...');
      
      // Check if there's a default system prompt we can use
      // This handles the case where AI is enabled on the room but no config row exists yet
      const defaultSystemPrompt = 'You are a helpful AI assistant in an educational tutoring session. ' +
        'Provide clear, educational responses to help students learn. ' +
        'Be encouraging, patient, and focus on building understanding.';
      
      // Create a temporary config object for assessment
      aiConfig = {
        id: `room-${roomId}`,
        room_id: roomId,
        model_name: roomData.ai_assistant_model || DEFAULT_AI_MODEL,
        system_prompt: defaultSystemPrompt,
        temperature: 0.7,
        max_tokens: 2000,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    
    if (!aiConfig) {
      console.log('❌ No AI config found after all checks');
      return { type: 'no_ai_config' };
    }
    
    // Get system prompt (handle null/undefined)
    const systemPrompt = aiConfig.system_prompt || '';

    const persistedDetectionAreas = aiConfig.prompt_config?.detection_areas?.filter(area => area.trim()) || [];
    const persistedVerificationSteps = aiConfig.prompt_config?.verification_steps?.filter(step => step.trim()) || [];
    const persistedItems = [...persistedDetectionAreas, ...persistedVerificationSteps];

    if (persistedItems.length > 0) {
      return {
        type: 'ready_for_extraction',
        systemPrompt,
        detectionAreas: persistedDetectionAreas,
        verificationSteps: persistedVerificationSteps,
        aiConfigId: aiConfig.id
      };
    }
    
    // Try to extract detection areas using async LLM extraction
    const extraction = await ChecklistIntegration.extractFromSystemPromptAsync(systemPrompt);
    const totalItems = extraction.understanding.length + extraction.behavior.length;
    
    // Check for None fallback
    const isNoneFallback = 
      extraction.understanding.length === 1 && extraction.understanding[0] === '[understanding] None' &&
      extraction.behavior.length === 1 && extraction.behavior[0] === '[behavior] None';
    
    if (totalItems === 0 || isNoneFallback) {
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
      detectionAreas: allItems,
      aiConfigId: aiConfig.id
    };
    
  } catch (error) {
    console.error('Error in assessChecklistGenerationContext:', error);
    return {
      type: 'no_ai_config',
      error: error instanceof Error ? error : new Error('Unknown error')
    };
  }
}

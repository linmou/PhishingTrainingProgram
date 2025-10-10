/**
 * Checklist Service
 * Handles all checklist operations including real-time updates, coverage detection integration,
 * and database synchronization. Based on BDD scenarios from checklist feature files.
 */

import { supabase } from './supabase';
import { CoverageDetectionService, CoverageUpdate } from './coverageDetectionService';
import { generateSystemPromptWithChecklist } from './prompts/checklistPromptGenerator';
import { 
  ChecklistItem, 
  SessionChecklist, 
  ChecklistProgress
} from '../types/checklist';
import { SystemPromptConfig } from './prompts/types';
import { SCENARIO_TEMPLATES } from './detectionTemplates';
import { ConversationMessage } from '../types';
import { generateChecklistFromSystemPrompt } from './checklistIntegration';

export class ChecklistService {
  
  /**
   * Initialize checklist from scenario template
   * Implements: "Tutor sees initial checklist with all areas pending" scenario
   */
  static async initializeChecklistFromTemplate(
    roomId: string,
    templateName: string
  ): Promise<SessionChecklist> {
    try {
      console.log('🚀 Initializing checklist for room:', roomId, 'with template:', templateName);

      // First, deactivate any existing active checklists for this room
      const { error: deactivateError } = await supabase
        .from('session_checklists')
        .update({ is_active: false })
        .eq('room_id', roomId)
        .eq('is_active', true);
      
      if (deactivateError) {
        console.warn('Failed to deactivate old checklists:', deactivateError);
      }

      // Use database function to initialize checklist
      const { error } = await supabase
        .rpc('initialize_checklist_from_template', {
          p_room_id: roomId,
          p_template_name: templateName
        });

      if (error) {
        console.error('Database initialization failed, using fallback approach:', error);
        return await this.initializeChecklistFallback(roomId, templateName);
      }

      // Small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch the complete checklist data with retry logic
      let checklist = await this.getChecklistByRoom(roomId);
      
      // Retry once if not found (database replication lag)
      if (!checklist) {
        console.log('⚠️ First read attempt failed, waiting 500ms and retrying...');
        await new Promise(resolve => setTimeout(resolve, 500));
        checklist = await this.getChecklistByRoom(roomId);
      }
      
      if (!checklist) {
        throw new Error('Failed to retrieve checklist after creation');
      }
      return checklist;

    } catch (error) {
      console.error('Failed to initialize checklist:', error);
      throw new Error('Failed to initialize checklist from template');
    }
  }

  /**
   * Fallback method for checklist initialization
   */
  private static async initializeChecklistFallback(
    roomId: string,
    templateName: string
  ): Promise<SessionChecklist> {
    
    // First, deactivate any existing active checklists for this room
    const { error: deactivateError } = await supabase
      .from('session_checklists')
      .update({ is_active: false })
      .eq('room_id', roomId)
      .eq('is_active', true);
    
    if (deactivateError) {
      console.warn('Failed to deactivate old checklists:', deactivateError);
    }
    
    // Create session checklist record
    const { data: checklist, error: checklistError } = await supabase
      .from('session_checklists')
      .insert({
        room_id: roomId,
        template_name: templateName,
        session_start: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (checklistError) {
      throw new Error(`Failed to create checklist: ${checklistError.message}`);
    }

    // Get template data from SCENARIO_TEMPLATES
    const templateData = SCENARIO_TEMPLATES[templateName as keyof typeof SCENARIO_TEMPLATES];
    
    if (templateData) {
      const items: Partial<ChecklistItem>[] = [];

      // Add detection areas
      templateData.detection_areas.forEach((area, index) => {
        items.push({
          area_text: area,
          item_type: 'detection_area',
          priority: this.inferPriorityFromText(area, index),
          status: 'pending',
          understanding_level: 'none',
          tutor_notes: '',
          attempts_count: 0,
          original_template_area: true
        });
      });

      // Add verification steps
      templateData.verification_steps.forEach((step, index) => {
        items.push({
          area_text: step,
          item_type: 'verification_step',
          priority: this.inferPriorityFromText(step, index),
          status: 'pending',
          understanding_level: 'none',
          tutor_notes: '',
          attempts_count: 0,
          original_template_area: true
        });
      });

      // Insert all items
      const { error: itemsError } = await supabase
        .from('checklist_items')
        .insert(items);

      if (itemsError) {
        throw new Error(`Failed to create checklist items: ${itemsError.message}`);
      }
    }

    // Get the items we just created and construct the checklist object
    const { data: items, error: fetchItemsError } = await supabase
      .from('checklist_items')
      .select(`
        *,
        coverage_evidence (*)
      `)
      .eq('checklist_id', checklist.id)
      .order('created_at', { ascending: true });
    
    if (fetchItemsError) {
      throw new Error(`Failed to fetch created checklist items: ${fetchItemsError.message}`);
    }

    // Separate detection areas and verification steps
    const detection_areas = items
      .filter(item => item.item_type === 'detection_area')
      .map(this.transformDatabaseItem);
    
    const verification_steps = items
      .filter(item => item.item_type === 'verification_step')
      .map(this.transformDatabaseItem);

    return {
      id: checklist.id,
      room_id: checklist.room_id,
      template_name: checklist.template_name,
      session_start: new Date(checklist.session_start),
      detection_areas,
      verification_steps,
      total_items: checklist.total_items,
      completed_items: checklist.completed_items,
      completion_percentage: checklist.completion_percentage,
      created_at: new Date(checklist.created_at),
      updated_at: new Date(checklist.updated_at),
      is_active: checklist.is_active
    };
  }

  /**
   * Get complete checklist data for a room
   */
  static async getChecklistByRoom(roomId: string): Promise<SessionChecklist | null> {
    console.log('🔍 Reading checklist for room:', roomId);
    
    // First, let's see ALL checklists for this room without any filters
    const { data: allChecklists } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('room_id', roomId);
    
    console.log('🔍 ALL checklists for room:', {
      count: allChecklists?.length || 0,
      checklists: allChecklists?.map(c => ({
        id: c.id,
        room_id: c.room_id,
        is_active: c.is_active,
        is_active_type: typeof c.is_active
      }))
    });
    
    const { data: checklist, error: checklistError } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single();

    console.log('📊 Checklist query result:', { 
      found: !!checklist, 
      error: checklistError?.code, 
      message: checklistError?.message,
      checklistId: checklist?.id,
      isActive: checklist?.is_active
    });

    if (checklistError) {
      // If no checklist found, return null instead of throwing error
      if (checklistError.code === 'PGRST116') {
        console.log('ℹ️ No checklist found (PGRST116 - no rows returned)');
        return null;
      }
      console.error('❌ Checklist query error:', checklistError);
      throw new Error(`Checklist not found for room: ${checklistError.message}`);
    }

    // Get all checklist items with evidence
    const { data: items, error: itemsError } = await supabase
      .from('checklist_items')
      .select(`
        *,
        coverage_evidence (*)
      `)
      .eq('checklist_id', checklist.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to fetch checklist items: ${itemsError.message}`);
    }

    // Separate detection areas and verification steps
    const detection_areas = items
      .filter(item => item.item_type === 'detection_area')
      .map(this.transformDatabaseItem);
    
    const verification_steps = items
      .filter(item => item.item_type === 'verification_step')
      .map(this.transformDatabaseItem);

    return {
      id: checklist.id,
      room_id: checklist.room_id,
      template_name: checklist.template_name,
      session_start: new Date(checklist.session_start),
      detection_areas,
      verification_steps,
      total_items: checklist.total_items,
      completed_items: checklist.completed_items,
      completion_percentage: checklist.completion_percentage,
      created_at: new Date(checklist.created_at),
      updated_at: new Date(checklist.updated_at),
      is_active: checklist.is_active
    };
  }

  /**
   * Process student message for coverage detection and update checklist
   * Implements: "AI automatically detects student understanding" scenario
   */
  static async processStudentMessage(
    roomId: string,
    studentMessage: string,
    messageId: string,
    conversationHistory: ConversationMessage[] = []
  ): Promise<{
    updatedItems: ChecklistItem[];
    detectionResults: any;
    promptRegenerated: boolean;
  }> {
    try {
      console.log('🔍 Processing student message for coverage detection:', {
        roomId,
        messageLength: studentMessage.length,
        messageId
      });

      // Get current checklist
      const checklist = await this.getChecklistByRoom(roomId);
      if (!checklist) {
        throw new Error('No checklist found for coverage detection');
      }
      const allItems = [...checklist.detection_areas, ...checklist.verification_steps];

      // Run coverage detection
      const detectionResults = await CoverageDetectionService.analyzeStudentResponse(
        studentMessage,
        allItems,
        conversationHistory
      );

      console.log('📊 Coverage detection results:', {
        detectedCount: detectionResults.detected_coverage.length,
        confidence: detectionResults.analysis_confidence,
        requiresReview: detectionResults.requires_tutor_review
      });

      // Validate results before applying
      if (!CoverageDetectionService.validateDetectionResults(detectionResults, studentMessage)) {
        return {
          updatedItems: [],
          detectionResults,
          promptRegenerated: false
        };
      }

      // Convert to checklist updates
      const updates = await CoverageDetectionService.convertToChecklistUpdates(
        detectionResults,
        allItems,
        messageId
      );

      // Apply updates to database
      const updatedItems = await this.applyChecklistUpdates(checklist.id, updates);

      // Regenerate system prompt if any updates were made
      let promptRegenerated = false;
      if (updatedItems.length > 0) {
        await this.triggerSystemPromptRegeneration(roomId);
        promptRegenerated = true;
      }

      return {
        updatedItems,
        detectionResults,
        promptRegenerated
      };

    } catch (error) {
      console.error('Failed to process student message:', error);
      return {
        updatedItems: [],
        detectionResults: { detected_coverage: [], analysis_confidence: 0, requires_tutor_review: true },
        promptRegenerated: false
      };
    }
  }

  /**
   * Apply checklist updates to database
   */
  private static async applyChecklistUpdates(
    checklistId: string,
    updates: CoverageUpdate[]
  ): Promise<ChecklistItem[]> {
    const updatedItems: ChecklistItem[] = [];

    for (const update of updates) {
      try {
        // First get the current item to increment attempts_count
        const { data: currentItem, error: fetchError } = await supabase
          .from('checklist_items')
          .select('attempts_count')
          .eq('id', update.item_id)
          .single();

        if (fetchError) {
          console.error(`Failed to fetch item ${update.item_id}:`, fetchError);
          continue;
        }

        // Update the item with incremented attempts_count
        const { data: item, error: itemError } = await supabase
          .from('checklist_items')
          .update({
            status: update.new_status,
            understanding_level: update.new_understanding,
            last_addressed: new Date().toISOString(),
            attempts_count: (currentItem?.attempts_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.item_id)
          .select()
          .single();

        if (itemError) {
          console.error('Failed to update checklist item:', itemError);
          continue;
        }

        // Add evidence record
        const { error: evidenceError } = await supabase
          .from('coverage_evidence')
          .insert({
            item_id: update.item_id,
            evidence_text: update.evidence.evidence_text,
            analysis: update.evidence.analysis,
            confidence_score: update.evidence.confidence_score,
            detection_method: update.evidence.detection_method,
            message_id: update.evidence.message_id
          });

        if (evidenceError) {
          console.error('Failed to insert evidence:', evidenceError);
          // Continue anyway, item update was successful
        }

        // Record the update in history
        await supabase
          .from('checklist_updates')
          .insert({
            checklist_id: checklistId,
            item_id: update.item_id,
            previous_status: 'pending', // TODO: Get actual previous status
            new_status: update.new_status,
            previous_understanding: 'none', // TODO: Get actual previous understanding
            new_understanding: update.new_understanding,
            updated_by: 'ai'
          });

        updatedItems.push(this.transformDatabaseItem(item));

        console.log('✅ Applied checklist update:', {
          itemId: update.item_id,
          newStatus: update.new_status,
          evidence: update.evidence.evidence_text.substring(0, 50) + '...'
        });

      } catch (error) {
        console.error('Failed to apply single update:', error);
      }
    }

    return updatedItems;
  }

  /**
   * Update checklist item status (manual tutor override)
   * Implements: "Tutor manually overrides checklist status" scenario
   */
  static async updateItemStatus(
    itemId: string,
    newStatus: ChecklistItem['status'],
    tutorNote?: string,
    updatedBy: 'tutor' | 'ai' = 'tutor'
  ): Promise<ChecklistItem> {
    
    // Get current item for history tracking
    const { data: currentItem, error: getCurrentError } = await supabase
      .from('checklist_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (getCurrentError) {
      throw new Error(`Failed to fetch current item: ${getCurrentError.message}`);
    }

    // Update the item
    const updateData: any = {
      status: newStatus,
      last_addressed: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (tutorNote) {
      updateData.tutor_notes = tutorNote;
    }

    if (updatedBy === 'tutor') {
      updateData.attempts_count = (currentItem.attempts_count || 0) + 1;
    }

    const { data: updatedItem, error: updateError } = await supabase
      .from('checklist_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update item: ${updateError.message}`);
    }

    // Record the update in history
    await supabase
      .from('checklist_updates')
      .insert({
        checklist_id: currentItem.checklist_id,
        item_id: itemId,
        previous_status: currentItem.status,
        new_status: newStatus,
        previous_understanding: currentItem.understanding_level,
        new_understanding: updatedItem.understanding_level,
        updated_by: updatedBy
      });

    // If this was a tutor update, add evidence record
    if (updatedBy === 'tutor' && tutorNote) {
      await supabase
        .from('coverage_evidence')
        .insert({
          item_id: itemId,
          evidence_text: tutorNote,
          analysis: 'Tutor manually updated status',
          confidence_score: 100,
          detection_method: 'tutor_manual'
        });
    }

    console.log('✅ Updated checklist item:', {
      itemId,
      newStatus,
      updatedBy,
      tutorNote: tutorNote ? tutorNote.substring(0, 50) + '...' : 'none'
    });

    return this.transformDatabaseItem(updatedItem);
  }

  /**
   * Update item priority
   * Implements: "Tutor adjusts area priority levels" scenario
   */
  static async updateItemPriority(
    itemId: string,
    newPriority: ChecklistItem['priority']
  ): Promise<ChecklistItem> {
    
    const { data: updatedItem, error } = await supabase
      .from('checklist_items')
      .update({
        priority: newPriority,
        updated_at: new Date().toISOString()
      })
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update priority: ${error.message}`);
    }

    console.log('✅ Updated item priority:', { itemId, newPriority });

    return this.transformDatabaseItem(updatedItem);
  }

  /**
   * Add custom detection area
   * Implements: "Tutor adds custom detection area" scenario
   */
  static async addCustomArea(
    roomId: string,
    areaText: string,
    itemType: 'detection_area' | 'verification_step',
    priority: ChecklistItem['priority'] = 'important'
  ): Promise<ChecklistItem> {
    
    // Get the checklist for this room
    const { data: checklist, error: checklistError } = await supabase
      .from('session_checklists')
      .select('id')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single();

    if (checklistError) {
      throw new Error(`Checklist not found: ${checklistError.message}`);
    }

    // Insert the new item
    const { data: newItem, error: insertError } = await supabase
      .from('checklist_items')
      .insert({
        checklist_id: checklist.id,
        area_text: areaText,
        item_type: itemType,
        priority,
        status: 'pending',
        understanding_level: 'none',
        tutor_notes: '',
        attempts_count: 0,
        original_template_area: false
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to add custom area: ${insertError.message}`);
    }

    console.log('✅ Added custom area:', {
      areaText: areaText.substring(0, 50) + '...',
      itemType,
      priority
    });

    return this.transformDatabaseItem(newItem);
  }

  /**
   * Get checklist progress summary
   */
  static async getChecklistProgress(roomId: string): Promise<ChecklistProgress> {
    const { data, error } = await supabase
      .from('session_checklists')
      .select(`
        total_items,
        completed_items,
        completion_percentage,
        checklist_items (
          status,
          priority
        )
      `)
      .eq('room_id', roomId)
      .eq('is_active', true)
      .single();

    if (error) {
      throw new Error(`Failed to get progress: ${error.message}`);
    }

    const items = data.checklist_items;
    
    return {
      total_areas: data.total_items,
      covered_areas: items.filter((item: any) => item.status === 'covered').length,
      partially_covered_areas: items.filter((item: any) => item.status === 'partially_covered').length,
      pending_areas: items.filter((item: any) => item.status === 'pending').length,
      completion_percentage: data.completion_percentage,
      critical_pending: items.filter((item: any) => item.priority === 'critical' && item.status === 'pending').length,
      critical_covered: items.filter((item: any) => item.priority === 'critical' && item.status === 'covered').length,
      important_pending: items.filter((item: any) => item.priority === 'important' && item.status === 'pending').length,
      important_covered: items.filter((item: any) => item.priority === 'important' && item.status === 'covered').length,
      optional_pending: items.filter((item: any) => item.priority === 'optional' && item.status === 'pending').length,
      optional_covered: items.filter((item: any) => item.priority === 'optional' && item.status === 'covered').length
    };
  }

  /**
   * Trigger system prompt regeneration
   */
  private static async triggerSystemPromptRegeneration(roomId: string): Promise<void> {
    try {
      // Get current AI configuration
      const { error: configError } = await supabase
        .from('ai_assistant_configs')
        .select('*')
        .eq('room_id', roomId)
        .eq('is_active', true)
        .single();

      if (configError) {
        console.warn('No AI config found for room, skipping prompt regeneration');
        return;
      }

      // Get updated checklist
      const checklist = await this.getChecklistByRoom(roomId);
      if (!checklist) {
        console.warn('No checklist found for prompt regeneration');
        return;
      }
      const allItems = [...checklist.detection_areas, ...checklist.verification_steps];

      // TODO: Get base prompt configuration from room settings
      // For now, use a default configuration
      const baseConfig: SystemPromptConfig = {
        role: { role: 'high' },
        communication_style: {
          teen_slang: 'low',
          conversational_markers: 'high',
          uncertainty_expression: 'low'
        },
        cognitive_parameters: {
          concept_density: 'high',
          perspective_taking: 'high',
          personal_examples: 'high',
          consequence_highlighting: 'high'
        },
        emotional_parameters: {
          enthusiasm_level: 'high',
          validation_frequency: 'high',
          mistake_normalization: 'high',
          confidence_building: 'high'
        },
        detection_areas: checklist.detection_areas.map(item => item.area_text),
        verification_steps: checklist.verification_steps.map(item => item.area_text)
      };

      // Generate new prompt with checklist context
      const newPrompt = generateSystemPromptWithChecklist(baseConfig, allItems);

      // Update AI configuration (configs table if present) and keep room prompt in sync
      try {
        await supabase
          .from('ai_assistant_configs')
          .update({
            system_prompt: newPrompt,
            updated_at: new Date().toISOString()
          })
          .eq('room_id', roomId);
      } catch (e) {
        // Non-fatal; some setups do not use the configs table
        console.warn('ai_assistant_configs not updated (optional):', e);
      }

      // Always persist the regenerated prompt on the room for simplified flows
      await supabase
        .from('rooms')
        .update({ ai_assistant_prompt: newPrompt })
        .eq('id', roomId);

      console.log('✅ System prompt regenerated and synced for room:', roomId);

    } catch (error) {
      console.error('Failed to regenerate system prompt:', error);
      // Don't throw error - this is not critical for checklist updates
    }
  }

  /**
   * Transform database item to application format
   */
  private static transformDatabaseItem(dbItem: any): ChecklistItem {
    return {
      id: dbItem.id,
      area_text: dbItem.area_text,
      item_type: dbItem.item_type,
      priority: dbItem.priority,
      status: dbItem.status,
      understanding_level: dbItem.understanding_level,
      coverage_evidence: (dbItem.coverage_evidence || []).map((evidence: any) => ({
        id: evidence.id,
        evidence_text: evidence.evidence_text,
        analysis: evidence.analysis,
        confidence_score: evidence.confidence_score,
        detection_method: evidence.detection_method,
        timestamp: new Date(evidence.timestamp),
        message_id: evidence.message_id
      })),
      tutor_notes: dbItem.tutor_notes || '',
      last_addressed: dbItem.last_addressed ? new Date(dbItem.last_addressed) : null,
      attempts_count: dbItem.attempts_count || 0,
      original_template_area: dbItem.original_template_area,
      created_at: new Date(dbItem.created_at),
      updated_at: new Date(dbItem.updated_at)
    };
  }

  /**
   * Convenience method: Create checklist (alias for initializeChecklistFromTemplate)
   */
  static async create(roomId: string, templateName: string): Promise<SessionChecklist> {
    return await this.initializeChecklistFromTemplate(roomId, templateName);
  }

  /**
   * Convenience method: Read checklist (alias for getChecklistByRoom)
   */
  static async read(roomId: string): Promise<SessionChecklist | null> {
    return await this.getChecklistByRoom(roomId);
  }

  /**
   * Convenience method: Update checklist item
   */
  static async update(itemId: string, updates: Partial<ChecklistItem>): Promise<ChecklistItem> {
    // Validate UUID format to prevent operations on temporary IDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(itemId)) {
      throw new Error(`Invalid item ID format: "${itemId}". Items must be saved to database before editing. Please refresh the page and try again.`);
    }
    if (updates.status) {
      return await this.updateItemStatus(
        itemId,
        updates.status,
        updates.tutor_notes || '',
        'tutor'
      );
    }
    
    if (updates.priority) {
      return await this.updateItemPriority(itemId, updates.priority);
    }

    // Handle area_text updates
    if (updates.area_text !== undefined) {
      const { data: updatedItem, error } = await supabase
        .from('checklist_items')
        .update({
          area_text: updates.area_text,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update item text: ${error.message}`);
      }

      console.log('✅ Updated item text:', { itemId, area_text: updates.area_text });
      return updatedItem;
    }

    // Handle tutor_notes updates
    if (updates.tutor_notes !== undefined) {
      const { data: updatedItem, error } = await supabase
        .from('checklist_items')
        .update({
          tutor_notes: updates.tutor_notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update tutor notes: ${error.message}`);
      }

      console.log('✅ Updated tutor notes:', { itemId });
      return updatedItem;
    }

    throw new Error('No valid updates provided');
  }

  /**
   * Create manual checklist with proper database persistence
   */
  static async createManual(
    roomId: string, 
    detectionAreas: string[], 
    verificationSteps: string[]
  ): Promise<SessionChecklist> {
    // First, deactivate any existing active checklists for this room
    const { error: deactivateError } = await supabase
      .from('session_checklists')
      .update({ is_active: false })
      .eq('room_id', roomId)
      .eq('is_active', true);
    
    if (deactivateError) {
      console.warn('Failed to deactivate old checklists:', deactivateError);
    }
    
    // First create the checklist record
    console.log('🔨 Creating checklist with:', {
      room_id: roomId,
      room_id_type: typeof roomId,
      room_id_length: roomId.length,
      template_name: 'Manual Input',
      is_active: true
    });
    
    const { data: checklistData, error: checklistError } = await supabase
      .from('session_checklists')
      .insert({
        room_id: roomId,
        template_name: 'Manual Input',
        session_start: new Date().toISOString(),
        is_active: true
      })
      .select()
      .single();

    if (checklistError) {
      throw new Error(`Failed to create checklist: ${checklistError.message}`);
    }

    // Create detection area items
    const detectionItems = detectionAreas.map(text => ({
      checklist_id: checklistData.id,
      area_text: text,
      item_type: 'detection_area',
      priority: 'important',
      status: 'pending',
      understanding_level: 'none',
      tutor_notes: '',
      attempts_count: 0,
      original_template_area: false
    }));

    // Create verification step items
    const verificationItems = verificationSteps.map(text => ({
      checklist_id: checklistData.id,
      area_text: text,
      item_type: 'verification_step',
      priority: 'important',
      status: 'pending',
      understanding_level: 'none',
      tutor_notes: '',
      attempts_count: 0,
      original_template_area: false
    }));

    // Insert all items
    const allItems = [...detectionItems, ...verificationItems];
    if (allItems.length > 0) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('checklist_items')
        .insert(allItems)
        .select();

      if (itemsError) {
        // Clean up checklist if items failed
        await supabase.from('session_checklists').delete().eq('id', checklistData.id);
        throw new Error(`Failed to create checklist items: ${itemsError.message}`);
      }

      // Update checklist totals
      await supabase
        .from('session_checklists')
        .update({
          total_items: allItems.length,
          completed_items: 0,
          completion_percentage: 0
        })
        .eq('id', checklistData.id);

      console.log('✅ Created manual checklist with proper UUIDs:', { 
        checklistId: checklistData.id, 
        roomId: checklistData.room_id,
        isActive: checklistData.is_active,
        templateName: checklistData.template_name,
        itemCount: itemsData.length 
      });
    }

    // Return the complete checklist using existing read method
    const savedChecklist = await this.read(roomId);
    
    if (!savedChecklist) {
      // Add a small delay and try once more
      console.log('⚠️ First read returned null, waiting 200ms and retrying...');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const retryChecklist = await this.read(roomId);
      if (!retryChecklist) {
        throw new Error(`Failed to read back created checklist for room: ${roomId}. Database may have consistency issues.`);
      }
      
      console.log('✅ Retry successful, checklist found');
      return retryChecklist;
    }
    
    return savedChecklist;
  }

  /**
   * Convenience method: Delete checklist
   */
  static async delete(roomId: string): Promise<void> {
    const { error } = await supabase
      .from('session_checklists')
      .delete()
      .eq('room_id', roomId);

    if (error) {
      throw new Error(`Failed to delete checklist: ${error.message}`);
    }
  }

  /**
   * Subscribe to checklist changes (placeholder for real-time updates)
   */
  static async subscribe(roomId: string, _callback: (checklist: SessionChecklist) => void): Promise<() => void> {
    // TODO: Implement real-time subscription when Supabase replication is enabled
    console.log(`📡 Subscribing to checklist updates for room: ${roomId}`);
    
    // Return unsubscribe function
    return () => {
      console.log(`📡 Unsubscribed from checklist updates for room: ${roomId}`);
    };
  }

  /**
   * Get checklist progress summary
   */
  static async getProgress(roomId: string): Promise<ChecklistProgress | null> {
    const checklist = await this.getChecklistByRoom(roomId);
    if (!checklist) {
      return null;
    }
    const allItems = [...checklist.detection_areas, ...checklist.verification_steps];
    
    const covered = allItems.filter(item => item.status === 'covered').length;
    const partial = allItems.filter(item => item.status === 'partially_covered').length;
    const pending = allItems.filter(item => item.status === 'pending').length;
    const total = allItems.length;
    
    // Priority breakdown
    const critical_covered = allItems.filter(item => item.priority === 'critical' && item.status === 'covered').length;
    const critical_pending = allItems.filter(item => item.priority === 'critical' && item.status !== 'covered').length;
    const important_covered = allItems.filter(item => item.priority === 'important' && item.status === 'covered').length;
    const important_pending = allItems.filter(item => item.priority === 'important' && item.status !== 'covered').length;
    const optional_covered = allItems.filter(item => item.priority === 'optional' && item.status === 'covered').length;
    const optional_pending = allItems.filter(item => item.priority === 'optional' && item.status !== 'covered').length;
    
    const progress = total > 0 ? (covered / total) * 100 : 0;

    return {
      total_areas: total,
      covered_areas: covered,
      partially_covered_areas: partial,
      pending_areas: pending,
      completion_percentage: Math.round(progress),
      critical_pending,
      critical_covered,
      important_pending,
      important_covered,
      optional_pending,
      optional_covered
    };
  }

  /**
   * Infer priority from area text and position
   */
  private static inferPriorityFromText(text: string, index: number): ChecklistItem['priority'] {
    const lowerText = text.toLowerCase();
    
    // First few items are typically critical
    if (index < 2) return 'critical';
    
    // Look for critical keywords
    if (lowerText.includes('urgent') || lowerText.includes('danger') || lowerText.includes('critical')) {
      return 'critical';
    }
    
    // Look for optional keywords
    if (lowerText.includes('optional') || lowerText.includes('advanced') || lowerText.includes('additional')) {
      return 'optional';
    }
    
    // Default to important
    return 'important';
  }

  /**
   * Create checklist from system prompt detection areas
   * Throws error with user prompt if no detection areas found
   */
  static async createFromSystemPrompt(roomId: string, systemPrompt: string): Promise<SessionChecklist> {
    const result = await generateChecklistFromSystemPrompt(roomId, systemPrompt);
    
    if (!result.success || !result.checklist) {
      throw new Error(result.userPrompt || 'Failed to create checklist from system prompt');
    }
    
    // Save the checklist to database with proper UUIDs
    const detectionTexts = result.checklist.detection_areas.map(item => item.area_text);
    const verificationTexts = result.checklist.verification_steps.map(item => item.area_text);
    
    return await this.createManual(roomId, detectionTexts, verificationTexts);
  }

  /**
   * Try to create checklist from system prompt, fallback to template if no detection areas found
   */
  static async createFromSystemPromptOrTemplate(
    roomId: string, 
    systemPrompt: string, 
    fallbackTemplate: string
  ): Promise<SessionChecklist> {
    try {
      // Try system prompt first
      return await this.createFromSystemPrompt(roomId, systemPrompt);
    } catch (error) {
      // Fallback to template if system prompt fails
      console.log('System prompt creation failed, falling back to template:', fallbackTemplate);
      return await this.create(roomId, fallbackTemplate);
    }
  }
}

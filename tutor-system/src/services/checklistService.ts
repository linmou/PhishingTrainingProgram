/**
 * Checklist Service
 * Handles learner-scoped tracking, historical reads, manual edits,
 * and database synchronization. Based on BDD scenarios from checklist feature files.
 */

import { supabase } from './supabase';
import { 
  ChecklistItem, 
  SessionChecklist, 
  ChecklistProgress
} from '../types/checklist';
import { CYBERBULLYING_LEARNING_TARGETS, CYBERBULLYING_TARGET_VERSION } from './detectionTemplates';
import { transferAssessmentService } from './transferAssessmentService';
import type { LearningTargetInput } from '../types/checklist';

export class ChecklistService {

  /**
   * Initialize an owner-scoped transfer-policy checklist.
   *
   * The database operation owns creation of the checklist and items so the
   * browser cannot bypass the transfer-policy state guard with direct writes.
   */
  static async initializeTransferChecklistForStudent(
    roomId: string,
    studentId: string,
    items: LearningTargetInput[]
  ): Promise<SessionChecklist> {
    if (!roomId || !studentId || !items.length || items.some(item =>
      !item.area_text.trim() || !item.priority ||
      !['detection_area', 'verification_step', 'understanding', 'behavior'].includes(item.item_type)
    )) {
      throw new Error('Room, student, and valid learning targets are required');
    }

    const result = await transferAssessmentService.initializeChecklist({
      roomId,
      studentId,
      items,
    });

    const checklist = await this.getChecklistForStudent(roomId, studentId);
    if (!checklist || checklist.id !== result.checklist_id) {
      throw new Error('Transfer checklist was created but could not be read for its owner');
    }

    await this.analyzeStudentMessages(roomId, studentId);

    const updatedChecklist = await this.getChecklistForStudent(roomId, studentId);
    if (!updatedChecklist || updatedChecklist.id !== result.checklist_id) {
      throw new Error('Transfer checklist could not be refreshed after checking earlier messages');
    }
    return updatedChecklist;
  }

  /** Analyze a learner's chronological history, optionally stopping at the selected message. */
  static async analyzeStudentMessages(
    roomId: string,
    studentId: string,
    focusMessageId?: string
  ): Promise<void> {
    // Every browser writer awaits the same prefix. Server completion markers make concurrent
    // replays safe and prevent a newer live message from overtaking older saved evidence.
    const pageSize = 500;
    const messageIds: string[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', studentId)
        .eq('user_role', 'student')
        .is('assessment_id', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        throw new Error(`Failed to read earlier learner messages: ${error.message}`);
      }
      messageIds.push(...(messages || []).map(message => message.id));
      if (!messages || messages.length < pageSize) break;
    }

    const focusIndex = focusMessageId === undefined ? messageIds.length - 1 : messageIds.indexOf(focusMessageId);
    if (focusMessageId !== undefined && focusIndex < 0) {
      throw new Error('Learning evidence focus message was not found for this learner');
    }
    const cacheKey = `confirmed-learning-evidence:${roomId}:${studentId}`;
    // Cache only explicit server completion markers; deferred evidence must remain retryable.
    const completedIds = new Set<string>();
    try {
      const storedIds: unknown = JSON.parse(window.sessionStorage.getItem(cacheKey) || '[]');
      if (!Array.isArray(storedIds) || !storedIds.every(id => typeof id === 'string')) {
        throw new Error('Invalid completed-message cache');
      }
      storedIds.forEach(id => completedIds.add(id));
    } catch (cacheError) {
      console.warn('Completed-message cache unavailable; checking evidence with the server:', cacheError);
    }

    try {
      for (const messageId of messageIds.slice(0, focusIndex + 1)) {
        if (completedIds.has(messageId)) continue;
        let result = await transferAssessmentService.analyzeMessage(messageId, roomId);
        // Initial goal replay primes the cache; live analysis confirms new IDs on the next pass.
        if (focusMessageId === undefined && result.already_processed !== true && result.deferred !== true) {
          result = await transferAssessmentService.analyzeMessage(messageId, roomId);
        }
        if (result.already_processed === true) completedIds.add(messageId);
      }
    } finally {
      try {
        window.sessionStorage.setItem(cacheKey, JSON.stringify(Array.from(completedIds)));
      } catch (cacheError) {
        console.warn('Completed-message cache could not be saved:', cacheError);
      }
    }
  }

  /**
   * Get complete checklist data for a room
   */
  static async getChecklistByRoom(roomId: string): Promise<SessionChecklist | null> {
    console.log('🔍 Reading checklist for room:', roomId);
    
    const { data: checklist, error: checklistError } = await supabase
      .from('session_checklists')
      .select('*')
      .eq('room_id', roomId)
      .eq('progress_policy_version', 'legacy_v1')
      .eq('is_active', true)
      .single();

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
      student_id: checklist.student_id ?? null,
      progress_policy_version: checklist.progress_policy_version,
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
   * Read the active transfer checklist for exactly one learner.
   * This is intentionally separate from getChecklistByRoom, which is the
   * legacy room-shared reader.
   */
  static async getChecklistForStudent(
    roomId: string,
    studentId: string
  ): Promise<SessionChecklist | null> {
    if (!roomId || !studentId) return null;

    const { data: checklist, error: checklistError } = await (supabase as any)
      .from('session_checklists')
      .select('*')
      .eq('room_id', roomId)
      .eq('student_id', studentId)
      .eq('progress_policy_version', 'transfer_v1')
      .eq('is_active', true)
      .maybeSingle();

    if (checklistError) {
      throw new Error(`Failed to read transfer checklist: ${checklistError.message}`);
    }
    if (!checklist) return null;

    const { data: items, error: itemsError } = await (supabase as any)
      .from('checklist_items')
      .select('*')
      .eq('checklist_id', checklist.id)
      .order('created_at', { ascending: true });

    if (itemsError) {
      throw new Error(`Failed to fetch transfer checklist items: ${itemsError.message}`);
    }

    // Evidence reads use the existing API actor/room checks while table RLS stays unchanged.
    const evidence = await transferAssessmentService.readLearningEvidence(roomId, checklist.id);
    const scopedItems = (items || []).map((item: any) => ({
      ...item,
      coverage_evidence: evidence.filter(row => row.item_id === item.id),
    }));

    // A single insert gives every target the same timestamp; use document order.
    if (checklist.target_version === CYBERBULLYING_TARGET_VERSION) {
      const targetOrder = new Map(CYBERBULLYING_LEARNING_TARGETS.map((target, index) => [target.key, index]));
      scopedItems.sort((a: any, b: any) =>
        (targetOrder.get(a.target_key) ?? targetOrder.size) -
        (targetOrder.get(b.target_key) ?? targetOrder.size));
    }

    return {
      id: checklist.id,
      room_id: checklist.room_id,
      student_id: checklist.student_id,
      progress_policy_version: 'transfer_v1',
      target_version: checklist.target_version ?? null,
      template_name: checklist.template_name,
      session_start: new Date(checklist.session_start),
      detection_areas: scopedItems
        .filter((item: any) => item.item_type === 'detection_area' || item.item_type === 'understanding')
        .map(this.transformDatabaseItem),
      verification_steps: scopedItems
        .filter((item: any) => item.item_type === 'verification_step' || item.item_type === 'behavior')
        .map(this.transformDatabaseItem),
      total_items: checklist.total_items,
      completed_items: checklist.completed_items,
      completion_percentage: checklist.completion_percentage,
      created_at: new Date(checklist.created_at),
      updated_at: new Date(checklist.updated_at),
      is_active: checklist.is_active
    };
  }

  /**
   * Read the sole active transfer checklist in a 1:1 room for an authorized
   * tutor. Multiple owners are rejected instead of sharing one learner's
   * progress with another participant.
   */
  static async getActiveTransferChecklistForRoom(
    roomId: string
  ): Promise<SessionChecklist | null> {
    const { data, error } = await (supabase as any)
      .from('session_checklists')
      .select('student_id')
      .eq('room_id', roomId)
      .eq('progress_policy_version', 'transfer_v1')
      .eq('is_active', true)
      .limit(2);

    if (error) {
      throw new Error(`Failed to read room transfer checklist: ${error.message}`);
    }
    if (!data || data.length === 0) return null;
    if (data.length > 1 || !data[0].student_id) {
      throw new Error('UNSUPPORTED_ROOM_SCOPE: transfer assessment requires one identified learner');
    }
    return this.getChecklistForStudent(roomId, data[0].student_id);
  }

  /** Read progress for one transfer-policy learner. */
  static async getChecklistProgressForStudent(
    roomId: string,
    studentId: string
  ): Promise<ChecklistProgress | null> {
    const checklist = await this.getChecklistForStudent(roomId, studentId);
    if (!checklist) return null;

    const items = [...checklist.detection_areas, ...checklist.verification_steps];
    return {
      total_areas: items.length,
      covered_areas: items.filter((item) => item.status === 'covered').length,
      partially_covered_areas: items.filter((item) => item.status === 'partially_covered').length,
      pending_areas: items.filter((item) => item.status === 'pending').length,
      completion_percentage: items.length === 0
        ? 0
        : Math.round((items.filter((item) => item.status === 'covered').length / items.length) * 100),
      critical_pending: items.filter((item) => item.priority === 'critical' && item.status !== 'covered').length,
      critical_covered: items.filter((item) => item.priority === 'critical' && item.status === 'covered').length,
      important_pending: items.filter((item) => item.priority === 'important' && item.status !== 'covered').length,
      important_covered: items.filter((item) => item.priority === 'important' && item.status === 'covered').length,
      optional_pending: items.filter((item) => item.priority === 'optional' && item.status !== 'covered').length,
      optional_covered: items.filter((item) => item.priority === 'optional' && item.status === 'covered').length
    };
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
      .eq('progress_policy_version', 'legacy_v1')
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
   * Transform database item to application format
   */
  private static transformDatabaseItem(dbItem: any): ChecklistItem {
    return {
      target_key: dbItem.target_key ?? null,
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
   * Convenience method: Read checklist (alias for getChecklistByRoom)
   */
  static async read(roomId: string): Promise<SessionChecklist | null> {
    return await this.getChecklistByRoom(roomId);
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
}

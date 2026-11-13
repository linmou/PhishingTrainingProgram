/**
 * useChecklist Hook
 * Provides state management and service integration for checklist functionality
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { RoomFeaturesService } from '../services/roomFeaturesService';
import { SessionChecklist, ChecklistItem, ChecklistProgress, LearningTargetInput } from '../types/checklist';
import { getAIConfig } from '../services/aiService';
import { assessChecklistGenerationContext, ChecklistGenerationContext } from '../services/checklistGenerationContext';
import { useOptionalAuth } from '../contexts/AuthContext';
import { transferAssessmentService } from '../services/transferAssessmentService';
import { useRealtimeInvalidation } from './useRealtimeInvalidation';
import { boundedRead } from './boundedRead';

export interface GenerationModalState {
  mode: 'no_ai_config' | 'empty_system_prompt';
  message: string;
  context: ChecklistGenerationContext;
}

const TRANSFER_PROGRESS_FIELDS: ReadonlyArray<keyof ChecklistItem> = [
  'status', 'understanding_level', 'area_text', 'priority', 'item_type', 'tutor_notes',
];

const draftStorageKey = (roomId: string) => `room-learning-target-draft:${roomId}`;

interface LearningTargetDraft {
  detectionAreas: string[];
  verificationSteps: string[];
  priorities?: Record<string, ChecklistItem['priority']>;
}

const readLearningTargetDraft = (roomId: string): LearningTargetDraft | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(draftStorageKey(roomId));
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as LearningTargetDraft;
    if (!Array.isArray(draft.detectionAreas) || !Array.isArray(draft.verificationSteps)) return null;
    return {
      detectionAreas: draft.detectionAreas.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      verificationSteps: draft.verificationSteps.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
      priorities: draft.priorities || {},
    };
  } catch {
    return null;
  }
};

const draftChecklist = (roomId: string, draft: LearningTargetDraft): SessionChecklist => {
  const now = new Date();
  const item = (areaText: string, itemType: ChecklistItem['item_type'], index: number): ChecklistItem => {
    const id = `draft-${roomId}-${itemType}-${index}`;
    return {
    id,
    area_text: areaText,
    item_type: itemType,
    priority: draft.priorities?.[id] || 'important',
    status: 'pending',
    understanding_level: 'none',
    coverage_evidence: [],
    tutor_notes: '',
    last_addressed: null,
    attempts_count: 0,
    original_template_area: false,
    created_at: now,
    updated_at: now,
    };
  };
  const detectionAreas = draft.detectionAreas.map((text, index) => item(text, 'detection_area', index));
  const verificationSteps = draft.verificationSteps.map((text, index) => item(text, 'verification_step', index));
  const totalItems = detectionAreas.length + verificationSteps.length;
  return {
    id: `draft-${roomId}`,
    room_id: roomId,
    student_id: null,
    progress_policy_version: 'transfer_v1',
    template_name: 'Room learning targets',
    session_start: now,
    detection_areas: detectionAreas,
    verification_steps: verificationSteps,
    total_items: totalItems,
    completed_items: 0,
    completion_percentage: 0,
    created_at: now,
    updated_at: now,
    is_active: true,
  };
};

const progressForChecklist = (currentChecklist: SessionChecklist): ChecklistProgress => {
  const items = [...currentChecklist.detection_areas, ...currentChecklist.verification_steps];
  const covered = items.filter(item => item.status === 'covered').length;
  return {
    total_areas: items.length,
    covered_areas: covered,
    partially_covered_areas: items.filter(item => item.status === 'partially_covered').length,
    pending_areas: items.filter(item => item.status === 'pending').length,
    completion_percentage: items.length ? Math.round((covered / items.length) * 100) : 0,
    critical_pending: items.filter(item => item.priority === 'critical' && item.status !== 'covered').length,
    critical_covered: items.filter(item => item.priority === 'critical' && item.status === 'covered').length,
    important_pending: items.filter(item => item.priority === 'important' && item.status !== 'covered').length,
    important_covered: items.filter(item => item.priority === 'important' && item.status === 'covered').length,
    optional_pending: items.filter(item => item.priority === 'optional' && item.status !== 'covered').length,
    optional_covered: items.filter(item => item.priority === 'optional' && item.status === 'covered').length,
  };
};

const isOwnerlessTransferError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /valid learner owner|unsupported_room_scope/i.test(message);
};

export interface UseChecklistReturn {
  // State
  checklist: SessionChecklist | null;
  priorChecklist: SessionChecklist | null;
  loading: boolean;
  error: string | null;
  liveError: string | null;
  progress: ChecklistProgress | null;
  
  // New modal states
  showGenerationModal: GenerationModalState | null;
  showManualInput: boolean;

  // Actions
  generateChecklist: (templateName: string) => Promise<void>;
  updateItem: (itemId: string, updates: Partial<ChecklistItem>) => Promise<boolean>;
  refreshChecklist: () => Promise<void>;
  deleteChecklist: () => Promise<void>;
  
  // New user interaction actions
  startSmartGeneration: (templateName?: string) => Promise<void>;
  openManualInput: () => void;
  closeModals: () => void;
  handleSetupAI: () => void;
  handleManualSubmit: (detectionAreas: string[], verificationSteps: string[]) => Promise<void>;
  
  // Utilities
  isItemCompleted: (itemId: string) => boolean;
  getItemById: (itemId: string) => ChecklistItem | undefined;
}

/**
 * Custom hook for checklist management
 * @param roomId - Room identifier
 * @returns Checklist state and actions
 */
export function useChecklist(roomId: string, transfer?: { enabled: boolean; studentId: string | null }): UseChecklistReturn {
  const auth = useOptionalAuth();
  const user = auth?.user || null;
  const transferEnabled = transfer?.enabled === true;
  const transferStudentId = transfer?.studentId ?? null;
  const [checklist, setChecklist] = useState<SessionChecklist | null>(null);
  const [priorChecklist, setPriorChecklist] = useState<SessionChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readError, setReadError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ChecklistProgress | null>(null);
  
  // New modal states
  const [showGenerationModal, setShowGenerationModal] = useState<GenerationModalState | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const transferScope = JSON.stringify([roomId, transferStudentId, transferEnabled, user?.id, user?.current_role]);
  const [dataScope, setDataScope] = useState(transferScope);
  const loadedScope = useRef<string | null>(null);
  const readRequest = useRef<{ scope: string; pending: boolean; promise: Promise<void>; controller: AbortController } | null>(null);
  const currentTransferScope = useRef(transferScope);
  currentTransferScope.current = transferScope;
  const transferPromotionInFlight = useRef<{ scope: string } | null>(null);
  useEffect(() => {
    setDataScope(transferScope);
    const localDraft = transferEnabled && user?.current_role === 'tutor' ? readLearningTargetDraft(roomId) : null;
    const scopedDraft = localDraft ? draftChecklist(roomId, localDraft) : null;
    setChecklist(scopedDraft);
    setPriorChecklist(null);
    setProgress(scopedDraft ? progressForChecklist(scopedDraft) : null);
    setError(null);
    setReadError(null);
    setShowManualInput(false);
    setShowGenerationModal(null);
    loadedScope.current = scopedDraft ? transferScope : null;
    readRequest.current = null;
    return () => {
      transferPromotionInFlight.current = null;
      readRequest.current?.controller.abort();
      readRequest.current = null;
    };
  }, [transferScope, roomId, transferEnabled, user?.current_role]);

  const syncTransferDraft = useCallback(async () => {
    if (!transferEnabled || !transferStudentId || user?.current_role !== 'tutor') return;
    const draft = readLearningTargetDraft(roomId);
    if (!draft || draft.detectionAreas.length + draft.verificationSteps.length === 0
      || transferPromotionInFlight.current?.scope === transferScope) return;
    const request = { scope: transferScope };
    transferPromotionInFlight.current = request;
    const isCurrentRequest = () => currentTransferScope.current === transferScope
      && transferPromotionInFlight.current === request;
    setLoading(true);
    setError(null);
    const items: LearningTargetInput[] = [
      ...draft.detectionAreas.map((area_text, index) => ({
        area_text, item_type: 'detection_area' as const,
        priority: draft.priorities?.[`draft-${roomId}-detection_area-${index}`] || 'important',
      })),
      ...draft.verificationSteps.map((area_text, index) => ({
        area_text, item_type: 'verification_step' as const,
        priority: draft.priorities?.[`draft-${roomId}-verification_step-${index}`] || 'important',
      })),
    ];
    try {
      const saved = await RoomFeaturesService.checklist.initializeTransferChecklistForStudent(roomId, transferStudentId, items);
      if (!isCurrentRequest()) return;
      window.localStorage.removeItem(draftStorageKey(roomId));
      loadedScope.current = transferScope;
      setChecklist(saved);
      setProgress(progressForChecklist(saved));
    } catch (err) {
      if (!isCurrentRequest()) return;
      loadedScope.current = transferScope;
      const message = err instanceof Error ? err.message : 'Failed to sync learning targets';
      const localChecklist = draftChecklist(roomId, draft);
      setChecklist(localChecklist);
      setProgress(progressForChecklist(localChecklist));
      setError(`Learning targets remain saved locally. Sync failed: ${message}`);
    } finally {
      if (isCurrentRequest()) {
        transferPromotionInFlight.current = null;
        setLoading(false);
      }
    }
  }, [roomId, transferEnabled, transferStudentId, user?.current_role, transferScope]);

  // Generate new checklist using TDD system prompt detection with template fallback
  const generateChecklist = useCallback(async (templateName: string) => {
    if (!roomId) return;
    if (transferEnabled) {
      setError('Transfer learning targets must be approved from room context or entered manually.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('🚀 Generating checklist for room:', roomId, 'template fallback:', templateName);
      
      // Try to get current AI configuration/system prompt for the room
      let systemPrompt = '';
      try {
        const aiConfig = await getAIConfig(roomId);
        systemPrompt = aiConfig?.system_prompt || '';
        console.log('📝 Retrieved system prompt for detection areas extraction');
      } catch (aiError) {
        console.log('⚠️ No AI config found, will use template fallback');
      }

      // Use our new TDD method: try system prompt first, fallback to template
      const newChecklist = await RoomFeaturesService.checklist.createFromSystemPromptOrTemplate(
        roomId, 
        systemPrompt, 
        templateName
      );
      
      // Check if checklist was created successfully
      if (!newChecklist) {
        throw new Error('Failed to create checklist - returned null');
      }
      
      setChecklist(newChecklist);
      
      setProgress(progressForChecklist(newChecklist));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate checklist';
      setError(errorMessage);
      console.error('Failed to generate checklist:', err);
      
      // Log more details for debugging
      if (err instanceof Error) {
        console.error('Error details:', {
          message: err.message,
          stack: err.stack,
          cause: (err as any).cause
        });
      }
    } finally {
      setLoading(false);
    }
  }, [roomId, transferEnabled]);

  const saveTransferTargets = useCallback(async (detectionAreas: string[], verificationSteps: string[]) => {
    const items = [
      ...detectionAreas.map(area_text => ({ area_text, item_type: 'detection_area' as const, priority: 'important' as const })),
      ...verificationSteps.map(area_text => ({ area_text, item_type: 'verification_step' as const, priority: 'important' as const })),
    ];
    if (!items.length) throw new Error('Enter at least one learning target.');
    const draft = { detectionAreas, verificationSteps };
    window.localStorage.setItem(draftStorageKey(roomId), JSON.stringify(draft));
    const localChecklist = draftChecklist(roomId, draft);
    setChecklist(localChecklist);
    setProgress(progressForChecklist(localChecklist));
    setShowManualInput(false);
    await syncTransferDraft();
  }, [roomId, syncTransferDraft]);

  // New smart generation function that assesses context first
  const startSmartGeneration = useCallback(async (templateName?: string) => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🧠 Starting smart checklist generation for room:', roomId);
      
      // Assess the situation first
      const context = await assessChecklistGenerationContext(roomId, transferEnabled);

      if (transferEnabled) {
        if (context.type === 'ready_for_extraction') {
          const detection = (context.detectionAreas || []).filter(text => text.trim());
          const verification = (context.verificationSteps || []).filter(text => text.trim());
          if (!detection.length && !verification.length) {
            throw new Error('No learning targets found. Edit the room configuration or enter targets manually.');
          }
          await saveTransferTargets(detection, verification);
        } else {
          setShowGenerationModal({
            mode: context.type,
            message: 'No learning targets found. Edit the room configuration or enter targets manually.',
            context,
          });
        }
        return;
      }
      const legacyTemplateName = templateName || 'General Scam Indicators';
      
      console.log('🔍 Smart generation context assessment:', context);
      
      switch (context.type) {
        case 'no_ai_config':
          console.log('⚠️ No AI config found, showing generation modal');
          setShowGenerationModal({
            mode: 'no_ai_config',
            message: 'No AI assistant found. Would you like to set up AI first or create a manual checklist?',
            context
          });
          break;
          
        case 'empty_system_prompt':
          console.log('⚠️ Empty system prompt, showing generation modal');
          setShowGenerationModal({
            mode: 'empty_system_prompt',
            message: 'No detection areas found in AI system prompt. Add custom areas or use a template?',
            context
          });
          break;
          
        case 'ready_for_extraction':
          console.log('✅ Ready for extraction, proceeding with smart generation');
          // If prompt_config already contains structured checklist items, use them directly.
          const hasStructuredPromptConfigItems = Boolean(
            context.verificationSteps || (context.detectionAreas && context.detectionAreas.length > 0)
          );
          const newChecklist = hasStructuredPromptConfigItems
            ? await RoomFeaturesService.checklist.createManual(
                roomId,
                context.detectionAreas || [],
                context.verificationSteps || []
              )
            : await RoomFeaturesService.checklist.createFromSystemPromptOrTemplate(
                roomId,
                context.systemPrompt!,
                legacyTemplateName
              );
          
          // Check if checklist was created successfully
          if (!newChecklist) {
            throw new Error('Failed to create checklist - returned null');
          }
          
          setChecklist(newChecklist);
          
          setProgress(progressForChecklist(newChecklist));
          
          console.log('✅ Smart generation completed with system prompt extraction');
          break;
          
        default:
          console.warn('🚨 Unexpected context type, falling back to template generation');
          // Fallback: just generate using template without showing modal
          const fallbackChecklist = await RoomFeaturesService.checklist.create(roomId, legacyTemplateName);
          
          // Check if checklist was created successfully
          if (!fallbackChecklist) {
            throw new Error('Failed to create fallback checklist - returned null');
          }
          
          setChecklist(fallbackChecklist);
          
          setProgress(progressForChecklist(fallbackChecklist));
          
          console.log('✅ Fallback template generation completed');
          break;
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate checklist';
      setError(errorMessage);
      console.error('Failed to start smart generation:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId, saveTransferTargets, transferEnabled]);

  // Open manual input form
  const openManualInput = useCallback(() => {
    setShowGenerationModal(null);
    setShowManualInput(true);
  }, []);

  // Close all modals
  const closeModals = useCallback(() => {
    setShowGenerationModal(null);
    setShowManualInput(false);
  }, []);

  // Handle AI setup redirect
  const handleSetupAI = useCallback(() => {
    setShowGenerationModal(null);
    // TODO: Navigate to AI Assistant Settings
    console.log('Redirecting to AI Assistant setup...');
  }, []);

  // Handle manual checklist submission
  const handleManualSubmit = useCallback(async (detectionAreas: string[], verificationSteps: string[]) => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      if (transferEnabled) {
        await saveTransferTargets(detectionAreas, verificationSteps);
        return;
      }
      console.log('📝 Creating manual checklist:', { detectionAreas, verificationSteps });
      
      // Save manual checklist to database to get proper UUIDs
      const savedChecklist = await RoomFeaturesService.checklist.createManual(
        roomId, 
        detectionAreas, 
        verificationSteps
      );
      
      // Check if checklist was created successfully
      if (!savedChecklist) {
        throw new Error('Failed to create manual checklist - returned null');
      }
      
      setChecklist(savedChecklist);
      
      // Set initial progress for manual checklist
      const total = detectionAreas.length + verificationSteps.length;
      setProgress({
        total_areas: total,
        covered_areas: 0,
        partially_covered_areas: 0,
        pending_areas: total,
        completion_percentage: 0,
        critical_pending: 0,
        critical_covered: 0,
        important_pending: total, // All manual items default to important
        important_covered: 0,
        optional_pending: 0,
        optional_covered: 0
      });
      
      setShowManualInput(false);
      
      console.log('✅ Manual checklist created successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create manual checklist';
      setError(errorMessage);
      console.error('Failed to create manual checklist:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId, saveTransferTargets, transferEnabled]);

  // Reads are serialized per viewer scope. Notifications never promote drafts or judge messages.
  const readChecklist = useCallback(async () => {
    if (!roomId || transferPromotionInFlight.current?.scope === transferScope) return;
    const existing = readRequest.current;
    if (existing?.scope === transferScope) {
      existing.pending = true;
      return existing.promise;
    }
    const request = { scope: transferScope, pending: false, promise: Promise.resolve(), controller: new AbortController() };
    readRequest.current = request;
    const current = () => currentTransferScope.current === transferScope && readRequest.current === request;
    request.promise = (async () => {
      do {
        request.pending = false;
        if (loadedScope.current !== transferScope) setLoading(true);
        const localDraft = transferEnabled && user?.current_role === 'tutor' ? readLearningTargetDraft(roomId) : null;
        setReadError(null);
        try {
          const api = RoomFeaturesService.checklist;
          let saved: SessionChecklist | null = null;
          try {
            saved = await boundedRead(user?.current_role === 'student'
              ? api.getChecklistForStudent?.(roomId, user.id) ?? null
              : api.getActiveTransferChecklistForRoom?.(roomId) ?? null, request.controller.signal);
          } catch (err) {
            if (!localDraft || !isOwnerlessTransferError(err)) throw err;
          }
          if (!current()) return;
          const draft = transferEnabled && user?.current_role === 'tutor' ? readLearningTargetDraft(roomId) : null;
          if (draft) saved = draftChecklist(roomId, draft);
          else if (!saved) saved = await boundedRead(api.read(roomId), request.controller.signal);
          if (!current()) return;
          const wrongRoom = saved && saved.room_id !== roomId;
          const wrongOwner = saved?.progress_policy_version === 'transfer_v1' && !saved.id.startsWith('draft-') && (
            !saved.student_id || (user?.current_role === 'student' && saved.student_id !== user.id)
            || (transferStudentId && saved.student_id !== transferStudentId)
          );
          if (wrongRoom || wrongOwner) {
            setChecklist(null);
            setProgress(null);
            setReadError(wrongRoom ? 'Server returned progress for a different room.'
              : saved?.student_id ? 'Server returned transfer progress for a different learner.'
                : 'Server returned transfer progress without a valid learner owner.');
            return;
          }
          setChecklist(saved);
          setPriorChecklist(null);
          setProgress(saved ? progressForChecklist(saved) : null);
        } catch (err) {
          if (current()) setReadError(err instanceof Error ? err.message : 'Failed to refresh checklist');
        } finally {
          if (current()) {
            loadedScope.current = transferScope;
            setLoading(false);
          }
        }
      } while (current() && request.pending);
    })();
    try { await request.promise; }
    finally { if (current()) readRequest.current = null; }
  }, [roomId, user?.id, user?.current_role, transferEnabled, transferStudentId, transferScope]);

  const refreshChecklist = useCallback(async () => {
    if (transferPromotionInFlight.current?.scope === transferScope) return;
    if (transferEnabled && transferStudentId && user?.current_role === 'tutor' && readLearningTargetDraft(roomId)) {
      await syncTransferDraft();
    } else {
      await readChecklist();
    }
  }, [roomId, transferScope, transferEnabled, transferStudentId, user?.current_role, syncTransferDraft, readChecklist]);

  // Update checklist item
  const updateItem = useCallback(async (itemId: string, updates: Partial<ChecklistItem>) => {
    if (!roomId) return false;

    if (checklist?.id.startsWith('draft-')) {
      // Promotion owns this snapshot until it succeeds or fails.
      if (transferPromotionInFlight.current?.scope === transferScope) return false;
      const currentDraft = readLearningTargetDraft(roomId);
      if (!currentDraft) return false;
      const allItems = [...currentDraft.detectionAreas, ...currentDraft.verificationSteps];
      const draftIndex = allItems.findIndex((text, index) => `draft-${roomId}-${index < currentDraft.detectionAreas.length ? 'detection_area' : 'verification_step'}-${index < currentDraft.detectionAreas.length ? index : index - currentDraft.detectionAreas.length}` === itemId);
      if (draftIndex < 0) return false;
      const nextDraft = {
        detectionAreas: [...currentDraft.detectionAreas],
        verificationSteps: [...currentDraft.verificationSteps],
        priorities: { ...(currentDraft.priorities || {}) },
      };
      const targetList = draftIndex < nextDraft.detectionAreas.length
        ? nextDraft.detectionAreas
        : nextDraft.verificationSteps;
      const targetIndex = draftIndex < nextDraft.detectionAreas.length
        ? draftIndex
        : draftIndex - nextDraft.detectionAreas.length;
      if (typeof updates.area_text === 'string' && updates.area_text.trim()) {
        targetList[targetIndex] = updates.area_text.trim();
      }
      if (updates.priority) {
        nextDraft.priorities![itemId] = updates.priority;
      }
      window.localStorage.setItem(draftStorageKey(roomId), JSON.stringify(nextDraft));
      setChecklist(draftChecklist(roomId, nextDraft));
      setError(null);
      return true;
    }

    const currentScope = () => currentTransferScope.current === transferScope;
    const trustedTransferEdit = checklist?.progress_policy_version === 'transfer_v1'
      && TRANSFER_PROGRESS_FIELDS.some((field) => field in updates);
    setLoading(!trustedTransferEdit);
    setError(null);

    try {
      console.log('📝 Updating checklist item:', itemId, updates);
      if (trustedTransferEdit) {
        const saved = await transferAssessmentService.editLearningProgress({
          roomId,
          itemId,
          action: Object.prototype.hasOwnProperty.call(updates, 'status')
            ? 'set_status'
            : Object.prototype.hasOwnProperty.call(updates, 'understanding_level')
              ? 'set_understanding'
              : Object.prototype.hasOwnProperty.call(updates, 'area_text')
                ? 'edit_item'
                : Object.prototype.hasOwnProperty.call(updates, 'priority')
                  ? 'set_priority'
                  : 'edit_item',
          updates: updates as Record<string, unknown>,
        });
        if (!currentScope()) return false;
        const savedProgress = {
          status: saved.status as ChecklistItem['status'],
          understanding_level: saved.understanding_level as ChecklistItem['understanding_level'],
        };
        setChecklist((current) => {
          if (!current) return current;
          const updateItemValue = (item: ChecklistItem) => item.id === itemId
            ? { ...item, ...updates, ...savedProgress, updated_at: new Date() }
            : item;
          const next = {
            ...current,
            detection_areas: current.detection_areas.map(updateItemValue),
            verification_steps: current.verification_steps.map(updateItemValue),
            updated_at: new Date(),
          };
          setProgress(previous => previous ? progressForChecklist(next) : previous);
          return next;
        });
      } else {
        await RoomFeaturesService.checklist.update(itemId, updates);
      }
      
      // Refresh checklist to get updated data
      if (!currentScope()) return false;
      if (!trustedTransferEdit) await refreshChecklist();
      return true;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      if (currentScope()) setError(errorMessage);
      console.error('Failed to update checklist item:', err);
      return false;
    } finally {
      if (currentScope()) setLoading(false);
    }
  }, [roomId, checklist, transferScope, refreshChecklist]);

  const visibleChecklist = dataScope === transferScope ? checklist : null;
  const persistedChecklist = visibleChecklist && !visibleChecklist.id.startsWith('draft-') ? visibleChecklist : null;
  const liveError = useRealtimeInvalidation(transferScope, roomId ? [
    { table: 'session_checklists', filter: `room_id=eq.${roomId}` },
    ...(persistedChecklist ? [
      { table: 'checklist_items', filter: `checklist_id=eq.${persistedChecklist.id}` },
      ...[...persistedChecklist.detection_areas, ...persistedChecklist.verification_steps]
        .map(item => item.id).sort().map(id => ({ table: 'coverage_evidence', filter: `item_id=eq.${id}` })),
    ] : []),
  ] : [], readChecklist);

  useEffect(() => {
    void syncTransferDraft();
  }, [syncTransferDraft]);

  // Delete checklist
  const deleteChecklist = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      await RoomFeaturesService.checklist.delete(roomId);
      setChecklist(null);
      setProgress(null);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete checklist';
      setError(errorMessage);
      console.error('Failed to delete checklist:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Utility: Check if item is completed
  const isItemCompleted = useCallback((itemId: string): boolean => {
    if (!checklist) return false;
    
    const allItems = [...checklist.detection_areas, ...checklist.verification_steps];
    const item = allItems.find(item => item.id === itemId);
    return item?.status === 'covered';
  }, [checklist]);

  // Utility: Get item by ID
  const getItemById = useCallback((itemId: string): ChecklistItem | undefined => {
    if (!checklist) return undefined;
    
    const allItems = [...checklist.detection_areas, ...checklist.verification_steps];
    return allItems.find(item => item.id === itemId);
  }, [checklist]);

  // Load existing checklist on mount
  useEffect(() => {
    if (roomId) {
      void readChecklist();
    }
  }, [roomId, readChecklist]);

  return {
    // State
    checklist: visibleChecklist,
    priorChecklist: dataScope === transferScope ? priorChecklist : null,
    loading: dataScope !== transferScope || loading,
    error: dataScope === transferScope ? [error, readError].filter(Boolean).join(' ') || null : null,
    liveError,
    progress: dataScope === transferScope ? progress : null,
    
    // New modal states
    showGenerationModal,
    showManualInput,

    // Actions
    generateChecklist,
    updateItem,
    refreshChecklist,
    deleteChecklist,
    
    // New user interaction actions
    startSmartGeneration,
    openManualInput,
    closeModals,
    handleSetupAI,
    handleManualSubmit,

    // Utilities
    isItemCompleted,
    getItemById,
  };
}

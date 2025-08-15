/**
 * useChecklist Hook
 * Provides state management and service integration for checklist functionality
 */

import { useState, useCallback, useEffect } from 'react';
import { RoomFeaturesService } from '../services/roomFeaturesService';
import { SessionChecklist, ChecklistItem, ChecklistProgress } from '../types/checklist';
import { getAIConfig } from '../services/aiService';
import { assessChecklistGenerationContext, ChecklistGenerationContext } from '../services/checklistGenerationContext';

export interface GenerationModalState {
  mode: 'no_ai_config' | 'empty_system_prompt';
  message: string;
  context: ChecklistGenerationContext;
}

export interface UseChecklistReturn {
  // State
  checklist: SessionChecklist | null;
  loading: boolean;
  error: string | null;
  progress: ChecklistProgress | null;
  
  // New modal states
  showGenerationModal: GenerationModalState | null;
  showManualInput: boolean;

  // Actions
  generateChecklist: (templateName: string) => Promise<void>;
  updateItem: (itemId: string, updates: Partial<ChecklistItem>) => Promise<void>;
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
export function useChecklist(roomId: string): UseChecklistReturn {
  const [checklist, setChecklist] = useState<SessionChecklist | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ChecklistProgress | null>(null);
  
  // New modal states
  const [showGenerationModal, setShowGenerationModal] = useState<GenerationModalState | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);

  // Generate new checklist using TDD system prompt detection with template fallback
  const generateChecklist = useCallback(async (templateName: string) => {
    if (!roomId) return;

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
      
      // Update progress with immediate calculation for responsiveness
      const allItems = [...newChecklist.detection_areas, ...newChecklist.verification_steps];
      const covered = allItems.filter(item => item.status === 'covered').length;
      const total = allItems.length;
      const progress = total > 0 ? (covered / total) * 100 : 0;
      
      setProgress({
        total_areas: total,
        covered_areas: covered,
        partially_covered_areas: allItems.filter(item => item.status === 'partially_covered').length,
        pending_areas: allItems.filter(item => item.status === 'pending').length,
        completion_percentage: Math.round(progress),
        critical_pending: allItems.filter(item => item.priority === 'critical' && item.status !== 'covered').length,
        critical_covered: allItems.filter(item => item.priority === 'critical' && item.status === 'covered').length,
        important_pending: allItems.filter(item => item.priority === 'important' && item.status !== 'covered').length,
        important_covered: allItems.filter(item => item.priority === 'important' && item.status === 'covered').length,
        optional_pending: allItems.filter(item => item.priority === 'optional' && item.status !== 'covered').length,
        optional_covered: allItems.filter(item => item.priority === 'optional' && item.status === 'covered').length
      });
      
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
  }, [roomId]);

  // New smart generation function that assesses context first
  const startSmartGeneration = useCallback(async (templateName: string = 'General Scam Indicators') => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('🧠 Starting smart checklist generation for room:', roomId);
      
      // Assess the situation first
      const context = await assessChecklistGenerationContext(roomId);
      
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
          // Proceed with TDD extraction using existing logic
          const newChecklist = await RoomFeaturesService.checklist.createFromSystemPromptOrTemplate(
            roomId, 
            context.systemPrompt!, 
            templateName
          );
          
          // Check if checklist was created successfully
          if (!newChecklist) {
            throw new Error('Failed to create checklist - returned null');
          }
          
          setChecklist(newChecklist);
          
          // Update progress with immediate calculation for responsiveness
          const allItems = [...newChecklist.detection_areas, ...newChecklist.verification_steps];
          const covered = allItems.filter(item => item.status === 'covered').length;
          const total = allItems.length;
          const progress = total > 0 ? (covered / total) * 100 : 0;
          
          setProgress({
            total_areas: total,
            covered_areas: covered,
            partially_covered_areas: allItems.filter(item => item.status === 'partially_covered').length,
            pending_areas: allItems.filter(item => item.status === 'pending').length,
            completion_percentage: Math.round(progress),
            critical_pending: allItems.filter(item => item.priority === 'critical' && item.status !== 'covered').length,
            critical_covered: allItems.filter(item => item.priority === 'critical' && item.status === 'covered').length,
            important_pending: allItems.filter(item => item.priority === 'important' && item.status !== 'covered').length,
            important_covered: allItems.filter(item => item.priority === 'important' && item.status === 'covered').length,
            optional_pending: allItems.filter(item => item.priority === 'optional' && item.status !== 'covered').length,
            optional_covered: allItems.filter(item => item.priority === 'optional' && item.status === 'covered').length
          });
          
          console.log('✅ Smart generation completed with system prompt extraction');
          break;
          
        default:
          console.warn('🚨 Unexpected context type, falling back to template generation');
          // Fallback: just generate using template without showing modal
          const fallbackChecklist = await RoomFeaturesService.checklist.create(roomId, templateName);
          
          // Check if checklist was created successfully
          if (!fallbackChecklist) {
            throw new Error('Failed to create fallback checklist - returned null');
          }
          
          setChecklist(fallbackChecklist);
          
          const fallbackItems = [...fallbackChecklist.detection_areas, ...fallbackChecklist.verification_steps];
          const fallbackCovered = fallbackItems.filter(item => item.status === 'covered').length;
          const fallbackTotal = fallbackItems.length;
          const fallbackProgress = fallbackTotal > 0 ? (fallbackCovered / fallbackTotal) * 100 : 0;
          
          setProgress({
            total_areas: fallbackTotal,
            covered_areas: fallbackCovered,
            partially_covered_areas: fallbackItems.filter(item => item.status === 'partially_covered').length,
            pending_areas: fallbackItems.filter(item => item.status === 'pending').length,
            completion_percentage: Math.round(fallbackProgress),
            critical_pending: fallbackItems.filter(item => item.priority === 'critical' && item.status !== 'covered').length,
            critical_covered: fallbackItems.filter(item => item.priority === 'critical' && item.status === 'covered').length,
            important_pending: fallbackItems.filter(item => item.priority === 'important' && item.status !== 'covered').length,
            important_covered: fallbackItems.filter(item => item.priority === 'important' && item.status === 'covered').length,
            optional_pending: fallbackItems.filter(item => item.priority === 'optional' && item.status !== 'covered').length,
            optional_covered: fallbackItems.filter(item => item.priority === 'optional' && item.status === 'covered').length
          });
          
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
  }, [roomId]);

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
      console.log('📝 Creating manual checklist:', { detectionAreas, verificationSteps });
      
      // TODO: Implement manual checklist creation in ChecklistService
      // For now, create a basic checklist structure
      const manualChecklist: SessionChecklist = {
        id: `manual-${roomId}-${Date.now()}`,
        room_id: roomId,
        template_name: 'Manual Input',
        session_start: new Date(),
        detection_areas: detectionAreas.map((text, index) => ({
          id: `manual-detection-${index}`,
          area_text: text,
          item_type: 'detection_area' as const,
          priority: 'important' as const,
          status: 'pending' as const,
          understanding_level: 'none' as const,
          tutor_notes: '',
          last_addressed: null,
          attempts_count: 0,
          original_template_area: false,
          coverage_evidence: [],
          created_at: new Date(),
          updated_at: new Date()
        })),
        verification_steps: verificationSteps.map((text, index) => ({
          id: `manual-verification-${index}`,
          area_text: text,
          item_type: 'verification_step' as const,
          priority: 'important' as const,
          status: 'pending' as const,
          understanding_level: 'none' as const,
          tutor_notes: '',
          last_addressed: null,
          attempts_count: 0,
          original_template_area: false,
          coverage_evidence: [],
          created_at: new Date(),
          updated_at: new Date()
        })),
        total_items: detectionAreas.length + verificationSteps.length,
        completed_items: 0,
        completion_percentage: 0,
        created_at: new Date(),
        updated_at: new Date(),
        is_active: true
      };

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
      const total = manualChecklist.total_items;
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
  }, [roomId]);

  // Update checklist item
  const updateItem = useCallback(async (itemId: string, updates: Partial<ChecklistItem>) => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      console.log('📝 Updating checklist item:', itemId, updates);
      await RoomFeaturesService.checklist.update(itemId, updates);
      
      // Refresh checklist to get updated data
      await refreshChecklist();
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update item';
      setError(errorMessage);
      console.error('Failed to update checklist item:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // Refresh checklist data - reload existing data without clearing
  const refreshChecklist = useCallback(async () => {
    if (!roomId) return;

    console.log('🔄 Refreshing checklist data for room:', roomId);
    setLoading(true);
    setError(null);

    try {
      const updatedChecklist = await RoomFeaturesService.checklist.read(roomId);
      
      console.log('📊 Checklist refresh result:', {
        found: !!updatedChecklist,
        detectionAreas: updatedChecklist?.detection_areas.length || 0,
        verificationSteps: updatedChecklist?.verification_steps.length || 0
      });
      
      setChecklist(updatedChecklist);
      
      // Update progress only if checklist exists
      if (updatedChecklist) {
        const allItems = [...updatedChecklist.detection_areas, ...updatedChecklist.verification_steps];
        const covered = allItems.filter(item => item.status === 'covered').length;
        const total = allItems.length;
        const progress = total > 0 ? (covered / total) * 100 : 0;
        
        setProgress({
          total_areas: total,
          covered_areas: covered,
          partially_covered_areas: allItems.filter(item => item.status === 'partially_covered').length,
          pending_areas: allItems.filter(item => item.status === 'pending').length,
          completion_percentage: Math.round(progress),
          critical_pending: allItems.filter(item => item.priority === 'critical' && item.status !== 'covered').length,
          critical_covered: allItems.filter(item => item.priority === 'critical' && item.status === 'covered').length,
          important_pending: allItems.filter(item => item.priority === 'important' && item.status !== 'covered').length,
          important_covered: allItems.filter(item => item.priority === 'important' && item.status === 'covered').length,
          optional_pending: allItems.filter(item => item.priority === 'optional' && item.status !== 'covered').length,
          optional_covered: allItems.filter(item => item.priority === 'optional' && item.status === 'covered').length
        });
        
        console.log('✅ Checklist refreshed successfully');
      } else {
        setProgress(null);
        console.log('ℹ️ No checklist found for room after refresh - this is normal if no checklist exists yet');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh checklist';
      setError(errorMessage);
      console.error('❌ Failed to refresh checklist:', err);
      
      // Don't clear existing checklist on refresh error - keep what we have
      console.log('🔒 Preserving existing checklist data due to refresh error');
    } finally {
      setLoading(false);
    }
  }, [roomId]);

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
      refreshChecklist();
    }
  }, [roomId, refreshChecklist]);

  return {
    // State
    checklist,
    loading,
    error,
    progress,
    
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
/**
 * useRoomFeatures Hook
 * Provides unified access to all room functionality including checklist, AI, and coverage
 */

import { useCallback, useEffect } from 'react';
import { RoomFeaturesService } from '../services/roomFeaturesService';
import { useChecklist, UseChecklistReturn } from './useChecklist';

export interface UseRoomFeaturesReturn {
  // Checklist functionality
  checklist: UseChecklistReturn;
  
  // Room management
  initializeRoom: () => Promise<void>;
  cleanupRoom: () => Promise<void>;
  
  // Service health
  serviceHealth: Record<string, boolean>;
}

/**
 * Custom hook for unified room features management
 * @param roomId - Room identifier
 * @returns All room functionality through service layer
 */
export function useRoomFeatures(roomId: string): UseRoomFeaturesReturn {
  const checklist = useChecklist(roomId);

  // Initialize room features
  const initializeRoom = useCallback(async () => {
    if (!roomId) return;

    try {
      console.log('🏗️ Initializing room features for:', roomId);
      await RoomFeaturesService.initializeRoom(roomId);
    } catch (error) {
      console.error('Failed to initialize room features:', error);
    }
  }, [roomId]);

  // Cleanup room features
  const cleanupRoom = useCallback(async () => {
    if (!roomId) return;

    try {
      console.log('🧹 Cleaning up room features for:', roomId);
      await RoomFeaturesService.cleanupRoom(roomId);
    } catch (error) {
      console.error('Failed to cleanup room features:', error);
    }
  }, [roomId]);

  // Get service health status
  const serviceHealth = RoomFeaturesService.getServiceHealth();

  // Initialize room on mount
  useEffect(() => {
    if (roomId) {
      initializeRoom();
    }

    // Cleanup on unmount
    return () => {
      cleanupRoom();
    };
  }, [roomId, initializeRoom, cleanupRoom]);

  return {
    // Checklist functionality
    checklist,

    // Room management
    initializeRoom,
    cleanupRoom,

    // Service health
    serviceHealth,
  };
}

// Export individual hooks for granular access
export { useChecklist } from './useChecklist';
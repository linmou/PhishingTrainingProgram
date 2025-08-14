/**
 * Unified Room Features Service
 * Central hub for all room-related functionality including checklist, AI, and coverage detection.
 * Provides a clean abstraction layer for components to access room features.
 */

import { ChecklistService } from './checklistService';
import * as aiService from './aiService';
import { CoverageDetectionService } from './coverageDetectionService';

/**
 * Service contracts for type safety and extensibility
 */
export interface IRoomFeaturesService {
  checklist: typeof ChecklistService;
  ai: typeof aiService;
  coverage: typeof CoverageDetectionService;
}

/**
 * Main Room Features Service
 * Provides unified access to all room functionality
 */
export class RoomFeaturesService {
  /**
   * Checklist management functionality
   * Handles all checklist CRUD operations, real-time updates, and coverage integration
   */
  static readonly checklist = ChecklistService;

  /**
   * AI assistant functionality  
   * Handles AI response generation, configuration, and context management
   */
  static readonly ai = aiService;

  /**
   * Coverage detection functionality
   * Handles content analysis, evidence detection, and coverage tracking
   */
  static readonly coverage = CoverageDetectionService;

  /**
   * Initialize all services for a room
   * @param roomId - Room identifier
   * @returns Promise resolving when all services are initialized
   */
  static async initializeRoom(roomId: string): Promise<void> {
    // Initialize services that require setup
    // Currently, services are stateless, but this provides extension point
    console.log(`🏗️ Initializing room features for room: ${roomId}`);
  }

  /**
   * Cleanup all services for a room
   * @param roomId - Room identifier  
   * @returns Promise resolving when cleanup is complete
   */
  static async cleanupRoom(roomId: string): Promise<void> {
    // Cleanup any subscriptions or resources
    console.log(`🧹 Cleaning up room features for room: ${roomId}`);
  }

  /**
   * Get service health status
   * @returns Object containing health status of all services
   */
  static getServiceHealth(): Record<string, boolean> {
    return {
      checklist: true, // ChecklistService is always available
      ai: true,        // aiService is always available  
      coverage: true   // CoverageDetectionService is always available
    };
  }
}

// Export for backward compatibility and direct access  
export { ChecklistService, CoverageDetectionService };
export { aiService };

// Default export
export default RoomFeaturesService;
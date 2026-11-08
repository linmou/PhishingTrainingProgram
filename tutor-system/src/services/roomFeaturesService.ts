/**
 * Room feature service access used by the application.
 * Components and useChecklist own their effects and resource cleanup.
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

}

// Export for backward compatibility and direct access  
export { ChecklistService, CoverageDetectionService };
export { aiService };

// Default export
export default RoomFeaturesService;

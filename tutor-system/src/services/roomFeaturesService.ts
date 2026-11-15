/**
 * Room feature service access used by the application.
 * Components and useChecklist own their effects and resource cleanup.
 */

import { ChecklistService } from './checklistService';
import * as aiService from './aiService';

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


}

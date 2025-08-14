/**
 * Tests for Checklist Management System
 * Covers core functionality, tutor interface, and manual operations
 */

import { ChecklistService } from '../services/checklistService';
import { ChecklistItem, SessionChecklist, CoverageEvidence } from '../types/checklist';

// Mock Supabase client
jest.mock('../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      single: jest.fn(),
      then: jest.fn()
    }))
  }
}));

describe('Checklist Management System', () => {
  const mockStudent = {
    id: 'student-123',
    role: 'student' as const
  };

  const mockRoom = {
    id: 'room-456'
  };

  const mockChecklistItems: ChecklistItem[] = [
    {
      id: '1',
      area_text: '[understanding] URL verification techniques',
      item_type: 'detection_area',
      priority: 'critical',
      status: 'pending',
      understanding_level: 'none',
      coverage_evidence: [],
      tutor_notes: '',
      last_addressed: null,
      attempts_count: 0,
      original_template_area: true,
      deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '2',
      area_text: '[behavior] Check domain manually before clicking',
      item_type: 'detection_area',
      priority: 'critical',
      status: 'pending',
      understanding_level: 'none',
      coverage_evidence: [],
      tutor_notes: '',
      last_addressed: null,
      attempts_count: 0,
      original_template_area: true,
      deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    },
    {
      id: '3',
      area_text: '[understanding] Social engineering recognition',
      item_type: 'detection_area',
      priority: 'important',
      status: 'covered',
      understanding_level: 'good',
      coverage_evidence: [
        {
          id: 'evidence-1',
          evidence_text: 'Student identified emotional manipulation tactics',
          analysis: 'Student correctly recognized pressure techniques',
          confidence_score: 85,
          detection_method: 'ai_analysis',
          timestamp: new Date(),
          message_id: 'msg-1'
        }
      ],
      tutor_notes: 'Good understanding demonstrated',
      last_addressed: new Date(),
      attempts_count: 1,
      original_template_area: true,
      deleted: false,
      created_at: new Date(),
      updated_at: new Date()
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Core Checklist Operations', () => {
    it('should create checklist for student from template', async () => {
      const mockTemplate = {
        id: 'template-1',
        name: 'Phishing Email Training',
        items: [
          '[understanding] Sender verification techniques',
          '[behavior] Check sender email manually',
          '[understanding] Link analysis methods',
          '[behavior] Hover over links without clicking'
        ]
      };

      // Mock Supabase responses
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().select().single.mockResolvedValueOnce({
        data: mockTemplate,
        error: null
      });

      mockSupabase.from().insert().select().mockResolvedValueOnce({
        data: [{ id: 'checklist-1' }],
        error: null
      });

      mockSupabase.from().insert().mockResolvedValueOnce({
        data: mockChecklistItems,
        error: null
      });

      const result = await ChecklistService.createChecklistFromTemplate(
        mockStudent.id,
        mockRoom.id,
        mockTemplate.id
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('session_checklists');
      expect(mockSupabase.from).toHaveBeenCalledWith('checklist_items');
    });

    it('should extract checklist items from system prompt', () => {
      const systemPrompt = `
        You are helping students identify phishing attempts. Guide them to:
        - Understand how attackers create urgency to pressure victims
        - Recognize suspicious URLs and domains
        - Learn to manually verify sender authenticity
        - Always hover over links before clicking
        - Report suspicious content to appropriate authorities
      `;

      const extractedItems = ChecklistService.extractFromSystemPrompt(systemPrompt);

      expect(extractedItems.length).toBeGreaterThan(0);
      expect(extractedItems.some(item => item.includes('[understanding]'))).toBe(true);
      expect(extractedItems.some(item => item.includes('[behavior]'))).toBe(true);
    });

    it('should calculate progress percentages correctly', () => {
      const progress = ChecklistService.calculateProgress(mockChecklistItems);

      expect(progress.overall_percentage).toBe(33); // 1 out of 3 covered
      expect(progress.covered_count).toBe(1);
      expect(progress.pending_count).toBe(2);
      expect(progress.partially_covered_count).toBe(0);
    });

    it('should handle cognitive vs behavioral categorization', () => {
      const categorized = ChecklistService.categorizeItems(mockChecklistItems);

      expect(categorized.understanding.length).toBe(2);
      expect(categorized.behavior.length).toBe(1);
      expect(categorized.understanding[0].area_text).toContain('[understanding]');
      expect(categorized.behavior[0].area_text).toContain('[behavior]');
    });
  });

  describe('Manual Status Management', () => {
    it('should allow tutor to manually mark item as covered', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().update().eq().select().single.mockResolvedValueOnce({
        data: { ...mockChecklistItems[0], status: 'covered', understanding_level: 'good' },
        error: null
      });

      const result = await ChecklistService.updateItemStatus(
        '1',
        'covered',
        {
          understanding_level: 'good',
          tutor_notes: 'Student demonstrated understanding verbally'
        }
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('checklist_items');
    });

    it('should allow tutor to mark item as partially covered', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().update().eq().select().single.mockResolvedValueOnce({
        data: { ...mockChecklistItems[0], status: 'partially_covered', understanding_level: 'basic' },
        error: null
      });

      const result = await ChecklistService.updateItemStatus(
        '1',
        'partially_covered',
        {
          understanding_level: 'basic',
          tutor_notes: 'Student identified some aspects but missed key points'
        }
      );

      expect(result.success).toBe(true);
    });

    it('should allow tutor to override AI coverage detection', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().update().eq().select().single.mockResolvedValueOnce({
        data: { ...mockChecklistItems[2], status: 'partially_covered' },
        error: null
      });

      // Mock logging the override
      mockSupabase.from().insert().mockResolvedValueOnce({
        data: [{ id: 'override-1' }],
        error: null
      });

      const result = await ChecklistService.overrideAIAssessment(
        '3',
        'partially_covered',
        'Student needs more practice with complex social engineering scenarios'
      );

      expect(result.success).toBe(true);
      expect(result.override_logged).toBe(true);
    });
  });

  describe('Custom Item Management', () => {
    it('should allow tutor to add custom checklist item', async () => {
      const customItem = {
        area_text: '[understanding] Emotional manipulation tactics',
        priority: 'important' as const,
        description: 'Student should recognize emotional pressure techniques'
      };

      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().insert().select().single.mockResolvedValueOnce({
        data: { id: 'custom-1', ...customItem, status: 'pending' },
        error: null
      });

      const result = await ChecklistService.addCustomItem(
        'checklist-1',
        customItem
      );

      expect(result.success).toBe(true);
      expect(result.item.area_text).toBe(customItem.area_text);
    });

    it('should validate cognitive/behavioral categorization for custom items', () => {
      const validItems = [
        '[understanding] Email authenticity assessment',
        '[behavior] Verify through official channels'
      ];

      const invalidItems = [
        'Missing prefix item',
        '[invalid] Wrong prefix'
      ];

      validItems.forEach(item => {
        const isValid = ChecklistService.validateItemFormat(item);
        expect(isValid).toBe(true);
      });

      invalidItems.forEach(item => {
        const isValid = ChecklistService.validateItemFormat(item);
        expect(isValid).toBe(false);
      });
    });

    it('should support soft delete of checklist items', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().update().eq().mockResolvedValueOnce({
        data: { ...mockChecklistItems[0], deleted: true },
        error: null
      });

      const result = await ChecklistService.softDeleteItem('1');

      expect(result.success).toBe(true);
      expect(mockSupabase.from().update).toHaveBeenCalledWith({ deleted: true });
    });

    it('should preserve evidence when soft deleting items', async () => {
      const itemWithEvidence = mockChecklistItems[2]; // Has coverage evidence

      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().update().eq().mockResolvedValueOnce({
        data: { ...itemWithEvidence, deleted: true },
        error: null
      });

      // Evidence should remain in database
      mockSupabase.from().select().eq().mockResolvedValueOnce({
        data: itemWithEvidence.coverage_evidence,
        error: null
      });

      const result = await ChecklistService.softDeleteItem('3');

      expect(result.success).toBe(true);
      expect(result.evidence_preserved).toBe(true);
    });
  });

  describe('Progress Analytics', () => {
    it('should generate detailed progress analytics', () => {
      const analytics = ChecklistService.generateAnalytics(mockChecklistItems, {
        session_start: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
        first_coverage_time: new Date(Date.now() - 18 * 60 * 1000) // 18 minutes ago
      });

      expect(analytics.time_to_first_coverage_minutes).toBe(12);
      expect(analytics.most_difficult_items).toBeDefined();
      expect(analytics.coverage_pattern).toBeDefined();
      expect(analytics.understanding_vs_behavior_balance).toBeDefined();
    });

    it('should identify understanding vs behavior progress patterns', () => {
      const pattern = ChecklistService.analyzeProgressPattern(mockChecklistItems);

      expect(pattern.understanding_progress).toBeDefined();
      expect(pattern.behavior_progress).toBeDefined();
      expect(pattern.recommendation).toBeDefined();
    });
  });

  describe('Template System Integration', () => {
    it('should fall back to templates when system prompt extraction fails', async () => {
      const emptyPrompt = 'You are a helpful assistant.'; // No extractable content

      const mockTemplate = {
        id: 'fallback-template',
        name: 'Generic Phishing Training',
        items: [
          '[understanding] Basic phishing recognition',
          '[behavior] Safe browsing practices'
        ]
      };

      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().select().mockResolvedValueOnce({
        data: [mockTemplate],
        error: null
      });

      const result = await ChecklistService.createChecklistFromPromptWithFallback(
        mockStudent.id,
        mockRoom.id,
        emptyPrompt
      );

      expect(result.success).toBe(true);
      expect(result.used_template_fallback).toBe(true);
      expect(result.template_name).toBe(mockTemplate.name);
    });

    it('should maintain simplified template format', () => {
      const templateItems = [
        '[understanding] URL verification techniques',
        '[behavior] Check domain manually',
        '[understanding] Social engineering recognition',
        '[behavior] Report suspicious content'
      ];

      const formatted = ChecklistService.formatTemplateItems(templateItems);

      formatted.forEach(item => {
        expect(item.area_text).toMatch(/^\[(understanding|behavior)\]/);
        expect(item.priority).toBeDefined();
        expect(item.status).toBe('pending');
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should support real-time progress updates', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      
      // Mock subscription setup
      const mockSubscription = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn()
      };
      mockSupabase.from().on.mockReturnValue(mockSubscription);

      const callback = jest.fn();
      const subscription = ChecklistService.subscribeToProgressUpdates(
        'checklist-1',
        callback
      );

      expect(mockSupabase.from).toHaveBeenCalledWith('checklist_items');
      expect(mockSubscription.on).toHaveBeenCalledWith('UPDATE');
    });

    it('should handle real-time status changes', () => {
      const mockUpdate = {
        new: { ...mockChecklistItems[0], status: 'covered' },
        old: mockChecklistItems[0]
      };

      const processedUpdate = ChecklistService.processRealtimeUpdate(mockUpdate);

      expect(processedUpdate.item_id).toBe('1');
      expect(processedUpdate.status_changed).toBe(true);
      expect(processedUpdate.new_status).toBe('covered');
    });
  });

  describe('Student-Level Management', () => {
    it('should maintain individual student checklists', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'checklist-1',
          student_id: mockStudent.id,
          room_id: mockRoom.id,
          items: mockChecklistItems
        },
        error: null
      });

      const checklist = await ChecklistService.getStudentChecklist(
        mockStudent.id,
        mockRoom.id
      );

      expect(checklist.success).toBe(true);
      expect(checklist.checklist.student_id).toBe(mockStudent.id);
    });

    it('should preserve student progress across sessions', async () => {
      const existingProgress = mockChecklistItems;
      
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().select().eq().mockResolvedValueOnce({
        data: existingProgress,
        error: null
      });

      // Student rejoins the same room
      const restoredProgress = await ChecklistService.restoreStudentProgress(
        mockStudent.id,
        mockRoom.id
      );

      expect(restoredProgress.success).toBe(true);
      expect(restoredProgress.items.length).toBe(mockChecklistItems.length);
      expect(restoredProgress.items.find(item => item.status === 'covered')).toBeDefined();
    });
  });

  describe('Optional Metadata Handling', () => {
    it('should work with minimal required fields only', () => {
      const minimalItem: Partial<ChecklistItem> = {
        id: '1',
        area_text: '[understanding] Basic concept',
        status: 'pending'
      };

      const processed = ChecklistService.processMinimalItem(minimalItem);

      expect(processed.area_text).toBe(minimalItem.area_text);
      expect(processed.status).toBe('pending');
      expect(processed.priority).toBe('important'); // Default value
      expect(processed.understanding_level).toBe('none'); // Default value
    });

    it('should utilize optional metadata when provided', () => {
      const fullItem: ChecklistItem = mockChecklistItems[0];

      const processed = ChecklistService.processItemWithMetadata(fullItem);

      expect(processed.uses_priority).toBe(true);
      expect(processed.uses_understanding_level).toBe(true);
      expect(processed.metadata_complete).toBe(true);
    });

    it('should adapt UI based on metadata availability', () => {
      const itemsWithoutMetadata = mockChecklistItems.map(item => ({
        ...item,
        priority: undefined,
        understanding_level: undefined
      }));

      const uiConfig = ChecklistService.generateUIConfig(itemsWithoutMetadata);

      expect(uiConfig.show_priority_controls).toBe(false);
      expect(uiConfig.show_understanding_levels).toBe(false);
      expect(uiConfig.simplified_mode).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection failures gracefully', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().select().mockRejectedValueOnce(new Error('Connection failed'));

      const result = await ChecklistService.getStudentChecklist(
        mockStudent.id,
        mockRoom.id
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection failed');
      expect(result.fallback_available).toBe(true);
    });

    it('should validate checklist item format', () => {
      const invalidItems = [
        '', // Empty
        'No prefix', // Missing category prefix
        '[invalid] Wrong prefix', // Invalid prefix
        '[understanding]', // No content after prefix
      ];

      invalidItems.forEach(item => {
        const isValid = ChecklistService.validateItemFormat(item);
        expect(isValid).toBe(false);
      });
    });

    it('should handle soft delete conflicts', async () => {
      const mockSupabase = require('../services/supabaseClient').supabase;
      mockSupabase.from().update().eq().mockRejectedValueOnce(
        new Error('Item is referenced by active evidence')
      );

      const result = await ChecklistService.softDeleteItem('3');

      expect(result.success).toBe(false);
      expect(result.conflict_reason).toBe('evidence_exists');
      expect(result.suggested_action).toBe('archive_instead');
    });
  });
});
#!/usr/bin/env node
/**
 * Test target: src/services/checklistService.ts and its checklist generation contract.
 * Purpose: verify supported room, transfer, progress, evidence, and AI coverage behavior while
 * retaining unresolved feature clauses as explicit pending tests.
 */

import { ChecklistIntegration } from '../services/checklistIntegration';
import { ChecklistService } from '../services/checklistService';
import { CoverageDetectionService } from '../services/coverageDetectionService';
import { LLMExtractionService } from '../services/llmExtractionService';
import { supabase } from '../services/supabase';
import { ChecklistItem, SessionChecklist } from '../types/checklist';

jest.mock('../services/supabase', () => {
  return {
    supabase: {
      from: jest.fn(),
      rpc: jest.fn()
    }
  };
});

jest.mock('../services/llmExtractionService', () => ({
  LLMExtractionService: {
    extractFromSystemPrompt: jest.fn()
  }
}));

type MockQuery = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
};

const mockSupabase = supabase as unknown as {
  from: jest.Mock;
  rpc: jest.Mock;
};

let mockQuery: MockQuery;

const createMockQuery = (): MockQuery => ({
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  maybeSingle: jest.fn(),
  single: jest.fn()
});

const buildItem = (overrides: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id: 'item-1',
  area_text: 'Verify the sender',
  item_type: 'detection_area',
  priority: 'important',
  status: 'pending',
  understanding_level: 'none',
  coverage_evidence: [],
  tutor_notes: '',
  last_addressed: null,
  attempts_count: 0,
  original_template_area: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides
});

const buildChecklist = (
  detectionAreas: ChecklistItem[] = [buildItem()],
  verificationSteps: ChecklistItem[] = []
): SessionChecklist => ({
  id: 'checklist-1',
  room_id: 'room-1',
  template_name: 'Phishing Email Training',
  session_start: new Date('2026-01-01T00:00:00.000Z'),
  detection_areas: detectionAreas,
  verification_steps: verificationSteps,
  total_items: detectionAreas.length + verificationSteps.length,
  completed_items: [...detectionAreas, ...verificationSteps].filter((item) => item.status === 'covered').length,
  completion_percentage: 0,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  is_active: true
});

const databaseItem = (overrides: Record<string, unknown> = {}) => ({
  ...buildItem(),
  checklist_id: 'checklist-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides
});

describe('Checklist Management System', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery = createMockQuery();
    [
      mockQuery.select,
      mockQuery.insert,
      mockQuery.update,
      mockQuery.delete,
      mockQuery.eq
    ].forEach((method) => method.mockReturnValue(mockQuery));
    mockQuery.order.mockReturnValue(mockQuery);
    mockQuery.maybeSingle.mockReturnValue(mockQuery);
    mockQuery.single.mockReturnValue(mockQuery);
    mockSupabase.from.mockReturnValue(mockQuery);
    mockSupabase.rpc.mockReset();
    (LLMExtractionService.extractFromSystemPrompt as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Current checklist operations', () => {
    it('initializes a room checklist from the selected database template', async () => {
      const checklist = buildChecklist([
        buildItem({ area_text: '[understanding] Sender verification techniques' })
      ], [
        buildItem({
          id: 'item-2',
          area_text: '[behavior] Check sender email manually',
          item_type: 'verification_step'
        })
      ]);
      jest.spyOn(ChecklistService, 'getChecklistByRoom').mockResolvedValue(checklist);
      mockQuery.single.mockResolvedValueOnce({
        data: { active_response_mode: 'tutoring' },
        error: null
      });
      mockSupabase.rpc.mockResolvedValueOnce({ error: null });

      const result = await ChecklistService.initializeChecklistFromTemplate(
        'room-1',
        'Phishing Email Training'
      );

      expect(mockSupabase.rpc).toHaveBeenCalledWith('initialize_checklist_from_template', {
        p_room_id: 'room-1',
        p_template_name: 'Phishing Email Training'
      });
      expect(mockQuery.update).toHaveBeenCalledWith({ is_active: false });
      expect(result.detection_areas.every((item) => item.status === 'pending')).toBe(true);
      expect(result.verification_steps.every((item) => item.status === 'pending')).toBe(true);
    });

    it('extracts learning prefixes through the current async extraction API', async () => {
      (LLMExtractionService.extractFromSystemPrompt as jest.Mock).mockResolvedValue({
        understanding: ['URL verification techniques'],
        behavior: ['Hover over links before clicking']
      });

      await expect(ChecklistIntegration.extractFromSystemPromptAsync(
        'Teach students how to inspect suspicious links.'
      )).resolves.toEqual({
        understanding: ['[understanding] URL verification techniques'],
        behavior: ['[behavior] Hover over links before clicking']
      });
    });

    it('reads checklist items into the current detection and verification groups with evidence', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'checklist-1',
          room_id: 'room-1',
          template_name: 'Phishing Email Training',
          session_start: '2026-01-01T00:00:00.000Z',
          total_items: 2,
          completed_items: 1,
          completion_percentage: 50,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          is_active: true
        },
        error: null
      });
      mockQuery.order.mockResolvedValueOnce({
        data: [
          databaseItem({
            status: 'covered',
            coverage_evidence: [{
              id: 'evidence-1',
              evidence_text: 'Student identified the sender mismatch.',
              analysis: 'Recognized the spoofed sender.',
              confidence_score: 90,
              detection_method: 'ai_analysis',
              timestamp: '2026-01-01T00:05:00.000Z',
              message_id: 'message-1'
            }]
          }),
          databaseItem({
            id: 'item-2',
            item_type: 'verification_step',
            area_text: 'Verify the domain manually',
            coverage_evidence: []
          })
        ],
        error: null
      });

      const result = await ChecklistService.getChecklistByRoom('room-1');

      expect(result?.detection_areas).toHaveLength(1);
      expect(result?.verification_steps).toHaveLength(1);
      expect(result?.detection_areas[0].coverage_evidence[0]).toMatchObject({
        evidence_text: 'Student identified the sender mismatch.',
        detection_method: 'ai_analysis',
        confidence_score: 90
      });
    });

    it('calculates current progress totals and works without optional item metadata', async () => {
      jest.spyOn(ChecklistService, 'getChecklistByRoom').mockResolvedValue(buildChecklist([
        buildItem({ status: 'covered', priority: 'critical' }),
        buildItem({ id: 'item-2', status: 'partially_covered', priority: 'important' }),
        buildItem({
          id: 'item-3',
          status: 'pending',
          priority: undefined,
          understanding_level: undefined
        })
      ]));

      await expect(ChecklistService.getProgress('room-1')).resolves.toEqual({
        total_areas: 3,
        covered_areas: 1,
        partially_covered_areas: 1,
        pending_areas: 1,
        completion_percentage: 33,
        critical_pending: 0,
        critical_covered: 1,
        important_pending: 1,
        important_covered: 0,
        optional_pending: 0,
        optional_covered: 0
      });
    });

    it('saves a tutor status update with its note, history row, and manual evidence', async () => {
      const note = 'Student verified the domain verbally.';
      mockQuery.single
        .mockResolvedValueOnce({ data: databaseItem({ attempts_count: 1 }), error: null })
        .mockResolvedValueOnce({ data: { room_id: 'room-1' }, error: null })
        .mockResolvedValueOnce({ data: { active_response_mode: 'tutoring' }, error: null })
        .mockResolvedValueOnce({
          data: databaseItem({ status: 'covered', tutor_notes: note, attempts_count: 2 }),
          error: null
        });

      await expect(ChecklistService.updateItemStatus('item-1', 'covered', note)).resolves.toMatchObject({
        id: 'item-1',
        status: 'covered',
        tutor_notes: note,
        attempts_count: 2
      });

      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({
        status: 'covered',
        tutor_notes: note,
        attempts_count: 2
      }));
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        previous_status: 'pending',
        new_status: 'covered',
        updated_by: 'tutor'
      }));
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        evidence_text: note,
        detection_method: 'tutor_manual'
      }));
    });

    it('supports partial status updates when optional metadata is absent', async () => {
      const note = 'Student named a clue but missed the main risk.';
      mockQuery.single
        .mockResolvedValueOnce({
          data: databaseItem({ priority: undefined, understanding_level: undefined }),
          error: null
        })
        .mockResolvedValueOnce({ data: { room_id: 'room-1' }, error: null })
        .mockResolvedValueOnce({ data: { active_response_mode: 'tutoring' }, error: null })
        .mockResolvedValueOnce({
          data: databaseItem({
            priority: undefined,
            understanding_level: undefined,
            status: 'partially_covered',
            tutor_notes: note,
            attempts_count: 1
          }),
          error: null
        });

      await expect(ChecklistService.updateItemStatus(
        'item-1',
        'partially_covered',
        note
      )).resolves.toMatchObject({
        status: 'partially_covered',
        tutor_notes: note
      });
    });

    it('adds a custom detection or verification area with the selected priority', async () => {
      mockQuery.single
        .mockResolvedValueOnce({ data: { active_response_mode: 'tutoring' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'checklist-1' }, error: null })
        .mockResolvedValueOnce({
          data: databaseItem({
            id: 'custom-item',
            item_type: 'verification_step',
            area_text: 'Verify through official channels',
            priority: 'critical',
            status: 'pending',
            original_template_area: false
          }),
          error: null
        });

      await expect(ChecklistService.addCustomArea(
        'room-1',
        'Verify through official channels',
        'verification_step',
        'critical'
      )).resolves.toMatchObject({
        id: 'custom-item',
        item_type: 'verification_step',
        status: 'pending',
        priority: 'critical'
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('session_checklists');
      expect(mockSupabase.from).toHaveBeenCalledWith('checklist_items');
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        checklist_id: 'checklist-1',
        item_type: 'verification_step',
        status: 'pending',
        priority: 'critical'
      }));
    });

    it('uses the selected template when prompt extraction fails', async () => {
      const fallback = buildChecklist();
      jest.spyOn(ChecklistService, 'createFromSystemPrompt').mockRejectedValue(
        new Error('No extractable areas')
      );
      const createSpy = jest.spyOn(ChecklistService, 'create').mockResolvedValue(fallback);

      await expect(ChecklistService.createFromSystemPromptOrTemplate(
        'room-1',
        'Generic prompt',
        'Phishing Email Training'
      )).resolves.toBe(fallback);

      expect(createSpy).toHaveBeenCalledWith('room-1', 'Phishing Email Training');
    });

    it('restores persisted transfer progress only for the requested learner', async () => {
      mockQuery.maybeSingle.mockResolvedValueOnce({
        data: {
          id: 'transfer-checklist',
          room_id: 'room-1',
          student_id: 'student-1',
          template_name: 'Transfer Assessment',
          session_start: '2026-01-01T00:00:00.000Z',
          total_items: 1,
          completed_items: 0,
          completion_percentage: 0,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
          is_active: true
        },
        error: null
      });
      mockQuery.order.mockResolvedValueOnce({
        data: [databaseItem({
          status: 'partially_covered',
          item_type: 'detection_area'
        })],
        error: null
      });

      const result = await ChecklistService.getChecklistForStudent('room-1', 'student-1');

      expect(mockQuery.eq).toHaveBeenCalledWith('student_id', 'student-1');
      expect(result).toMatchObject({
        student_id: 'student-1',
        progress_policy_version: 'transfer_v1'
      });
      expect(result?.detection_areas[0].status).toBe('partially_covered');
    });

    it('records AI-detected coverage without replacing the room prompt', async () => {
      const checklist = buildChecklist([buildItem()]);
      const detectionResults = {
        detected_coverage: [{
          item_id: 'item-1',
          evidence: 'The student checked the displayed sender domain.',
          confidence: 90,
          understanding_level: 'good' as const
        }],
        analysis_confidence: 90,
        requires_tutor_review: false
      };
      const coverageUpdate = {
        item_id: 'item-1',
        new_status: 'covered' as const,
        new_understanding: 'good' as const,
        evidence: {
          evidence_text: 'The student checked the displayed sender domain.',
          analysis: 'The learner recognized the sender mismatch.',
          confidence_score: 90,
          detection_method: 'ai_analysis' as const,
          message_id: 'message-1'
        }
      };
      jest.spyOn(ChecklistService, 'getChecklistByRoom').mockResolvedValue(checklist);
      jest.spyOn(CoverageDetectionService, 'analyzeStudentResponse').mockResolvedValue(detectionResults);
      jest.spyOn(CoverageDetectionService, 'validateDetectionResults').mockReturnValue(detectionResults);
      jest.spyOn(CoverageDetectionService, 'convertToChecklistUpdates').mockResolvedValue([coverageUpdate]);
      mockQuery.single
        .mockResolvedValueOnce({ data: { active_response_mode: 'tutoring' }, error: null })
        .mockResolvedValueOnce({ data: { attempts_count: 0 }, error: null })
        .mockResolvedValueOnce({
          data: databaseItem({
            status: 'covered',
            understanding_level: 'good',
            attempts_count: 1,
            coverage_evidence: []
          }),
          error: null
        });

      const result = await ChecklistService.processStudentMessage(
        'room-1',
        'I checked the sender domain and found a mismatch.',
        'message-1'
      );

      expect(result.updatedItems).toHaveLength(1);
      expect(result.updatedItems[0].status).toBe('covered');
      expect(result.promptRegenerated).toBe(false);
      expect(mockQuery.update).not.toHaveBeenCalledWith(expect.objectContaining({ ai_assistant_prompt: expect.anything() }));
      expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
        item_id: 'item-1',
        evidence_text: 'The student checked the displayed sender domain.',
        detection_method: 'ai_analysis'
      }));
    });

    it('updates priority through the supported item metadata API', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: databaseItem({ priority: 'critical' }),
        error: null
      });

      await expect(ChecklistService.updateItemPriority('item-1', 'critical')).resolves.toMatchObject({
        id: 'item-1',
        priority: 'critical'
      });
      expect(mockQuery.update).toHaveBeenCalledWith(expect.objectContaining({ priority: 'critical' }));
    });

    it('returns null when no active room checklist exists', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' }
      });

      await expect(ChecklistService.getChecklistByRoom('room-1')).resolves.toBeNull();
    });

    it('throws a descriptive error for a checklist database failure', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'DB_DOWN', message: 'Connection failed' }
      });

      await expect(ChecklistService.getChecklistByRoom('room-1')).rejects.toThrow(
        'Checklist not found for room: Connection failed'
      );
    });
  });

  describe('Pending checklist feature coverage', () => {
    it.todo('PENDING FEATURE: tutor status changes refresh AI guidance and show a reinforcement cue');

    it.todo('PENDING FEATURE: custom items retain their description and appear in regenerated AI prompts');

    it.todo('PENDING FEATURE: individual items can be soft-deleted and excluded from recalculated progress');

    it.todo('PENDING FEATURE: coverage evidence remains available after an item is soft-deleted');

    it.todo('PENDING FEATURE: analytics report time to first coverage, hardest and strongest items, and AI accuracy');

    it.todo('PENDING FEATURE: analytics identify coverage patterns and recommend interventions');

    it.todo('PENDING FEATURE: open panels receive checklist and progress changes without a page refresh');

    it.todo('PENDING FEATURE: template changes regenerate AI prompts with the replacement items');

    it.todo('PENDING FEATURE: understanding and behavior objectives remain separate and mixed concepts split into items');

    it.todo('PENDING FEATURE: legacy room checklists preserve separate progress for each learner across sessions');

    it.todo('PENDING FEATURE: tutors can set understanding levels and metadata controls adapt when optional fields are absent');

    it.todo('PENDING FEATURE: mastery regression alerts include recommendations and an item reset action');

    it.todo('PENDING FEATURE: AI outages show Manual Mode and queue updates for synchronization without interrupting the session');
  });
});

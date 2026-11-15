#!/usr/bin/env node
/**
 * Test target: src/services/checklistService.ts and its checklist generation contract.
 * Purpose: verify the currently supported checklist service and integration behavior.
 */

import { ChecklistIntegration } from '../services/checklistIntegration';
import { ChecklistService } from '../services/checklistService';
import { LLMExtractionService } from '../services/llmExtractionService';
import { supabase } from '../services/supabase';
import { ChecklistItem, SessionChecklist } from '../types/checklist';

jest.mock('../services/supabase', () => {
  return {
    supabase: {
      from: jest.fn(),
      rpc: jest.fn(),
      functions: { invoke: jest.fn() }
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
  functions: { invoke: jest.Mock };
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
    mockSupabase.functions.invoke.mockReset().mockResolvedValue({ data: { ok: true, data: [] }, error: null });
    window.localStorage.setItem('tutor_system_user', JSON.stringify({ id: 'tutor-1' }));
    (LLMExtractionService.extractFromSystemPrompt as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Current checklist operations', () => {

    it('passes the unified learning-target list through the async extraction API', async () => {
      (LLMExtractionService.extractFromSystemPrompt as jest.Mock).mockResolvedValue({
        detection_areas: ['URL verification techniques', 'Hover over links before clicking']
      });

      await expect(ChecklistIntegration.extractFromSystemPromptAsync(
        'Teach students how to inspect suspicious links.'
      )).resolves.toEqual({
        detection_areas: ['URL verification techniques', 'Hover over links before clicking']
      });
    });

    it('reads checklist items into the current detection and verification groups with evidence', async () => {
      mockQuery.single.mockResolvedValueOnce({
        data: {
          id: 'checklist-1',
          room_id: 'room-1',
          progress_policy_version: 'legacy_v1',
          student_id: null,
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

      expect(result?.progress_policy_version).toBe('legacy_v1');
      expect(result?.student_id).toBeNull();
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
      expect(result?.detection_areas[0].coverage_evidence).toEqual([]);
      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('assessment-api', {
        body: { operation: 'read_learning_evidence', request_id: expect.any(String), room_id: 'room-1', checklist_id: 'transfer-checklist' },
        headers: { 'x-application-user-id': 'tutor-1' },
      });
      expect(mockQuery.select.mock.calls.every(([columns]) => !columns.includes('coverage_evidence'))).toBe(true);
    });

    it('maps scoped evidence to its own item and preserves evidence dates', async () => {
      mockQuery.maybeSingle.mockResolvedValueOnce({ data: { ...buildChecklist(), student_id: 'student-1' }, error: null });
      mockQuery.order.mockResolvedValueOnce({ data: [databaseItem({ id: 'detect' }), databaseItem({ id: 'verify', item_type: 'verification_step' })], error: null });
      const row = { id: 'evidence-1', item_id: 'verify', evidence_text: 'Saved observation', analysis: 'Saved analysis',
        confidence_score: 80, detection_method: 'tutor_manual', message_id: 'message-1', timestamp: '2026-11-12T12:00:00Z' };
      mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { ok: true, data: [row, { ...row, id: 'foreign-evidence', item_id: 'foreign-item' }] }, error: null });
      const result = await ChecklistService.getChecklistForStudent('room-1', 'student-1');
      expect(result?.detection_areas[0].coverage_evidence).toEqual([]);
      expect(result?.verification_steps[0].coverage_evidence).toEqual([{
        id: row.id, evidence_text: row.evidence_text, analysis: row.analysis, confidence_score: row.confidence_score,
        detection_method: row.detection_method, message_id: row.message_id, timestamp: new Date(row.timestamp),
      }]);
      expect(JSON.stringify(result)).not.toContain('foreign-evidence');
    });

    it.each(['FORBIDDEN', 'PERSISTENCE_FAILED'])('surfaces evidence %s rather than returning apparently empty progress', async code => {
      mockQuery.maybeSingle.mockResolvedValueOnce({ data: { ...buildChecklist(), student_id: 'student-1' }, error: null });
      mockQuery.order.mockResolvedValueOnce({ data: [databaseItem()], error: null });
      mockSupabase.functions.invoke.mockResolvedValueOnce({ data: { ok: false, error: { code, message: 'Evidence unavailable', retryable: false } }, error: null });
      await expect(ChecklistService.getChecklistForStudent('room-1', 'student-1')).rejects.toMatchObject({ code, message: 'Evidence unavailable' });
    });

    it('does not read evidence when the requested learner has no active checklist', async () => {
      mockQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(ChecklistService.getChecklistForStudent('room-1', 'another-learner')).resolves.toBeNull();
      expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('student_id', 'another-learner');
      expect(mockQuery.eq).toHaveBeenCalledWith('is_active', true);
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

});

/** Real ChecklistService -> hook contract for historical read/export entry. */
import { renderHook, waitFor } from '@testing-library/react';
import { useChecklist } from '../useChecklist';
import { supabase } from '../../services/supabase';

jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ user: { id: 'tutor', current_role: 'tutor' } }) }));
jest.mock('../../hooks/useRealtimeInvalidation', () => ({ useRealtimeInvalidation: () => null }));
jest.mock('../../services/roomFeaturesService', () => ({ RoomFeaturesService: {
  checklist: jest.requireActual('../../services/checklistService').ChecklistService,
} }));
jest.mock('../../services/supabase', () => ({ supabase: { from: jest.fn() } }));

it('preserves real legacy metadata and evidence as history without installing current progress', async () => {
  const row = { id: 'historical', room_id: 'room', student_id: null, progress_policy_version: 'legacy_v1',
    template_name: 'Historical original', session_start: '2026-01-01', total_items: 1, completed_items: 1,
    completion_percentage: 100, created_at: '2026-01-01', updated_at: '2026-01-02', is_active: true };
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    const query = {
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      single: jest.fn().mockResolvedValue({ data: row, error: null }),
      order: jest.fn().mockResolvedValue({ data: table === 'checklist_items' ? [{
        id: 'old-item', checklist_id: row.id, area_text: 'Original target', item_type: 'detection_area',
        status: 'covered', understanding_level: 'excellent', priority: 'important',
        created_at: '2026-01-01', updated_at: '2026-01-02', coverage_evidence: [{
          id: 'old-evidence', evidence_text: 'Historical learner quote', analysis: 'Original analysis',
          confidence_score: 90, detection_method: 'ai_analysis', timestamp: '2026-01-02', message_id: 'old-message',
        }],
      }] : [], error: null }),
    };
    return query;
  });
  window.localStorage.clear();
  const { result } = renderHook(() => useChecklist('room', { enabled: false, studentId: null }));
  await waitFor(() => expect(result.current.priorChecklist?.id).toBe('historical'));
  expect(result.current.checklist).toBeNull();
  expect(result.current.progress).toBeNull();
  expect(result.current.priorChecklist?.progress_policy_version).toBe('legacy_v1');
  expect(result.current.priorChecklist?.detection_areas[0].coverage_evidence[0].evidence_text).toBe('Historical learner quote');
});

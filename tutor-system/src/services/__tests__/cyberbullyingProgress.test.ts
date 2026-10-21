// #!/usr/bin/env node
// Covers checklistService.ts and roomExportBuilder.ts: all five learner targets and durable evidence survive reading/export.
import { ChecklistService } from '../checklistService';
import { CYBERBULLYING_LEARNING_TARGETS } from '../detectionTemplates';
import { supabase } from '../supabase';
import { buildRoomExportData, buildRoomTextExport } from '../../contexts/roomExportBuilder';
import { transferRoom } from '../../test-support/transferRoomFixtures';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn() } }));

test('reads and exports understanding plus behavior targets with their learner and evidence identities', async () => {
  const now = '2026-10-21T12:00:00Z';
  const evidence = { id: 'evidence-1', evidence_text: 'Saved learner evidence', analysis: 'Recorded analysis',
    confidence_score: 90, detection_method: 'ai_analysis', timestamp: now, message_id: 'message-1' };
  const items = CYBERBULLYING_LEARNING_TARGETS.map((target, index) => ({
    id: 'item-' + index, target_key: target.key, area_text: target.description,
    item_type: index === 0 ? 'understanding' : 'behavior', priority: 'important',
    status: index === 1 ? 'covered' : 'pending', understanding_level: index === 1 ? 'good' : 'none',
    coverage_evidence: index === 1 ? [evidence] : [], created_at: now, updated_at: now,
  }));
  const checklist = { id: 'checklist-1', room_id: transferRoom.id, student_id: 'learner-1',
    target_version: 'cyberbullying_v1', template_name: 'Cyberbullying', session_start: now,
    total_items: 5, completed_items: 1, completion_percentage: 20, created_at: now, updated_at: now, is_active: true };
  const queries: any[] = [];
  (supabase.from as jest.Mock).mockImplementation(table => {
    const query: any = { select: jest.fn(() => query), eq: jest.fn(() => query),
      maybeSingle: jest.fn(async () => ({ data: checklist, error: null })),
      order: jest.fn(async () => ({ data: items, error: null })) };
    queries.push(query);
    return query;
  });
  const progress = await ChecklistService.getChecklistForStudent(transferRoom.id, 'learner-1');
  expect(queries[0].eq).toHaveBeenCalledWith('student_id', 'learner-1');
  expect(progress?.detection_areas).toHaveLength(1);
  expect(progress?.verification_steps).toHaveLength(4);
  expect(progress?.verification_steps[0].coverage_evidence[0].message_id).toBe('message-1');
  const args = { room: { ...transferRoom, practice_type: 'cyberbullying' as const }, messages: [],
    messageFeedbackStats: {}, feedbackSummary: null, aiInteractions: [], userRole: 'student' as const,
    userId: 'learner-1', learningProgress: progress };
  const exported = JSON.parse(JSON.stringify(buildRoomExportData(args)));
  expect(exported.learning_progress).toMatchObject({ student_id: 'learner-1', target_version: 'cyberbullying_v1' });
  expect(exported.learning_progress.verification_steps.map((item: any) => item.target_key))
    .toEqual(CYBERBULLYING_LEARNING_TARGETS.slice(1).map(target => target.key));
  expect(buildRoomTextExport(args)).toContain('Evidence [message-1]: Saved learner evidence');
  expect(buildRoomTextExport(args)).toContain('targets: cyberbullying_v1');
});

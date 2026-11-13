// #!/usr/bin/env node
// Covers checklistService.ts and roomExportBuilder.ts: all five learner targets and durable evidence survive reading/export.
import { ChecklistService } from '../checklistService';
import { CYBERBULLYING_LEARNING_TARGETS, CYBERBULLYING_TARGET_VERSION } from '../detectionTemplates';
import { supabase } from '../supabase';
import { buildRoomExportData, buildRoomTextExport } from '../../contexts/roomExportBuilder';
import { transferRoom } from '../../test-support/transferRoomFixtures';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));

const historicalTargets = [
  { key: 'recognize_cyberbullying_impact', description: 'Recognize harmful online behavior and explain its impact on the person targeted.' },
  { key: 'show_empathy_support', description: 'Acknowledge the targeted person’s feelings and offer a concrete supportive response.' },
  { key: 'stand_up_constructively', description: 'Challenge bullying with a calm, respectful response that avoids escalating the conflict.' },
  { key: 'avoid_reinforcing_bullying', description: 'Choose responses that avoid joining in, amplifying, or rewarding harmful behavior.' },
  { key: 'choose_safe_next_step', description: 'Choose an appropriate next step such as supporting the person privately, saving evidence, reporting, blocking, or seeking trusted help.' },
];

test.each(['cyberbullying_v1', CYBERBULLYING_TARGET_VERSION])('reads and exports %s targets with their learner, order and evidence identities', async targetVersion => {
  const now = '2026-10-21T12:00:00Z';
  const evidence = { id: 'evidence-1', evidence_text: 'Saved learner evidence', analysis: 'Recorded analysis',
    confidence_score: 90, detection_method: 'ai_analysis', timestamp: now, message_id: 'message-1' };
  const targets = targetVersion === 'cyberbullying_v1' ? historicalTargets : CYBERBULLYING_LEARNING_TARGETS;
  const items = targets.map((target, index) => ({
    id: 'item-' + index, target_key: target.key, area_text: target.description,
    item_type: index === 0 ? 'understanding' : 'behavior', priority: 'important',
    status: index === 1 ? 'covered' : 'pending', understanding_level: index === 1 ? 'good' : 'none',
    created_at: now, updated_at: now,
  }));
  const checklist = { id: 'checklist-1', room_id: transferRoom.id, student_id: 'learner-1',
    target_version: targetVersion, template_name: 'Cyberbullying', session_start: now,
    total_items: 5, completed_items: 1, completion_percentage: 20, created_at: now, updated_at: now, is_active: true };
  const queries: any[] = [];
  window.localStorage.setItem('tutor_system_user', JSON.stringify({ id: 'learner-1' }));
  (supabase.functions.invoke as jest.Mock).mockImplementation(async (name, { body, headers }) => {
    expect(name).toBe('assessment-api');
    expect(body).toEqual({ operation: 'read_learning_evidence', room_id: transferRoom.id,
      checklist_id: 'checklist-1', request_id: expect.any(String) });
    expect(headers).toEqual({ 'x-application-user-id': 'learner-1' });
    return { data: { ok: true, data: [{ ...evidence, item_id: 'item-1' }] }, error: null };
  });
  // Identical timestamps cannot order the revised targets; simulate arbitrary DB order.
  if (targetVersion === CYBERBULLYING_TARGET_VERSION) items.reverse();
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
  expect([...(progress?.detection_areas || []), ...(progress?.verification_steps || [])].map(item => item.area_text))
    .toEqual(targets.map(target => target.description));
  expect(progress?.verification_steps[0].coverage_evidence[0].message_id).toBe('message-1');
  expect(progress?.detection_areas[0].coverage_evidence).toEqual([]);
  expect(progress?.verification_steps.slice(1).every(item => item.coverage_evidence.length === 0)).toBe(true);
  const args = { room: { ...transferRoom, practice_type: 'cyberbullying' as const }, messages: [],
    messageFeedbackStats: {}, feedbackSummary: null, aiInteractions: [], userRole: 'student' as const,
    userId: 'learner-1', learningProgress: progress };
  const exported = JSON.parse(JSON.stringify(buildRoomExportData(args)));
  expect(exported.learning_progress).toMatchObject({ student_id: 'learner-1', target_version: targetVersion });
  expect(exported.learning_progress.verification_steps.map((item: any) => item.target_key))
    .toEqual(targets.slice(1).map(target => target.key));
  expect(buildRoomTextExport(args)).toContain('Evidence [message-1]: Saved learner evidence');
  expect(buildRoomTextExport(args)).toContain(`targets: ${targetVersion}`);
});

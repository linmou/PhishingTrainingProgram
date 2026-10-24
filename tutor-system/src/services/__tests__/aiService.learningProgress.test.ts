// Responsible for aiService.ts: verify authoritative learner progress reaches the provider after preparation and unsafe/missing scope blocks generation.
import { generateTutorSuggestion } from '../aiService';
import { ChecklistService } from '../checklistService';
import { supabase } from '../supabase';
import type { SessionChecklist } from '../../types/checklist';
import { formatTutorLearningProgress } from '../tutorLearningProgress';
import { buildAIContextFromExistingData } from '../simplifiedAIContext';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('../checklistService', () => ({ ChecklistService: {
  getChecklistByRoom: jest.fn(), getChecklistForStudent: jest.fn(),
} }));
jest.mock('../simplifiedAIContext', () => ({ buildAIContextFromExistingData: jest.fn().mockResolvedValue([
  { role: 'user', content: 'Student: Ah, I understand', timestamp: 1 },
]) }));

const checklist = (status = 'partially_covered', level = 'basic') => ({
  id: 'checklist-learner', student_id: 'learner', progress_policy_version: 'transfer_v1', target_version: 'v1',
  detection_areas: [{ id: 'url', target_key: 'url-key', area_text: 'URL Analysis', status,
    understanding_level: level, updated_at: '2026-10-24T00:00:00Z' }],
  verification_steps: [{ id: 'deleted', area_text: 'Removed', status: 'pending', deleted: true }],
} as unknown as SessionChecklist);

function snapshot(prompt: string) {
  return JSON.parse(prompt.split('CURRENT LEARNING PROGRESS\n')[1].split('\n')[0]);
}

describe('authoritative tutor learning progress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REACT_APP_ENVIRONMENT = 'production';
    (buildAIContextFromExistingData as jest.Mock).mockResolvedValue([
      { role: 'user', content: 'Student: Ah, I understand', timestamp: 1 },
    ]);
    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(checklist());
    (ChecklistService.getChecklistByRoom as jest.Mock).mockResolvedValue(null);
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      const row = table === 'rooms' ? {
        ai_assistant_enabled: true, transfer_learning_enabled: true,
        ai_assistant_prompt: 'Room guidance', ai_assistant_model: 'qwen3.8-flash', guard_mode: false,
      } : table === 'ai_assistant_configs' ? { prompt_config: null } : null;
      const chain: any = {
        eq: jest.fn(() => chain), select: jest.fn(() => chain), order: jest.fn(() => chain),
        single: jest.fn().mockResolvedValue({ data: row, error: null }),
        limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      };
      return chain;
    });
    (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: {
      content: JSON.stringify({ reason: 'Evidence-based next step', decision: { guard_mode: false, instruction: 'scaffolding' }, response: 'Explain your reasoning.' }),
      finish_reason: 'stop',
    }, error: null });
  });

  afterAll(() => { delete process.env.REACT_APP_ENVIRONMENT; });

  const options = { focusStudentId: 'learner', focusStudentMessageId: 'focus',
    focusStudentMessage: 'Ah, I understand', assessmentPreparation: 'no_candidate' as const };

  it.each([
    ['partially_covered', 'basic', ['url']],
    ['needs_review', 'basic', ['url']],
    ['covered', 'good', []],
  ])('passes the recorded %s/%s pair and unresolved IDs without promoting acknowledgment', async (status, level, unresolved) => {
    (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(checklist(status as string, level as string));
    const result = await generateTutorSuggestion('room', 'tutor', undefined, options);
    expect(result.success).toBe(true);
    expect(ChecklistService.getChecklistForStudent).toHaveBeenCalledWith('room', 'learner');
    expect(ChecklistService.getChecklistByRoom).not.toHaveBeenCalled();
    const body = (supabase.functions.invoke as jest.Mock).mock.calls[0][1].body;
    expect(snapshot(body.messages[0].content)).toMatchObject({
      checklist_id: 'checklist-learner', student_id: 'learner', focus_message_id: 'focus',
      target_version: 'v1', assessment_preparation: 'no_candidate', unresolved_target_ids: unresolved,
      targets: [{ item_id: 'url', target_key: 'url-key', status, understanding_level: level }],
    });
    expect(snapshot(result.appliedConfig!.system_prompt!)).toEqual(snapshot(body.messages[0].content));
  });

  it.each(['learner', 'message', 'preparation'])('blocks transfer generation without %s scope', async missing => {
    const input = { ...options };
    if (missing === 'learner') delete (input as Partial<typeof options>).focusStudentId;
    if (missing === 'message') delete (input as Partial<typeof options>).focusStudentMessageId;
    if (missing === 'preparation') delete (input as Partial<typeof options>).assessmentPreparation;
    expect((await generateTutorSuggestion('room', 'tutor', undefined, input)).success).toBe(false);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it.each(['missing', 'wrong_owner', 'read_failure'])('blocks %s progress instead of substituting room-shared progress', async failure => {
    const read = ChecklistService.getChecklistForStudent as jest.Mock;
    if (failure === 'read_failure') read.mockRejectedValueOnce(new Error('Network read failed'));
    else read.mockResolvedValueOnce(failure === 'missing' ? null : { ...checklist(), student_id: 'other' });
    expect((await generateTutorSuggestion('room', 'tutor', undefined, options)).success).toBe(false);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(ChecklistService.getChecklistByRoom).not.toHaveBeenCalled();
  });

  it('retains same-label targets by identity and distinguishes unchecked preparation', () => {
    const input = checklist();
    input.verification_steps = [{ ...input.detection_areas[0], id: 'other-url' }];
    expect(snapshot(formatTutorLearningProgress(input, 'learner', 'focus'))).toMatchObject({
      assessment_preparation: 'not_checked', unresolved_target_ids: ['url', 'other-url'],
    });
  });
});

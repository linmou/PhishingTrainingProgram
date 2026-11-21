#!/usr/bin/env node
// Responsibility: verify useChecklist.ts progress and saved checklist state across creation, trusted edits, and failures.

import { act, renderHook, waitFor } from '@testing-library/react';
jest.mock('../../hooks/useRealtimeInvalidation', () => ({ useRealtimeInvalidation: () => null }));

import { useChecklist } from '../useChecklist';
import { RoomFeaturesService } from '../../services/roomFeaturesService';
import { getAIConfig } from '../../services/aiService';
import { assessChecklistGenerationContext } from '../../services/checklistGenerationContext';
import { transferAssessmentService } from '../../services/transferAssessmentService';
import { ChecklistItem, ChecklistProgress, SessionChecklist } from '../../types/checklist';

jest.mock('../../services/roomFeaturesService', () => ({
  RoomFeaturesService: { checklist: {
    read: jest.fn(), create: jest.fn(), createManual: jest.fn(),
    createFromSystemPromptOrTemplate: jest.fn(), update: jest.fn(), delete: jest.fn(),
    getActiveTransferChecklistForRoom: jest.fn(), initializeTransferChecklistForStudent: jest.fn(),
  } },
}));
jest.mock('../../services/aiService', () => ({ getAIConfig: jest.fn() }));
jest.mock('../../services/checklistGenerationContext', () => ({ assessChecklistGenerationContext: jest.fn() }));
jest.mock('../../services/transferAssessmentService', () => ({ transferAssessmentService: { editLearningProgress: jest.fn() } }));
jest.mock('../../contexts/AuthContext', () => {
  const auth = { user: { id: 'tutor-1', current_role: 'tutor' } };
  return { useOptionalAuth: () => auth };
});

const api = RoomFeaturesService.checklist;
const now = new Date('2026-11-08T00:00:00Z');
const item = (id: string, type: ChecklistItem['item_type'], priority: ChecklistItem['priority'], status: ChecklistItem['status']): ChecklistItem => ({
  id, area_text: id, item_type: type, priority, status, understanding_level: 'none',
  tutor_notes: '', last_addressed: null, attempts_count: 0, original_template_area: false,
  coverage_evidence: [], created_at: now, updated_at: now,
});
const checklist = (items: ChecklistItem[], transfer: boolean): SessionChecklist => ({
  id: 'saved-checklist', room_id: 'room-1', template_name: 'Saved targets', session_start: now,
  detection_areas: items.filter(value => value.item_type === 'detection_area'),
  verification_steps: items.filter(value => value.item_type === 'verification_step'),
  total_items: items.length, completed_items: 0, completion_percentage: 0,
  created_at: now, updated_at: now, is_active: true,
  ...(transfer ? { progress_policy_version: 'transfer_v1', student_id: 'learner-1' } : {}),
});
const pendingProgress = (total: number): ChecklistProgress => ({
  total_areas: total, covered_areas: 0, partially_covered_areas: 0, pending_areas: total,
  completion_percentage: 0, critical_pending: 0, critical_covered: 0,
  important_pending: total, important_covered: 0, optional_pending: 0, optional_covered: 0,
});
const mixed = checklist([
  item('critical-pending', 'detection_area', 'critical', 'pending'),
  item('important-partial', 'verification_step', 'important', 'partially_covered'),
  item('optional-covered', 'detection_area', 'optional', 'covered'),
], true);
const mixedProgress: ChecklistProgress = {
  total_areas: 3, covered_areas: 1, partially_covered_areas: 1, pending_areas: 1,
  completion_percentage: 33, critical_pending: 1, critical_covered: 0,
  important_pending: 1, important_covered: 0, optional_pending: 0, optional_covered: 1,
};

beforeEach(() => {
  jest.resetAllMocks();
  window.localStorage.clear();
  (api.read as jest.Mock).mockResolvedValue(null);
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(null);
  (getAIConfig as jest.Mock).mockResolvedValue(null);
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('trusted progress edits', () => {
  it.each(['critical', 'important', 'optional'] as const)('moves a covered item into the %s priority count', async priority => {
    const initial = checklist([item('edited', 'verification_step', 'optional', 'covered')], true);
    (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(initial);
    (transferAssessmentService.editLearningProgress as jest.Mock).mockResolvedValue({ status: 'covered', understanding_level: 'complete' });
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.checklist).toBe(initial));
    await act(async () => { await result.current.updateItem('edited', { priority }); });
    expect(result.current.progress).toEqual({
      ...pendingProgress(1), pending_areas: 0, covered_areas: 1, completion_percentage: 100,
      important_pending: 0, [`${priority}_covered`]: 1,
    });
    expect(transferAssessmentService.editLearningProgress).toHaveBeenCalledWith({
      roomId: 'room-1', itemId: 'edited', action: 'set_priority', updates: { priority },
    });
  });

  it.each(['detection_area', 'verification_step'] as const)('recomputes status and priority counts for %s edits', async type => {
    const initial = checklist([
      item('edited', type, 'critical', 'pending'),
      item('partial', 'verification_step', 'important', 'partially_covered'),
      item('covered', 'detection_area', 'optional', 'covered'),
    ], true);
    (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(initial);
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.checklist).toBe(initial));
    const reads = (api.getActiveTransferChecklistForRoom as jest.Mock).mock.calls.length;

    (transferAssessmentService.editLearningProgress as jest.Mock).mockResolvedValue({ status: 'covered', understanding_level: 'complete' });
    await act(async () => { await result.current.updateItem('edited', { status: 'covered', priority: 'optional' }); });
    expect(result.current.progress).toEqual({
      ...mixedProgress, covered_areas: 2, pending_areas: 0, completion_percentage: 67,
      critical_pending: 0, optional_covered: 2,
    });
    expect(result.current.getItemById('edited')).toMatchObject({ priority: 'optional', status: 'covered' });

    (transferAssessmentService.editLearningProgress as jest.Mock).mockResolvedValue({ status: 'partially_covered', understanding_level: 'basic' });
    await act(async () => { await result.current.updateItem('edited', { status: 'partially_covered', priority: 'important' }); });
    expect(result.current.progress).toEqual({
      ...mixedProgress, partially_covered_areas: 2, pending_areas: 0, critical_pending: 0, important_pending: 2,
    });

    (transferAssessmentService.editLearningProgress as jest.Mock).mockResolvedValue({ status: 'pending', understanding_level: 'none' });
    await act(async () => { await result.current.updateItem('edited', { status: 'pending', priority: 'critical' }); });
    expect(result.current.progress).toEqual(mixedProgress);
    expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(reads);
  });

  it('uses the trusted returned status when an edit request differs from the saved state', async () => {
    (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(mixed);
    (transferAssessmentService.editLearningProgress as jest.Mock).mockResolvedValue({ status: 'partially_covered', understanding_level: 'basic' });
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.checklist).toBe(mixed));
    await act(async () => { await result.current.updateItem('critical-pending', { status: 'covered' }); });
    expect(result.current.progress).toEqual({ ...mixedProgress, pending_areas: 0, partially_covered_areas: 2 });
    expect(result.current.getItemById('critical-pending')?.status).toBe('partially_covered');
  });

  it.each([false, true])('preserves counts for a missing item, including empty checklist=%s', async empty => {
    const initial = empty ? checklist([], true) : mixed;
    (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(initial);
    (transferAssessmentService.editLearningProgress as jest.Mock).mockResolvedValue({ status: 'covered', understanding_level: 'complete' });
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.checklist).toBe(initial));
    await act(async () => { await result.current.updateItem('missing', { status: 'covered' }); });
    expect(result.current.progress).toEqual(empty ? pendingProgress(0) : mixedProgress);
    expect(result.current.checklist?.detection_areas).toEqual(initial.detection_areas);
    expect(result.current.checklist?.verification_steps).toEqual(initial.verification_steps);
  });

  it('preserves checklist and every progress field when the trusted write fails', async () => {
    (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(mixed);
    (transferAssessmentService.editLearningProgress as jest.Mock).mockRejectedValue(new Error('Progress is locked'));
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.checklist).toBe(mixed));
    await act(async () => { await result.current.updateItem('critical-pending', { status: 'covered', priority: 'optional' }); });
    expect(result.current.checklist).toBe(mixed);
    expect(result.current.progress).toEqual(mixedProgress);
    expect(result.current.error).toBe('Progress is locked');
  });


});

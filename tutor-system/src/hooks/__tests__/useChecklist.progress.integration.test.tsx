#!/usr/bin/env node
// Responsibility: verify useChecklist.ts progress and saved checklist state across creation, trusted edits, and failures.

import { act, renderHook, waitFor } from '@testing-library/react';
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

describe('manual checklist submission', () => {
  it.each([
    [[], []], [['Detect'], []], [[], ['Verify']], [['Detect one', 'Detect two'], ['Verify']],
  ])('installs the persisted checklist and counts inputs %j / %j', async (detection, verification) => {
    const saved = checklist([
      ...detection.map((text, index) => item(`saved-d-${index}`, 'detection_area', 'important', 'pending')),
      ...verification.map((text, index) => item(`saved-v-${index}`, 'verification_step', 'important', 'pending')),
    ], false);
    (api.createManual as jest.Mock).mockResolvedValue(saved);
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.openManualInput());
    await act(async () => { await result.current.handleManualSubmit(detection, verification); });
    expect(api.createManual).toHaveBeenCalledWith('room-1', detection, verification);
    expect(result.current.checklist).toBe(saved);
    expect(result.current.progress).toEqual(pendingProgress(detection.length + verification.length));
    expect(result.current.showManualInput).toBe(false);
  });

  it.each(['null', 'rejection'])('preserves saved state and the input form after %s', async failure => {
    (api.read as jest.Mock).mockResolvedValue(mixed);
    if (failure === 'null') (api.createManual as jest.Mock).mockResolvedValue(null);
    else (api.createManual as jest.Mock).mockRejectedValue(new Error('save failed'));
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.checklist).toBe(mixed));
    act(() => result.current.openManualInput());
    await act(async () => { await result.current.handleManualSubmit(['New'], []); });
    expect(result.current.checklist).toBe(mixed);
    expect(result.current.progress).toEqual(mixedProgress);
    expect(result.current.showManualInput).toBe(true);
    expect(result.current.error).toBe(failure === 'null' ? 'Failed to create manual checklist - returned null' : 'save failed');
    expect(result.current.loading).toBe(false);
  });

  it('uses the learner-owned target save path when transfer is enabled', async () => {
    (api.initializeTransferChecklistForStudent as jest.Mock).mockResolvedValue(mixed);
    const { result } = renderHook(() => useChecklist('room-1', { enabled: true, studentId: 'learner-1' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.handleManualSubmit(['Detect'], ['Verify']); });
    expect(api.createManual).not.toHaveBeenCalled();
    expect(api.initializeTransferChecklistForStudent).toHaveBeenCalledWith('room-1', 'learner-1', [
      { area_text: 'Detect', item_type: 'detection_area', priority: 'important' },
      { area_text: 'Verify', item_type: 'verification_step', priority: 'important' },
    ]);
    expect(result.current.checklist).toBe(mixed);
    expect(result.current.progress).toEqual(mixedProgress);
  });
});

describe('progress after generation', () => {
  it.each(['generate', 'structured', 'extracted', 'fallback'])('computes all progress fields for %s', async path => {
    (api.createManual as jest.Mock).mockResolvedValue(mixed);
    (api.createFromSystemPromptOrTemplate as jest.Mock).mockResolvedValue(mixed);
    (api.create as jest.Mock).mockResolvedValue(mixed);
    (assessChecklistGenerationContext as jest.Mock).mockResolvedValue(path === 'fallback'
      ? { type: 'unexpected' }
      : { type: 'ready_for_extraction', systemPrompt: 'Saved prompt', ...(path === 'structured' ? { detectionAreas: ['Detect'] } : {}) });
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      if (path === 'generate') await result.current.generateChecklist('Template');
      else await result.current.startSmartGeneration('Template');
    });
    expect(result.current.checklist).toBe(mixed);
    expect(result.current.progress).toEqual(mixedProgress);
    expect(result.current.error).toBeNull();
  });
});

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
    expect(api.update).not.toHaveBeenCalled();
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

  it('keeps null progress when the checklist is deleted while an edit is pending', async () => {
    (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(mixed);
    let finish!: (value: { status: string; understanding_level: string }) => void;
    (transferAssessmentService.editLearningProgress as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useChecklist('room-1'));
    await waitFor(() => expect(result.current.checklist).toBe(mixed));
    let edit!: Promise<void>;
    act(() => { edit = result.current.updateItem('critical-pending', { status: 'covered' }); });
    await act(async () => { await result.current.deleteChecklist(); });
    expect(result.current.progress).toBeNull();
    await act(async () => { finish({ status: 'covered', understanding_level: 'complete' }); await edit; });
    expect(result.current.checklist).toBeNull();
    expect(result.current.progress).toBeNull();
  });
});

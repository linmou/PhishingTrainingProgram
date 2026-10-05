#!/usr/bin/env node
/**
 * Test responsible for the checklist progress surface on a transfer-policy room:
 * src/components/ChecklistPanel.tsx together with src/hooks/useChecklist.ts.
 *
 * Responsibility: prove learner progress is owner-scoped and tutor status edits share the same
 * checklist with assessment results. Also check target setup before learner messages arrive.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChecklistPanel from '../ChecklistPanel';
import { useChecklist } from '../../hooks/useChecklist';
import { useOptionalAuth } from '../../contexts/AuthContext';
import { RoomFeaturesService } from '../../services/roomFeaturesService';
import { assessChecklistGenerationContext } from '../../services/checklistGenerationContext';
import {
  CHECKLIST_ID,
  CHECKLIST_ITEM_ID,
  LEARNER_A_ID,
  LEARNER_B_ID,
  TRANSFER_ROOM_ID,
} from '../../test-support/transferRoomFixtures';

jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: jest.fn() }));
jest.mock('../../services/roomFeaturesService', () => ({
  RoomFeaturesService: {
    checklist: {
      read: jest.fn(),
      update: jest.fn(),
      createFromSystemPromptOrTemplate: jest.fn(),
      getChecklistForStudent: jest.fn(),
      getActiveTransferChecklistForRoom: jest.fn(),
      initializeTransferChecklistForStudent: jest.fn(),
      addCustomArea: jest.fn(),
    },
  },
}));
jest.mock('../../services/aiService', () => ({ getAIConfig: jest.fn().mockResolvedValue(null) }));
jest.mock('../../services/checklistGenerationContext', () => ({
  assessChecklistGenerationContext: jest.fn(),
}));
jest.mock('../../services/transferAssessmentService', () => ({
  transferAssessmentService: { editLearningProgress: jest.fn().mockResolvedValue({}) },
}));
import { transferAssessmentService } from '../../services/transferAssessmentService';

const checklistApi = RoomFeaturesService.checklist as unknown as {
  read: jest.Mock;
  update: jest.Mock;
  getChecklistForStudent: jest.Mock;
  getActiveTransferChecklistForRoom: jest.Mock;
  initializeTransferChecklistForStudent: jest.Mock;
};

const buildItem = (overrides: Record<string, unknown> = {}) => ({
  id: CHECKLIST_ITEM_ID,
  checklist_id: CHECKLIST_ID,
  area_text: 'Verify payment requests',
  priority: 'critical' as const,
  status: 'partially_covered' as const,
  understanding_level: 'basic' as const,
  coverage_evidence: [],
  tutor_notes: '',
  created_at: '2026-09-12T08:30:00Z',
  updated_at: '2026-09-12T08:30:00Z',
  ...overrides,
});

const buildChecklist = (overrides: Record<string, unknown> = {}) => {
  const item = buildItem((overrides.itemOverrides as Record<string, unknown>) || {});
  return {
    id: CHECKLIST_ID,
    room_id: TRANSFER_ROOM_ID,
    student_id: LEARNER_A_ID as string | null,
    template_name: 'transfer',
    progress_policy_version: 'transfer_v1',
    session_start: new Date('2026-09-12T08:30:00Z'),
    detection_areas: [item],
    verification_steps: [],
    total_items: 1,
    completed_items: 0,
    completion_percentage: 0,
    created_at: new Date('2026-09-12T08:30:00Z'),
    updated_at: new Date('2026-09-12T08:30:00Z'),
    is_active: true,
    ...overrides,
  };
};

const transferChecklist = buildChecklist();

const legacyChecklist = buildChecklist({
  progress_policy_version: 'legacy_v1',
  student_id: null,
  itemOverrides: { status: 'pending', understanding_level: 'none' },
});

const setUser = (role: 'tutor' | 'student') => {
  (useOptionalAuth as jest.Mock).mockReturnValue({
    user: { id: role === 'student' ? LEARNER_A_ID : 'tutor-1', current_role: role, display_name: role },
  });
};

describe('useChecklist transfer progress ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    setUser('tutor');
    checklistApi.update.mockResolvedValue(undefined);
    checklistApi.initializeTransferChecklistForStudent.mockResolvedValue(transferChecklist);
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(transferChecklist);
    checklistApi.getChecklistForStudent.mockResolvedValue(transferChecklist);
    checklistApi.read.mockResolvedValue(legacyChecklist);
  });

  it('loads the owner-scoped transfer checklist for the signed-in learner', async () => {
    setUser('student');

    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    expect(checklistApi.getChecklistForStudent).toHaveBeenCalledWith(TRANSFER_ROOM_ID, LEARNER_A_ID);
    expect(checklistApi.getActiveTransferChecklistForRoom).not.toHaveBeenCalled();
    expect(result.current.checklist!.student_id).toBe(LEARNER_A_ID);
  });

  it('uses the server-selected learner-owned projection for a tutor view', async () => {
    setUser('tutor');

    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    expect(checklistApi.getActiveTransferChecklistForRoom).toHaveBeenCalledWith(TRANSFER_ROOM_ID);
    expect(result.current.checklist!.progress_policy_version).toBe('transfer_v1');
    expect(result.current.checklist!.student_id).toBe(LEARNER_A_ID);
    expect(checklistApi.read).not.toHaveBeenCalled();
  });

  // useChecklist.ts: a room draft is promoted when the tutor observes the learner seat.
  it('synchronizes a saved room draft when a learner joins', async () => {
    window.localStorage.setItem(`room-learning-target-draft:${TRANSFER_ROOM_ID}`, JSON.stringify({
      detectionAreas: ['Check the sender'],
      verificationSteps: ['Use the official support channel'],
    }));
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    checklistApi.initializeTransferChecklistForStudent.mockResolvedValue(transferChecklist);

    const { rerender } = renderHook(
      ({ studentId }: { studentId: string | null }) => useChecklist(TRANSFER_ROOM_ID, {
        enabled: true,
        studentId,
      }),
      { initialProps: { studentId: null } },
    );
    await act(async () => undefined);
    rerender({ studentId: LEARNER_A_ID });

    await waitFor(() => expect(checklistApi.initializeTransferChecklistForStudent)
      .toHaveBeenCalledWith(TRANSFER_ROOM_ID, LEARNER_A_ID, [
        { area_text: 'Check the sender', item_type: 'detection_area', priority: 'important' },
        { area_text: 'Use the official support channel', item_type: 'verification_step', priority: 'important' },
      ]));
    expect(window.localStorage.getItem(`room-learning-target-draft:${TRANSFER_ROOM_ID}`)).toBeNull();
  });

  it('fails closed when the server returns transfer progress for a different learner', async () => {
    setUser('student');
    checklistApi.getChecklistForStudent.mockResolvedValue({ ...transferChecklist, student_id: LEARNER_B_ID } as never);

    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    expect(checklistApi.getChecklistForStudent).toHaveBeenCalledWith(TRANSFER_ROOM_ID, LEARNER_A_ID);
    expect(result.current.checklist).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toMatch(/different learner/i);
    expect(checklistApi.read).not.toHaveBeenCalled();
    // The caller identity is checked against the returned server-owned projection.
    expect(checklistApi.getChecklistForStudent.mock.calls[0][1]).toBe(LEARNER_A_ID);
  });

  it('rejects a transfer projection returned through the legacy fallback when the scoped read is empty', async () => {
    setUser('student');
    checklistApi.getChecklistForStudent.mockResolvedValue(null);
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    checklistApi.read.mockResolvedValue({ ...transferChecklist, student_id: LEARNER_B_ID } as never);

    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    expect(checklistApi.getChecklistForStudent).toHaveBeenCalledWith(TRANSFER_ROOM_ID, LEARNER_A_ID);
    expect(checklistApi.read).toHaveBeenCalledWith(TRANSFER_ROOM_ID);
    expect(result.current.checklist).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(result.current.error).toMatch(/different learner/i);
  });

  it('lets the tutor change the learner-owned status through the checklist service', async () => {
    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    await act(async () => {
      await result.current.updateItem(CHECKLIST_ITEM_ID, { status: 'covered' });
    });

    expect(checklistApi.update).not.toHaveBeenCalled();
    expect(transferAssessmentService.editLearningProgress).toHaveBeenCalledWith(expect.objectContaining({
      roomId: TRANSFER_ROOM_ID, itemId: CHECKLIST_ITEM_ID, updates: { status: 'covered' },
    }));
    expect(result.current.error).toBeNull();
  });

  it('allows a transfer-policy understanding write from the tutor checklist', async () => {
    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    await act(async () => {
      await result.current.updateItem(CHECKLIST_ITEM_ID, { understanding_level: 'excellent' });
    });

    expect(checklistApi.update).not.toHaveBeenCalled();
    expect(transferAssessmentService.editLearningProgress).toHaveBeenCalledWith(expect.objectContaining({
      roomId: TRANSFER_ROOM_ID, itemId: CHECKLIST_ITEM_ID, updates: { understanding_level: 'excellent' },
    }));
  });

  it('still allows a non-progress transfer item edit such as a tutor note', async () => {
    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    await act(async () => {
      await result.current.updateItem(CHECKLIST_ITEM_ID, { tutor_notes: 'Revisit next session' });
    });

    expect(checklistApi.update).toHaveBeenCalledWith(CHECKLIST_ITEM_ID, { tutor_notes: 'Revisit next session' });
  });

  it('leaves legacy room-shared progress writes unchanged', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    checklistApi.getChecklistForStudent.mockResolvedValue(null);
    checklistApi.read.mockResolvedValue(legacyChecklist);

    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });
    expect(result.current.checklist!.progress_policy_version).toBe('legacy_v1');

    await act(async () => {
      await result.current.updateItem(CHECKLIST_ITEM_ID, { status: 'covered' });
    });

    expect(checklistApi.update).toHaveBeenCalledWith(CHECKLIST_ITEM_ID, { status: 'covered' });
  });
});

describe('ChecklistPanel transfer presentation', () => {
  const renderPanel = () =>
    render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} isVisible onToggleVisibility={jest.fn()} />);

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    setUser('tutor');
    checklistApi.update.mockResolvedValue(undefined);
    checklistApi.initializeTransferChecklistForStudent.mockResolvedValue(transferChecklist);
  });

  const expandFirstItem = async () => {
    const itemText = await screen.findByText('Verify payment requests');
    fireEvent.click(itemText.closest('.checklist-item-header') as HTMLElement);
  };

  it('shows the tutor a status control on the assessment checklist', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(transferChecklist);

    const { container } = renderPanel();
    await expandFirstItem();

    expect(container.querySelector('.status-select')).toBeInTheDocument();
    expect(container.querySelector('.status-select')).toHaveValue('partially_covered');
  });

  it('lets the tutor edit and reprioritize a shared assessment target', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(transferChecklist);

    const { container } = renderPanel();
    await expandFirstItem();

    fireEvent.change(container.querySelector('.priority-select') as HTMLSelectElement, {
      target: { value: 'critical' },
    });
    expect(transferAssessmentService.editLearningProgress).toHaveBeenCalledWith(expect.objectContaining({
      roomId: TRANSFER_ROOM_ID,
      itemId: CHECKLIST_ITEM_ID,
      updates: { priority: 'critical' },
    }));

    fireEvent.click(container.querySelector('.edit-text-button') as HTMLElement);
    fireEvent.change(screen.getByDisplayValue('Verify payment requests'), {
      target: { value: 'Verify the sender independently' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(transferAssessmentService.editLearningProgress).toHaveBeenCalledWith(expect.objectContaining({
      roomId: TRANSFER_ROOM_ID,
      itemId: CHECKLIST_ITEM_ID,
      updates: { area_text: 'Verify the sender independently' },
    }));
  });

  it('keeps the legacy status control for a legacy checklist', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    checklistApi.read.mockResolvedValue(legacyChecklist);

    renderPanel();
    await expandFirstItem();

    expect(document.querySelector('.status-select')).not.toBeNull();
    expect(screen.queryByText('Ready for transfer check')).not.toBeInTheDocument();
  });

  it('locks legacy progress controls while the room progression lock is on', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    checklistApi.read.mockResolvedValue(legacyChecklist);

    render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} isVisible onToggleVisibility={jest.fn()} progressLocked />);
    await expandFirstItem();

    expect(document.querySelector('.status-select')).toBeDisabled();
  });

  it('shows Guard protection while keeping the shared assessment targets visible', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(transferChecklist);

    const { container } = render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} transferEnabled
      studentId={LEARNER_A_ID} isVisible onToggleVisibility={jest.fn()} progressLocked />);
    await expandFirstItem();

    expect(screen.getAllByRole('status').some(node => /Guard Mode is active/i.test(node.textContent || ''))).toBe(true);
    expect(container.querySelector('.priority-select')).toBeDisabled();
    expect(screen.getByText('Verify payment requests')).toBeInTheDocument();
  });

  it('shows tutor setup actions when no transfer checklist exists', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} transferEnabled studentId={LEARNER_A_ID}
      isVisible onToggleVisibility={jest.fn()} progressLocked />);

    expect(await screen.findByRole('button', { name: 'Generate Learning Targets' })).toBeEnabled();
    expect(screen.queryByText(/Learning targets required/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter Manually' })).toBeEnabled();
    expect(checklistApi.read).toHaveBeenCalledWith(TRANSFER_ROOM_ID);
  });

  // ChecklistPanel.tsx: a tutor can save a room draft before the learner joins.
  it('saves learning targets before a learner joins', async () => {
    window.localStorage.clear();
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    (assessChecklistGenerationContext as jest.Mock).mockResolvedValue({
      type: 'ready_for_extraction', detectionAreas: ['Check the sender'], verificationSteps: [],
    });
    render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} transferEnabled studentId={null}
      isVisible onToggleVisibility={jest.fn()} />);

    const generate = await screen.findByRole('button', { name: 'Generate Learning Targets' });
    expect(generate).toBeEnabled();
    fireEvent.click(generate);
    expect(await screen.findByText('Approve Learning Targets')).toBeInTheDocument();
    expect(screen.getByLabelText('Detection Areas')).toHaveValue('Check the sender');
    fireEvent.click(screen.getByRole('button', { name: 'Create Checklist' }));
    expect(await screen.findByText('Check the sender')).toBeInTheDocument();
    expect(screen.queryByText(/Wait for the learner to join before saving learning targets/i)).not.toBeInTheDocument();
    expect(checklistApi.initializeTransferChecklistForStudent).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(`room-learning-target-draft:${TRANSFER_ROOM_ID}`)).toContain('Check the sender');
  });

  // ChecklistPanel.tsx and useChecklist.ts: enabling assessment must keep prior room progress visible.
  it('shows earlier learning progress as the current checklist while assessment targets are being set up', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(null);
    checklistApi.read.mockResolvedValue(buildChecklist({
      progress_policy_version: 'legacy_v1', student_id: null,
      detection_areas: [
        buildItem({ status: 'partially_covered', understanding_level: 'basic' }),
        buildItem({ id: 'second-item', area_text: 'Check the official app', status: 'covered', understanding_level: 'good' }),
      ],
      total_items: 2, completed_items: 1, completion_percentage: 50,
    }));
    render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} transferEnabled studentId={null}
      isVisible onToggleVisibility={jest.fn()} />);

    expect(await screen.findByText('Learning Progress')).toBeInTheDocument();
    expect(screen.queryByText('Previous Learning Progress')).not.toBeInTheDocument();
    expect(await screen.findByText('Verify payment requests')).toBeInTheDocument();
    expect(screen.getByText(/Partially covered/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Learning Targets' })).toBeEnabled();
  });

  it('keeps the zero-item setup reminder out of the collapsed panel', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(buildChecklist({
      detection_areas: [], verification_steps: [], total_items: 0,
    }));
    const onToggleVisibility = jest.fn();
    render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} transferEnabled studentId={LEARNER_A_ID}
      isVisible={false} onToggleVisibility={onToggleVisibility} />);

    await waitFor(() => expect(checklistApi.getActiveTransferChecklistForRoom).toHaveBeenCalled());
    expect(screen.queryByText(/Learning targets required/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Learning Progress' }));
    expect(onToggleVisibility).toHaveBeenCalledTimes(1);
  });

  it('shows a waiting notice without setup controls to a learner', async () => {
    setUser('student');
    checklistApi.getChecklistForStudent.mockResolvedValue(null);
    render(<ChecklistPanel roomId={TRANSFER_ROOM_ID} transferEnabled studentId={LEARNER_A_ID}
      isVisible onToggleVisibility={jest.fn()} />);

    expect(await screen.findByText('Waiting for the tutor to set up learning targets.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate Learning Targets' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enter Manually' })).not.toBeInTheDocument();
  });
});

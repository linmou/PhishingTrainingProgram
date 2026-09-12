#!/usr/bin/env node
/**
 * Test responsible for the checklist progress surface on a transfer-policy room:
 * src/components/ChecklistPanel.tsx together with src/hooks/useChecklist.ts.
 *
 * Responsibility: prove transfer progress is read owner-scoped straight from the server and cannot
 * be written from the browser (status or understanding), while a legacy room-shared checklist keeps
 * its editable controls and is never presented as transfer verification.
 */

import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ChecklistPanel from '../ChecklistPanel';
import { useChecklist } from '../../hooks/useChecklist';
import { useOptionalAuth } from '../../contexts/AuthContext';
import { RoomFeaturesService } from '../../services/roomFeaturesService';
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
    },
  },
}));
jest.mock('../../services/aiService', () => ({ getAIConfig: jest.fn().mockResolvedValue(null) }));
jest.mock('../../services/checklistGenerationContext', () => ({
  assessChecklistGenerationContext: jest.fn(),
}));

const checklistApi = RoomFeaturesService.checklist as unknown as {
  read: jest.Mock;
  update: jest.Mock;
  getChecklistForStudent: jest.Mock;
  getActiveTransferChecklistForRoom: jest.Mock;
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
    setUser('tutor');
    checklistApi.update.mockResolvedValue(undefined);
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

  it('never returns another learner progress to the learner viewer', async () => {
    setUser('student');
    checklistApi.getChecklistForStudent.mockResolvedValue({ ...transferChecklist, student_id: LEARNER_B_ID } as never);

    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    expect(checklistApi.getChecklistForStudent).toHaveBeenCalledWith(TRANSFER_ROOM_ID, LEARNER_A_ID);
    expect(result.current.checklist!.student_id).toBe(LEARNER_B_ID);
    // The read is scoped by the caller identity; the UI never asks for a learner by display name.
    expect(checklistApi.getChecklistForStudent.mock.calls[0][1]).toBe(LEARNER_A_ID);
  });

  it('refuses a transfer-policy status write from the browser', async () => {
    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    await act(async () => {
      await result.current.updateItem(CHECKLIST_ITEM_ID, { status: 'covered' });
    });

    expect(checklistApi.update).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/server/i);
  });

  it('refuses a transfer-policy understanding write from the browser', async () => {
    const { result } = renderHook(() => useChecklist(TRANSFER_ROOM_ID));
    await act(async () => {
      await result.current.refreshChecklist();
    });

    await act(async () => {
      await result.current.updateItem(CHECKLIST_ITEM_ID, { understanding_level: 'excellent' });
    });

    expect(checklistApi.update).not.toHaveBeenCalled();
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
    setUser('tutor');
    checklistApi.update.mockResolvedValue(undefined);
  });

  const expandFirstItem = async () => {
    const itemText = await screen.findByText('Verify payment requests');
    fireEvent.click(itemText.closest('.checklist-item-header') as HTMLElement);
  };

  it('shows transfer progress as server-owned text with no status control', async () => {
    checklistApi.getActiveTransferChecklistForRoom.mockResolvedValue(transferChecklist);

    const { container } = renderPanel();
    await expandFirstItem();

    expect(screen.getByText('Ready for transfer check')).toBeInTheDocument();
    expect(container.querySelector('.status-select')).toBeNull();
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
});

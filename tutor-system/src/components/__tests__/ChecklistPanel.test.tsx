/**
 * Test target: src/components/ChecklistPanel.tsx
 * Purpose: verify learning progress export downloads a JSON report with checklist progress data.
 */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import ChecklistPanel from '../ChecklistPanel';
import { useChecklist } from '../../hooks/useChecklist';
import { SessionChecklist, ChecklistProgress } from '../../types/checklist';

jest.mock('../../hooks/useChecklist');
jest.mock('../ChecklistGenerationModal', () => ({
  ChecklistGenerationModal: () => null
}));
jest.mock('../ManualChecklistInput', () => ({
  ManualChecklistInput: () => null
}));
jest.mock('../AddCustomAreaModal', () => () => null);

const mockUseChecklist = useChecklist as jest.MockedFunction<typeof useChecklist>;

const checklist: SessionChecklist = {
  id: 'checklist-1',
  room_id: 'room-123',
  template_name: 'Nintendo Switch Deal Scam',
  session_start: new Date('2026-03-26T10:00:00.000Z'),
  detection_areas: [
    {
      id: 'item-1',
      area_text: 'Urgent language pressure',
      item_type: 'detection_area',
      priority: 'critical',
      status: 'covered',
      understanding_level: 'good',
      coverage_evidence: [],
      tutor_notes: 'Student identified time pressure cues.',
      last_addressed: new Date('2026-03-26T10:10:00.000Z'),
      attempts_count: 1,
      original_template_area: true,
      created_at: new Date('2026-03-26T10:00:00.000Z'),
      updated_at: new Date('2026-03-26T10:10:00.000Z')
    }
  ],
  verification_steps: [
    {
      id: 'item-2',
      area_text: 'Verify seller reputation',
      item_type: 'verification_step',
      priority: 'important',
      status: 'pending',
      understanding_level: 'none',
      coverage_evidence: [],
      tutor_notes: '',
      last_addressed: null,
      attempts_count: 0,
      original_template_area: true,
      created_at: new Date('2026-03-26T10:00:00.000Z'),
      updated_at: new Date('2026-03-26T10:00:00.000Z')
    }
  ],
  total_items: 2,
  completed_items: 1,
  completion_percentage: 50,
  created_at: new Date('2026-03-26T10:00:00.000Z'),
  updated_at: new Date('2026-03-26T10:10:00.000Z'),
  is_active: true
};

const progress: ChecklistProgress = {
  total_areas: 2,
  covered_areas: 1,
  partially_covered_areas: 0,
  pending_areas: 1,
  completion_percentage: 50,
  critical_pending: 0,
  critical_covered: 1,
  important_pending: 1,
  important_covered: 0,
  optional_pending: 0,
  optional_covered: 0
};

const readBlobContent = async (blob: Blob): Promise<string> => {
  if (typeof FileReader === 'undefined') {
    throw new Error('FileReader is not available in the test environment');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob content'));
    reader.readAsText(blob);
  });
};

describe('ChecklistPanel export report', () => {
  const createObjectURL = jest.fn(() => 'blob:learning-progress');
  const revokeObjectURL = jest.fn();
  let createdAnchor: HTMLAnchorElement;
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    jest.clearAllMocks();
    originalCreateElement = document.createElement.bind(document);

    mockUseChecklist.mockReturnValue({
      checklist,
      loading: false,
      error: null,
      progress,
      showGenerationModal: null,
      showManualInput: false,
      generateChecklist: jest.fn(),
      updateItem: jest.fn(),
      refreshChecklist: jest.fn(),
      deleteChecklist: jest.fn(),
      startSmartGeneration: jest.fn(),
      openManualInput: jest.fn(),
      closeModals: jest.fn(),
      handleSetupAI: jest.fn(),
      handleManualSubmit: jest.fn(),
      isItemCompleted: jest.fn(),
      getItemById: jest.fn()
    });

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectURL
    });

    createdAnchor = document.createElement('a');
    createdAnchor.click = jest.fn();
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return createdAnchor;
      }

      return originalCreateElement(tagName);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('downloads a JSON learning progress report with checklist summary and items', async () => {
    render(
      <ChecklistPanel
        roomId="room-123"
        isVisible={true}
        onToggleVisibility={jest.fn()}
      />
    );

    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');

    fireEvent.click(screen.getByRole('button', { name: /export report/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);

    const exportBlob = createObjectURL.mock.calls[0][0] as Blob;
    const exportData = JSON.parse(await readBlobContent(exportBlob));

    expect(exportData.room_id).toBe('room-123');
    expect(exportData.template_name).toBe('Nintendo Switch Deal Scam');
    expect(exportData.summary).toEqual({
      completion_percentage: 50,
      total_items: 2,
      covered_items: 1,
      partially_covered_items: 0,
      pending_items: 1
    });
    expect(exportData.detection_areas).toHaveLength(1);
    expect(exportData.verification_steps).toHaveLength(1);
    expect(exportData.detection_areas[0]).toMatchObject({
      id: 'item-1',
      area_text: 'Urgent language pressure',
      status: 'covered',
      priority: 'critical',
      tutor_notes: 'Student identified time pressure cues.'
    });

    const anchor = appendChildSpy.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor).toBe(createdAnchor);
    expect(anchor.download).toMatch(/^Nintendo_Switch_Deal_Scam_learning_progress_\d{4}-\d{2}-\d{2}\.json$/);
    expect(createdAnchor.click).toHaveBeenCalledTimes(1);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});

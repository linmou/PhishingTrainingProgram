#!/usr/bin/env node
/**
 * Test responsible for useChecklist.ts using persisted prompt_config checklist items directly instead of falling back to generic template extraction.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useChecklist } from '../useChecklist';
import { RoomFeaturesService } from '../../services/roomFeaturesService';
import { assessChecklistGenerationContext } from '../../services/checklistGenerationContext';

jest.mock('../../services/roomFeaturesService', () => ({
  RoomFeaturesService: {
    checklist: {
      read: jest.fn(),
      createManual: jest.fn(),
      createFromSystemPromptOrTemplate: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  }
}));

jest.mock('../../services/checklistGenerationContext', () => ({
  assessChecklistGenerationContext: jest.fn()
}));

describe('useChecklist smart generation', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (RoomFeaturesService.checklist.read as jest.Mock).mockResolvedValue(null);
  });

  it('creates the checklist directly from persisted prompt_config areas and verification steps', async () => {
    (assessChecklistGenerationContext as jest.Mock).mockResolvedValue({
      type: 'ready_for_extraction',
      systemPrompt: 'Persisted scenario prompt',
      detectionAreas: [
        'Real-time location sharing: Announcing specific places and times',
        'Address visibility: Posting exact addresses publicly'
      ],
      verificationSteps: [
        'Use private messages: Coordinate meetups via DM instead of public posts',
        'Avoid real-time posting: Share experiences after you have left the location'
      ],
      aiConfigId: 'ai-config-1'
    });

    (RoomFeaturesService.checklist.createManual as jest.Mock).mockResolvedValue({
      id: 'checklist-1',
      room_id: 'room-1',
      template_name: 'Manual Input',
      session_start: new Date('2026-04-02T00:00:00Z'),
      detection_areas: [
        {
          id: 'detection-1',
          area_text: 'Real-time location sharing: Announcing specific places and times',
          item_type: 'detection_area',
          priority: 'critical',
          status: 'pending',
          understanding_level: 'none',
          tutor_notes: '',
          last_addressed: null,
          attempts_count: 0,
          original_template_area: false,
          coverage_evidence: [],
          created_at: new Date('2026-04-02T00:00:00Z'),
          updated_at: new Date('2026-04-02T00:00:00Z')
        }
      ],
      verification_steps: [
        {
          id: 'verification-1',
          area_text: 'Use private messages: Coordinate meetups via DM instead of public posts',
          item_type: 'verification_step',
          priority: 'important',
          status: 'pending',
          understanding_level: 'none',
          tutor_notes: '',
          last_addressed: null,
          attempts_count: 0,
          original_template_area: false,
          coverage_evidence: [],
          created_at: new Date('2026-04-02T00:00:00Z'),
          updated_at: new Date('2026-04-02T00:00:00Z')
        }
      ],
      total_items: 2,
      completed_items: 0,
      completion_percentage: 0,
      created_at: new Date('2026-04-02T00:00:00Z'),
      updated_at: new Date('2026-04-02T00:00:00Z'),
      is_active: true
    });

    const { result } = renderHook(() => useChecklist('room-1'));

    await act(async () => {
      await result.current.startSmartGeneration();
    });

    await waitFor(() => {
      expect(RoomFeaturesService.checklist.createManual).toHaveBeenCalledWith(
        'room-1',
        [
          'Real-time location sharing: Announcing specific places and times',
          'Address visibility: Posting exact addresses publicly'
        ],
        [
          'Use private messages: Coordinate meetups via DM instead of public posts',
          'Avoid real-time posting: Share experiences after you have left the location'
        ]
      );
    });

    expect(RoomFeaturesService.checklist.createFromSystemPromptOrTemplate).not.toHaveBeenCalled();
  });
});

#!/usr/bin/env node
// Responsibility: ChecklistPanel.tsx and ManualChecklistInput.tsx; preserve typed targets and prevent replacement after a remote setup arrives.
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ChecklistPanel from '../../components/ChecklistPanel';
import { RoomFeaturesService } from '../../services/roomFeaturesService';
import { supabase } from '../../services/supabase';

jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ user: { id: 'tutor', current_role: 'tutor' } }) }));
jest.mock('../../services/roomFeaturesService', () => ({ RoomFeaturesService: { checklist: {
  read: jest.fn(), getActiveTransferChecklistForRoom: jest.fn(), initializeTransferChecklistForStudent: jest.fn(),
} } }));
jest.mock('../../services/aiService', () => ({ getAIConfig: jest.fn() }));
jest.mock('../../services/checklistGenerationContext', () => ({ assessChecklistGenerationContext: jest.fn() }));
jest.mock('../../services/transferAssessmentService', () => ({ transferAssessmentService: { editLearningProgress: jest.fn() } }));
jest.mock('../../services/supabase', () => ({ supabase: { channel: jest.fn(), removeChannel: jest.fn() } }));

afterEach(() => { jest.useRealTimers(); });

it.each(['postgres_changes', 'system'])('preserves manual text and blocks replacement after %s delivers saved targets', async kind => {
  jest.useFakeTimers();
  window.localStorage.clear();
  const handlers: Array<{ kind: string; callback: (payload: unknown) => void }> = [];
  (supabase.channel as jest.Mock).mockImplementation(() => {
    const channel = {
      on: (kind: string, _filter: unknown, callback: (payload: unknown) => void) => {
        handlers.push({ kind, callback });
        return channel;
      },
      subscribe: () => channel,
    };
    return channel;
  });
  (supabase.removeChannel as jest.Mock).mockResolvedValue('ok');
  (RoomFeaturesService.checklist.read as jest.Mock).mockResolvedValue(null);
  (RoomFeaturesService.checklist.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(null);
  render(<ChecklistPanel roomId="room" studentId="learner" transferEnabled isVisible onToggleVisibility={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Enter Manually', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Detection Areas' }), { target: { value: 'My unfinished target' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Verification Steps' }), { target: { value: 'My verification step' } });
  (RoomFeaturesService.checklist.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue({
    id: 'saved-checklist', room_id: 'room', student_id: 'learner', progress_policy_version: 'transfer_v1',
    template_name: 'Learning', detection_areas: [{ id: 'saved-item', area_text: 'Target from another tab',
      item_type: 'detection_area', priority: 'important', status: 'pending', understanding_level: 'none',
      tutor_notes: '', coverage_evidence: [], attempts_count: 0 }], verification_steps: [],
  });
  await act(async () => {
    handlers.find(handler => handler.kind === kind)!.callback({ extension: 'postgres_changes', status: 'ok' });
    jest.advanceTimersByTime(300);
  });
  expect(screen.queryByRole('textbox', { name: 'Detection Areas' })).toHaveValue('My unfinished target');
  expect(screen.getByRole('textbox', { name: 'Verification Steps' })).toHaveValue('My verification step');
  expect(screen.getByRole('button', { name: 'Create Checklist', exact: true })).toBeDisabled();
  // Keyboard submission must obey the same conflict guard as the button.
  // The form has no accessible name; submit its DOM event independently of the disabled button.
  // eslint-disable-next-line testing-library/no-node-access
  fireEvent.submit(screen.getByRole('textbox', { name: 'Detection Areas' }).closest('form')!);
  expect(RoomFeaturesService.checklist.initializeTransferChecklistForStudent).not.toHaveBeenCalled();
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
  expect(screen.queryByRole('textbox', { name: 'Detection Areas' })).not.toBeInTheDocument();
  expect(screen.getByText('Target from another tab')).toBeInTheDocument();
});

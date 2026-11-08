#!/usr/bin/env node
/** Tests ChecklistPanel.tsx and EvidenceModal.tsx: selected-item evidence, refreshes and learner/room isolation. */
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ChecklistPanel from '../ChecklistPanel';
import { useChecklist } from '../../hooks/useChecklist';
import { ChecklistItem, SessionChecklist } from '../../types/checklist';

jest.mock('../../hooks/useChecklist');
jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ user: { id: 'tutor', current_role: 'tutor' } }) }));
jest.mock('../ChecklistGenerationModal', () => ({ ChecklistGenerationModal: () => null }));
jest.mock('../ManualChecklistInput', () => ({ ManualChecklistInput: () => null }));
jest.mock('../AddCustomAreaModal', () => () => null);
jest.mock('../../services/roomFeaturesService', () => ({ RoomFeaturesService: { checklist: {} } }));
jest.mock('../../services/transferAssessmentService', () => ({ transferAssessmentService: {} }));

const item = (id: string, itemType: ChecklistItem['item_type']): ChecklistItem => ({
  id, area_text: `Target ${id}`, item_type: itemType, priority: 'important', status: 'partially_covered',
  understanding_level: 'basic', tutor_notes: '', last_addressed: null, attempts_count: 1,
  original_template_area: true, created_at: new Date(), updated_at: new Date(),
  coverage_evidence: [{ id: `evidence-${id}`, evidence_text: `Learner evidence ${id}`, analysis: 'Recorded reasoning',
    confidence_score: 80, detection_method: 'ai_analysis', timestamp: new Date(), message_id: 'message' }],
});
let checklist: SessionChecklist;
let loading: boolean;
const view = (roomId = 'room-a', studentId = 'learner-a', isVisible = true) => (
  <ChecklistPanel roomId={roomId} studentId={studentId} transferEnabled isVisible={isVisible} onToggleVisibility={() => {}} />
);
const openFirst = () => fireEvent.click(screen.getAllByTitle('View evidence')[0]);

beforeEach(() => {
  loading = false;
  checklist = {
    id: 'checklist-a', room_id: 'room-a', student_id: 'learner-a', template_name: 'Phishing',
    progress_policy_version: 'transfer_v1', session_start: new Date(),
    detection_areas: [item('a', 'detection_area')], verification_steps: [item('b', 'verification_step')],
    total_items: 2, completed_items: 0, completion_percentage: 0,
    created_at: new Date(), updated_at: new Date(), is_active: true,
  };
  (useChecklist as jest.Mock).mockImplementation(() => ({
    checklist, loading, error: null, progress: null, updateItem: jest.fn(), refreshChecklist: jest.fn(),
    showGenerationModal: null, showManualInput: false,
  }));
});

it('opens the selected detection/verification evidence and closes before reopening another item', () => {
  render(view());
  openFirst();
  let dialog = screen.getByRole('dialog', { name: 'Learning Evidence' });
  expect(within(dialog).getByText('"Learner evidence a"')).toBeInTheDocument();
  expect(within(dialog).queryByText('"Learner evidence b"')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Close evidence' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByTitle('View evidence')[1]);
  dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('"Learner evidence b"')).toBeInTheDocument();
  expect(within(dialog).queryByText('"Learner evidence a"')).not.toBeInTheDocument();
});

it('uses current item evidence on refresh including an empty history', () => {
  const rendered = render(view());
  openFirst();
  checklist = { ...checklist, detection_areas: [{ ...checklist.detection_areas[0], coverage_evidence: [] }] };
  rendered.rerender(view());
  expect(screen.getByRole('dialog')).toHaveTextContent('No evidence recorded yet');
  expect(screen.queryByText('"Learner evidence a"')).not.toBeInTheDocument();
});

it('focuses the dialog, cycles its buttons, closes with Escape and restores the opener', () => {
  render(view());
  const opener = screen.getAllByTitle('View evidence')[0];
  opener.focus();
  openFirst();
  const dialog = screen.getByRole('dialog');
  const first = within(dialog).getByRole('button', { name: 'Close evidence' });
  const last = within(dialog).getByRole('button', { name: 'Close' });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: 'Tab' });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
});

it('clears a removed selection so it cannot reappear when the same ID returns', () => {
  const rendered = render(view());
  openFirst();
  const removed = checklist.detection_areas;
  checklist = { ...checklist, detection_areas: [] };
  rendered.rerender(view());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  checklist = { ...checklist, detection_areas: removed };
  rendered.rerender(view());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each(['room', 'learner'])('does not reopen retained evidence after the %s changes', (change) => {
  const rendered = render(view());
  rendered.rerender(view(change === 'room' ? 'room-b' : 'room-a', change === 'learner' ? 'learner-b' : 'learner-a'));
  openFirst();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it.each(['room', 'learner', 'checklist owner', 'checklist identity', 'hidden', 'loading'])(
  'closes the viewer on a change in %s and does not revive the old selection', (change) => {
    const rendered = render(view());
    openFirst();
    if (change === 'checklist owner') checklist = { ...checklist, student_id: 'learner-b' };
    if (change === 'checklist identity') checklist = { ...checklist, id: 'checklist-b' };
    if (change === 'loading') loading = true;
    rendered.rerender(view(change === 'room' ? 'room-b' : 'room-a', change === 'learner' ? 'learner-b' : 'learner-a', change !== 'hidden'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    loading = false;
    rendered.rerender(view());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  }
);

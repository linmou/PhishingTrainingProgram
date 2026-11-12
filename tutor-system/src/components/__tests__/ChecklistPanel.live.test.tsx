/** ChecklistPanel: background updates preserve work and learner controls are read-only. */
import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ChecklistPanel from '../ChecklistPanel';
import { useChecklist } from '../../hooks/useChecklist';
import { ChecklistItem, SessionChecklist } from '../../types/checklist';

jest.mock('../../hooks/useChecklist');
jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ user: mockUser }) }));
jest.mock('../ChecklistGenerationModal', () => ({ ChecklistGenerationModal: () => null }));
jest.mock('../ManualChecklistInput', () => ({ ManualChecklistInput: () => <div>Manual form</div> }));
jest.mock('../AddCustomAreaModal', () => () => null);
jest.mock('../../services/roomFeaturesService', () => ({ RoomFeaturesService: { checklist: {} } }));
jest.mock('../../services/transferAssessmentService', () => ({ transferAssessmentService: {} }));

let mockUser = { id: 'tutor', current_role: 'tutor' };
let checklist: SessionChecklist | null;
let error: string | null;
let liveError: string | null;
let loading: boolean;
const refreshChecklist = jest.fn();
const updateItem = jest.fn();
const item = (id: string, priority: ChecklistItem['priority']): ChecklistItem => ({
  id, area_text: `Target ${id}`, item_type: 'detection_area', priority,
  status: 'pending', understanding_level: 'none', tutor_notes: 'Saved note',
  last_addressed: null, attempts_count: 1, original_template_area: true,
  created_at: new Date(), updated_at: new Date(),
  coverage_evidence: [{ id: `evidence-${id}`, evidence_text: `Evidence ${id}`, analysis: 'Recorded reasoning',
    confidence_score: 80, detection_method: 'ai_analysis', timestamp: new Date(), message_id: 'message' }],
});
const view = (props = {}) => <ChecklistPanel roomId="room" studentId="learner" transferEnabled
  isVisible onToggleVisibility={() => {}} {...props} />;
const card = () => screen.getByText('Target a', { selector: '.checklist-item-text' }).closest('.checklist-item') as HTMLElement;
const expand = () => fireEvent.click(within(card()).getByText('Target a', { selector: '.checklist-item-text' }));
const updateSaved = (updates: Partial<ChecklistItem>) => {
  checklist = { ...checklist!, detection_areas: checklist!.detection_areas.map(value => value.id === 'a' ? { ...value, ...updates } : value) };
};

beforeEach(() => {
  jest.clearAllMocks();
  updateItem.mockReset();
  mockUser = { id: 'tutor', current_role: 'tutor' };
  loading = false;
  error = null;
  liveError = null;
  checklist = {
    id: 'checklist', room_id: 'room', student_id: 'learner', progress_policy_version: 'transfer_v1',
    template_name: 'Learning targets', session_start: new Date(), detection_areas: [item('a', 'important'), item('b', 'critical')],
    verification_steps: [], total_items: 2, completed_items: 0, completion_percentage: 0,
    created_at: new Date(), updated_at: new Date(), is_active: true,
  };
  (useChecklist as jest.Mock).mockImplementation(() => ({
    checklist, loading, error, liveError, progress: null, updateItem, refreshChecklist,
    showGenerationModal: null, showManualInput: false,
  }));
});

it('preserves both active drafts and the same card when remote updates move its priority', () => {
  const rendered = render(view());
  expand();
  const originalCard = card();
  fireEvent.click(originalCard.querySelector('.edit-text-button')!);
  fireEvent.click(originalCard.querySelector('.edit-note-button')!);
  fireEvent.change(screen.getByPlaceholderText('Enter checklist item text...'), { target: { value: 'Unsent target' } });
  fireEvent.change(screen.getByPlaceholderText("Add notes about student's understanding..."), { target: { value: 'Unsent note' } });
  updateSaved({ priority: 'critical', status: 'covered', area_text: 'Remote target', tutor_notes: 'Remote note' });
  rendered.rerender(view());
  expect(screen.getByPlaceholderText('Enter checklist item text...')).toHaveValue('Unsent target');
  expect(screen.getByPlaceholderText("Add notes about student's understanding...")).toHaveValue('Unsent note');
  expect(screen.getByLabelText('Status:', { selector: '#status-a' })).toHaveValue('covered');
  expect(screen.getByText('Remote target', { selector: '.checklist-item-text' }).closest('.checklist-item')).toBe(originalCard);
  fireEvent.click(originalCard.querySelector('.cancel-text')!);
  fireEvent.click(originalCard.querySelector('.cancel-note')!);
  expect(within(originalCard).getByText('Remote target', { selector: '.text-display' })).toBeInTheDocument();
  expect(within(originalCard).getByText('Remote note')).toBeInTheDocument();
});

it('updates nonedited fields independently while preserving an active note draft', () => {
  const rendered = render(view());
  expand();
  fireEvent.click(card().querySelector('.edit-note-button')!);
  fireEvent.change(screen.getByPlaceholderText("Add notes about student's understanding..."), { target: { value: 'My note' } });
  updateSaved({ area_text: 'New saved target' });
  rendered.rerender(view());
  expect(screen.getByPlaceholderText("Add notes about student's understanding...")).toHaveValue('My note');
  expect(screen.getByText('New saved target', { selector: '.text-display' })).toBeInTheDocument();
});

it('keeps the card and evidence visible with independent refresh and feed warnings', () => {
  const rendered = render(view());
  expand();
  fireEvent.click(within(card()).getByTitle('View evidence'));
  error = 'Could not refresh progress';
  liveError = 'Live updates disconnected. Use Refresh.';
  rendered.rerender(view());
  expect(screen.getByRole('dialog', { name: 'Learning Evidence' })).toHaveTextContent('Evidence a');
  expect(screen.getByText(error)).toBeInTheDocument();
  expect(screen.getByText(liveError)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(refreshChecklist).toHaveBeenCalledTimes(1);
  error = null;
  rendered.rerender(view());
  expect(screen.getByText(liveError)).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it.each(['prop', 'student role'])('shows learner progress and evidence without mutation controls through %s', mode => {
  if (mode === 'student role') mockUser = { id: 'learner', current_role: 'student' };
  render(view(mode === 'prop' ? { readOnly: true } : {}));
  expand();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  expect(within(card()).getByText('Target a', { selector: '.text-display' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Custom Area' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enter Manually' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Guard Mode is active/)).not.toBeInTheDocument();
  fireEvent.click(within(card()).getByTitle('View evidence'));
  expect(screen.getByRole('dialog')).toHaveTextContent('Evidence a');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(refreshChecklist).toHaveBeenCalledTimes(1);
  expect(updateItem).not.toHaveBeenCalled();
});

it('reports setup changes while collapsed and keeps the learner waiting view read-only', () => {
  const onSetupStateChange = jest.fn();
  mockUser = { id: 'learner', current_role: 'student' };
  const saved = checklist;
  checklist = null;
  loading = true;
  const rendered = render(view({ onSetupStateChange, isVisible: false }));
  expect(onSetupStateChange).not.toHaveBeenCalled();
  loading = false;
  rendered.rerender(view({ onSetupStateChange }));
  expect(onSetupStateChange).toHaveBeenLastCalledWith(true);
  expect(screen.getByText('Waiting for the tutor to set up learning targets.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Enter Manually' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  checklist = saved;
  rendered.rerender(view({ onSetupStateChange, isVisible: false }));
  expect(onSetupStateChange).toHaveBeenLastCalledWith(false);
});


it.each(['text', 'note'] as const)('keeps the %s draft until an asynchronous save succeeds', async field => {
  const rendered = render(view());
  expand();
  const originalCard = card();
  const placeholder = field === 'text' ? 'Enter checklist item text...' : "Add notes about student's understanding...";
  fireEvent.click(originalCard.querySelector(field === 'text' ? '.edit-text-button' : '.edit-note-button')!);
  fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value: 'Unsaved draft' } });
  let finishSave!: (success: boolean) => void;
  updateItem.mockImplementationOnce(() => new Promise<boolean>(resolve => { finishSave = resolve; }));
  const save = originalCard.querySelector(field === 'text' ? '.save-text' : '.save-note') as HTMLButtonElement;
  fireEvent.click(save);
  expect(save).toBeDisabled();
  expect(screen.getByPlaceholderText(placeholder)).toHaveValue('Unsaved draft');
  expect(screen.getByPlaceholderText(placeholder)).toBeDisabled();
  fireEvent.click(save);
  expect(updateItem).toHaveBeenCalledTimes(1);
  updateSaved(field === 'text' ? { area_text: 'Remote target' } : { tutor_notes: 'Remote note' });
  rendered.rerender(view());
  expect(screen.getByPlaceholderText(placeholder)).toHaveValue('Unsaved draft');

  await act(async () => { finishSave(false); });
  expect(save).toBeEnabled();
  expect(screen.getByPlaceholderText(placeholder)).toHaveValue('Unsaved draft');

  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  updateItem.mockRejectedValueOnce(new Error('Save rejected'));
  await act(async () => { fireEvent.click(save); });
  log.mockRestore();
  expect(screen.getByPlaceholderText(placeholder)).toHaveValue('Unsaved draft');
  expect(save).toBeEnabled();

  updateItem.mockImplementationOnce(async () => {
    updateSaved(field === 'text' ? { area_text: 'Unsaved draft' } : { tutor_notes: 'Unsaved draft' });
    return true;
  });
  await act(async () => { fireEvent.click(save); });
  rendered.rerender(view());
  expect(screen.queryByPlaceholderText(placeholder)).not.toBeInTheDocument();
  expect(within(originalCard).getByText('Unsaved draft', {
    selector: field === 'text' ? '.text-display' : '.note-display',
  })).toBeInTheDocument();
  expect(updateItem).toHaveBeenCalledTimes(3);
});

it('shows an initial read failure and Retry while collapsed without duplicating the expanded error', () => {
  checklist = null;
  error = 'Read unavailable';
  const rendered = render(view({ isVisible: false }));
  expect(screen.getByRole('status')).toHaveTextContent('Read unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(refreshChecklist).toHaveBeenCalledTimes(1);
  rendered.rerender(view());
  expect(screen.getAllByText(/Read unavailable/)).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(1);
});

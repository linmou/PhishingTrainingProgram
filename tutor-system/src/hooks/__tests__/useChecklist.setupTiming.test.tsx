#!/usr/bin/env node
// Responsibility: useChecklist.ts setup races across initial reads, learner membership and room changes; verify persisted targets reach separate tutor/learner viewers.
import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { useChecklist } from '../useChecklist';
import ChecklistPanel from '../../components/ChecklistPanel';
import { RoomFeaturesService } from '../../services/roomFeaturesService';
import { supabase } from '../../services/supabase';
import { SessionChecklist } from '../../types/checklist';

const mockViewerContext = React.createContext({ id: 'tutor', current_role: 'tutor' });
jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ user: require('react').useContext(mockViewerContext) }) }));
jest.mock('../../services/roomFeaturesService', () => ({ RoomFeaturesService: { checklist: {
  read: jest.fn(), getChecklistForStudent: jest.fn(), getActiveTransferChecklistForRoom: jest.fn(),
  initializeTransferChecklistForStudent: jest.fn(),
} } }));
jest.mock('../../services/aiService', () => ({ getAIConfig: jest.fn() }));
jest.mock('../../services/checklistGenerationContext', () => ({ assessChecklistGenerationContext: jest.fn() }));
jest.mock('../../services/transferAssessmentService', () => ({ transferAssessmentService: { editLearningProgress: jest.fn() } }));
jest.mock('../../services/supabase', () => ({ supabase: {
  channel: jest.fn(), removeChannel: jest.fn(), realtime: { isConnected: jest.fn() },
} }));

type Channel = { active: boolean; handlers: Array<{ table?: string; callback: () => void }>; status: (status: string) => void };
const api = RoomFeaturesService.checklist;
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
};
const saved = (room: string): SessionChecklist => ({
  id: `checklist-${room}`, room_id: room, student_id: 'learner', progress_policy_version: 'transfer_v1',
  template_name: 'Learning', session_start: new Date(), total_items: 1, completed_items: 0,
  completion_percentage: 0, created_at: new Date(), updated_at: new Date(), is_active: true,
  detection_areas: [{ id: `item-${room}`, area_text: 'Verify the sender', item_type: 'detection_area',
    priority: 'important', status: 'pending', understanding_level: 'none', coverage_evidence: [],
    tutor_notes: '', last_addressed: null, attempts_count: 0, original_template_area: false,
    created_at: new Date(), updated_at: new Date() }], verification_steps: [],
});
const wrapper = (role: string) => ({ children }: { children: React.ReactNode }) =>
  <mockViewerContext.Provider value={{ id: role, current_role: role === 'learner' ? 'student' : 'tutor' }}>{children}</mockViewerContext.Provider>;
let channels: Channel[];
let persisted: Map<string, SessionChecklist>;
// Drain already-started hook promises without advancing the race's timers.
// eslint-disable-next-line testing-library/no-unnecessary-act
const flush = async () => { await act(async () => {}); };
const notify = async () => {
  act(() => channels.filter(channel => channel.active).forEach(channel =>
    channel.handlers.filter(handler => handler.table === 'session_checklists').forEach(handler => handler.callback())));
  await act(async () => { jest.advanceTimersByTime(300); });
};
const subscribe = async () => {
  act(() => channels.filter(channel => channel.active).forEach(channel => channel.status('SUBSCRIBED')));
  await act(async () => { jest.advanceTimersByTime(300); });
};

beforeEach(() => {
  jest.useFakeTimers(); jest.resetAllMocks(); window.localStorage.clear();
  persisted = new Map(); channels = [];
  (api.read as jest.Mock).mockResolvedValue(null);
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockImplementation(async room => persisted.get(room) || null);
  (api.getChecklistForStudent as jest.Mock).mockImplementation(async (room, learner) => learner === 'learner' ? persisted.get(room) || null : null);
  (api.initializeTransferChecklistForStudent as jest.Mock).mockImplementation(async room => {
    const row = saved(room); persisted.set(room, row); return row;
  });
  (supabase.realtime.isConnected as jest.Mock).mockReturnValue(true);
  (supabase.removeChannel as jest.Mock).mockImplementation(async channel => { channel.active = false; return 'ok'; });
  (supabase.channel as jest.Mock).mockImplementation(() => {
    const channel: Channel = { active: true, handlers: [], status: () => {} };
    const connection = Object.assign(channel, {
      on: (_kind: string, filter: { table?: string }, callback: () => void) => { channel.handlers.push({ ...filter, callback }); return connection; },
      subscribe: (callback: (status: string) => void) => { channel.status = callback; return connection; },
    });
    channels.push(channel); return connection;
  });
});
afterEach(() => { jest.useRealTimers(); });

it.each([
  ['before-promotion', false], ['after-promotion', false],
  ['before-promotion', true], ['after-promotion', true],
])('converges when the old initial empty read completes %s with already subscribed=%s', async (order, alreadySubscribed) => {
  const initial = deferred<SessionChecklist | null>();
  const promotion = deferred<SessionChecklist>();
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockReturnValueOnce(initial.promise);
  (api.initializeTransferChecklistForStudent as jest.Mock).mockReturnValueOnce(promotion.promise);
  const { result: tutor } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }), { wrapper: wrapper('tutor') });
  const { result: learner } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }), { wrapper: wrapper('learner') });
  await flush();
  if (alreadySubscribed) await subscribe();
  let submission!: Promise<void>;
  act(() => { submission = tutor.current.handleManualSubmit(['Verify the sender'], []); });
  if (order === 'before-promotion') await act(async () => initial.resolve(null));
  persisted.set('room', saved('room'));
  await notify();
  await act(async () => { promotion.resolve(persisted.get('room')!); await submission; });
  if (order === 'after-promotion') await act(async () => initial.resolve(null));
  if (!alreadySubscribed) await subscribe();
  expect(tutor.current.checklist?.id).toBe('checklist-room');
  expect(learner.current.checklist?.id).toBe('checklist-room');
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
  expect(tutor.current.loading).toBe(false);
});

it('promotes when null membership becomes identified in the same batch as manual submission', async () => {
  const { result: tutor, rerender } = renderHook(({ learner }: { learner: string | null }) => useChecklist('room', { enabled: true, studentId: learner }),
    { wrapper: wrapper('tutor'), initialProps: { learner: null as string | null } });
  const { result: learner } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }), { wrapper: wrapper('learner') });
  await flush();
  // One batch is the tested race: custom hook submission and learner resolution overlap.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    const submission = tutor.current.handleManualSubmit(['Verify the sender'], []);
    rerender({ learner: 'learner' });
    await submission;
  });
  await notify();
  expect(api.initializeTransferChecklistForStudent).toHaveBeenCalledTimes(1);
  expect(tutor.current.checklist?.id).toBe('checklist-room');
  expect(learner.current.checklist?.id).toBe('checklist-room');
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
});

it('rereads after a setup event arrives while the learner initial empty response is still pending', async () => {
  const learnerInitial = deferred<SessionChecklist | null>();
  (api.getChecklistForStudent as jest.Mock).mockReturnValueOnce(learnerInitial.promise);
  const { result: tutor } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }), { wrapper: wrapper('tutor') });
  const { result: learner } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }), { wrapper: wrapper('learner') });
  await subscribe();
  await act(async () => tutor.current.handleManualSubmit(['Verify the sender'], []));
  await notify();
  expect(learner.current.checklist).toBeNull();
  await act(async () => learnerInitial.resolve(null));
  // No second subscribe, reconnect or manual refresh is injected after the stale response.
  expect(learner.current.checklist?.id).toBe('checklist-room');
  expect(learner.current.loading).toBe(false);
  expect(learner.current.error).toBeNull();
});

it('ignores the abandoned StrictMode promotion when its result arrives after the active promotion', async () => {
  const abandoned = deferred<SessionChecklist>();
  const active = deferred<SessionChecklist>();
  window.localStorage.setItem('room-learning-target-draft:room', JSON.stringify({ detectionAreas: ['Verify the sender'], verificationSteps: [] }));
  (api.initializeTransferChecklistForStudent as jest.Mock).mockReturnValueOnce(abandoned.promise).mockReturnValueOnce(active.promise);
  const Viewer = wrapper('tutor');
  const { result: tutor } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }), {
    wrapper: ({ children }) => <React.StrictMode><Viewer>{children}</Viewer></React.StrictMode>,
  });
  await flush();
  expect(api.initializeTransferChecklistForStudent).toHaveBeenCalledTimes(2);
  persisted.set('room', saved('room'));
  await act(async () => active.resolve(persisted.get('room')!));
  await act(async () => abandoned.resolve({ ...saved('room'), id: 'abandoned-checklist' }));
  expect(tutor.current.checklist?.id).toBe('checklist-room');
  expect(tutor.current.loading).toBe(false);
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
});

it('does not publish an old-room save into the new room and recovers its draft on return', async () => {
  const promotion = deferred<SessionChecklist>();
  (api.initializeTransferChecklistForStudent as jest.Mock).mockReturnValueOnce(promotion.promise);
  const { result: tutor, rerender } = renderHook(({ room }) => useChecklist(room, { enabled: true, studentId: 'learner' }),
    { wrapper: wrapper('tutor'), initialProps: { room: 'room' } });
  await flush();
  let submission!: Promise<void>;
  act(() => { submission = tutor.current.handleManualSubmit(['Verify the sender'], []); });
  rerender({ room: 'new-room' }); await flush();
  persisted.set('room', saved('room'));
  await act(async () => { promotion.resolve(persisted.get('room')!); await submission; });
  expect(tutor.current.checklist).toBeNull();
  expect(window.localStorage.getItem('room-learning-target-draft:room')).not.toBeNull();
  rerender({ room: 'room' }); await flush();
  expect(tutor.current.checklist?.id).toBe('checklist-room');
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
});

it('recovers a pending save after membership changes to null then returns', async () => {
  const promotion = deferred<SessionChecklist>();
  (api.initializeTransferChecklistForStudent as jest.Mock).mockReturnValueOnce(promotion.promise);
  const { result: tutor, rerender } = renderHook(({ learner }: { learner: string | null }) => useChecklist('room', { enabled: true, studentId: learner }),
    { wrapper: wrapper('tutor'), initialProps: { learner: 'learner' as string | null } });
  await flush();
  let submission!: Promise<void>;
  act(() => { submission = tutor.current.handleManualSubmit(['Verify the sender'], []); });
  rerender({ learner: null }); await flush();
  persisted.set('room', saved('room'));
  await act(async () => { promotion.resolve(persisted.get('room')!); await submission; });
  expect(tutor.current.checklist?.id).toBe('draft-room');
  expect(window.localStorage.getItem('room-learning-target-draft:room')).not.toBeNull();
  rerender({ learner: 'learner' }); await flush();
  expect(tutor.current.checklist?.id).toBe('checklist-room');
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
});

it('keeps the manual setup form open when same-room membership resolves before submission', async () => {
  const { result: tutor, rerender } = renderHook(({ learner }: { learner: string | null }) => useChecklist('room', { enabled: true, studentId: learner }),
    { wrapper: wrapper('tutor'), initialProps: { learner: null as string | null } });
  await flush();
  act(() => tutor.current.openManualInput());
  expect(tutor.current.showManualInput).toBe(true);
  rerender({ learner: 'learner' }); await flush();
  expect(api.initializeTransferChecklistForStudent).not.toHaveBeenCalled();
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
  expect(tutor.current.showManualInput).toBe(true);
});

it('preserves typed manual targets when same-room membership resolves before clicking Submit', async () => {
  const { rerender } = render(<ChecklistPanel roomId="room" studentId={null} transferEnabled isVisible onToggleVisibility={() => {}} />,
    { wrapper: wrapper('tutor') });
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Enter Manually', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Detection Areas' }), { target: { value: 'Verify the sender' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Verification Steps' }), { target: { value: 'Use a trusted channel' } });
  rerender(<ChecklistPanel roomId="room" studentId="learner" transferEnabled isVisible onToggleVisibility={() => {}} />);
  await flush();
  expect(api.initializeTransferChecklistForStudent).not.toHaveBeenCalled();
  expect(persisted.size).toBe(0);
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
  expect(screen.queryByRole('textbox', { name: 'Detection Areas' })).toHaveValue('Verify the sender');
  expect(screen.queryByRole('textbox', { name: 'Verification Steps' })).toHaveValue('Use a trusted channel');
  fireEvent.click(screen.getByRole('button', { name: 'Create Checklist', exact: true }));
  await flush();
  expect(api.initializeTransferChecklistForStudent).toHaveBeenCalledWith('room', 'learner', [
    { area_text: 'Verify the sender', item_type: 'detection_area', priority: 'important' },
    { area_text: 'Use a trusted channel', item_type: 'verification_step', priority: 'important' },
  ]);
});

it('preserves the typed manual form during a pending same-room membership read', async () => {
  const nextRead = deferred<SessionChecklist | null>();
  const { rerender } = render(<ChecklistPanel roomId="room" studentId={null} transferEnabled isVisible onToggleVisibility={() => {}} />,
    { wrapper: wrapper('tutor') });
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Enter Manually', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Detection Areas' }), { target: { value: 'Keep this unsaved target' } });
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockReturnValueOnce(nextRead.promise);
  rerender(<ChecklistPanel roomId="room" studentId="learner" transferEnabled isVisible onToggleVisibility={() => {}} />);
  await flush();
  expect(screen.queryByRole('textbox', { name: 'Detection Areas' })).toHaveValue('Keep this unsaved target');
  await act(async () => nextRead.resolve(null));
  expect(screen.queryByRole('textbox', { name: 'Detection Areas' })).toHaveValue('Keep this unsaved target');
});

it('preserves typed manual targets and reports a failed membership read until retry succeeds', async () => {
  const { rerender } = render(<ChecklistPanel roomId="room" studentId={null} transferEnabled isVisible onToggleVisibility={() => {}} />,
    { wrapper: wrapper('tutor') });
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Enter Manually', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Detection Areas' }), { target: { value: 'Keep this unsaved target' } });
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockRejectedValueOnce(new Error('Membership-scope read unavailable'));
  rerender(<ChecklistPanel roomId="room" studentId="learner" transferEnabled isVisible onToggleVisibility={() => {}} />);
  await flush();
  expect(screen.getByRole('textbox', { name: 'Detection Areas' })).toHaveValue('Keep this unsaved target');
  expect(screen.getByText('Membership-scope read unavailable')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Retry', exact: true }));
  await flush();
  expect(screen.queryByText('Membership-scope read unavailable')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Detection Areas' })).toHaveValue('Keep this unsaved target');
});

it.each(['room', 'account'])('clears unsaved manual text across a true %s identity change', async changed => {
  const panel = (room: string, id: string) => <mockViewerContext.Provider value={{ id, current_role: 'tutor' }}>
    <ChecklistPanel roomId={room} studentId={null} transferEnabled isVisible onToggleVisibility={() => {}} />
  </mockViewerContext.Provider>;
  const { rerender } = render(panel('room', 'tutor'));
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Enter Manually', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Detection Areas' }), { target: { value: 'Private unsaved target' } });
  rerender(panel(changed === 'room' ? 'other-room' : 'room', changed === 'account' ? 'other-tutor' : 'tutor'));
  await flush();
  expect(screen.queryByRole('textbox', { name: 'Detection Areas' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Enter Manually', exact: true }));
  expect(screen.getByRole('textbox', { name: 'Detection Areas' })).toHaveValue('');
});

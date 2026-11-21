/** useChecklist.ts: verify realtime reads and draft edits during pending promotion. */
import React from 'react';
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import ChecklistPanel from '../../components/ChecklistPanel';
import { useChecklist } from '../useChecklist';
import { RoomFeaturesService } from '../../services/roomFeaturesService';
import { transferAssessmentService } from '../../services/transferAssessmentService';
import { supabase } from '../../services/supabase';
import { SessionChecklist } from '../../types/checklist';

let mockUser = { id: 'tutor', current_role: 'tutor' };
jest.mock('../../contexts/AuthContext', () => ({ useOptionalAuth: () => ({ user: mockUser }) }));
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

type Channel = { handlers: Array<{ kind: string; filter: any; callback: (payload: any) => void }>;
  status: (status: string) => void; on: jest.Mock; subscribe: jest.Mock };
let channels: Channel[];
const api = RoomFeaturesService.checklist;
const saved = (room = 'room', note = ''): SessionChecklist => ({
  id: `checklist-${room}`, room_id: room, student_id: 'learner', progress_policy_version: 'transfer_v1',
  template_name: 'Learning', session_start: new Date(), total_items: 1, completed_items: 0,
  completion_percentage: 0, created_at: new Date(), updated_at: new Date(), is_active: true,
  detection_areas: [{ id: `item-${room}`, area_text: 'Explain the risk', item_type: 'detection_area',
    priority: 'important', status: note ? 'covered' : 'pending', understanding_level: 'none',
    coverage_evidence: [], tutor_notes: note, last_addressed: null, attempts_count: 0,
    original_template_area: false, created_at: new Date(), updated_at: new Date() }], verification_steps: [],
});
const flush = async () => { await act(async () => {}); };
const advance = async (ms = 300) => { await act(async () => { jest.advanceTimersByTime(ms); }); };
const currentChannel = () => channels[channels.length - 1];
const event = (table: string, channel = currentChannel()) => {
  const handler = channel.handlers.find(value => value.filter.table === table)!;
  act(() => handler.callback({ new: {} }));
};
const status = (value: string, channel = currentChannel()) => act(() => channel.status(value));
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

beforeEach(() => {
  jest.useFakeTimers();
  jest.resetAllMocks();
  window.localStorage.clear();
  mockUser = { id: 'tutor', current_role: 'tutor' };
  channels = [];
  (api.read as jest.Mock).mockResolvedValue(null);
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(saved());
  (api.getChecklistForStudent as jest.Mock).mockResolvedValue(saved());
  (supabase.realtime.isConnected as jest.Mock).mockReturnValue(true);
  (supabase.removeChannel as jest.Mock).mockResolvedValue('ok');
  (supabase.channel as jest.Mock).mockImplementation(() => {
    const channel: Channel = { handlers: [], status: () => {}, on: jest.fn(), subscribe: jest.fn() };
    channel.on.mockImplementation((kind, filter, callback) => { channel.handlers.push({ kind, filter, callback }); return channel; });
    channel.subscribe.mockImplementation(callback => { channel.status = callback; return channel; });
    channels.push(channel);
    return channel;
  });
});
afterEach(() => { jest.useRealTimers(); });

it('scopes setup, item and evidence notifications and coalesces a burst into a quiet read', async () => {
  const { result } = renderHook(() => useChecklist('room'));
  await flush();
  expect(currentChannel().handlers.map(h => h.filter)).toEqual(expect.arrayContaining([
    expect.objectContaining({ table: 'session_checklists', filter: 'room_id=eq.room' }),
    expect.objectContaining({ table: 'checklist_items', filter: 'checklist_id=eq.checklist-room' }),
    expect.objectContaining({ table: 'coverage_evidence', filter: 'item_id=eq.item-room' }),
  ]));
  const pending = deferred<SessionChecklist>();
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockReturnValueOnce(pending.promise);
  event('checklist_items'); event('coverage_evidence'); event('checklist_items');
  await advance(299);
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(2);
  expect(result.current.loading).toBe(false);
  expect(result.current.checklist?.detection_areas[0].status).toBe('pending');
  await act(async () => pending.resolve(saved('room', 'new evidence')));
  expect(result.current.checklist?.detection_areas[0].status).toBe('covered');
});

it('reconciles after initial subscribe and reconnect even without row events', async () => {
  const { result } = renderHook(() => useChecklist('room'));
  await flush();
  status('SUBSCRIBED'); await advance();
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(2);
  status('CHANNEL_ERROR');
  expect(result.current.liveError).toMatch(/unavailable/);
  await advance(1000);
  status('SUBSCRIBED'); await advance();
  expect(result.current.liveError).toBeNull();
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(3);
});

it('does not clear a database-stream error on channel join or manual refresh', async () => {
  const { result } = renderHook(() => useChecklist('room'));
  await flush();
  act(() => currentChannel().handlers.find(h => h.kind === 'system')!.callback({ extension: 'postgres_changes', status: 'error' }));
  status('SUBSCRIBED');
  await act(async () => result.current.refreshChecklist());
  expect(result.current.liveError).toMatch(/unavailable/);
  expect(result.current.checklist).not.toBeNull();
});

it('discovers targets committed after channel join but before PostgreSQL stream readiness', async () => {
  mockUser = { id: 'learner', current_role: 'student' };
  (api.getChecklistForStudent as jest.Mock).mockResolvedValue(null);
  const { result } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }));
  await flush();
  status('SUBSCRIBED'); await advance();
  expect(result.current.checklist).toBeNull();
  // A write before the database stream starts has no row notification to replay.
  (api.getChecklistForStudent as jest.Mock).mockResolvedValue(saved());
  act(() => currentChannel().handlers.find(h => h.kind === 'system')!.callback({ extension: 'postgres_changes', status: 'ok' }));
  await advance();
  expect(result.current.checklist?.id).toBe('checklist-room');
});

it('queues one further read when events arrive during a pending read', async () => {
  renderHook(() => useChecklist('room'));
  await flush();
  const pending = deferred<SessionChecklist>();
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockReturnValueOnce(pending.promise);
  event('checklist_items'); await advance();
  event('checklist_items'); event('coverage_evidence'); await advance();
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(2);
  await act(async () => pending.resolve(saved()));
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(3);
});

it('retains saved progress after a failed background read', async () => {
  const { result } = renderHook(() => useChecklist('room'));
  await flush();
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockRejectedValueOnce(new Error('read unavailable'));
  event('checklist_items'); await advance();
  expect(result.current.checklist?.id).toBe('checklist-room');
  expect(result.current.error).toBe('read unavailable');
  expect(result.current.loading).toBe(false);
});

it('discovers first target setup with no checklist or item subscription yet', async () => {
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValueOnce(null);
  const { result } = renderHook(() => useChecklist('room'));
  await flush();
  expect(result.current.checklist).toBeNull();
  event('session_checklists'); await advance();
  expect(result.current.checklist?.id).toBe('checklist-room');
});

it('rejects delayed reads and notifications from a previous room', async () => {
  const pending = deferred<SessionChecklist>();
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockReturnValueOnce(pending.promise).mockResolvedValue(saved('new-room'));
  const { result, rerender } = renderHook(({ room }) => useChecklist(room), { initialProps: { room: 'room' } });
  const previous = currentChannel();
  rerender({ room: 'new-room' }); await flush();
  await act(async () => pending.resolve(saved()));
  event('session_checklists', previous); await advance();
  act(() => previous.handlers.find(h => h.kind === 'system')!.callback({ extension: 'postgres_changes', status: 'ok' }));
  await advance();
  expect(result.current.checklist?.room_id).toBe('new-room');
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(2);
});

it('invalidates reads when only the authenticated learner identity changes', async () => {
  mockUser = { id: 'learner', current_role: 'student' };
  const pending = deferred<SessionChecklist>();
  (api.getChecklistForStudent as jest.Mock).mockReturnValueOnce(pending.promise).mockResolvedValue(null);
  const { result, rerender } = renderHook(() => useChecklist('room'));
  mockUser = { id: 'other-learner', current_role: 'student' };
  rerender(); await flush();
  await act(async () => pending.resolve(saved()));
  expect(result.current.checklist).toBeNull();
  expect(api.getChecklistForStudent).toHaveBeenLastCalledWith('room', 'other-learner');
});

it('never retries draft promotion from a notification after an initial save failure', async () => {
  window.localStorage.setItem('room-learning-target-draft:room', JSON.stringify({ detectionAreas: ['Draft'], verificationSteps: [] }));
  (api.initializeTransferChecklistForStudent as jest.Mock).mockRejectedValue(new Error('save unavailable'));
  const { result } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }));
  await flush();
  event('session_checklists'); await advance();
  expect(api.initializeTransferChecklistForStudent).toHaveBeenCalledTimes(1);
  expect(result.current.checklist?.id).toBe('draft-room');
});

it('cancels pending refresh and recovery timers when the viewer unmounts', async () => {
  const { unmount } = renderHook(() => useChecklist('room'));
  await flush();
  event('checklist_items'); status('CHANNEL_ERROR');
  const count = channels.length;
  unmount(); await advance(5000);
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(1);
  expect(channels).toHaveLength(count);
  expect(supabase.removeChannel).toHaveBeenCalled();
});

it('rejects draft edits during promotion and allows persisted edits after success', async () => {
  const draft = JSON.stringify({ detectionAreas: ['Draft'], verificationSteps: [] });
  window.localStorage.setItem('room-learning-target-draft:room', draft);
  const pending = deferred<SessionChecklist>();
  (api.initializeTransferChecklistForStudent as jest.Mock).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }));
  await flush();
  expect(result.current.loading).toBe(true);
  await act(async () => {
    expect(await result.current.updateItem('draft-room-detection_area-0', { area_text: 'New draft' })).toBe(false);
    expect(await result.current.updateItem('draft-room-detection_area-0', { priority: 'critical' })).toBe(false);
  });
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBe(draft);
  await act(async () => pending.resolve(saved()));
  expect(result.current.loading).toBe(false);
  expect(window.localStorage.getItem('room-learning-target-draft:room')).toBeNull();
  (transferAssessmentService.editLearningProgress as jest.Mock).mockResolvedValue({ ...saved().detection_areas[0], area_text: 'New saved target' });
  await act(async () => {
    expect(await result.current.updateItem('item-room', { area_text: 'New saved target' })).toBe(true);
  });
  expect(transferAssessmentService.editLearningProgress).toHaveBeenCalledTimes(1);
});

it('allows draft edits after promotion fails without retrying the write', async () => {
  window.localStorage.setItem('room-learning-target-draft:room', JSON.stringify({ detectionAreas: ['Draft'], verificationSteps: [] }));
  (api.initializeTransferChecklistForStudent as jest.Mock).mockRejectedValueOnce(new Error('Sync failed'));
  const { result } = renderHook(() => useChecklist('room', { enabled: true, studentId: 'learner' }));
  await flush();
  expect(result.current.loading).toBe(false);
  await act(async () => {
    expect(await result.current.updateItem('draft-room-detection_area-0', { area_text: 'Revised draft' })).toBe(true);
  });
  expect(result.current.checklist?.detection_areas[0].area_text).toBe('Revised draft');
  expect(JSON.parse(window.localStorage.getItem('room-learning-target-draft:room')!).detectionAreas).toEqual(['Revised draft']);
  expect(api.initializeTransferChecklistForStudent).toHaveBeenCalledTimes(1);
});

it('keeps the real panel draft controls disabled until its hook finishes promotion', async () => {
  window.localStorage.setItem('room-learning-target-draft:room', JSON.stringify({ detectionAreas: ['Draft'], verificationSteps: [] }));
  const pending = deferred<SessionChecklist>();
  (api.initializeTransferChecklistForStudent as jest.Mock).mockReturnValueOnce(pending.promise);
  render(<ChecklistPanel roomId="room" studentId="learner" transferEnabled isVisible onToggleVisibility={() => {}} />);
  await flush();
  fireEvent.click(screen.getByText('Draft', { selector: '.checklist-item-text' }));
  expect(screen.getByLabelText('Status:')).toBeDisabled();
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2);
  screen.getAllByRole('button', { name: 'Edit' }).forEach(button => expect(button).toBeDisabled());
  await act(async () => pending.resolve(saved()));
  fireEvent.click(screen.getByText('Explain the risk', { selector: '.checklist-item-text' }));
  expect(screen.getByLabelText('Status:')).toBeEnabled();
  screen.getAllByRole('button', { name: 'Edit' }).forEach(button => expect(button).toBeEnabled());
});


it('refreshes within a bounded delay during a sustained stream of writes', async () => {
  renderHook(() => useChecklist('room'));
  await flush();
  for (let n = 0; n < 15; n++) {
    event('checklist_items');
    await advance(200);
  }
  expect(api.getActiveTransferChecklistForRoom).toHaveBeenCalledTimes(4);
});

it('keeps a failed-save warning through successful background reads', async () => {
  const { result } = renderHook(() => useChecklist('room'));
  await flush();
  (transferAssessmentService.editLearningProgress as jest.Mock).mockRejectedValueOnce(new Error('Save was rejected'));
  await act(async () => {
    expect(await result.current.updateItem('item-room', { tutor_notes: 'Unsaved note' })).toBe(false);
  });
  event('checklist_items'); await advance();
  expect(result.current.error).toContain('Save was rejected');
  expect(result.current.checklist?.detection_areas[0].tutor_notes).toBe('');
});

it('releases a hung read and ignores its late result after manual recovery', async () => {
  const pending = deferred<SessionChecklist>();
  (api.getActiveTransferChecklistForRoom as jest.Mock).mockReturnValueOnce(pending.promise);
  const { result } = renderHook(() => useChecklist('room'));
  await advance(15_000);
  expect(result.current.loading).toBe(false);
  expect(result.current.error).toMatch(/timed out/);
  await act(async () => result.current.refreshChecklist());
  expect(result.current.checklist?.detection_areas[0].tutor_notes).toBe('');
  await act(async () => pending.resolve(saved('room', 'late stale snapshot')));
  expect(result.current.checklist?.detection_areas[0].tutor_notes).toBe('');
  expect(result.current.error).toBeNull();
});

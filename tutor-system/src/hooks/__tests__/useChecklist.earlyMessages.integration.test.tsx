#!/usr/bin/env node
// Responsibility: exercise useChecklist and ChecklistService together when goals follow ordinary learner messages.

import { act, renderHook, waitFor } from '@testing-library/react';
import { useChecklist } from '../useChecklist';
import { supabase } from '../../services/supabase';
import { ChecklistService } from '../../services/checklistService';

jest.mock('../../services/supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('../../services/aiService', () => ({ getAIConfig: jest.fn() }));
jest.mock('../../services/coverageDetectionService', () => ({ CoverageDetectionService: {} }));
jest.mock('../../services/checklistIntegration', () => ({ generateChecklistFromSystemPrompt: jest.fn() }));
jest.mock('../../services/checklistGenerationContext', () => ({ assessChecklistGenerationContext: jest.fn() }));
jest.mock('../../contexts/AuthContext', () => {
  const auth = { user: { id: 'tutor-1', current_role: 'tutor' } };
  return { useOptionalAuth: () => auth };
});

const ROOM = 'room-1';
const LEARNER = 'learner-1';
const DRAFT_KEY = `room-learning-target-draft:${ROOM}`;
const CACHE_KEY = `confirmed-learning-evidence:${ROOM}:${LEARNER}`;
const createdAt = '2026-10-14T12:00:00Z';
const message = (id: string, overrides: Record<string, unknown> = {}) => ({
  id, room_id: ROOM, user_id: LEARNER, user_role: 'student', assessment_id: null,
  created_at: createdAt, ...overrides,
});
type SavedMessage = ReturnType<typeof message>;

describe('goals saved after learner messages', () => {
  let messages: SavedMessage[];
  let initialized: boolean;
  let processed: Set<string>;
  let inventoryError: string | null;
  let initializationError: string | null;
  let analysisFailure: string | null;
  let returnedChecklistId: string;
  let checklistReadCount: number;
  let failReadNumber: number | null;
  let orders: string[][];
  let ranges: Array<[number, number]>;
  let events: string[];
  let pauseAnalysis: ((messageId: string) => Promise<void>) | null;
  let applyEvidence: ((messageId: string) => void) | null;
  let deferred: Set<string>;

  const analysisIds = () => (supabase.functions.invoke as jest.Mock).mock.calls
    .map(([, options]) => options.body)
    .filter(body => body.operation === 'analyze_message')
    .map(body => body.message_id);
  const uniqueAnalysisIds = () => Array.from(new Set(analysisIds()));

  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    messages = [];
    initialized = false;
    processed = new Set();
    inventoryError = null;
    initializationError = null;
    analysisFailure = null;
    returnedChecklistId = 'checklist-1';
    checklistReadCount = 0;
    failReadNumber = null;
    orders = [];
    ranges = [];
    events = [];
    pauseAnalysis = null;
    applyEvidence = null;
    deferred = new Set();

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      const filters: Array<[string, unknown]> = [];
      const order: string[] = [];
      let page: [number, number] | null = null;
      const resolve = () => {
        if (table === 'messages') {
          events.push('inventory');
          orders.push(order);
          if (inventoryError) return { data: null, error: { message: inventoryError } };
          const rows = messages.filter(row => filters.every(([key, value]) => row[key as keyof SavedMessage] === value));
          rows.sort((left, right) => {
            for (const key of order) {
              const comparison = String(left[key as keyof SavedMessage]).localeCompare(String(right[key as keyof SavedMessage]));
              if (comparison) return comparison;
            }
            return 0;
          });
          return { data: page ? rows.slice(page[0], page[1] + 1) : rows, error: null };
        }
        if (table === 'session_checklists') {
          checklistReadCount += 1;
          if (checklistReadCount === failReadNumber) return { data: null, error: { message: 'read failed' } };
          const row = initialized ? {
            id: returnedChecklistId, room_id: ROOM, student_id: LEARNER, progress_policy_version: 'transfer_v1',
            is_active: true, template_name: 'Room learning targets', session_start: createdAt,
            created_at: createdAt, updated_at: createdAt, total_items: 1, completed_items: 0, completion_percentage: 0,
          } : null;
          const eligible = row && filters.every(([key, value]) => row[key as keyof typeof row] === value);
          return { data: eligible ? row : null, error: null };
        }
        if (table === 'checklist_items') return { data: [{
          id: 'target-1', checklist_id: 'checklist-1', area_text: 'Verify the sender', item_type: 'detection_area',
          priority: 'important', status: processed.size ? 'partially_covered' : 'pending',
          understanding_level: processed.size ? 'basic' : 'none', coverage_evidence: [], tutor_notes: '',
          last_addressed: null, attempts_count: processed.size, original_template_area: false,
          created_at: createdAt, updated_at: createdAt,
        }], error: null };
        throw new Error(`Unexpected table ${table}`);
      };
      const query: Record<string, unknown> = {
        select: jest.fn(() => query),
        eq: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
        is: jest.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
        order: jest.fn((key: string, options: { ascending: boolean }) => {
          expect(options.ascending).toBe(true);
          order.push(key); return query;
        }),
        range: jest.fn((start: number, end: number) => { page = [start, end]; ranges.push(page); return query; }),
        limit: jest.fn(() => query),
        maybeSingle: jest.fn(() => Promise.resolve(resolve())),
        single: jest.fn(() => {
          const result = resolve();
          return Promise.resolve(result.data ? result : { data: null, error: { code: 'PGRST116', message: 'No rows' } });
        }),
        then: (fulfilled: (value: unknown) => unknown, rejected: (reason: unknown) => unknown) =>
          Promise.resolve(resolve()).then(fulfilled, rejected),
      };
      return query;
    });
    (supabase.functions.invoke as jest.Mock).mockImplementation(async (_name, { body }) => {
      events.push(body.operation);
      if (body.operation === 'initialize_checklist') {
        if (initializationError) return { data: null, error: { message: initializationError } };
        initialized = true;
        return { data: { ok: true, data: { checklist_id: 'checklist-1' } }, error: null };
      }
      if (body.operation === 'analyze_message') {
        expect(typeof body.room_id).toBe('string');
        if (pauseAnalysis) await pauseAnalysis(body.message_id);
        if (body.message_id === analysisFailure) return { data: null, error: { message: 'analysis unavailable' } };
        if (deferred.has(body.message_id)) return { data: { ok: true, data: { deferred: true } }, error: null };
        const alreadyProcessed = processed.has(body.message_id);
        if (!alreadyProcessed && applyEvidence) applyEvidence(body.message_id);
        processed.add(body.message_id);
        return { data: { ok: true, data: { already_processed: alreadyProcessed } }, error: null };
      }
      throw new Error(`Unexpected API operation ${body.operation}`);
    });
  });

  afterEach(() => { jest.restoreAllMocks(); });

  const saveGoals = async () => {
    const hook = renderHook(() => useChecklist(ROOM, { enabled: true, studentId: LEARNER }));
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => { await hook.result.current.handleManualSubmit(['Verify the sender'], []); });
    return hook;
  };

  it('analyzes both early messages in chronological order and returns refreshed progress', async () => {
    messages = [message('later', { created_at: '2026-10-14T12:01:00Z' }), message('earlier')];
    const { result } = await saveGoals();
    expect(analysisIds()).toEqual(['earlier', 'earlier', 'later', 'later']);
    expect(events.indexOf('initialize_checklist')).toBeLessThan(events.indexOf('inventory'));
    expect(result.current.checklist?.detection_areas[0]).toMatchObject({ attempts_count: 2, status: 'partially_covered' });
    expect(result.current.progress?.partially_covered_areas).toBe(1);
    expect(result.current.error).toBeNull();
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('saves goals with an empty history without analysis', async () => {
    const { result } = await saveGoals();
    expect(analysisIds()).toEqual([]);
    expect(result.current.checklist?.id).toBe('checklist-1');
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it('filters the room, learner, role, and assessment scope and orders equal timestamps by ID', async () => {
    messages = [message('b'), message('tutor', { user_role: 'tutor' }), message('a'),
      message('other-learner', { user_id: 'learner-2' }), message('other-room', { room_id: 'room-2' }),
      message('assessment-answer', { assessment_id: 'assessment-1' })];
    await saveGoals();
    expect(uniqueAnalysisIds()).toEqual(['a', 'b']);
    expect(orders[0]).toEqual(['created_at', 'id']);
  });

  it('preserves the draft after a partial failure and safely retries completed evidence', async () => {
    messages = [message('a'), message('b'), message('c')];
    analysisFailure = 'b';
    const { result } = await saveGoals();
    expect(analysisIds()).toEqual(['a', 'a', 'b']);
    expect(result.current.error).toMatch(/analysis unavailable/);
    expect(result.current.checklist?.id).toBe(`draft-${ROOM}`);
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || '[]')).toEqual(['a']);
    analysisFailure = null;
    await act(async () => { await result.current.refreshChecklist(); });
    expect(analysisIds()).toEqual(['a', 'a', 'b', 'b', 'b', 'c', 'c']);
    expect(processed.size).toBe(3);
    expect(result.current.checklist?.detection_areas[0].attempts_count).toBe(3);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('keeps the draft retryable if message inventory cannot be read', async () => {
    inventoryError = 'inventory unavailable';
    const { result } = await saveGoals();
    expect(result.current.error).toMatch(/inventory unavailable/);
    expect(analysisIds()).toEqual([]);
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('does not inspect or analyze history when initialization fails', async () => {
    initializationError = 'initialization unavailable';
    const { result } = await saveGoals();
    expect(result.current.error).toMatch(/initialization unavailable/);
    expect(events).not.toContain('inventory');
    expect(analysisIds()).toEqual([]);
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('does not analyze history when the initialized checklist cannot be verified', async () => {
    returnedChecklistId = 'different-checklist';
    const { result } = await saveGoals();
    expect(result.current.error).toMatch(/could not be read/);
    expect(events).not.toContain('inventory');
    expect(analysisIds()).toEqual([]);
  });

  it('preserves retry state when the final progress reread fails', async () => {
    messages = [message('a')];
    failReadNumber = 4; // Initial transfer and legacy reads, verified checklist, final refreshed checklist.
    const { result } = await saveGoals();
    expect(uniqueAnalysisIds()).toEqual(['a']);
    expect(result.current.error).toMatch(/read failed/);
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
  });

  it('promotes a saved draft and checks earlier messages when the learner arrives later', async () => {
    const { result, rerender } = renderHook(({ studentId }: { studentId: string | null }) =>
      useChecklist(ROOM, { enabled: true, studentId }), { initialProps: { studentId: null as string | null } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.handleManualSubmit(['Verify the sender'], []); });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    messages = [message('early')];
    rerender({ studentId: LEARNER });
    await waitFor(() => expect(result.current.checklist?.id).toBe('checklist-1'));
    expect(uniqueAnalysisIds()).toEqual(['early']);
    expect(result.current.checklist?.detection_areas[0].attempts_count).toBe(1);
  });

  it('waits for each analysis before starting the next message', async () => {
    messages = [message('a'), message('b')];
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    pauseAnalysis = () => gate;
    const { result } = renderHook(() => useChecklist(ROOM, { enabled: true, studentId: LEARNER }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let submission: Promise<void>;
    act(() => { submission = result.current.handleManualSubmit(['Verify the sender'], []); });
    await waitFor(() => expect(analysisIds()).toEqual(['a']));
    expect(window.localStorage.getItem(DRAFT_KEY)).not.toBeNull();
    await act(async () => { release(); await submission; });
    expect(analysisIds()).toEqual(['a', 'a', 'b', 'b']);
  });

  it('visits messages beyond the first database page', async () => {
    messages = Array.from({ length: 1001 }, (_, index) => message(`m-${String(index).padStart(4, '0')}`)).reverse();
    const { result } = await saveGoals();
    expect(uniqueAnalysisIds()).toEqual([...messages].reverse().map(row => row.id));
    expect(ranges.length).toBeGreaterThan(1);
    expect(result.current.checklist?.detection_areas[0].attempts_count).toBe(1001);
  });

  it('bounds repeated Edge calls after checking a 1001-message history', async () => {
    messages = Array.from({ length: 1001 }, (_, index) => message(`m-${String(index).padStart(4, '0')}`));
    await saveGoals();
    const initialCallCount = analysisIds().length;
    messages.push(message('new', { created_at: '2026-10-14T12:01:00Z' }));
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'new');
    expect(analysisIds().slice(initialCallCount)).toEqual(['new']);
    expect(JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || '[]')).toHaveLength(1001);
    messages.push(message('newer', { created_at: '2026-10-14T12:02:00Z' }));
    const nextCallCount = analysisIds().length;
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'newer');
    expect(analysisIds().slice(nextCallCount)).toEqual(['new', 'newer']);
  });

  it('caches only a positive server completion confirmation and retries Guard-deferred evidence', async () => {
    messages = [message('a')];
    deferred.add('a');
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER);
    expect(analysisIds()).toEqual(['a']);
    expect(JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || '[]')).toEqual([]);
    expect(processed.size).toBe(0);
    deferred.clear();
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'a');
    expect(analysisIds()).toEqual(['a', 'a']);
    expect(JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || '[]')).toEqual([]);
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'a');
    expect(analysisIds()).toEqual(['a', 'a', 'a']);
    expect(JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || '[]')).toEqual(['a']);
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'a');
    expect(analysisIds()).toEqual(['a', 'a', 'a']);
  });

  it('keeps completion caches separate for each room and learner', async () => {
    messages = [message('a')];
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER);
    messages = [message('a', { user_id: 'learner-2' })];
    await ChecklistService.analyzeStudentMessages(ROOM, 'learner-2', 'a');
    messages = [message('a', { room_id: 'room-2' })];
    await ChecklistService.analyzeStudentMessages('room-2', LEARNER, 'a');
    expect(analysisIds()).toEqual(['a', 'a', 'a', 'a']);
    expect(window.sessionStorage.length).toBe(3);
  });

  it.each(['not-json', '{"completed":["a"]}', '["a",7]'])('checks actual evidence when cache data is invalid: %s', async raw => {
    messages = [message('a')];
    window.sessionStorage.setItem(CACHE_KEY, raw);
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'a');
    expect(analysisIds()).toEqual(['a']);
    expect(processed.has('a')).toBe(true);
    expect(warning).toHaveBeenCalled();
  });

  it('checks evidence even if session storage cannot be read or written', async () => {
    messages = [message('a')];
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'a');
    expect(analysisIds()).toEqual(['a']);
    expect(processed.has('a')).toBe(true);
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it('checks only the chronological prefix through a tutor-selected focus', async () => {
    messages = [message('b', { created_at: '2026-10-14T12:01:00Z' }), message('a'),
      message('c', { created_at: '2026-10-14T12:02:00Z' })];
    await ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'b');
    expect(analysisIds()).toEqual(['a', 'b']);
  });

  it('rejects an unavailable focus without analyzing unrelated evidence', async () => {
    messages = [message('a')];
    await expect(ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'missing')).rejects.toThrow(/focus.*not found/i);
    expect(analysisIds()).toEqual([]);
  });

  it('keeps concurrent goal replay and live-message analysis in chronological order', async () => {
    messages = [message('x'), message('a', { created_at: '2026-10-14T12:01:00Z' })];
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    pauseAnalysis = async id => { if (id === 'x') await gate; };
    let progressState = 0;
    const committed: string[] = [];
    applyEvidence = id => {
      committed.push(id);
      if (id === 'a') progressState = progressState === 2 ? -1 : 1;
      if (id === 'b') progressState = 2;
    };
    const { result } = renderHook(() => useChecklist(ROOM, { enabled: true, studentId: LEARNER }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    let save: Promise<void>;
    act(() => { save = result.current.handleManualSubmit(['Verify the sender'], []); });
    await waitFor(() => expect(analysisIds()).toEqual(['x']));
    messages.push(message('b', { created_at: '2026-10-14T12:02:00Z' }));
    const live = ChecklistService.analyzeStudentMessages(ROOM, LEARNER, 'b');
    await waitFor(() => expect(analysisIds()).toEqual(['x', 'x']));
    expect(committed).toEqual([]);
    await act(async () => { release(); await Promise.all([save, live]); });
    expect(committed).toEqual(['x', 'a', 'b']);
    expect(progressState).toBe(2);
    expect(window.localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});

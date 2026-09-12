#!/usr/bin/env node
// Test responsible for the browser-local transfer assessment service after the server boundary was
// removed for the research build. It covers: checklist initialisation with eligible items, the
// provider-backed prepare step (frozen budget/thinking settings, structured decision, rejection of
// an invalid draft), local grading of a correct and a wrong answer including the single progress
// transition, delivery stamping the assessment onto the tutor message, and the public message
// projection that keeps private assessment fields out.

import { webcrypto } from 'node:crypto';
import { TextDecoder, TextEncoder } from 'node:util';

type Row = Record<string, unknown>;

const mockCalls: Array<{ table: string; op: string; payload?: unknown }> = [];
const mockSingle: Record<string, Row | null> = {};
const mockMaybeSingle: Record<string, Row | null> = {};
const mockMaybeSingleQueue: Record<string, Array<Row | null>> = {};
const mockList: Record<string, Row[]> = {};

function mockMakeChain(table: string): any {
  const builder: any = {
    insert(payload: unknown) {
      mockCalls.push({ table, op: 'insert', payload });
      return builder;
    },
    update(payload: unknown) {
      mockCalls.push({ table, op: 'update', payload });
      return builder;
    },
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => builder,
    single: async () => ({ data: mockSingle[table] ?? null, error: null }),
    maybeSingle: async () => {
      const queue = mockMaybeSingleQueue[table];
      if (queue && queue.length > 0) return { data: queue.shift() ?? null, error: null };
      return { data: mockMaybeSingle[table] ?? null, error: null };
    },
    then: (resolve: (value: unknown) => unknown) => resolve({ data: mockList[table] ?? [], error: null }),
  };
  return builder;
}

jest.mock('../supabase', () => ({
  supabase: { from: (table: string) => mockMakeChain(table) },
}));

import {
  PUBLIC_MESSAGE_DTO_KEYS,
  TransferAssessmentService,
  toPublicMessageDTO,
} from '../transferAssessmentService';

const CHECKLIST_ID = 'checklist-1';
const ITEM_ID = 'item-1';
const ANSWER_ID = 'answer-1';
const ASSESSMENT_ROW_ID = 'message-tutor-1';

const OPTIONS = [
  { id: 'A', text: 'A familiar account proves the link is safe' },
  { id: 'B', text: 'The account could have been compromised' },
  { id: 'C', text: 'Every prize message is necessarily a scam' },
  { id: 'D', text: 'Opening the link proves the sender identity' },
];

function decision(): any {
  return {
    reason: 'The learner transferred the concept and the message is unfamiliar.',
    decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: ITEM_ID },
    response: 'Which statement best describes the risk to this account?',
    assessment: {
      selection_type: 'single',
      stem: 'Which statement best describes the risk to this account?',
      rendered_text: 'Which statement best describes the risk to this account?',
      options: OPTIONS,
      correct_option_ids: ['B'],
      transfer_basis: {
        concept_rule: 'A familiar sender is not proof of safety.',
        source_context: 'The learner trusted a familiar sender.',
        changed_context: 'A bank alert asks for confirmation.',
        source_evidence_message_ids: ['focus-1'],
      },
    },
  };
}

function deliveredAssessmentRow(): Row {
  return {
    id: ASSESSMENT_ROW_ID,
    room_id: 'room-1',
    user_id: 'tutor-1',
    content: 'Which statement best describes the risk to this account?',
    user_role: 'tutor',
    parent_message_id: 'focus-1',
    response_mode: 'assessment',
    assessment_id: 'assessment-1',
    assessment_item_id: ITEM_ID,
    assessment_checklist_id: CHECKLIST_ID,
    assessment_options: OPTIONS,
    assessment_key: ['B'],
    assessment_selection_type: 'single',
    assessment_lifecycle: 'delivered',
    created_at: '2026-09-12T00:00:01.000Z',
  };
}

function arrangePrepare(): jest.Mock {
  mockMaybeSingle.session_checklists = {
    id: CHECKLIST_ID,
    room_id: 'room-1',
    student_id: 'student-1',
    progress_policy_version: 'transfer_v1',
  };
  mockMaybeSingle.messages = { id: 'focus-1', room_id: 'room-1', user_id: 'student-1', user_role: 'student', content: 'It looked fine to me.' };
  mockMaybeSingle.rooms = { id: 'room-1', active_response_mode: 'tutoring' };
  mockList.checklist_items = [
    { id: ITEM_ID, area_text: 'A familiar sender is not proof', priority: 'critical', status: 'partially_covered', understanding_level: 'basic' },
  ];
  return jest.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(decision()) } }] }),
  })) as unknown as jest.Mock;
}

function arrangeGrading(answerContent: string): void {
  mockMaybeSingleQueue.messages = [
    { id: ANSWER_ID, room_id: 'room-1', user_id: 'student-1', content: answerContent, assessment_result: null },
    deliveredAssessmentRow(),
  ];
  mockMaybeSingle.checklist_items = { id: ITEM_ID, status: 'partially_covered', understanding_level: 'basic', checklist_id: CHECKLIST_ID };
  mockMaybeSingle.session_checklists = { id: CHECKLIST_ID, room_id: 'room-1', student_id: 'student-1', progress_policy_version: 'transfer_v1' };
  mockList.checklist_items = [
    { id: ITEM_ID, area_text: 'A familiar sender is not proof', priority: 'critical', status: 'partially_covered', understanding_level: 'basic' },
  ];
}

function insertedInto(table: string): Row[] {
  return mockCalls
    .filter((call) => call.table === table && call.op === 'insert')
    .flatMap((call) => (Array.isArray(call.payload) ? (call.payload as Row[]) : [call.payload as Row]));
}

function updated(table: string): Row[] {
  return mockCalls
    .filter((call) => call.table === table && call.op === 'update')
    .map((call) => call.payload as Row);
}

function service(): TransferAssessmentService {
  return new TransferAssessmentService();
}

beforeEach(() => {
  mockCalls.length = 0;
  [mockSingle, mockMaybeSingle, mockMaybeSingleQueue, mockList].forEach((store) => {
    Object.keys(store).forEach((key) => delete (store as Record<string, unknown>)[key]);
  });
  (globalThis as any).TextEncoder = (globalThis as any).TextEncoder ?? TextEncoder;
  (globalThis as any).TextDecoder = (globalThis as any).TextDecoder ?? TextDecoder;
  if (!(globalThis as any).crypto?.subtle) (globalThis as any).crypto = webcrypto;
  localStorage.setItem('tutor_system_user', JSON.stringify({ id: 'tutor-1', current_role: 'tutor' }));
  process.env.REACT_APP_OAI_API_KEY = 'test-provider-key';
  process.env.REACT_APP_OAI_BASE_URL = 'https://provider.invalid/v1';
});

describe('initializeChecklist', () => {
  it('creates one active transfer_v1 checklist and items that are eligible for transfer', async () => {
    const result = await service().initializeChecklist({
      roomId: 'room-1',
      studentId: 'student-1',
      templateName: 'Transfer demo',
    });

    const checklists = insertedInto('session_checklists');
    expect(checklists).toHaveLength(1);
    expect(checklists[0]).toMatchObject({
      room_id: 'room-1',
      student_id: 'student-1',
      progress_policy_version: 'transfer_v1',
      is_active: true,
    });
    const items = insertedInto('checklist_items');
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.checklist_id).toBe(checklists[0].id);
      expect(item.status).toBe('partially_covered');
      expect(item.understanding_level).toBe('basic');
    }
    expect(result.checklist_id).toBe(checklists[0].id);
  });
});

describe('prepareTurn', () => {
  it('asks the provider with the frozen transfer settings and returns the reviewable decision', async () => {
    const fetchMock = arrangePrepare();
    (globalThis as any).fetch = fetchMock;

    const prepared = await service().prepareTurn({
      roomId: 'room-1',
      focusStudentMessageId: 'focus-1',
      checklistId: CHECKLIST_ID,
    });

    const request = JSON.parse((fetchMock as any).mock.calls[0][1].body);
    expect(request.max_tokens).toBe(1200);
    expect(request.enable_thinking).toBe(false);
    expect(request.temperature).toBe(0.3);
    expect(request.messages[0].role).toBe('system');
    expect(prepared.item_id).toBe(ITEM_ID);
    expect(prepared.student_id).toBe('student-1');
    expect((prepared.decision as any).decision.mode).toBe('assessment');
    expect(prepared.progress_snapshot_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects a provider draft that cites evidence outside the supplied context', async () => {
    arrangePrepare();
    const drifted = decision();
    drifted.assessment.transfer_basis.source_evidence_message_ids = ['not-a-known-message'];
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(drifted) } }] }),
    }));

    await expect(
      service().prepareTurn({ roomId: 'room-1', focusStudentMessageId: 'focus-1', checklistId: CHECKLIST_ID })
    ).rejects.toThrow('AI_OUTPUT_INVALID');
  });
});

describe('processMessage', () => {
  it('grades a correct answer, marks the item covered, and closes the checklist', async () => {
    arrangeGrading('B');
    const processed = await service().processMessage(ANSWER_ID);

    expect(processed.result).toBe('pass');
    expect(processed.selected_option_ids).toEqual(['B']);
    expect(processed.feedback_required).toBe(true);
    expect(processed.already_processed).toBe(false);
    expect(updated('checklist_items')).toEqual([{ status: 'covered', understanding_level: 'good' }]);
    expect(updated('session_checklists')[0]).toMatchObject({ completed_items: 1, completion_percentage: 100, is_active: false });
    expect(updated('messages')[0]).toMatchObject({ assessment_result: 'pass' });
  });

  it('grades a wrong answer as needs_review and keeps the checklist active', async () => {
    arrangeGrading('A');
    const processed = await service().processMessage(ANSWER_ID);

    expect(processed.result).toBe('needs_review');
    expect(updated('checklist_items')).toEqual([{ status: 'needs_review', understanding_level: 'basic' }]);
    expect(updated('session_checklists')[0]).toMatchObject({ completed_items: 0, completion_percentage: 0, is_active: true });
  });
});

describe('sendReviewed', () => {
  it('stamps the assessment onto the tutor message and returns the public message only', async () => {
    mockSingle.messages = {
      id: ASSESSMENT_ROW_ID,
      room_id: 'room-1',
      user_id: 'tutor-1',
      content: 'Which statement best describes the risk?',
      user_role: 'tutor',
      is_ai_generated: true,
      parent_message_id: 'focus-1',
      response_mode: 'assessment',
      created_at: '2026-09-12T00:00:01.000Z',
    };
    mockMaybeSingle.rooms = { id: 'room-1', active_response_mode: 'tutoring' };

    const sent = await service().sendReviewed({
      reviewedPayload: decision(),
      roomId: 'room-1',
      studentId: 'student-1',
      checklistId: CHECKLIST_ID,
      itemId: ITEM_ID,
      focusStudentMessageId: 'focus-1',
    });

    expect(insertedInto('messages')[0]).toMatchObject({
      room_id: 'room-1',
      user_role: 'tutor',
      response_mode: 'assessment',
      assessment_item_id: ITEM_ID,
      assessment_checklist_id: CHECKLIST_ID,
      assessment_key: ['B'],
      assessment_selection_type: 'single',
      assessment_lifecycle: 'delivered',
    });
    expect(sent.message.id).toBe(ASSESSMENT_ROW_ID);
    expect((sent.message as Row).assessment_key).toBeUndefined();
  });
});

describe('public message projection', () => {
  it('keeps only the allowlisted public keys and never the assessment key', () => {
    const projected = toPublicMessageDTO(deliveredAssessmentRow());
    expect(Object.keys(projected).sort()).toEqual([...PUBLIC_MESSAGE_DTO_KEYS].sort());
    expect(JSON.stringify(projected)).not.toContain('assessment_key');
    expect((projected as unknown as Row).assessment_key).toBeUndefined();
  });
});

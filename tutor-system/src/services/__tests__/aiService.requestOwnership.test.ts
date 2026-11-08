#!/usr/bin/env node
/** Tests aiService.ts and simplifiedAIContext.ts: one room snapshot owns suggestion inputs; history packaging preserves each branch's contract. */

import { generateTutorSuggestion, TutorSuggestionService } from '../aiService';
import { supabase } from '../supabase';
import { ChecklistService } from '../checklistService';
import * as packaging from '../ecologicalTutorCall';
import type { AIAssistantConfig, ConversationMessage } from '../../types';
import { transferAssessmentService } from '../transferAssessmentService';
import { deliveredAnswerRow, deliveredQuestionRow } from '../../test-support/transferRoomFixtures';

jest.mock('../supabase', () => ({ supabase: { from: jest.fn(), functions: { invoke: jest.fn() } } }));
jest.mock('../checklistService', () => ({ ChecklistService: { getChecklistByRoom: jest.fn() } }));
jest.mock('../transferAssessmentService', () => ({ transferAssessmentService: { readReview: jest.fn() } }));

const room = {
  id: 'room-request', ai_assistant_enabled: true, ai_assistant_model: 'qwen3.8-flash',
  ai_assistant_prompt: 'Room prompt snapshot', guard_mode: false,
  guard_mode_changed_at: '2026-11-01T00:00:00Z', practice_type: 'phishing',
  title: 'Scenario title snapshot', description: 'Scenario description snapshot',
  pre_populated_dialogue: [{ user_name: 'Opening learner', role: 'student', message: 'Opening discussion' }],
  created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z'
};
const config: AIAssistantConfig = {
  id: 'config-request', room_id: room.id, model_name: 'qwen3.8-flash',
  system_prompt: 'Packaging prompt', prompt_config: null, temperature: 0.3,
  max_tokens: 600, is_active: true, created_at: room.created_at, updated_at: room.updated_at
};
const decision = { reason: 'Fixture evidence', decision: { guard_mode: false, instruction: 'scaffolding' }, response: 'Fixture response' };
const from = supabase.from as jest.Mock;
const invoke = supabase.functions.invoke as jest.Mock;

function configureQueries(roomData: object | null = room, roomError: object | null = null, messageRows: object[] = [
  { id: 'message-1', content: 'Latest learner turn', user_role: 'student', user_id: 'learner-1', created_at: room.updated_at }
]) {
  const projections: Array<{ table: string; columns: string }> = [];
  const messagePages = [
    messageRows,
    []
  ];
  from.mockImplementation((table: string) => {
    const query: any = {
      select: jest.fn((columns: string) => { projections.push({ table, columns }); return query; }),
      eq: jest.fn(() => query), order: jest.fn(() => query), or: jest.fn(() => query),
      single: jest.fn().mockResolvedValue(table === 'rooms'
        ? { data: roomData, error: roomError }
        : { data: { prompt_config: null, temperature: 0.6, max_tokens: 123 }, error: null }),
      range: jest.fn().mockImplementation(() => Promise.resolve({ data: messagePages.shift() ?? [], error: null })),
      limit: jest.fn().mockResolvedValue({ data: [{ id: 'message-1' }], error: null })
    };
    return query;
  });
  return projections;
}

beforeEach(() => {
  jest.clearAllMocks();
  (ChecklistService.getChecklistByRoom as jest.Mock).mockResolvedValue(null);
  invoke.mockResolvedValue({ data: { content: JSON.stringify(decision) }, error: null });
});

afterEach(() => jest.restoreAllMocks());

describe('suggestion room ownership', () => {
  it('uses one projected room acquisition for config, scenario, history and prior mode', async () => {
    const projections = configureQueries();
    const result = await generateTutorSuggestion(room.id, 'tutor-1');

    expect(result.success).toBe(true);
    const roomQueries = projections.filter(query => query.table === 'rooms');
    expect(roomQueries).toHaveLength(1);
    expect(roomQueries[0].columns.split(', ')).toEqual([
      'id', 'ai_assistant_enabled', 'ai_assistant_model', 'ai_assistant_prompt', 'guard_mode',
      'guard_mode_changed_at', 'practice_type', 'title', 'description', 'pre_populated_dialogue', 'created_at', 'updated_at'
    ]);
    expect(projections.filter(query => query.table === 'ai_assistant_configs')).toHaveLength(1);
    const request = invoke.mock.calls[0][1].body;
    expect(request.messages[0].content).toContain(room.ai_assistant_prompt);
    const payload = JSON.parse(request.messages[1].content.split('\n').pop());
    expect(payload).toMatchObject({
      scenario_context: `${room.title} — ${room.description}`,
      prior_guard_mode: false,
      student_message: 'Student: Latest learner turn'
    });
    expect(payload.conversation_history).toContain('Opening discussion');
    expect(payload.conversation_history).toContain('Latest learner turn');
    expect(result.appliedConfig).toMatchObject({ model_name: room.ai_assistant_model, system_prompt: room.ai_assistant_prompt });
    expect(result.contextMessages).toEqual(['message-1']);
  });

  it.each([
    ['disabled', { ...room, ai_assistant_enabled: false }, null],
    ['missing', null, null],
    ['failed read', null, { message: 'Room read unavailable' }]
  ])('stops a %s room before configuration, history or provider acquisition', async (_name, data, error) => {
    const projections = configureQueries(data, error);
    const result = await generateTutorSuggestion(room.id, 'tutor-1');
    expect(result).toMatchObject({ success: false, error: 'AI assistant is not enabled for this room', contextMessages: [] });
    expect(projections.map(query => query.table)).toEqual(['rooms']);
    expect(invoke).not.toHaveBeenCalled();
    expect(ChecklistService.getChecklistByRoom).not.toHaveBeenCalled();
  });

  it('keeps cyberbullying on its server-owned early-return path', async () => {
    const projections = configureQueries({ ...room, practice_type: 'cyberbullying' });
    const draft = {
      room_id: room.id, parent_message_id: 'student-message', raw_character: 'same_age_peer',
      raw_response: 'Draft fixture', raw_guard_mode: false, reason: 'Fixture reason',
      context_messages: ['student-message'], generation_provenance: { source: 'fixture' }
    };
    invoke.mockResolvedValue({ data: { data: draft }, error: null });
    const result = await generateTutorSuggestion(room.id, 'tutor-1', undefined, { parentMessageId: 'student-message' });
    expect(result).toMatchObject({ success: true, cyberbullyingDraft: draft });
    expect(projections.map(query => query.table)).toEqual(['rooms']);
    expect(ChecklistService.getChecklistByRoom).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('ai-api', {
      body: { operation: 'cyberbullying_suggest', room_id: room.id, parent_message_id: 'student-message', character: null },
      headers: { 'x-application-user-id': 'tutor-1' }
    });
  });

  it('still blocks provider generation on focused learner assessment readiness with the shared snapshot', async () => {
    const projections = configureQueries(room, null, [deliveredQuestionRow, deliveredAnswerRow]);
    (transferAssessmentService.readReview as jest.Mock).mockResolvedValue({ history_readiness: {
      ready: false, result_message_ids: [], handled_answer_message_ids: [],
      pending_answer_message_ids: [deliveredAnswerRow.id], unavailable_assessment_ids: []
    } });
    const result = await generateTutorSuggestion(room.id, 'tutor-1', undefined, {
      focusStudentId: deliveredAnswerRow.user_id
    });
    expect(result).toMatchObject({ success: false, error: 'ASSESSMENT_RESULT_UNAVAILABLE: Assessment processing is incomplete.' });
    expect(transferAssessmentService.readReview).toHaveBeenCalledWith(room.id, deliveredAnswerRow.assessment_id);
    expect(projections.filter(query => query.table === 'rooms')).toHaveLength(1);
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('suggestion history packaging', () => {
  const mixedHistory: ConversationMessage[] = [
    { role: 'system', content: 'Scenario from history', timestamp: 1 },
    { role: 'user', content: 'First learner entry', timestamp: 2 },
    { role: 'assistant', content: 'Tutor history entry', timestamp: 3 },
    { role: 'user', content: 'Last learner entry', timestamp: 4 }
  ];

  it.each(['phase0', 'ecological'] as const)('preserves full history and branch format for %s', async version => {
    const history = mixedHistory.map(message => Object.freeze({ ...message }));
    Object.freeze(history);
    const ecologicalSerializer = jest.spyOn(packaging, 'conversationMessagesToHistoryText');
    const phase0Builder = jest.spyOn(packaging, 'buildPhase0ChatCompletionMessages');
    const ecologicalBuilder = jest.spyOn(packaging, 'buildEcologicalChatCompletionMessages');
    const result = await TutorSuggestionService.generateSuggestion(history, {
      ...config, prompt_config: { prompt_comparison: { version } } as AIAssistantConfig['prompt_config']
    }, { focusStudentMessage: 'Explicit focus', priorMode: true });

    expect(result.success).toBe(true);
    const request = invoke.mock.calls[0][1].body;
    expect(request.messages.map((message: {role: string}) => message.role)).toEqual(['system', 'user']);
    expect(history).toEqual(mixedHistory);
    if (version === 'phase0') {
      expect(phase0Builder).toHaveBeenCalledTimes(1);
      expect(ecologicalBuilder).not.toHaveBeenCalled();
      expect(ecologicalSerializer).not.toHaveBeenCalled();
      mixedHistory.forEach(message => expect(request.messages[1].content).toContain(`${message.role}: ${message.content}`));
    } else {
      expect(phase0Builder).not.toHaveBeenCalled();
      expect(ecologicalBuilder).toHaveBeenCalledTimes(1);
      expect(ecologicalSerializer).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(request.messages[1].content.split('\n').pop());
      expect(payload).toMatchObject({ scenario_context: 'Scenario from history', student_message: 'Explicit focus', prior_guard_mode: true });
      expect(payload.conversation_history).toBe(packaging.conversationMessagesToHistoryText(mixedHistory));
      expect(payload.conversation_history).toContain('First learner entry');
      expect(payload.conversation_history).toContain('Tutor history entry');
      expect(payload.conversation_history).toContain('Last learner entry');
    }
  });

  it.each([
    ['inferred', mixedHistory, undefined, 'Last learner entry'],
    ['whitespace focus', mixedHistory, '  ', 'Last learner entry'],
    ['empty', [], undefined, 'What should I look for in this post?']
  ])('packages %s student focus without changing history', async (_name, history, focusStudentMessage, expectedFocus) => {
    await TutorSuggestionService.generateSuggestion(history, config, { focusStudentMessage });
    const payload = JSON.parse(invoke.mock.calls[0][1].body.messages[1].content.split('\n').pop());
    expect(payload.student_message).toBe(expectedFocus);
    expect(payload.conversation_history).toBe(history.length ? packaging.conversationMessagesToHistoryText(history) : '(no prior turns)');
  });

  it('packages an empty phase0 history with scenario only', async () => {
    await TutorSuggestionService.generateSuggestion([], {
      ...config, prompt_config: { prompt_comparison: { version: 'phase0' } } as AIAssistantConfig['prompt_config']
    });
    expect(invoke.mock.calls[0][1].body.messages[1].content).toContain('Recent conversation:\nScenario context: Phishing training room\n\n');
  });
});

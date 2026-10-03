#!/usr/bin/env node
/** File: src/__tests__/ai_suggestion_tracking.bdd.test.tsx; Purpose: bind AI suggestion tracking scenarios to tutor room actions, persisted feedback calls, and chat exports. */

import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { RoomProvider } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getRoomFeedbackSummary } from '../services/supabase';
import { buildAIContextFromExistingData } from '../services/simplifiedAIContext';
import type { Room, User } from '../types';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../services/supabase', () => ({
  supabase: { from: jest.fn(), channel: jest.fn(), rpc: jest.fn(), functions: { invoke: jest.fn() } },
  validateRoomPassword: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn().mockResolvedValue({ like_count: 0, dislike_count: 0, overall_average_rating: 0, total_feedback_count: 0 }),
  getUserMessageFeedback: jest.fn().mockResolvedValue(null),
  getRoomFeedbackSummary: jest.fn().mockResolvedValue(null),
  clearChatHistory: jest.fn(),
}));
jest.mock('../services/checklistService', () => ({
  ChecklistService: { getActiveTransferChecklistForRoom: jest.fn().mockResolvedValue(null), getChecklistByRoom: jest.fn().mockResolvedValue(null), getChecklistForStudent: jest.fn().mockResolvedValue(null) },
}));
jest.mock('../services/simplifiedAIContext', () => ({ buildAIContextFromExistingData: jest.fn() }));
jest.mock('../components/RoomPost', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/PostComment', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ChecklistPanel', () => ({ __esModule: true, default: () => null }));

const feature = loadFeature('./features/ai_suggestion_tracking.feature');
const ROOM_ID = 'tracking-bdd-room';
const TUTOR_ID = 'tracking-bdd-tutor';
const STUDENT_ID = 'tracking-bdd-student';
const STARTED_AT = '2026-01-01T00:00:00.000Z';
const originalEnvironment = process.env.REACT_APP_ENVIRONMENT;

const tutor: User = { id: TUTOR_ID, display_name: 'Tutor', current_role: 'tutor', email: 'tutor@example.test', status: 'active', created_at: STARTED_AT, updated_at: STARTED_AT } as User;
const student: User = { id: STUDENT_ID, display_name: 'Student', current_role: 'student', email: 'student@example.test', status: 'active', created_at: STARTED_AT, updated_at: STARTED_AT } as User;
const makeMessage = (id: string, content: string, role: 'student' | 'tutor', createdAt = STARTED_AT) => ({
  id, room_id: ROOM_ID, user_id: role === 'student' ? STUDENT_ID : TUTOR_ID, content, user_role: role,
  ai_model_used: null, ai_response_time_ms: null, parent_message_id: null, created_at: createdAt,
});

defineFeature(feature, (test) => {
  let roomRecord: Room;
  let messages: ReturnType<typeof makeMessage>[];
  let aiConfig: any;
  let feedbackRows: any[];
  let reviewedRows: any[];
  let participants: User[];
  let view: ReturnType<typeof render> | null;
  let blobParts: any[][];
  let suggestionText: string;
  let ignoredSuggestionText: string;
  let responseTimeClock: jest.SpyInstance<number, []> | null;

  const configureDatabase = () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      let selected = '';
      let filters: Record<string, unknown> = {};
      let insertValue: any;
      let updateValue: any;
      let descending = false;
      let limit: number | null = null;
      const query: any = {};
      const result = () => {
        if (table === 'rooms' && updateValue) {
          roomRecord = { ...roomRecord, ...updateValue };
          return { data: { ...roomRecord }, error: null };
        }
        if (table === 'rooms') return { data: { ...roomRecord }, error: null };
        if (table === 'ai_assistant_configs') {
          if (!aiConfig || (filters.room_id && filters.room_id !== ROOM_ID)) return { data: null, error: { code: 'PGRST116' } };
          return { data: selected === 'id' ? { id: aiConfig.id } : { ...aiConfig }, error: null };
        }
        if (table === 'messages' && insertValue) {
          const row = { ...insertValue, id: `tutor-message-${messages.length}`, created_at: new Date().toISOString() };
          messages = [...messages, row];
          return { data: row, error: null };
        }
        if (table === 'ai_suggestion_feedback') {
          if (insertValue) {
            feedbackRows.push({ id: `feedback-${feedbackRows.length + 1}`, created_at: new Date().toISOString(), ...insertValue });
            return { data: null, error: null };
          }
          return { data: feedbackRows.filter((row) => row.room_id === filters.room_id), error: null };
        }
        if (table === 'messages') {
          const rows = selected === 'id' ? messages.map((message) => ({ id: message.id })) : [...messages];
          const ordered = descending ? rows.reverse() : rows;
          return { data: limit === null ? ordered : ordered.slice(0, limit), error: null };
        }
        return { data: null, error: null };
      };
      query.select = jest.fn((columns = '*') => { selected = columns; return query; });
      query.eq = jest.fn((key: string, value: unknown) => { filters[key] = value; return query; });
      query.order = jest.fn((_column: string, options?: { ascending?: boolean }) => { descending = options?.ascending === false; return query; });
      query.limit = jest.fn((value: number) => { limit = value; return query; });
      query.in = jest.fn(async () => ({ data: [...participants], error: null }));
      query.single = jest.fn(async () => result());
      query.insert = jest.fn((value: any) => { insertValue = value; return query; });
      query.update = jest.fn((value: any) => { updateValue = value; return query; });
      query.then = (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
      return query;
    });
    (supabase.channel as jest.Mock).mockReturnValue({ on: jest.fn().mockReturnThis(), subscribe: jest.fn(), unsubscribe: jest.fn() });
    (supabase.rpc as jest.Mock).mockImplementation(async (name: string, args: any) => {
      if (name !== 'send_reviewed_tutor_response') return { data: null, error: null };
      reviewedRows.push(args);
      const message = makeMessage(`reviewed-${reviewedRows.length}`, args.p_content, 'tutor', new Date().toISOString());
      messages = [...messages, message];
      feedbackRows.push({
        id: `feedback-${feedbackRows.length + 1}`,
        room_id: args.p_room_id,
        tutor_id: args.p_tutor_id,
        parent_message_id: args.p_parent_message_id,
        ai_suggestion: args.p_ai_suggestion,
        tutor_action: args.p_tutor_action,
        tutor_final_response: args.p_content,
        tutor_message_id: message.id,
        response_time_ms: args.p_response_time_ms,
        context_messages: args.p_context_messages,
        raw_mode: args.p_raw_mode,
        raw_instruction: args.p_raw_instruction,
        mode_reason: args.p_mode_reason,
        final_mode: args.p_final_mode,
        created_at: message.created_at,
      });
      return { data: { message, room: { ...roomRecord } }, error: null };
    });
  };

  const renderRoom = async () => {
    (useAuth as jest.Mock).mockReturnValue({ user: tutor, loading: false });
    view = render(<MemoryRouter initialEntries={[`/room/${ROOM_ID}`]}><RoomProvider><Routes><Route path="/room/:roomId" element={<RoomPagePost />} /></Routes></RoomProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByTitle('AI Assistant Settings')).toBeInTheDocument());
  };

  const generateSuggestion = async () => {
    if (!view) await renderRoom();
    if (screen.queryByRole('button', { name: 'Reject' })) suggestionText = `${suggestionText} (next suggestion)`;
    const generatedText = suggestionText;
    fireEvent.click(screen.getByTitle(/Generate AI Response/));
    await screen.findByText(generatedText);
    return generatedText;
  };

  const performAction = async (action: 'accepted' | 'rejected' | 'modified', finalResponse?: string) => {
    await generateSuggestion();
    if (action === 'rejected') {
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
      await waitFor(() => expect(screen.queryByText(suggestionText)).not.toBeInTheDocument());
      return;
    }
    fireEvent.click(screen.getByRole('button', { name: 'Copy to Input' }));
    if (action === 'modified') fireEvent.change(screen.getByPlaceholderText('Write a comment...'), { target: { value: finalResponse } });
    fireEvent.click(screen.getByTitle('Send comment'));
    await waitFor(() => expect(reviewedRows.length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument());
  };

  const exportChat = async (format: 'json' | 'txt') => {
    blobParts = [];
    await openDownload();
    await selectDownload(format);
    return blobParts[0][0];
  };

  const openDownload = async () => {
    fireEvent.click(screen.getByTitle('Download Chat History'));
    await screen.findByRole('heading', { name: 'Download Room Data' });
  };

  const selectDownload = async (format: 'json' | 'txt') => {
    blobParts = [];
    fireEvent.click(screen.getByRole('button', { name: format === 'json' ? 'Complete Data (JSON)' : 'Chat History (TXT)' }));
    await waitFor(() => expect(blobParts).toHaveLength(1));
  };

  const createUsage = async (actions: Array<{ action: 'accepted' | 'rejected' | 'modified' | 'ignored'; count: number }>) => {
    if (!view) await renderRoom();
    for (const { action, count } of actions) {
      for (let index = 0; index < count; index += 1) {
        if (action === 'accepted' || action === 'modified' || action === 'rejected') {
          const priorReviewCount = reviewedRows.length;
          const priorFeedbackCount = feedbackRows.length;
          await performAction(action, `Tutor revision ${index + 1}`);
          if (action === 'rejected') await waitFor(() => expect(feedbackRows).toHaveLength(priorFeedbackCount + 1));
          else await waitFor(() => expect(reviewedRows).toHaveLength(priorReviewCount + 1));
        } else {
          const priorFeedbackCount = feedbackRows.length;
          await generateSuggestion();
          await generateSuggestion();
          await waitFor(() => expect(feedbackRows).toHaveLength(priorFeedbackCount + 1));
        }
      }
    }
  };

  const bindBackground = (given: any, and: any) => {
    given('the user is logged in as a tutor', () => { (useAuth as jest.Mock).mockReturnValue({ user: tutor, loading: false }); });
    and('the tutor has a room with AI assistant enabled', () => { roomRecord.ai_assistant_enabled = true; });
    and('a student is participating in the room', () => { participants = [tutor, student]; });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    roomRecord = { id: ROOM_ID, tutor_id: TUTOR_ID, title: 'AI Tracking Room', description: 'Tracking integration', image_url: null, is_active: true, ai_assistant_enabled: true, ai_assistant_model: 'qwen3.5-flash', ai_assistant_prompt: 'Help the tutor teach phishing.', created_at: STARTED_AT, updated_at: STARTED_AT } as Room;
    messages = [makeMessage('student-message-1', 'How do I identify phishing emails?', 'student')];
    aiConfig = { id: 'tracking-config', room_id: ROOM_ID, model_name: 'qwen3.5-flash', system_prompt: 'Help the tutor teach phishing.', prompt_config: null, temperature: 0.7, max_tokens: 120, is_active: true, created_at: STARTED_AT, updated_at: STARTED_AT };
    feedbackRows = [];
    reviewedRows = [];
    participants = [tutor, student];
    blobParts = [];
    suggestionText = 'Look for red flags such as a mismatched sender or a link asking for credentials.';
    ignoredSuggestionText = '';
    responseTimeClock = null;
    view = null;
    process.env.REACT_APP_ENVIRONMENT = 'production';
    configureDatabase();
    (useAuth as jest.Mock).mockReturnValue({ user: tutor, loading: false });
    (getRoomFeedbackSummary as jest.Mock).mockResolvedValue(null);
    (buildAIContextFromExistingData as jest.Mock).mockImplementation(async () => messages.map((message) => ({ role: message.user_role === 'student' ? 'user' : 'assistant', content: message.content })));
    (supabase.functions.invoke as jest.Mock).mockImplementation(async () => ({
      data: {
        content: JSON.stringify({
          reason: 'The learner asks for phishing advice.',
          decision: { mode: 'tutoring', instruction: 'explanation' },
          response: suggestionText,
        }),
        model: 'qwen3.5-flash',
        finish_reason: 'stop',
      },
      error: null,
    }));
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    Object.defineProperty(global, 'Blob', { configurable: true, value: jest.fn((parts: any[]) => { blobParts.push(parts); return { parts }; }) });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:tracking-bdd') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: jest.fn() });
  });

  afterEach(() => {
    view?.unmount();
    view = null;
    if (originalEnvironment === undefined) delete process.env.REACT_APP_ENVIRONMENT;
    else process.env.REACT_APP_ENVIRONMENT = originalEnvironment;
    jest.restoreAllMocks();
  });

  test('Track accepted suggestions', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given(/^the student sends "How do I identify phishing emails\?"$/, () => { messages = [makeMessage('student-message-1', 'How do I identify phishing emails?', 'student')]; });
    and(/^the AI generates suggestion "Look for red flags such as a mismatched sender or a link asking for credentials\."$/, async () => { ignoredSuggestionText = await generateSuggestion(); });
    when('the tutor copies the suggestion', () => fireEvent.click(screen.getByRole('button', { name: 'Copy to Input' })));
    and('sends it without modification', async () => { fireEvent.click(screen.getByTitle('Send comment')); await waitFor(() => expect(reviewedRows).toHaveLength(1)); });
    then('the system should record:', (table: Array<{ Field: string; Value: string }>) => {
      const row = reviewedRows[0];
      const expected = Object.fromEntries(table.map(({ Field, Value }) => [Field, Value]));
      expect(row).toMatchObject({ p_tutor_action: expected.tutor_action, p_parent_message_id: expected.parent_message_id, p_ai_suggestion: expected.ai_suggestion, p_content: expected.tutor_final_response });
      expect(typeof row.p_response_time_ms).toBe('number');
      expect(row.p_response_time_ms).toBeGreaterThanOrEqual(0);
    });
  });

  test('Track rejected suggestions', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given(/^the student sends "Is this email legitimate\?"$/, () => { messages = [makeMessage('student-message-1', 'Is this email legitimate?', 'student')]; });
    and('the AI generates a suggestion', async () => { await generateSuggestion(); });
    when('the tutor clicks "Reject"', () => fireEvent.click(screen.getByRole('button', { name: 'Reject' })));
    then('the system should record:', (table: Array<{ Field: string; Value: string }>) => {
      const expected = Object.fromEntries(table.map(({ Field, Value }) => [Field, Value]));
      expect(feedbackRows).toContainEqual(expect.objectContaining({ tutor_action: expected.tutor_action, parent_message_id: 'student-message-1', ai_suggestion: suggestionText, tutor_final_response: null, response_time_ms: expect.any(Number) }));
    });
  });

  test('Track modified suggestions', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given(/^the student sends "What should I do if I clicked a phishing link\?"$/, () => { messages = [makeMessage('student-message-1', 'What should I do if I clicked a phishing link?', 'student')]; });
    and(/^the AI generates suggestion "Immediately change your passwords\.\.\."$/, async () => { suggestionText = 'Immediately change your passwords...'; await generateSuggestion(); });
    when('the tutor copies the suggestion', () => fireEvent.click(screen.getByRole('button', { name: 'Copy to Input' })));
    and(/^modifies it to "First, don't panic\. Then change your passwords\.\.\."$/, () => fireEvent.change(screen.getByPlaceholderText('Write a comment...'), { target: { value: "First, don't panic. Then change your passwords..." } }));
    and('sends the modified message', async () => { fireEvent.click(screen.getByTitle('Send comment')); await waitFor(() => expect(reviewedRows).toHaveLength(1)); });
    then('the system should record:', (table: Array<{ Field: string; Value: string }>) => {
      const expected = Object.fromEntries(table.map(({ Field, Value }) => [Field, Value]));
      expect(reviewedRows[0]).toMatchObject({ p_tutor_action: expected.tutor_action, p_ai_suggestion: 'Immediately change your passwords...', p_content: "First, don't panic. Then change your passwords...", p_response_time_ms: expect.any(Number) });
    });
  });

  test('Track ignored suggestions', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given(/^the student sends "Can you help me\?"$/, () => { messages = [makeMessage('student-message-1', 'Can you help me?', 'student')]; });
    and('the AI generates a suggestion', async () => { ignoredSuggestionText = await generateSuggestion(); });
    and('the tutor views the suggestion', () => expect(screen.getByText(suggestionText)).toBeInTheDocument());
    when('the tutor generates another AI suggestion without using the first', async () => { await generateSuggestion(); });
    then('the system should mark the first suggestion as "ignored"', () => expect(feedbackRows).toContainEqual(expect.objectContaining({ tutor_action: 'ignored', ai_suggestion: ignoredSuggestionText, response_time_ms: expect.any(Number) })));
  });

  test('Export tracking data as JSON', ({ given, when, and, then }) => {
    bindBackground(given, and);
    given('the tutor has used AI suggestions multiple times', async () => { await createUsage([{ action: 'accepted', count: 2 }, { action: 'rejected', count: 1 }]); });
    when('the tutor downloads chat history', async () => { await openDownload(); });
    and('selects "Download as JSON"', async () => { await selectDownload('json'); });
    then('the export should include:', () => {
      const exported = JSON.parse(String(blobParts[0][0]));
      expect(exported.messages).toHaveLength(messages.length);
      expect(exported.ai_interactions.length).toBeGreaterThan(0);
      expect(exported.export_metadata.interaction_summary).toBeUndefined();
    });
  });

  test('Export tracking data as TXT', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the tutor has used AI suggestions', async () => { await createUsage([{ action: 'accepted', count: 5 }, { action: 'modified', count: 3 }, { action: 'rejected', count: 2 }, { action: 'ignored', count: 1 }]); });
    when('the tutor downloads chat history', async () => { await openDownload(); });
    and('selects "Download as TXT"', async () => { await selectDownload('txt'); });
    then('the export should include a section:', () => {
      expect(String(blobParts[0][0])).toContain('AI Assistant Summary:');
      expect(String(blobParts[0][0])).toContain('Total AI suggestions: 11');
      expect(String(blobParts[0][0])).toContain('Accepted: 5 (45.45%)');
      expect(String(blobParts[0][0])).toContain('Modified: 3 (27.27%)');
      expect(String(blobParts[0][0])).toContain('Rejected: 2 (18.18%)');
      expect(String(blobParts[0][0])).toContain('Ignored: 1 (9.09%)');
    });
  });

  test('Track response time metrics', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given(/^the AI generates a suggestion at timestamp T1$/, async () => {
      await renderRoom();
      responseTimeClock = jest.spyOn(Date, 'now').mockReturnValue(1000);
      await generateSuggestion();
    });
    when(/^the tutor takes action at timestamp T2$/, async () => {
      responseTimeClock?.mockReturnValue(3500);
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
      await waitFor(() => expect(feedbackRows).toHaveLength(1));
    });
    then('the system should calculate response_time_ms as (T2 - T1)', () => expect(feedbackRows[0].response_time_ms).toBe(2500));
    and('store this metric with the interaction record', () => expect(feedbackRows[0].response_time_ms).toBeGreaterThanOrEqual(0));
  });

  test('Persistent tracking across sessions', ({ given, when, and, then }) => {
    bindBackground(given, and);
    given('the tutor has AI interactions in a previous session', async () => {
      await createUsage([{ action: 'accepted', count: 1 }, { action: 'rejected', count: 1 }]);
      feedbackRows.push({ ...feedbackRows[0], id: 'other-room-feedback', room_id: 'other-room', tutor_action: 'modified' });
    });
    when('the tutor rejoins the room', async () => { view?.unmount(); view = null; await renderRoom(); });
    and('downloads the chat history', async () => { await openDownload(); await selectDownload('json'); });
    then('all previous AI interactions should be included', () => expect(JSON.parse(String(blobParts[0][0])).ai_interactions).toHaveLength(2));
    and('the data should be complete and accurate', () => expect(JSON.parse(String(blobParts[0][0])).ai_interactions.map((row: any) => row.tutor_action)).toEqual(expect.arrayContaining(['accepted', 'rejected'])));
  });

  test('Privacy-conscious tracking', ({ given, then, and }) => {
    bindBackground(given, and);
    given('AI tracking is enabled', async () => { await performAction('rejected'); });
    then('the system should only track:', (table: Array<{ Tracked: string; 'Not Tracked': string }>) => {
      expect(table).toHaveLength(4);
      const row = feedbackRows[0];
      expect(row).toMatchObject({ tutor_action: 'rejected', ai_suggestion: suggestionText, parent_message_id: 'student-message-1', response_time_ms: expect.any(Number) });
      expect(Object.keys(row)).not.toEqual(expect.arrayContaining(['tutor_email', 'student_email', 'ip_address', 'browser', 'user_agent']));
    });
  });

  test('Real-time tracking updates', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the tutor is using AI suggestions', async () => { await renderRoom(); });
    when('the tutor accepts a suggestion', async () => { await performAction('accepted'); });
    then('the tracking database should be updated immediately', () => expect(reviewedRows).toHaveLength(1));
    and('the interaction should be available in exports without page refresh', async () => {
      const exported = JSON.parse(String(await exportChat('json')));
      expect(exported.ai_interactions).toHaveLength(1);
      expect(exported.ai_interactions[0].tutor_action).toBe('accepted');
    });
  });

  test('Contextual message tracking', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given('the AI generates suggestions based on previous messages', () => {
      messages = [makeMessage('student-message-1', 'Check this message carefully.', 'student'), makeMessage('student-message-2', 'The sender is unknown.', 'student', '2026-01-01T00:01:00.000Z')];
    });
    when('tracking an AI interaction', async () => { await performAction('rejected'); });
    then('the system should store the context messages', () => expect(feedbackRows[0].context_messages).toEqual(['student-message-1', 'student-message-2']));
    and('preserve the conversation flow for analysis', () => expect(feedbackRows[0].parent_message_id).toBe('student-message-2'));
  });
});

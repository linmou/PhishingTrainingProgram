#!/usr/bin/env node
/** File: src/__tests__/ai_assistant.bdd.test.tsx; Purpose: bind tutor AI assistant feature workflows to RoomPagePost, RoomProvider, persistence, export, and the Qwen boundary. */

import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RoomPagePost from '../pages/RoomPagePost';
import { RoomProvider } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { buildAIContextFromExistingData } from '../services/simplifiedAIContext';
import type { Room, User } from '../types';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    rpc: jest.fn(),
  },
  validateRoomPassword: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn().mockResolvedValue({
    like_count: 0,
    dislike_count: 0,
    overall_average_rating: 0,
    total_feedback_count: 0,
  }),
  getUserMessageFeedback: jest.fn().mockResolvedValue(null),
  getRoomFeedbackSummary: jest.fn().mockResolvedValue(null),
  clearChatHistory: jest.fn(),
}));

jest.mock('../services/checklistService', () => ({
  ChecklistService: {
    getActiveTransferChecklistForRoom: jest.fn().mockResolvedValue(null),
    getChecklistByRoom: jest.fn().mockResolvedValue(null),
    getChecklistForStudent: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../services/simplifiedAIContext', () => ({
  buildAIContextFromExistingData: jest.fn().mockResolvedValue([
    { role: 'user', content: 'Student: What is phishing?' },
  ]),
}));

jest.mock('../components/RoomPost', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/PostComment', () => ({ __esModule: true, default: () => null }));
jest.mock('../components/ChecklistPanel', () => ({ __esModule: true, default: () => null }));

const feature = loadFeature('./features/ai_assistant.feature', { tagFilter: 'not @non_feasible' });
const ROOM_ID = 'ai-bdd-room';
const TUTOR_ID = 'ai-bdd-tutor';
const STUDENT_ID = 'ai-bdd-student';
const STARTED_AT = '2026-01-01T00:00:00.000Z';
const ORIGINAL_API_KEY = process.env.REACT_APP_OAI_API_KEY;
const ORIGINAL_ENVIRONMENT = process.env.REACT_APP_ENVIRONMENT;

const tutor: User = {
  id: TUTOR_ID,
  display_name: 'Tutor',
  current_role: 'tutor',
  email: 'tutor@example.test',
  status: 'active',
  created_at: STARTED_AT,
  updated_at: STARTED_AT,
} as User;

const student: User = {
  id: STUDENT_ID,
  display_name: 'Student',
  current_role: 'student',
  email: 'student@example.test',
  status: 'active',
  created_at: STARTED_AT,
  updated_at: STARTED_AT,
} as User;

const buildRoom = (overrides: Partial<Room> = {}): Room => ({
  id: ROOM_ID,
  tutor_id: TUTOR_ID,
  title: 'AI-Enhanced Learning',
  description: 'Phishing education room',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: true,
  ai_assistant_model: 'qwen3.5-flash',
  ai_assistant_prompt: 'Teach phishing education clearly.',
  active_response_mode: 'tutoring',
  created_at: STARTED_AT,
  updated_at: STARTED_AT,
  ...overrides,
} as Room);

const makeMessage = (id: string, content: string, role: 'student' | 'tutor', createdAt: string) => ({
  id,
  room_id: ROOM_ID,
  user_id: role === 'student' ? STUDENT_ID : TUTOR_ID,
  content,
  user_role: role,
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: null,
  created_at: createdAt,
});

defineFeature(feature, (test) => {
  let mockUser: User;
  let roomRecord: Room;
  let messages: ReturnType<typeof makeMessage>[];
  let participants: User[];
  let aiConfig: any;
  let feedbackRows: any[];
  let reviewedRows: any[];
  let configLogRows: any[];
  let roomWrites: any[];
  let view: ReturnType<typeof render> | null;
  let blobParts: any[][];
  let nextSuggestion: string;

  const configureDatabase = () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      let selected = '';
      let filters: Record<string, unknown> = {};
      let insertValue: any;
      let updateValue: any;
      let descending = false;
      let resultLimit: number | null = null;
      const query: any = {};

      const result = () => {
        if (table === 'rooms' && updateValue) {
          roomRecord = { ...roomRecord, ...updateValue };
          return { data: { ...roomRecord }, error: null };
        }
        if (table === 'ai_assistant_configs' && insertValue) {
          aiConfig = { ...insertValue, id: 'ai-bdd-config' };
          return { data: null, error: null };
        }
        if (table === 'ai_assistant_configs' && updateValue) {
          aiConfig = { ...aiConfig, ...updateValue };
          return { data: null, error: null };
        }
        if (table === 'rooms') return { data: { ...roomRecord }, error: null };
        if (table === 'ai_assistant_configs') {
          const configMatches = aiConfig &&
            (!filters.room_id || filters.room_id === ROOM_ID) &&
            (!filters.is_active || aiConfig.is_active === true) &&
            (!filters.id || filters.id === aiConfig.id);
          if (!configMatches) return { data: null, error: { code: 'PGRST116', message: 'No rows found' } };
          if (selected === 'id') return { data: { id: aiConfig.id }, error: null };
          return { data: { ...aiConfig }, error: null };
        }
        if (table === 'messages' && insertValue) {
          const row = { ...insertValue, id: `tutor-message-${messages.length}`, created_at: new Date().toISOString() };
          messages = [...messages, row];
          return { data: row, error: null };
        }
        if (table === 'ai_suggestion_feedback') feedbackRows.push(insertValue);
        if (table === 'ai_assistant_config_logs') configLogRows.push(insertValue);
        if (table === 'messages') {
          const data = selected === 'id' ? messages.map((message) => ({ id: message.id })) : [...messages];
          const ordered = descending ? [...data].reverse() : data;
          return { data: resultLimit === null ? ordered : ordered.slice(0, resultLimit), error: null };
        }
        return { data: null, error: null };
      };

      query.select = jest.fn((columns = '*') => { selected = columns; return query; });
      query.eq = jest.fn((key: string, value: unknown) => { filters[key] = value; return query; });
      query.order = jest.fn((_column: string, options?: { ascending?: boolean }) => {
        descending = options?.ascending === false;
        return query;
      });
      query.limit = jest.fn((limit: number) => { resultLimit = limit; return query; });
      query.in = jest.fn(async () => ({ data: [...participants], error: null }));
      query.single = jest.fn(async () => result());
      query.insert = jest.fn((value: any) => { insertValue = value; return query; });
      query.update = jest.fn((value: any) => {
        updateValue = value;
        if (table === 'rooms') roomWrites.push(value);
        return query;
      });
      query.then = (resolve: (value: any) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(result()).then(resolve, reject);
      return query;
    });

    const channel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    (supabase.channel as jest.Mock).mockReturnValue(channel);
    (supabase.rpc as jest.Mock).mockImplementation(async (name: string, args: any) => {
      if (name === 'send_reviewed_tutor_response') {
        reviewedRows.push(args);
        const message = makeMessage(`reviewed-${reviewedRows.length}`, args.p_content, 'tutor', new Date().toISOString());
        messages = [...messages, message];
        return { data: { message, room: { ...roomRecord } }, error: null };
      }
      return { data: null, error: null };
    });
  };

  const renderRoom = async (user: User = tutor) => {
    mockUser = user;
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, loading: false });
    view = render(
      <MemoryRouter initialEntries={[`/room/${ROOM_ID}`]}>
        <RoomProvider>
          <Routes>
            <Route path="/room/:roomId" element={<RoomPagePost />} />
          </Routes>
        </RoomProvider>
      </MemoryRouter>
    );
    await screen.findByTitle('Download Chat History');
  };

  const openSettings = async () => {
    if (!view) await renderRoom();
    fireEvent.click(screen.getByTitle('AI Assistant Settings'));
    await screen.findByRole('heading', { name: 'AI Assistant Settings' });
    await waitFor(() => expect(screen.getByLabelText('Enable AI Assistant')).toHaveProperty('checked', roomRecord.ai_assistant_enabled));
    if (aiConfig && roomRecord.ai_assistant_enabled) {
      await waitFor(() => expect(document.querySelectorAll('input[type="range"]')[1]).toHaveValue(String(aiConfig.max_tokens)));
    }
  };

  const requestSuggestion = async () => {
    if (!view) await renderRoom();
    fireEvent.click(screen.getByTitle(/Generate AI Response/));
    await waitFor(() => expect((global.fetch as jest.Mock).mock.calls.length > 0 || (window.alert as jest.Mock).mock.calls.length > 0).toBe(true));
    if ((window.alert as jest.Mock).mock.calls.length > 0 && !screen.queryByText(nextSuggestion)) {
      throw new Error(`AI request failed in room workflow: ${(window.alert as jest.Mock).mock.calls[0][0]}`);
    }
    await screen.findByText(nextSuggestion);
  };

  const useGeneratedSuggestion = async (action: 'accepted' | 'modified' | 'rejected', finalText?: string) => {
    const priorReviewedCount = reviewedRows.length;
    await requestSuggestion();
    if (action === 'rejected') {
      fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
      await waitFor(() => expect(screen.queryByText(nextSuggestion)).not.toBeInTheDocument());
      return;
    }
    fireEvent.click(screen.getByRole('button', { name: 'Copy to Input' }));
    const input = screen.getByPlaceholderText('Write a comment...');
    if (action === 'modified') fireEvent.change(input, { target: { value: finalText } });
    fireEvent.click(screen.getByTitle('Send comment'));
    await waitFor(() => expect(reviewedRows).toHaveLength(priorReviewedCount + 1));
  };

  const openDownload = async () => {
    fireEvent.click(screen.getByTitle('Download Chat History'));
    await screen.findByRole('heading', { name: 'Download Room Data' });
  };

  const captureDownload = async (format: 'json' | 'txt') => {
    blobParts = [];
    await openDownload();
    fireEvent.click(screen.getByRole('button', { name: format === 'json' ? 'Complete Data (JSON)' : 'Chat History (TXT)' }));
    await waitFor(() => expect(blobParts).toHaveLength(1));
    return blobParts[0][0];
  };

  const bindBackground = (given: any, and: any) => {
    given('the user is logged in as a tutor', () => { mockUser = tutor; });
    and(/^the tutor has created a room called "AI-Enhanced Learning"$/, () => { roomRecord.title = 'AI-Enhanced Learning'; });
    and('a student has joined the room', () => { participants = [tutor, student]; });
    and('the AI assistant feature is available', () => { roomRecord.ai_assistant_enabled = false; });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = tutor;
    roomRecord = buildRoom({ ai_assistant_enabled: false });
    messages = [makeMessage('student-message-1', 'What is phishing?', 'student', STARTED_AT)];
    participants = [tutor, student];
    aiConfig = null;
    feedbackRows = [];
    reviewedRows = [];
    configLogRows = [];
    roomWrites = [];
    blobParts = [];
    nextSuggestion = 'Phishing is a cybercrime where an attacker tricks someone into sharing information.';
    view = null;
    process.env.REACT_APP_OAI_API_KEY = 'ai-assistant-bdd-key';
    process.env.REACT_APP_ENVIRONMENT = 'production';

    (useAuth as jest.Mock).mockReturnValue({ user: mockUser, loading: false });
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    configureDatabase();
    (buildAIContextFromExistingData as jest.Mock).mockResolvedValue([
      { role: 'user', content: 'Student: What is phishing?' },
    ]);
    Object.defineProperty(global, 'Blob', {
      configurable: true,
      value: jest.fn((parts: any[]) => { blobParts.push(parts); return { parts }; }),
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: jest.fn(() => 'blob:ai-bdd') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: jest.fn() });
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: jest.fn(),
    });
    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body || '{}'));
      const prompt = body.messages?.find((message: any) => message.role === 'system')?.content || '';
      const responseText = prompt.includes('Focus on practical examples')
        ? 'For example, a fake delivery notice may ask you to enter a password on a copied website.'
        : nextSuggestion;
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({
          reason: 'The student asked a learning question.',
          decision: { mode: 'tutoring', instruction: 'explanation' },
          response: responseText,
        }) } }] }),
      } as Response;
    }) as typeof fetch;
  });

  afterEach(() => {
    view?.unmount();
    view = null;
    if (ORIGINAL_API_KEY === undefined) delete process.env.REACT_APP_OAI_API_KEY;
    else process.env.REACT_APP_OAI_API_KEY = ORIGINAL_API_KEY;
    if (ORIGINAL_ENVIRONMENT === undefined) delete process.env.REACT_APP_ENVIRONMENT;
    else process.env.REACT_APP_ENVIRONMENT = ORIGINAL_ENVIRONMENT;
    jest.restoreAllMocks();
  });

  test('Tutor enables AI assistant for a room', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the tutor is in the "AI-Enhanced Learning" room', async () => { await renderRoom(); });
    when('the tutor clicks the "AI Settings" button', async () => { await openSettings(); });
    and('the tutor toggles "Enable AI Assistant" to on', async () => {
      const toggle = screen.getByLabelText('Enable AI Assistant');
      await userEvent.click(toggle);
      await waitFor(() => expect(toggle).toBeChecked());
    });
    and('the tutor selects model "Qwen3.5 Flash"', () => {
      fireEvent.change(document.querySelector('.ai-setting-select') as HTMLSelectElement, { target: { value: 'qwen3.5-flash' } });
    });
    and('the tutor sets temperature to 0.7', () => {
      fireEvent.change(document.querySelectorAll('input[type="range"]')[0], { target: { value: '0.7' } });
    });
    and('the tutor saves the settings', async () => {
      const saveButton = screen.getByRole('button', { name: 'Save Settings' });
      expect(saveButton).not.toBeDisabled();
      fireEvent.click(saveButton);
      await waitFor(() => expect(roomRecord.ai_assistant_enabled).toBe(true));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'AI Assistant Settings' })).not.toBeInTheDocument());
    });
    then('the AI assistant should be enabled for the room', () => {
      expect(roomRecord.ai_assistant_enabled).toBe(true);
      expect(aiConfig).toMatchObject({ model_name: 'qwen3.5-flash', temperature: 0.7, is_active: true });
    });
    and('AI settings should show the assistant enabled when reopened', async () => {
      await openSettings();
      expect(screen.getByLabelText('Enable AI Assistant')).toBeChecked();
    });
  });

  test('Tutor disables AI assistant', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the AI assistant is enabled in the room', () => {
      roomRecord.ai_assistant_enabled = true;
      aiConfig = { id: 'ai-bdd-config', room_id: ROOM_ID, model_name: 'qwen3.5-flash', system_prompt: 'Teach phishing.', prompt_config: null, temperature: 0.7, max_tokens: 177, is_active: true, created_at: STARTED_AT, updated_at: STARTED_AT };
    });
    when('the tutor clicks the "AI Settings" button', async () => { await openSettings(); });
    and('the tutor toggles "Enable AI Assistant" to off', async () => {
      const toggle = screen.getByLabelText('Enable AI Assistant');
      expect(toggle).toBeChecked();
      expect(toggle).not.toBeDisabled();
      await userEvent.click(toggle);
      await waitFor(() => expect(toggle).not.toBeChecked());
    });
    and('the tutor saves the settings', async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
      await waitFor(() => expect(roomWrites).toContainEqual(expect.objectContaining({ ai_assistant_enabled: false })));
      await waitFor(() => expect(roomRecord.ai_assistant_enabled).toBe(false));
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'AI Assistant Settings' })).not.toBeInTheDocument());
      expect(roomWrites).toContainEqual(expect.objectContaining({ ai_assistant_enabled: false }));
      expect(roomRecord.ai_assistant_enabled).toBe(false);
    });
    then('the AI assistant should be disabled for the room', () => expect(roomRecord.ai_assistant_enabled).toBe(false));
    and('AI settings should show the assistant disabled when reopened', async () => {
      await openSettings();
      expect(screen.getByLabelText('Enable AI Assistant')).not.toBeChecked();
    });
  });

  test('AI generates contextual suggestions', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the AI assistant is enabled', () => { roomRecord.ai_assistant_enabled = true; });
    and(/^the student sends the message "What is phishing\?"$/, () => {
      messages = [makeMessage('student-message-1', 'What is phishing?', 'student', STARTED_AT)];
    });
    when('the tutor clicks the AI suggestion button', async () => { await requestSuggestion(); });
    then('the AI assistant should generate a suggested response', () => expect(screen.getByText(nextSuggestion)).toBeInTheDocument());
    and('the suggestion should relate to phishing education', () => expect(screen.getByText(/Phishing is a cybercrime/i)).toBeInTheDocument());
    and("the suggestion box should show the student's message as context", () => expect(screen.getByText('"What is phishing?"')).toBeInTheDocument());
  });

  test('Tutor accepts AI suggestion', ({ given, when, and, then }) => {
    bindBackground(given, and);
    given(/^the AI has generated a suggestion "Phishing is a cybercrime where\.\.\."$/, async () => {
      nextSuggestion = 'Phishing is a cybercrime where...';
      roomRecord.ai_assistant_enabled = true;
      await renderRoom();
      await requestSuggestion();
    });
    when('the tutor clicks "Copy to Input"', () => fireEvent.click(screen.getByRole('button', { name: 'Copy to Input' })));
    then('the suggestion should be copied to the message input field', () => expect(screen.getByPlaceholderText('Write a comment...')).toHaveValue(nextSuggestion));
    and('the suggestion box should remain available until the tutor sends', () => {
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });
    when('the tutor sends the message without changes', async () => {
      fireEvent.click(screen.getByTitle('Send comment'));
      await waitFor(() => expect(reviewedRows).toHaveLength(1));
    });
    then('the system should track the suggestion as "accepted"', () => {
      expect(reviewedRows[0]).toMatchObject({ p_tutor_action: 'accepted', p_content: nextSuggestion, p_ai_suggestion: nextSuggestion });
    });
  });

  test('Tutor rejects AI suggestion', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given('the AI has generated a suggestion', async () => {
      roomRecord.ai_assistant_enabled = true;
      await renderRoom();
      await requestSuggestion();
    });
    when('the tutor clicks the "Reject" button', () => fireEvent.click(screen.getByRole('button', { name: 'Reject' })));
    then('the suggestion box should disappear', async () => waitFor(() => expect(screen.queryByText(nextSuggestion)).not.toBeInTheDocument()));
    and('the system should track the suggestion as "rejected"', () => expect(feedbackRows).toContainEqual(expect.objectContaining({ tutor_action: 'rejected', ai_suggestion: nextSuggestion })));
    and('the message input should remain empty', () => expect(screen.getByPlaceholderText('Write a comment...')).toHaveValue(''));
  });

  test('Tutor modifies AI suggestion', ({ given, when, and, then }) => {
    bindBackground(given, and);
    given(/^the AI has generated a suggestion "Phishing is a cybercrime where\.\.\."$/, async () => {
      nextSuggestion = 'Phishing is a cybercrime where...';
      roomRecord.ai_assistant_enabled = true;
      await renderRoom();
      await requestSuggestion();
    });
    when('the tutor clicks "Copy to Input"', () => fireEvent.click(screen.getByRole('button', { name: 'Copy to Input' })));
    and(/^the tutor modifies the text to "Phishing is a type of cyber attack where\.\.\."$/, () => {
      fireEvent.change(screen.getByPlaceholderText('Write a comment...'), { target: { value: 'Phishing is a type of cyber attack where...' } });
    });
    and('the tutor sends the modified message', async () => {
      fireEvent.click(screen.getByTitle('Send comment'));
      await waitFor(() => expect(reviewedRows).toHaveLength(1));
    });
    then('the system should track the suggestion as "modified"', () => expect(reviewedRows[0]).toMatchObject({ p_tutor_action: 'modified', p_content: 'Phishing is a type of cyber attack where...' }));
    and('the final response should be recorded', () => expect(messages).toContainEqual(expect.objectContaining({ content: 'Phishing is a type of cyber attack where...', user_role: 'tutor' })));
  });

  test('AI responds to specific student messages', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the AI assistant is enabled', () => { roomRecord.ai_assistant_enabled = true; });
    and('there are multiple messages in the chat', () => {
      messages = [
        makeMessage('student-message-1', 'What is phishing?', 'student', STARTED_AT),
        makeMessage('student-message-2', 'Can you explain spear phishing?', 'student', '2026-01-01T00:01:00.000Z'),
      ];
    });
    when(/^the student sends "Can you explain spear phishing\?"$/, () => undefined);
    and('the tutor clicks the AI suggestion button', async () => { await requestSuggestion(); });
    then('the AI should generate a response specifically about spear phishing', () => {
      const request = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body));
      expect(request.messages).toContainEqual(expect.objectContaining({ content: expect.stringContaining('Can you explain spear phishing?') }));
    });
    and(/^the context should show "Can you explain spear phishing\?" as the parent message$/, () => expect(screen.getByText('"Can you explain spear phishing?"')).toBeInTheDocument());
  });

  test('AI suggestion tracking', ({ given, when, then, and }) => {
    bindBackground(given, and);
    given('the tutor has interacted with AI suggestions', async () => {
      roomRecord.ai_assistant_enabled = true;
      await renderRoom();
    });
    when('the tutor has:', async (table: Array<{ Action: string; Count: string }>) => {
      for (const { Action, Count } of table) {
        for (let index = 0; index < Number(Count); index += 1) {
          if (Action === 'accepted') await useGeneratedSuggestion('accepted');
          else if (Action === 'modified') await useGeneratedSuggestion('modified', `Modified response ${index + 1}`);
          else await useGeneratedSuggestion('rejected');
        }
      }
    });
    then('the system should maintain a record of all interactions', async () => {
      const rawExport = await captureDownload('json');
      const exported = JSON.parse(String(rawExport));
      expect(exported.ai_interactions).toHaveLength(6);
      expect([...feedbackRows, ...reviewedRows]).toHaveLength(6);
    });
    and('each interaction should include response time metrics', async () => {
      const rawExport = await captureDownload('json');
      expect(JSON.parse(String(rawExport)).ai_interactions.every((interaction: any) => typeof interaction.response_time_ms === 'number')).toBe(true);
    });
  });

  test('AI configuration persistence', ({ given, when, and, then }) => {
    bindBackground(given, and);
    given('the tutor has configured AI settings with:', async (table: Array<{ Setting: string; Value: string }>) => {
      roomRecord.ai_assistant_enabled = true;
      await renderRoom();
      await openSettings();
      const bySetting = Object.fromEntries(table.map(({ Setting, Value }) => [Setting, Value]));
      fireEvent.change(document.querySelector('.ai-setting-select') as HTMLSelectElement, { target: { value: 'qwen3.5-flash' } });
      fireEvent.change(document.querySelectorAll('input[type="range"]')[0], { target: { value: bySetting.Temperature } });
      fireEvent.change(document.querySelectorAll('input[type="range"]')[1], { target: { value: bySetting['Max Tokens'] } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
      await waitFor(() => expect(aiConfig?.max_tokens).toBe(Number(bySetting['Max Tokens'])));
    });
    when('the tutor leaves the room', () => { view?.unmount(); view = null; });
    and('the tutor rejoins the room', async () => { await renderRoom(); });
    then('the AI settings should be preserved', () => expect(aiConfig).toMatchObject({ model_name: 'qwen3.5-flash', temperature: 0.5, max_tokens: 300, is_active: true }));
    and('AI settings should show the assistant enabled after rejoining', async () => {
      await openSettings();
      expect(screen.getByLabelText('Enable AI Assistant')).toBeChecked();
    });
  });

  test('AI handles no student messages gracefully', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the AI assistant is enabled', () => { roomRecord.ai_assistant_enabled = true; });
    and('there are no student messages in the chat', () => { messages = [makeMessage('tutor-message-1', 'Start with a question.', 'tutor', STARTED_AT)]; });
    when('the tutor clicks the AI suggestion button', async () => {
      await renderRoom();
      fireEvent.click(screen.getByTitle(/Generate AI Response/));
      await waitFor(() => expect(global.fetch).not.toHaveBeenCalled());
    });
    then(/^the system should show "The transfer request could not be completed\. Try again\."$/, () => expect(window.alert).toHaveBeenCalledWith('The transfer request could not be completed. Try again.'));
    and('no suggestion should be generated', () => expect(screen.queryByText(nextSuggestion)).not.toBeInTheDocument());
  });

  test('AI respects role-based access', ({ given, then, and }) => {
    bindBackground(given, and);
    given('a student is viewing the room', async () => { await renderRoom(student); });
    then('the student should not see the AI Settings button', () => expect(screen.queryByTitle('AI Assistant Settings')).not.toBeInTheDocument());
    and('the student should not see the AI suggestion button', () => expect(screen.queryByTitle(/Generate AI Response/)).not.toBeInTheDocument());
    given('an observer is viewing the room', async () => {
      view?.unmount();
      view = null;
      await renderRoom({ ...student, id: 'ai-bdd-observer', current_role: 'observer' } as User);
    });
    then('the observer should not see the AI Settings button', () => expect(screen.queryByTitle('AI Assistant Settings')).not.toBeInTheDocument());
    and('the observer should not see the AI suggestion button', () => expect(screen.queryByTitle(/Generate AI Response/)).not.toBeInTheDocument());
  });

  test('Tutor receives a suggestion shaped by a custom system prompt', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given(/^the tutor has set a custom system prompt "Focus on practical examples"$/, () => {
      roomRecord.ai_assistant_enabled = true;
      roomRecord.ai_assistant_prompt = 'Focus on practical examples';
      nextSuggestion = 'For example, a fake delivery notice may ask you to enter a password on a copied website.';
      aiConfig = { id: 'ai-bdd-config', room_id: ROOM_ID, model_name: 'qwen3.5-flash', system_prompt: 'Focus on practical examples', prompt_config: null, temperature: 0.7, max_tokens: 150, is_active: true, created_at: STARTED_AT, updated_at: STARTED_AT };
    });
    and(/^the student asks "What is social engineering\?"$/, () => { messages = [makeMessage('student-message-1', 'What is social engineering?', 'student', STARTED_AT)]; });
    when('the tutor requests an AI suggestion', async () => { await requestSuggestion(); });
    then('the tutor should see a suggestion that emphasizes practical examples', () => expect(screen.getByText(/For example, a fake delivery notice/i)).toBeInTheDocument());
    and('the suggestion should align with the custom prompt', () => {
      const request = JSON.parse(String((global.fetch as jest.Mock).mock.calls[0][1].body));
      expect(request.messages[0].content).toContain('Focus on practical examples');
    });
  });

  test('AI failure handling', ({ given, and, when, then }) => {
    bindBackground(given, and);
    given('the AI assistant is enabled', () => { roomRecord.ai_assistant_enabled = true; });
    and('the AI service is temporarily unavailable', () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503, text: async () => 'temporarily unavailable' } as Response);
    });
    when('the tutor clicks the AI suggestion button', async () => {
      await renderRoom();
      fireEvent.click(screen.getByTitle(/Generate AI Response/));
      await waitFor(() => expect(window.alert).toHaveBeenCalled());
    });
    then('the system should show an error message', () => expect(window.alert).toHaveBeenCalled());
    and(/^the error should say "The transfer request could not be completed\. Try again\."$/, () => expect(window.alert).toHaveBeenCalledWith('The transfer request could not be completed. Try again.'));
    and('the tutor should still be able to type manually', () => {
      fireEvent.change(screen.getByPlaceholderText('Write a comment...'), { target: { value: 'I can answer manually.' } });
      expect(screen.getByPlaceholderText('Write a comment...')).toHaveValue('I can answer manually.');
    });
  });
});

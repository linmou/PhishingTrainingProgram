#!/usr/bin/env node
// Test responsible for executable bindings to features/chat_history_download.feature through RoomContext exports and RoomPagePost controls.

import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { defineFeature, loadFeature } from 'jest-cucumber';
import RoomPagePost from '../pages/RoomPagePost';
import { RoomProvider, useRoom } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase, getRoomFeedbackSummary } from '../services/supabase';
import { getAIConfig, generateTutorSuggestion, recordAISuggestionFeedback } from '../services/aiService';
import { ChecklistService } from '../services/checklistService';
import {
  learnerAUser,
  learnerBUser,
  observerUser,
  tutorUser,
  transferRoom,
} from '../test-support/transferRoomFixtures';
import type { AIInteraction, Message, Room, UserRole } from '../types';

jest.mock('../services/supabase', () => ({
  supabase: { channel: jest.fn(), from: jest.fn(), storage: { from: jest.fn() } },
  validateRoomPassword: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn(),
  getUserMessageFeedback: jest.fn(),
  getRoomFeedbackSummary: jest.fn(),
  clearChatHistory: jest.fn(),
}));

jest.mock('../services/aiService', () => ({
  generateTutorSuggestion: jest.fn(),
  recordAISuggestionFeedback: jest.fn(),
  updateAIConfig: jest.fn(),
  getAIConfig: jest.fn(),
  DEFAULT_AI_MODEL: 'qwen3.5-flash',
}));

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

jest.mock('../services/checklistService', () => ({
  ChecklistService: {
    getActiveTransferChecklistForRoom: jest.fn(),
    getChecklistForStudent: jest.fn(),
  },
}));

jest.mock('../components/ChecklistPanel', () => function MockChecklistPanel() {
  return <div data-testid="checklist-panel" />;
});
jest.mock('../components/AIAssistantSettings', () => function MockAIAssistantSettings() {
  return <div data-testid="ai-settings-modal" />;
});
jest.mock('../components/StudentAIToneControl', () => function MockStudentAIToneControl() {
  return <div data-testid="student-ai-tone" />;
});
jest.mock('../components/RoomPost', () => function MockRoomPost() {
  return <div data-testid="room-post" />;
});
jest.mock('../components/CommentInput', () => function MockCommentInput() {
  return <div data-testid="comment-input" />;
});
jest.mock('../components/AISuggestionBox', () => function MockAISuggestionBox() {
  return <div data-testid="ai-suggestion-box" />;
});

const feature = loadFeature('features/chat_history_download.feature');

const ROOM: Room = {
  ...transferRoom,
  title: 'Phishing 101',
  created_at: '2024-01-01T00:00:00.000Z',
  transfer_learning_enabled: false,
  ai_assistant_enabled: true,
  active_response_mode: 'tutoring',
};

const MESSAGES: Message[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    room_id: ROOM.id,
    user_id: tutorUser.id,
    content: 'Welcome to Phishing 101!',
    user_role: 'tutor',
    display_name: 'Prof. Smith',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    response_mode: 'tutoring',
    created_at: '2024-01-01T10:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    room_id: ROOM.id,
    user_id: learnerAUser.id,
    content: 'Glad to be here!',
    user_role: 'student',
    display_name: 'John Doe',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    response_mode: null,
    created_at: '2024-01-01T10:01:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000003',
    room_id: ROOM.id,
    user_id: learnerAUser.id,
    content: 'What is phishing?',
    user_role: 'student',
    display_name: 'John Doe',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    response_mode: null,
    created_at: '2024-01-01T10:02:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    room_id: ROOM.id,
    user_id: learnerAUser.id,
    content: 'How do I stay safe?',
    user_role: 'student',
    display_name: 'John Doe',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    response_mode: null,
    created_at: '2024-01-01T10:03:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000005',
    room_id: ROOM.id,
    user_id: learnerAUser.id,
    content: 'Is this email real?',
    user_role: 'student',
    display_name: 'John Doe',
    is_ai_generated: false,
    ai_model_used: null,
    ai_response_time_ms: null,
    parent_message_id: null,
    response_mode: null,
    created_at: '2024-01-01T10:04:00.000Z',
  },
];

const PARTICIPANTS = [
  { id: tutorUser.id, display_name: 'Prof. Smith', current_role: 'tutor' },
  { id: learnerAUser.id, display_name: 'John Doe', current_role: 'student' },
  { id: observerUser.id, display_name: 'Jane Observer', current_role: 'observer' },
];

interface CapturedDownload {
  blob: Blob;
  filename: string;
}

interface ParsedRoomExport {
  room: { id: string; title: string; created_at: string };
  participants?: Array<{ display_name?: string; role?: string; current_role?: string }>;
  messages: Array<{
    id: string;
    content: string;
    display_name?: string;
    user_role: string;
    created_at: string;
  }>;
  ai_interactions?: AIInteraction[];
}

interface ScenarioState {
  userRole: UserRole;
  userId: string;
  room: Room;
  messages: Message[];
  participants: typeof PARTICIPANTS;
  aiInteractions: AIInteraction[];
  roomApi: ReturnType<typeof useRoom> | null;
  unmount: (() => void) | null;
  downloads: CapturedDownload[];
}

function makeState(): ScenarioState {
  return {
    userRole: 'tutor',
    userId: tutorUser.id,
    room: { ...ROOM },
    messages: MESSAGES.map((message) => ({ ...message })),
    participants: PARTICIPANTS,
    aiInteractions: [],
    roomApi: null,
    unmount: null,
    downloads: [],
  };
}

const RoomProbe: React.FC<{ onReady: (room: ReturnType<typeof useRoom>) => void }> = ({ onReady }) => {
  const room = useRoom();
  React.useEffect(() => onReady(room), [onReady, room]);
  return null;
};

function setLoggedInRole(state: ScenarioState, role: UserRole) {
  state.userRole = role;
  state.userId = role === 'tutor'
    ? tutorUser.id
    : role === 'student'
      ? learnerAUser.id
      : observerUser.id;
}

function bindBackground(
  state: ScenarioState,
  given: (name: string, fn: () => unknown) => void,
  and: (name: string, fn: () => unknown) => void
) {
  given('a "tutor" user is logged in', () => {
    setLoggedInRole(state, 'tutor');
    expect(state.userId).toBe(tutorUser.id);
  });
  and('the "tutor" has created a room named "Phishing 101"', () => {
    expect(state.room.title).toBe('Phishing 101');
  });
  and('a "student" user has joined the "Phishing 101" room', () => {
    expect(state.participants.some((participant) => participant.current_role === 'student')).toBe(true);
  });
  and('the "tutor" has sent the message "Welcome to Phishing 101!"', () => {
    expect(state.messages.some((message) => message.content === 'Welcome to Phishing 101!')).toBe(true);
  });
  and('the "student" has sent the message "Glad to be here!"', () => {
    expect(state.messages.some((message) => message.content === 'Glad to be here!')).toBe(true);
  });
  and('an "observer" user has joined the "Phishing 101" room', () => {
    expect(state.participants.some((participant) => participant.current_role === 'observer')).toBe(true);
  });
}

function configureBackend(state: ScenarioState) {
  const currentUser = state.userRole === 'tutor'
    ? tutorUser
    : state.userRole === 'student'
      ? learnerAUser
      : observerUser;
  (useAuth as jest.Mock).mockReturnValue({ user: currentUser, loading: false });
  (getAIConfig as jest.Mock).mockResolvedValue(null);
  (getRoomFeedbackSummary as jest.Mock).mockResolvedValue(null);
  (ChecklistService.getActiveTransferChecklistForRoom as jest.Mock).mockResolvedValue(null);
  (ChecklistService.getChecklistForStudent as jest.Mock).mockResolvedValue(null);
  (supabase.channel as jest.Mock).mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  });
  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'rooms') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: state.room, error: null }),
            }),
            single: jest.fn().mockResolvedValue({ data: state.room, error: null }),
          }),
        }),
      };
    }
    if (table === 'messages') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: state.messages, error: null }),
          }),
        }),
      };
    }
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockImplementation(async (_field: string, ids: string[]) => ({
            data: state.participants.filter((participant) => ids.includes(participant.id)),
            error: null,
          })),
        }),
      };
    }
    if (table === 'ai_suggestion_feedback') {
      return {
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      };
    }
    throw new Error('Unexpected Supabase table ' + table);
  });
}

async function mountRoom(state: ScenarioState) {
  configureBackend(state);
  const onReady = (room: ReturnType<typeof useRoom>) => { state.roomApi = room; };
  const view = render(
    <RoomProvider>
      <RoomProbe onReady={onReady} />
      <MemoryRouter initialEntries={['/room/' + state.room.id]}>
        <Routes>
          <Route path="/room/:roomId" element={<RoomPagePost />} />
        </Routes>
      </MemoryRouter>
    </RoomProvider>
  );
  state.unmount = view.unmount;
  await waitFor(() => expect(state.roomApi?.currentRoom?.id).toBe(state.room.id));
  await waitFor(() => expect(state.roomApi?.messages).toHaveLength(state.messages.length));
  await waitFor(() => expect(screen.getByText('Welcome to Phishing 101!')).toBeVisible());
}

async function createAIInteractions(state: ScenarioState, actions: AIInteraction['tutor_action'][]) {
  if (!state.roomApi) throw new Error('Room must be mounted before generating tutor interactions');
  const latestLearnerMessage = state.messages.filter((message) => message.user_role === 'student').slice(-1)[0];
  if (!latestLearnerMessage) throw new Error('Room must have a learner message before generating tutor interactions');
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    const suggestion = 'AI suggestion ' + (index + 1);
    const finalResponse = 'Tutor response ' + (index + 1);
    (generateTutorSuggestion as jest.Mock).mockResolvedValueOnce({
      success: true,
      suggestion,
      decision: {
        mode: 'tutoring',
        instruction: 'explanation',
        mode_reason: 'The learner asked for phishing guidance.',
        suggested_response: finalResponse,
      },
      contextMessages: [latestLearnerMessage.id],
    });
    await act(async () => {
      await state.roomApi!.generateAIResponse();
    });
    await act(async () => {
      await state.roomApi!.recordAIFeedback(action, finalResponse);
      state.roomApi!.clearAISuggestion();
    });
  }
  await waitFor(() => expect(state.roomApi?.aiInteractions).toHaveLength(actions.length));
  state.aiInteractions = state.roomApi!.aiInteractions;
}

function openDownloadModal() {
  fireEvent.click(screen.getByTitle('Download Chat History'));
  expect(screen.getByRole('heading', { name: 'Download Room Data' })).toBeInTheDocument();
}

async function clickFormatAndRead(state: ScenarioState, format: 'TXT' | 'JSON') {
  openDownloadModal();
  await selectFormatAndCapture(state, format);
  const download = state.downloads[state.downloads.length - 1];
  return { ...download, content: await readBlobAsText(download.blob) };
}

async function selectFormatAndCapture(state: ScenarioState, format: 'TXT' | 'JSON') {
  const name = format === 'TXT' ? 'Chat History (TXT)' : 'Complete Data (JSON)';
  fireEvent.click(screen.getByRole('button', { name }));
  await waitFor(() => expect(lastCreatedBlob).not.toBeNull());
  if (!lastCreatedBlob) throw new Error('Expected the selected format to create a download Blob');
  state.downloads.push({ blob: lastCreatedBlob, filename: lastDownloadedFilename });
}

function readBlobAsText(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

async function readJsonExport(state: ScenarioState): Promise<ParsedRoomExport> {
  const download = state.downloads[state.downloads.length - 1];
  if (!download) throw new Error('Expected a room export download');
  return JSON.parse(await readBlobAsText(download.blob)) as ParsedRoomExport;
}

let urlDescriptors: Array<{
  url: typeof URL;
  createObjectURL?: PropertyDescriptor;
  revokeObjectURL?: PropertyDescriptor;
}> = [];
let createObjectURLMock: jest.Mock;
let lastCreatedBlob: Blob | null = null;
let lastDownloadedFilename = '';

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: jest.fn(),
  });
  const urlConstructors = Array.from(new Set([globalThis.URL, window.URL]));
  lastCreatedBlob = null;
  lastDownloadedFilename = '';
  createObjectURLMock = jest.fn((blob: Blob) => {
    lastCreatedBlob = blob;
    return 'blob:room-export';
  });
  urlDescriptors = urlConstructors.map((url) => ({
    url,
    createObjectURL: Object.getOwnPropertyDescriptor(url, 'createObjectURL'),
    revokeObjectURL: Object.getOwnPropertyDescriptor(url, 'revokeObjectURL'),
  }));
  for (const url of urlConstructors) {
    Object.defineProperty(url, 'createObjectURL', {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(url, 'revokeObjectURL', { configurable: true, value: jest.fn() });
  }
  jest.spyOn(window.HTMLAnchorElement.prototype, 'click').mockImplementation(function click(this: HTMLAnchorElement) {
    lastDownloadedFilename = this.download;
  });
});

afterEach(() => {
  currentState?.unmount?.();
  currentState = null;
  jest.restoreAllMocks();
  for (const descriptor of urlDescriptors) {
    if (descriptor.createObjectURL) Object.defineProperty(descriptor.url, 'createObjectURL', descriptor.createObjectURL);
    else delete (descriptor.url as unknown as Record<string, unknown>).createObjectURL;
    if (descriptor.revokeObjectURL) Object.defineProperty(descriptor.url, 'revokeObjectURL', descriptor.revokeObjectURL);
    else delete (descriptor.url as unknown as Record<string, unknown>).revokeObjectURL;
  }
  urlDescriptors = [];
  lastCreatedBlob = null;
  lastDownloadedFilename = '';
});

let currentState: ScenarioState | null = null;

defineFeature(feature, (test) => {
  test('Download button is visible to all roles', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is logged in as a "tutor" in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'tutor');
      await mountRoom(state);
    });
    then('the user should see a "Download Chat History" button', () => {
      expect(screen.getByTitle('Download Chat History')).toBeVisible();
    });
    when('the user logs out and logs in as a "student" in the "Phishing 101" room', async () => {
      state.unmount?.();
      setLoggedInRole(state, 'student');
      await mountRoom(state);
    });
    then('the user should see a "Download Chat History" button', () => {
      expect(screen.getByTitle('Download Chat History')).toBeVisible();
    });
    when('the user logs out and logs in as an "observer" in the "Phishing 101" room', async () => {
      state.unmount?.();
      setLoggedInRole(state, 'observer');
      await mountRoom(state);
    });
    then('the user should see a "Download Chat History" button', () => {
      expect(screen.getByTitle('Download Chat History')).toBeVisible();
    });
  });

  test('Download chat history as TXT', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is logged in as a "student" in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'student');
      await mountRoom(state);
    });
    when('the user clicks the "Download Chat History" button', () => {
      openDownloadModal();
    });
    and('selects the "TXT" format', async () => {
      await selectFormatAndCapture(state, 'TXT');
      expect(createObjectURLMock).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(state.downloads).toHaveLength(1));
    });
    then('a file named "Phishing_101_chat_history_<date>.txt" should be downloaded', async () => {
      expect(state.downloads[0].filename).toMatch(/^Phishing_101_chat_history_\d{4}-\d{2}-\d{2}\.txt$/);
    });
    and('the file should contain the room title "Phishing 101"', async () => {
      expect(await readBlobAsText(state.downloads[0].blob)).toContain('Room: Phishing 101');
    });
    and('the file should contain the messages "Welcome to Phishing 101!" and "Glad to be here!" with timestamps.', async () => {
      const content = await readBlobAsText(state.downloads[0].blob);
      expect(state.downloads[0].blob.type).toBe('text/plain');
      expect(content).toContain('[2024-01-01T10:00:00.000Z] Prof. Smith (tutor): Welcome to Phishing 101!');
      expect(content).toContain(`[2024-01-01T10:01:00.000Z] ${learnerAUser.display_name} (student): Glad to be here!`);
    });
  });

  test('Download chat history as JSON', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is logged in as a "tutor" in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'tutor');
      await mountRoom(state);
    });
    when('the user clicks the "Download Chat History" button', () => openDownloadModal());
    and('selects the "JSON" format', async () => {
      await selectFormatAndCapture(state, 'JSON');
      await waitFor(() => expect(state.downloads).toHaveLength(1));
    });
    then('a file named "Phishing_101_chat_export_<date>.json" should be downloaded', async () => {
      expect(state.downloads[0].filename).toMatch(/^Phishing_101_chat_export_\d{4}-\d{2}-\d{2}\.json$/);
    });
    and('the JSON file should be valid', async () => {
      const content = await readBlobAsText(state.downloads[0].blob);
      expect(() => JSON.parse(content)).not.toThrow();
      expect(state.downloads[0].blob.type).toBe('application/json');
    });
    and('the JSON file should contain the room title "Phishing 101"', async () => {
      expect((await readJsonExport(state)).room.title).toBe('Phishing 101');
    });
    and('the JSON file should contain a list of currently identifiable participants including the "tutor" and "student"', async () => {
      const data = await readJsonExport(state);
      const exportedParticipants = data.participants?.map((participant) => [
        participant.display_name,
        participant.role ?? participant.current_role,
      ]);
      expect(exportedParticipants).toEqual(expect.arrayContaining([
        ['Tutor', 'tutor'], ['John Doe', 'student'],
      ]));
    });
    and('the JSON file should contain a list of messages with content, author, role, and timestamp', async () => {
      const data = await readJsonExport(state);
      expect(data.messages).toHaveLength(state.messages.length);
      expect(data.messages.every((message) => Boolean(
        message.id && message.content && message.display_name && message.user_role && message.created_at
      ))).toBe(true);
    });
  });

  test('Downloaded content includes all required information', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is logged in as a "tutor" in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'tutor');
      await mountRoom(state);
    });
    when('the user downloads the chat history as "JSON"', async () => {
      await clickFormatAndRead(state, 'JSON');
    });
    then("the downloaded file should contain the room's creation date", async () => {
      const data = await readJsonExport(state);
      expect(data.room.created_at).toBe('2024-01-01T00:00:00.000Z');
    });
    and('the downloaded file should contain each currently identifiable participant\'s display name and role', async () => {
      const data = await readJsonExport(state);
      const exportedParticipants = data.participants?.map((participant) => [
        participant.display_name,
        participant.role ?? participant.current_role,
      ]);
      expect(exportedParticipants).toEqual(expect.arrayContaining([
        ['Tutor', 'tutor'], ['John Doe', 'student'],
      ]));
    });
    and("each message in the downloaded file should have a unique ID, content, author's display name, author's role, and a precise timestamp.", async () => {
      const messages = (await readJsonExport(state)).messages;
      expect(new Set(messages.map((message) => message.id)).size).toBe(messages.length);
      expect(messages.every((message) => Boolean(
        message.content && message.display_name && message.user_role && message.created_at
      ))).toBe(true);
    });
  });

  test('Download includes AI interaction data for tutors', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is logged in as a "tutor" in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'tutor');
      await mountRoom(state);
    });
    and('the tutor has enabled AI assistant', () => {
      expect(state.room.ai_assistant_enabled).toBe(true);
    });
    and('the tutor has used AI suggestions with various outcomes:', async () => {
      await createAIInteractions(state, ['accepted', 'modified', 'rejected']);
      expect(state.aiInteractions.map((interaction) => interaction.tutor_action)).toEqual(['accepted', 'modified', 'rejected']);
    });
    when('the tutor downloads the chat history as "JSON"', async () => {
      await clickFormatAndRead(state, 'JSON');
    });
    then('the downloaded file should include an "ai_interactions" section', async () => {
      const data = await readJsonExport(state);
      const interactions = data.ai_interactions;
      if (!interactions) throw new Error('JSON export omitted AI interactions');
      expect(interactions).toHaveLength(3);
      state.aiInteractions = interactions;
    });
    and('the AI interactions should show:', () => {
      expect(state.aiInteractions).toEqual(expect.arrayContaining([
        expect.objectContaining({
          parent_message_content: expect.any(String),
          ai_suggestion: expect.any(String),
          tutor_action: expect.any(String),
          tutor_final_response: expect.any(String),
          response_time_ms: expect.any(Number),
        }),
      ]));
    });
  });

  test('TXT download includes AI usage summary', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is logged in as a "tutor" in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'tutor');
      await mountRoom(state);
    });
    and('the tutor has used AI suggestions 10 times', async () => {
      const actions: AIInteraction['tutor_action'][] = [
        'accepted', 'accepted', 'modified', 'rejected', 'ignored',
        'ignored', 'ignored', 'ignored', 'ignored', 'ignored',
      ];
      await createAIInteractions(state, actions);
      expect(state.aiInteractions).toHaveLength(10);
    });
    when('the tutor downloads the chat history as "TXT"', async () => {
      await clickFormatAndRead(state, 'TXT');
    });
    then('the file should include an "AI Assistant Summary" section', async () => {
      const content = await readBlobAsText(state.downloads[0].blob);
      expect(content).toContain('AI Assistant Summary:');
      expect(content).toContain('Total AI suggestions: 10');
    });
    and('the summary should show total suggestions and usage breakdown', async () => {
      const content = await readBlobAsText(state.downloads[0].blob);
      expect(content).toContain('Accepted: 2');
      expect(content).toContain('Modified: 1');
      expect(content).toContain('Rejected: 1');
      expect(content).toContain('Ignored: 6');
    });
  });

  test('Students and observers see basic downloads without AI data', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is logged in as a "student" in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'student');
      await mountRoom(state);
    });
    and('the tutor has used AI suggestions in the room', () => {
      state.aiInteractions = [{
        timestamp: '2024-01-01T10:05:00.000Z',
        parent_message_id: state.messages[2].id,
        parent_message_content: state.messages[2].content,
        ai_suggestion: 'Private tutor suggestion',
        tutor_action: 'accepted',
        tutor_final_response: 'Private final response',
        response_time_ms: 25,
        raw_instruction: 'explanation',
      }];
    });
    when('the student downloads the chat history as "JSON"', async () => {
      await clickFormatAndRead(state, 'JSON');
    });
    then('the downloaded file should NOT include "ai_interactions" section', async () => {
      const content = await readBlobAsText(state.downloads[0].blob);
      expect(content).not.toContain('ai_interactions');
      expect(content).not.toContain('Private tutor suggestion');
    });
    and('the file should only contain messages and basic room information', async () => {
      const content = await readBlobAsText(state.downloads[0].blob);
      const data = JSON.parse(content);
      expect(data.room).toEqual(expect.objectContaining({
        id: ROOM.id,
        title: 'Phishing 101',
        created_at: ROOM.created_at,
      }));
      expect(data).not.toHaveProperty('ai_interactions');
    });
  });

  test('Download modal shows format options', ({ given, and, when, then }) => {
    const state = currentState = makeState();
    bindBackground(state, given, and);
    given('the user is in the "Phishing 101" room', async () => {
      setLoggedInRole(state, 'tutor');
      await mountRoom(state);
    });
    when('the user clicks the "Download Chat History" button', () => openDownloadModal());
    then('a modal should appear with format options:', () => {
      expect(screen.getByRole('button', { name: 'Chat History (TXT)' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Complete Data (JSON)' })).toBeInTheDocument();
    });
    and('the modal should have a "Cancel" button to close without downloading', () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'Download Room Data' })).not.toBeInTheDocument();
      expect(state.downloads).toHaveLength(0);
    });
  });
});

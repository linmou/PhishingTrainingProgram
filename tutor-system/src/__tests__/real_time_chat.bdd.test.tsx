#!/usr/bin/env node
// Binds real_time_chat.feature to RoomProvider and RoomPagePost with mocked Supabase boundaries.
import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import RoomPagePost from '../pages/RoomPagePost';
import { RoomProvider } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getMessageFeedbackStats,
  getRoomFeedbackSummary,
  getUserMessageFeedback,
  submitMessageFeedback,
  supabase,
  validateRoomPassword
} from '../services/supabase';

jest.mock('../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
    auth: { getUser: jest.fn(), signOut: jest.fn() },
    storage: { from: jest.fn() }
  },
  validateRoomPassword: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn(),
  getUserMessageFeedback: jest.fn(),
  getRoomFeedbackSummary: jest.fn(),
  clearChatHistory: jest.fn()
}));

jest.mock('../contexts/AuthContext', () => ({
  ...jest.requireActual('../contexts/AuthContext'),
  useAuth: () => require('react').useContext(MockAuthClientContext)
}));

jest.mock('../services/aiService', () => ({
  generateTutorSuggestion: jest.fn().mockResolvedValue(null),
  recordAISuggestionFeedback: jest.fn(),
  updateAIConfig: jest.fn(),
  getAIConfig: jest.fn().mockResolvedValue(null),
  initializeAIAssistant: jest.fn(),
  generateAndSaveAIResponse: jest.fn(),
  DEFAULT_AI_MODEL: 'test-model'
}));

const feature = loadFeature('./features/real_time_chat.feature');
const MockAuthClientContext = React.createContext<any>(null);
const users = {
  tutor: { id: 'tutor-1', display_name: 'Tutor', current_role: 'tutor', avatar_url: null },
  student: { id: 'student-1', display_name: 'Student', current_role: 'student', avatar_url: null },
  observer: { id: 'observer-1', display_name: 'Observer', current_role: 'observer', avatar_url: null }
};
let mockRoom: any;
let mockMessages: any[];
let mockFeedbackRows: Array<{ message_id: string; user_id: string; feedback_type: 'like' | 'dislike'; rating: number }>;
let mockNetworkConnected: boolean;
let mockOfflinePollObserved: boolean;
let mockMessageInsertError: { message: string } | null;
let roomMembers: Set<string>;
let roomClients: Record<string, ReturnType<typeof render>>;
let currentActor: keyof typeof users = 'tutor';
let realtimeListeners: Array<{
  event: string;
  filter: any;
  callback: (payload: any) => void;
  active: boolean;
  channel?: any;
  actor: keyof typeof users;
}>;

const mockSupabase = supabase as any;
const mockUseAuth = useAuth as jest.Mock;
const featureFeedbackStats = getMessageFeedbackStats as jest.Mock;
const featureUserFeedback = getUserMessageFeedback as jest.Mock;
const featureSubmitFeedback = submitMessageFeedback as jest.Mock;
const featureRoomFeedbackSummary = getRoomFeedbackSummary as jest.Mock;
const featureValidateRoomPassword = validateRoomPassword as jest.Mock;

const makeMessage = (id: string, content: string, user: typeof users.tutor | typeof users.student | typeof users.observer) => ({
  id,
  room_id: mockRoom.id,
  user_id: user.id,
  user_role: user.current_role,
  content,
  ai_model_used: null,
  ai_response_time_ms: null,
  parent_message_id: null,
  created_at: new Date().toISOString(),
  display_name: user.display_name,
  avatar_url: null
});

const feedbackStatsFor = (messageId: string) => {
  const rows = mockFeedbackRows.filter(row => row.message_id === messageId);
  const likes = rows.filter(row => row.feedback_type === 'like');
  const dislikes = rows.filter(row => row.feedback_type === 'dislike');
  const average = (items: typeof rows) => items.length
    ? items.reduce((total, row) => total + row.rating, 0) / items.length
    : null;
  return {
    message_id: messageId,
    total_feedback_count: rows.length,
    like_count: likes.length,
    dislike_count: dislikes.length,
    average_like_rating: average(likes),
    average_dislike_rating: average(dislikes),
    overall_average_rating: average(rows)
  };
};

const makeQuery = (table: string) => {
  let filterValues: Record<string, unknown> = {};
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn((field: string, value: unknown) => { filterValues[field] = value; return query; }),
    neq: jest.fn(() => query),
    not: jest.fn(() => query),
    or: jest.fn(() => query),
    gt: jest.fn(() => query),
    is: jest.fn(() => query),
    in: jest.fn((_field: string, ids: string[]) => Promise.resolve({
      data: Object.values(users).filter(user => ids.includes(user.id)), error: null
    })),
    order: jest.fn(async () => {
      if (table !== 'messages') return { data: [], error: null };
      if (!mockNetworkConnected) {
        mockOfflinePollObserved = true;
        return { data: [], error: { message: 'network unavailable' } };
      }
      return { data: mockMessages, error: null };
    }),
    single: jest.fn(async () => ({ data: table === 'rooms' ? mockRoom : null, error: null })),
    maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    limit: jest.fn(async () => ({ data: [], error: null })),
    insert: jest.fn((data: Record<string, any>) => {
      if (table !== 'messages') return query;
      const savedMessage = makeMessage(`message-${mockMessages.length + 1}`, data.content, {
        id: data.user_id,
        display_name: data.user_role === 'tutor' ? users.tutor.display_name : users.student.display_name,
        current_role: data.user_role,
        avatar_url: null
      } as any);
      mockMessages.push({ ...savedMessage, ...data, created_at: savedMessage.created_at });
      const insertQuery: any = {
        select: jest.fn(() => insertQuery),
        single: jest.fn(async () => mockMessageInsertError
          ? { data: null, error: mockMessageInsertError }
          : { data: mockMessages[mockMessages.length - 1], error: null })
      };
      return insertQuery;
    }),
    update: jest.fn(() => query),
    upsert: jest.fn(async () => ({ data: null, error: null })),
    delete: jest.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
  };
  return query;
};

const registerRealtimeChannel = () => {
  const channel: any = {
    on: jest.fn((event: string, filter: any, callback: (payload: any) => void) => {
      const listener = { event, filter, callback, active: true, actor: currentActor, channel };
      realtimeListeners.push(listener);
      return channel;
    }),
    send: jest.fn(async (message: any) => {
      realtimeListeners
        .filter(listener => listener.active && listener.event === 'broadcast' && listener.filter.event === message.event)
        .forEach(listener => listener.callback({ payload: message.payload }));
      return 'ok';
    }),
    subscribe: jest.fn((callback?: (status: string) => void) => {
      callback?.('SUBSCRIBED');
      return channel;
    }),
    unsubscribe: jest.fn(() => {
      realtimeListeners.forEach(listener => { if (listener.channel === channel) listener.active = false; });
    })
  };
  channel.on.mockImplementation((event: string, filter: any, callback: (payload: any) => void) => {
    const listener = { event, filter, callback, active: true, actor: currentActor, channel };
    realtimeListeners.push(listener);
    return channel;
  });
  return channel;
};

const renderClient = (actor: keyof typeof users) => {
  currentActor = actor;
  const view = render(
    <MemoryRouter initialEntries={[`/room/${mockRoom.id}`]}>
      <MockAuthClientContext.Provider value={{ user: users[actor], loading: false }}>
        <RoomProvider>
          <Routes>
            <Route path="/room/:roomId" element={<RoomPagePost />} />
          </Routes>
        </RoomProvider>
      </MockAuthClientContext.Provider>
    </MemoryRouter>
  );
  roomClients[actor] = view;
  return view;
};

const ensureClient = async (actor: keyof typeof users) => {
  const view = roomClients[actor] || renderClient(actor);
  await within(view.container).findByText(mockRoom.title);
  return view;
};

const notifyMessageInsert = (message: any, disconnectedActors = new Set<keyof typeof users>()) => {
  realtimeListeners
    .filter(listener => listener.active && listener.event === 'postgres_changes'
      && listener.filter.table === 'messages' && !disconnectedActors.has(listener.actor))
    .forEach(listener => listener.callback({ new: message }));
};

const notifyFeedbackChange = (messageId: string) => {
  realtimeListeners
    .filter(listener => listener.active && listener.event === 'broadcast' && listener.filter.event === 'message_feedback_changed')
    .forEach(listener => listener.callback({ payload: { messageId } }));
};

const rateLatestTutorMessageAsStudent = async () => {
  const latestTutorMessage = [...mockMessages].reverse().find(message => message.user_role === 'tutor');
  if (!latestTutorMessage) throw new Error('Expected a tutor message to rate');

  const student = await ensureClient('student');
  fireEvent.click(within(student.container).getByTitle('Like this comment'));
  fireEvent.click(within(student.container).getByTitle('Rate 4 stars'));
  fireEvent.click(within(student.container).getByRole('button', { name: 'Submit Rating' }));
  await waitFor(() => expect(featureSubmitFeedback).toHaveBeenCalledWith(
    latestTutorMessage.id, users.student.id, mockRoom.id, 'like', 4
  ));
  act(() => notifyFeedbackChange(latestTutorMessage.id));
};

const sendMessageAs = async (actor: keyof typeof users, content: string) => {
  const view = await ensureClient(actor);
  const input = within(view.container).getByPlaceholderText('Write a comment...');
  fireEvent.change(input, { target: { value: content } });
  fireEvent.click(within(view.container).getByTitle('Send comment'));
  await waitFor(() => expect(mockMessages.some(message => message.content === content)).toBe(true));
  const sentMessage = mockMessages.find(message => message.content === content);
  act(() => notifyMessageInsert(sentMessage, mockNetworkConnected ? undefined : new Set<keyof typeof users>(['student'])));
  return sentMessage;
};

const defineBackground = (given: any, and: any) => {
  given('a "tutor" user "Tutor" exists and is logged in', () => {
    expect(users.tutor).toMatchObject({ display_name: 'Tutor', current_role: 'tutor' });
  });
  and('a "student" user "Student" exists and is logged in', () => {
    expect(users.student).toMatchObject({ display_name: 'Student', current_role: 'student' });
  });
  and('an "observer" user "Observer" exists and is logged in', () => {
    expect(users.observer).toMatchObject({ display_name: 'Observer', current_role: 'observer' });
  });
  and('the tutor has created a room called "Phishing 101"', () => {
    mockRoom = {
      id: 'room-1', title: 'Phishing 101', description: 'Learn about phishing attacks',
      tutor_id: users.tutor.id, created_by: users.tutor.id, is_active: true,
      ai_assistant_enabled: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    };
    expect(mockRoom.title).toBe('Phishing 101');
  });
  and('the student has joined the "Phishing 101" room', () => {
    roomMembers.add(users.student.id);
    expect(roomMembers.has(users.student.id)).toBe(true);
  });
  and('the observer has joined the "Phishing 101" room', () => {
    roomMembers.add(users.observer.id);
    expect(roomMembers.has(users.observer.id)).toBe(true);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRoom = null;
  mockMessages = [];
  mockFeedbackRows = [];
  mockNetworkConnected = true;
  mockOfflinePollObserved = false;
  mockMessageInsertError = null;
  roomMembers = new Set();
  roomClients = {};
  realtimeListeners = [];
  currentActor = 'tutor';
  Element.prototype.scrollIntoView = jest.fn();
  mockSupabase.from.mockImplementation((table: string) => makeQuery(table));
  mockSupabase.channel.mockImplementation(registerRealtimeChannel);
  featureValidateRoomPassword.mockResolvedValue(true);
  featureRoomFeedbackSummary.mockResolvedValue(null);
  featureFeedbackStats.mockImplementation(async (messageId: string) => feedbackStatsFor(messageId));
  featureUserFeedback.mockImplementation(async (messageId: string, userId: string) =>
    mockFeedbackRows.find(row => row.message_id === messageId && row.user_id === userId) || null);
  featureSubmitFeedback.mockImplementation(async (messageId: string, userId: string, _roomId: string, feedbackType: 'like' | 'dislike', rating: number) => {
    const current = mockFeedbackRows.find(row => row.message_id === messageId && row.user_id === userId);
    if (current) {
      current.feedback_type = feedbackType;
      current.rating = rating;
    } else {
      mockFeedbackRows.push({ message_id: messageId, user_id: userId, feedback_type: feedbackType, rating });
    }
  });
});

defineFeature(feature, test => {
  test('Tutor and Student can exchange messages', ({ given, when, then, and }) => {
    defineBackground(given, and);
    when('the tutor sends the message "Welcome to the session!"', async () => {
      await sendMessageAs('tutor', 'Welcome to the session!');
    });
    then('the student should see the message "Welcome to the session!" from the tutor', async () => {
      const student = await ensureClient('student');
      expect(within(student.container).getByText('Welcome to the session!')).toBeInTheDocument();
      expect(within(student.container).getByText('Tutor')).toBeInTheDocument();
    });
    and('the observer should see the message "Welcome to the session!" from the tutor', async () => {
      const observer = await ensureClient('observer');
      expect(within(observer.container).getByText('Welcome to the session!')).toBeInTheDocument();
      expect(within(observer.container).getByText('Tutor')).toBeInTheDocument();
    });
    and('the student rates the latest tutor message with a thumbs up and 4 stars', rateLatestTutorMessageAsStudent);
    when('the student sends the message "Hi, glad to be here."', async () => {
      await sendMessageAs('student', 'Hi, glad to be here.');
    });
    then('the tutor should see the message "Hi, glad to be here." from the student', async () => {
      const tutor = await ensureClient('tutor');
      expect(within(tutor.container).getByText('Hi, glad to be here.')).toBeInTheDocument();
      expect(within(tutor.container).getByText('Student')).toBeInTheDocument();
    });
    and('the observer should see the message "Hi, glad to be here." from the student', async () => {
      const observer = await ensureClient('observer');
      expect(within(observer.container).getByText('Hi, glad to be here.')).toBeInTheDocument();
      expect(within(observer.container).getByText('Student')).toBeInTheDocument();
    });
  });

  test('Messages appear immediately without page refresh', ({ given, when, then, and }) => {
    defineBackground(given, and);
    given('the tutor and student are both viewing the same room', async () => {
      await ensureClient('tutor');
      await ensureClient('student');
    });
    when('the tutor sends the message "Real-time test message"', async () => {
      await sendMessageAs('tutor', 'Real-time test message');
    });
    then('the student should see the message "Real-time test message" immediately without refreshing', async () => {
      const student = roomClients.student;
      expect(within(student.container).getByText('Real-time test message')).toBeInTheDocument();
    });
    and('the message should appear in the student\'s chat window within 2 seconds', async () => {
      await waitFor(() => expect(within(roomClients.student.container).getByText('Real-time test message')).toBeInTheDocument(), { timeout: 2000 });
    });
    and('the student rates the latest tutor message with a thumbs up and 4 stars', rateLatestTutorMessageAsStudent);
    when('the student sends the message "I can see it!"', async () => {
      await sendMessageAs('student', 'I can see it!');
    });
    then('the tutor should see the message "I can see it!" immediately without refreshing', () => {
      expect(within(roomClients.tutor.container).getByText('I can see it!')).toBeInTheDocument();
    });
    and('the message should appear in the tutor\'s chat window within 2 seconds', async () => {
      await waitFor(() => expect(within(roomClients.tutor.container).getByText('I can see it!')).toBeInTheDocument(), { timeout: 2000 });
    });
  });

  test('Message feedback appears immediately without page refresh', ({ given, and, when, then }) => {
    let feedbackMessage: any;
    defineBackground(given, and);
    given('the tutor, student, and observer are all viewing the same room', async () => {
      await ensureClient('tutor');
      await ensureClient('student');
      await ensureClient('observer');
    });
    and('the tutor has already sent the message "Please inspect the sender address carefully."', async () => {
      feedbackMessage = makeMessage('feedback-message', 'Please inspect the sender address carefully.', users.tutor);
      mockMessages.push(feedbackMessage);
      const clients = await Promise.all([ensureClient('tutor'), ensureClient('student'), ensureClient('observer')]);
      act(() => notifyMessageInsert(feedbackMessage));
      await waitFor(() => clients.forEach(client =>
        expect(within(client.container).getByText(feedbackMessage.content)).toBeInTheDocument()));
    });
    when('the student rates that message with a thumbs up and 4 stars', async () => {
      const student = roomClients.student;
      fireEvent.click(within(student.container).getByTitle('Like this comment'));
      fireEvent.click(within(student.container).getByTitle('Rate 4 stars'));
      fireEvent.click(within(student.container).getByRole('button', { name: 'Submit Rating' }));
      await waitFor(() => expect(featureSubmitFeedback).toHaveBeenCalledWith(feedbackMessage.id, users.student.id, mockRoom.id, 'like', 4));
      act(() => notifyFeedbackChange(feedbackMessage.id));
    });
    then('the tutor should see the updated thumbs up count immediately without refreshing', async () => {
      await waitFor(() => expect(within(roomClients.tutor.container).getByText('(4.0★)')).toBeInTheDocument());
    });
    and('the observer should see the updated thumbs up count immediately without refreshing', async () => {
      await waitFor(() => expect(within(roomClients.observer.container).getByText('(4.0★)')).toBeInTheDocument());
    });
    when('the student changes the rating for that message to a thumbs down and 2 stars', async () => {
      const student = roomClients.student;
      fireEvent.click(within(student.container).getByTitle('Dislike this comment'));
      fireEvent.click(within(student.container).getByTitle('Rate 2 stars'));
      fireEvent.click(within(student.container).getByRole('button', { name: 'Submit Rating' }));
      await waitFor(() => expect(featureSubmitFeedback).toHaveBeenLastCalledWith(feedbackMessage.id, users.student.id, mockRoom.id, 'dislike', 2));
      act(() => notifyFeedbackChange(feedbackMessage.id));
    });
    then('the tutor should see the updated thumbs down count immediately without refreshing', async () => {
      await waitFor(() => expect(within(roomClients.tutor.container).getByText('(2.0★)')).toBeInTheDocument());
    });
    and('the observer should see the updated thumbs down count immediately without refreshing', async () => {
      await waitFor(() => expect(within(roomClients.observer.container).getByText('(2.0★)')).toBeInTheDocument());
    });
  });

  test('Observer has read-only access to the chat', ({ given, then, and }) => {
    defineBackground(given, and);
    then('the chat composer should not be available to the observer', async () => {
      const observer = await ensureClient('observer');
      expect(within(observer.container).queryByPlaceholderText('Write a comment...')).toBeNull();
    });
    and('the send message button should not be available to the observer', () => {
      expect(within(roomClients.observer.container).queryByTitle('Send comment')).toBeNull();
    });
  });

  test('Chat history is preserved', ({ given, and, when, then }) => {
    let studentView: ReturnType<typeof render>;
    defineBackground(given, and);
    given('the tutor has sent the message "This is the first message."', async () => {
      await sendMessageAs('tutor', 'This is the first message.');
    });
    and('the student rates the latest tutor message with a thumbs up and 4 stars', rateLatestTutorMessageAsStudent);
    and('the student has sent the message "This is the second message."', async () => {
      await sendMessageAs('student', 'This is the second message.');
      studentView = roomClients.student;
    });
    when('the student leaves the room', () => {
      studentView.unmount();
      delete roomClients.student;
      expect(mockMessages.map(message => message.content)).toContain('This is the second message.');
    });
    and('the student rejoins the "Phishing 101" room', async () => {
      studentView = renderClient('student');
      await within(studentView.container).findByText(mockRoom.title);
    });
    then('the student should see the message "This is the first message." from the tutor', () => {
      expect(within(studentView.container).getByText('This is the first message.')).toBeInTheDocument();
    });
    and('the student should see the message "This is the second message." from the student', () => {
      expect(within(studentView.container).getByText('This is the second message.')).toBeInTheDocument();
    });
  });

  test('Typing indicators are shown between tutor and student', ({ given, and, when, then }) => {
    defineBackground(given, and);
    when('the student starts typing a message', async () => {
      await ensureClient('tutor');
      const student = await ensureClient('student');
      fireEvent.change(within(student.container).getByPlaceholderText('Write a comment...'), { target: { value: 'draft' } });
    });
    then('the tutor should see a typing indicator for the student', async () => {
      await waitFor(() => expect(roomClients.tutor.container.querySelector('.comments-list')?.textContent).toContain('Student is typing...'));
    });
    when('the student stops typing', () => {
      fireEvent.change(within(roomClients.student.container).getByPlaceholderText('Write a comment...'), { target: { value: '' } });
    });
    then('the tutor should not see a typing indicator for the student', async () => {
      await waitFor(() => expect(roomClients.tutor.container.querySelector('.comments-list')?.textContent).not.toContain('Student is typing...'));
    });
    when('the tutor starts typing a message', () => {
      fireEvent.change(within(roomClients.tutor.container).getByPlaceholderText('Write a comment...'), { target: { value: 'draft' } });
    });
    then('the student should see a typing indicator for the tutor', async () => {
      await waitFor(() => expect(roomClients.student.container.querySelector('.comments-list')?.textContent).toContain('Tutor is typing...'));
    });
    when('the tutor stops typing', () => {
      fireEvent.change(within(roomClients.tutor.container).getByPlaceholderText('Write a comment...'), { target: { value: '' } });
    });
    then('the student should not see a typing indicator for the student', async () => {
      await waitFor(() => expect(roomClients.student.container.querySelector('.comments-list')?.textContent).not.toContain('Student is typing...'));
      expect(roomClients.student.container.querySelector('.comments-list')?.textContent).not.toContain('Tutor is typing...');
    });
  });

  test('Offline message synchronization', ({ given, and, when, then }) => {
    defineBackground(given, and);
    given('the student is disconnected from the network', async () => {
      await ensureClient('tutor');
      await ensureClient('student');
      mockNetworkConnected = false;
      await waitFor(() => expect(mockOfflinePollObserved).toBe(true), { timeout: 3000 });
    });
    when('the tutor sends the message "Can you see this message?"', async () => {
      await sendMessageAs('tutor', 'Can you see this message?');
    });
    and('the student reconnects to the network', () => {
      mockNetworkConnected = true;
    });
    then('the student should see the message "Can you see this message?" from the tutor', async () => {
      await waitFor(() => expect(within(roomClients.student.container).getByText('Can you see this message?')).toBeInTheDocument(), { timeout: 5000 });
    });
  });
});

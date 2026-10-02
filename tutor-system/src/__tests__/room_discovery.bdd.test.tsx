#!/usr/bin/env node
// Binds room_discovery.feature to the student and observer dashboards and room page.
import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import StudentView from '../pages/StudentView';
import ObserverView from '../pages/ObserverView';
import RoomPagePost from '../pages/RoomPagePost';
import { BEHAVIOR_TEST_ROOM_MARKER } from '../utils/behaviorTestRooms';
import { getRoomsByObserver, joinRoomAsObserver, supabase } from '../services/supabase';

let mockAuthUser: any = null;
let mockRoomContextValue: any;

jest.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn()
    },
    from: jest.fn(),
    channel: jest.fn()
  },
  getRoomsByObserver: jest.fn(),
  joinRoomAsObserver: jest.fn()
}));

jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser, loading: false, signOut: jest.fn(), setUserRole: jest.fn() }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

jest.mock('../contexts/RoomContext', () => ({
  useRoom: () => mockRoomContextValue,
  RoomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const feature = loadFeature('./features/room_discovery.feature');
const tutor = {
  id: 'tutor-1', display_name: 'John Tutor', current_role: 'tutor', avatar_url: null,
  status: 'active', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
};
const jane = {
  id: 'jane-1', display_name: 'Jane Student', current_role: 'student', avatar_url: null,
  status: 'active', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
};
const bob = {
  id: 'bob-1', display_name: 'Bob Student', current_role: 'student', avatar_url: null,
  status: 'active', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
};
const alice = {
  id: 'alice-1', display_name: 'Alice Observer', current_role: 'observer', avatar_url: null,
  status: 'active', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z'
};
const makeRoom = (id: string, title: string, overrides: Record<string, unknown> = {}) => ({
  id,
  title,
  description: '',
  tutor_id: tutor.id,
  image_url: null,
  is_active: true,
  ai_assistant_enabled: false,
  ai_assistant_model: null,
  ai_assistant_prompt: null,
  pre_populated_dialogue: null,
  op_id: tutor.id,
  op_display_name: tutor.display_name,
  op_avatar_url: null,
  password: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  tutor,
  ...overrides
});
const mockSupabase = supabase as any;
let mockRooms: any[];
let mockSessions: any[];
let mockUsers: any[];
let realtimeCallbacks: Record<string, (payload: any) => void>;
let currentLocation: string;

const LocationReader = () => {
  currentLocation = useLocation().pathname;
  return null;
};

const TestRoutes = () => (
  <>
    <Routes>
      <Route path="/student" element={<StudentView />} />
      <Route path="/observer" element={<ObserverView />} />
      <Route path="/room/:roomId" element={<RoomPagePost />} />
    </Routes>
    <LocationReader />
  </>
);

const makeRoomContext = (room: any = null, messages: any[] = []) => ({
  currentRoom: room,
  messages,
  participants: [tutor, jane, bob, alice],
  messageFeedbackStats: {},
  loading: false,
  typingUsers: [],
  createRoom: jest.fn(),
  joinRoom: jest.fn().mockResolvedValue(undefined),
  leaveRoom: jest.fn().mockResolvedValue(undefined),
  sendMessage: jest.fn().mockResolvedValue(undefined),
  generateAIResponse: jest.fn(),
  regenerateAIResponse: jest.fn(),
  toggleAIAssistant: jest.fn(),
  startTyping: jest.fn(),
  stopTyping: jest.fn(),
  aiConfig: null,
  loadingAI: false,
  downloadChatHistory: jest.fn(),
  clearChatHistory: jest.fn(),
  aiSuggestion: null,
  clearAISuggestion: jest.fn(),
  aiInteractions: [],
  currentSuggestionContext: null,
  recordAIFeedback: jest.fn(),
  submitMessageFeedback: jest.fn(),
  getMessageFeedbackStats: jest.fn(),
  submitAssessmentAnswer: jest.fn(),
  assessmentAttempts: new Map(),
  assessmentAnswerSubmitting: false
});

const makeQuery = (table: string) => {
  const filters: Record<string, unknown> = {};
  const query: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn((field: string, value: unknown) => { filters[field] = value; return query; }),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockImplementation(async () => ({ data: mockRooms, error: null })),
    maybeSingle: jest.fn().mockImplementation(async () => ({
      data: mockSessions.find(session => session.room_id === filters.room_id && session.status === 'active') || null,
      error: null
    })),
    single: jest.fn().mockImplementation(async () => ({
      data: table === 'users'
        ? mockUsers.find(user => user.id === filters.id) || mockUsers.find(user => user.display_name === filters.display_name) || null
        : mockRooms.find(room => room.id === filters.id) || null,
      error: null
    })),
    insert: jest.fn((values: any) => ({
      select: jest.fn(async () => {
        if (table === 'sessions') mockSessions.push(values);
        return { data: [values], error: null };
      })
    })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const rows = table === 'sessions'
        ? mockSessions.filter(session => session.status === 'active' && session.student_id)
        : [];
      return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
    }
  };
  return query;
};

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <TestRoutes />
  </MemoryRouter>
);

const selectUser = (name: string, role: string) => {
  const users = [tutor, jane, bob, alice];
  const selected = users.find(user => user.display_name === name && user.current_role === role);
  if (!selected) throw new Error(`Unknown scenario user: ${name} (${role})`);
  mockAuthUser = selected;
};

const assertRoomTable = (roomCard: HTMLElement, title: string, rows: any[]) => {
  expect(within(roomCard).getByText(title)).toBeInTheDocument();
  rows.forEach((row: Record<string, string>) => {
    const [field, value] = Object.values(row);
    if (field === 'Tutor') {
      expect(within(roomCard).getByText('Tutor:')).toBeInTheDocument();
      expect(within(roomCard).getByText(value)).toBeInTheDocument();
    }
    if (field === 'Description') expect(within(roomCard).getByText(value)).toBeInTheDocument();
    if (field === 'Status') expect(within(roomCard).getByText(new RegExp(value))).toBeInTheDocument();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthUser = null;
  mockRooms = [];
  mockSessions = [];
  mockUsers = [tutor, jane, bob, alice];
  realtimeCallbacks = {};
  currentLocation = '';
  mockRoomContextValue = makeRoomContext();
  mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mockSupabase.auth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
  mockSupabase.from.mockImplementation((table: string) => makeQuery(table));
  mockSupabase.channel.mockImplementation(() => {
    const channel: any = {
      on: jest.fn((_event: string, config: any, callback: (payload: any) => void) => {
        if (config?.table === 'rooms' || config?.table === 'sessions') realtimeCallbacks[config.table] = callback;
        return channel;
      }),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn()
    };
    return channel;
  });
  (getRoomsByObserver as jest.Mock).mockImplementation(async () => mockRooms);
  (joinRoomAsObserver as jest.Mock).mockImplementation(async (roomId: string) => {
    if (mockRoomContextValue.currentRoom?.id === roomId) {
      mockRoomContextValue.currentRoom.observer_count = (mockRoomContextValue.currentRoom.observer_count || 0) + 1;
    }
    return { success: true };
  });
});

defineFeature(feature, test => {
  test('Student views available rooms', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => {
      expect(table).toEqual(expect.arrayContaining([
        expect.objectContaining({ display_name: 'John Tutor', role: 'tutor' }),
        expect.objectContaining({ display_name: 'Jane Student', role: 'student' })
      ]));
    });
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('the tutor "John Tutor" has created a room titled "Math Basics" with description "Introduction to algebra"', () => {
      mockRooms = [makeRoom('math-1', 'Math Basics', { description: 'Introduction to algebra' })];
    });
    when('I view the student dashboard', () => renderAt('/student'));
    then('I should see the available rooms section', async () => expect(await screen.findByRole('heading', { name: 'Available Rooms' })).toBeInTheDocument());
    and('I should see a room card with:', async (table: any[]) => {
      const roomCard = await screen.findByTestId('room-card-math-1');
      assertRoomTable(roomCard, 'Math Basics', table);
    });
  });

  test('Student sees waiting message when no rooms available', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('there are no active rooms', () => { mockRooms = []; });
    when('I view the student dashboard', () => renderAt('/student'));
    then('I should see "No rooms available"', async () => expect(await screen.findByText('No rooms available')).toBeInTheDocument());
    and('I should see "Please wait for a tutor to create a room"', () => {
      expect(screen.getByText('Please wait for a tutor to create a room.')).toBeInTheDocument();
    });
  });

  test('Student joins an available room', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('the tutor "John Tutor" has created a room titled "Physics 101"', () => {
      const room = makeRoom('physics-1', 'Physics 101');
      mockRooms = [room];
      mockRoomContextValue = makeRoomContext(room);
    });
    and('no other student has joined the room', () => expect(mockSessions).toHaveLength(0));
    when('I view the student dashboard', () => renderAt('/student'));
    and('I click "Join Room" on the "Physics 101" room card', async () => {
      const roomCard = await screen.findByTestId('room-card-physics-1');
      fireEvent.click(within(roomCard).getByRole('button', { name: 'Join Room' }));
    });
    then('I should be redirected to the room view', async () => waitFor(() => expect(currentLocation).toBe('/room/physics-1')));
    and('I should see "Physics 101" as the room title', async () => expect(await screen.findByRole('heading', { name: 'Physics 101' })).toBeInTheDocument());
    and('I should see "John Tutor" as the tutor name', () => expect(screen.getByText('John Tutor')).toBeInTheDocument());
    and('I should be able to send messages in the chat', async () => {
      const input = await screen.findByPlaceholderText('Write a comment...');
      fireEvent.change(input, { target: { value: 'I joined the room.' } });
      fireEvent.click(screen.getByTitle('Send comment'));
      await waitFor(() => expect(mockRoomContextValue.sendMessage).toHaveBeenCalledWith('I joined the room.', expect.any(Object)));
    });
  });

  test('Student cannot join a full room', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('the tutor "John Tutor" has created a room titled "Chemistry Lab"', () => {
      mockRooms = [makeRoom('chemistry-1', 'Chemistry Lab')];
    });
    and('the student "Bob Student" has already joined the room', () => {
      mockSessions = [{ room_id: 'chemistry-1', student_id: bob.id, status: 'active' }];
    });
    when('I view the student dashboard', () => renderAt('/student'));
    then('I should see the "Chemistry Lab" room card', async () => expect(await screen.findByTestId('room-card-chemistry-1')).toBeInTheDocument());
    and('the room card should show "Room Full" status', () => {
      expect(within(screen.getByTestId('room-card-chemistry-1')).getByText(/Room Full/)).toBeInTheDocument();
    });
    and('the "Join Room" button should be disabled', () => {
      expect(within(screen.getByTestId('room-card-chemistry-1')).getByRole('button', { name: 'Join Room' })).toBeDisabled();
    });
  });

  test('Observer views available rooms', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Alice Observer" with role "observer"', () => selectUser('Alice Observer', 'observer'));
    and('the tutor "John Tutor" has created a room titled "History Class"', () => {
      mockRooms = [makeRoom('history-1', 'History Class')];
    });
    when('I view the observer dashboard', () => renderAt('/observer'));
    then('I should see the available rooms section', async () => expect(await screen.findByRole('heading', { name: 'Available Rooms' })).toBeInTheDocument());
    and('I should see a room card for "History Class"', async () => expect(await screen.findByTestId('room-card-history-1')).toBeInTheDocument());
  });

  test('Observer joins a room as read-only', ({ given, and, when, then, but }) => {
    const room = makeRoom('english-1', 'English Literature', { observer_count: 0 });
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Alice Observer" with role "observer"', () => selectUser('Alice Observer', 'observer'));
    and('the tutor "John Tutor" has created a room titled "English Literature"', () => {
      mockRooms = [room];
      mockRoomContextValue = makeRoomContext(room, [{
        id: 'msg-1', room_id: room.id, user_id: jane.id, user_role: 'student',
        content: 'A student message', created_at: '2026-01-01T00:00:00.000Z', display_name: jane.display_name
      }]);
    });
    and('the student "Jane Student" has joined the room', () => {
      mockSessions = [{ room_id: room.id, student_id: jane.id, status: 'active' }];
    });
    when('I view the observer dashboard', () => renderAt('/observer'));
    and('I click "Join" on the "English Literature" room card', async () => {
      const roomCard = await screen.findByTestId('room-card-english-1');
      expect(within(roomCard).getByRole('button', { name: 'Join' })).toBeInTheDocument();
      fireEvent.click(within(roomCard).getByRole('button', { name: 'Join' }));
    });
    then('I should be redirected to the room view', async () => waitFor(() => expect(currentLocation).toBe('/room/english-1')));
    and('I should see "English Literature" as the room title', async () => expect(await screen.findByRole('heading', { name: 'English Literature' })).toBeInTheDocument());
    and('I should see the chat messages', () => expect(screen.getByText('A student message')).toBeInTheDocument());
    but('I should not see the message input field', () => expect(screen.queryByPlaceholderText('Write a comment...')).not.toBeInTheDocument());
    and('I should see "You are in observer mode. You can view the conversation but cannot participate."', () => {
      expect(screen.getByText(/You are in observer mode\. You can view the conversation but cannot participate\./)).toBeInTheDocument();
    });
  });

  test('Multiple observers can join the same room', ({ given, and, when, then }) => {
    const room = makeRoom('science-1', 'Science Lab', { observer_count: 3 });
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Alice Observer" with role "observer"', () => selectUser('Alice Observer', 'observer'));
    and('the tutor "John Tutor" has created a room titled "Science Lab"', () => {
      mockRooms = [room];
      mockRoomContextValue = makeRoomContext(room);
    });
    and('the student "Jane Student" has joined the room', () => {
      mockSessions = [{ room_id: room.id, student_id: jane.id, status: 'active' }];
    });
    and('3 observers have already joined the room', () => expect(mockRoomContextValue.currentRoom.observer_count).toBe(3));
    when('I view the observer dashboard', () => renderAt('/observer'));
    and('I click "Join" on the "Science Lab" room card', async () => {
      const roomCard = await screen.findByTestId('room-card-science-1');
      expect(within(roomCard).getByRole('button', { name: 'Join' })).toBeInTheDocument();
      fireEvent.click(within(roomCard).getByRole('button', { name: 'Join' }));
    });
    then('I should successfully join the room as an observer', async () => {
      await waitFor(() => expect(joinRoomAsObserver).toHaveBeenCalledWith(room.id, alice.id));
    });
    and('I should see "4 observers" in the room info', async () => {
      expect(await screen.findByText('4 observers')).toBeInTheDocument();
    });
  });

  test('Room list updates in real-time', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('I am viewing the student dashboard', () => renderAt('/student'));
    and('there are no active rooms', () => expect(mockRooms).toHaveLength(0));
    when('the tutor "John Tutor" creates a new room titled "Calculus Help"', async () => {
      await waitFor(() => expect(realtimeCallbacks.rooms).toEqual(expect.any(Function)), { timeout: 5000 });
      const newRoom = makeRoom('calculus-1', 'Calculus Help');
      mockRooms = [newRoom];
      await act(async () => realtimeCallbacks.rooms({ eventType: 'INSERT', new: newRoom }));
    });
    then('I should see the "Calculus Help" room appear without refreshing', async () => {
      expect(await screen.findByTestId('room-card-calculus-1')).toBeInTheDocument();
    });
    and('the room card should show as "Available"', () => {
      expect(within(screen.getByTestId('room-card-calculus-1')).getByText(/Available/)).toBeInTheDocument();
    });
  });

  test('Student sees room status change in real-time', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('the tutor "John Tutor" has created a room titled "Programming 101"', () => {
      mockRooms = [makeRoom('programming-1', 'Programming 101')];
    });
    and('I am viewing the student dashboard', () => renderAt('/student'));
    when('another student "Bob Student" joins the "Programming 101" room', async () => {
      await waitFor(() => expect(realtimeCallbacks.sessions).toEqual(expect.any(Function)), { timeout: 5000 });
      const session = { room_id: 'programming-1', student_id: bob.id, status: 'active' };
      mockSessions = [session];
      await act(async () => realtimeCallbacks.sessions({ eventType: 'INSERT', new: session }));
    });
    then('I should see the room status change to "Room Full"', async () => {
      expect(await screen.findByText(/Room Full/)).toBeInTheDocument();
    });
    and('the "Join Room" button should become disabled', () => {
      expect(screen.getByRole('button', { name: 'Join Room' })).toBeDisabled();
    });
  });

  test('Room displays preview image', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('the tutor "John Tutor" has created a room titled "Art History" with image "art-history.jpg"', () => {
      mockRooms = [makeRoom('art-1', 'Art History', {
        image_url: 'https://storage.example.com/art-history.jpg', description: 'Study of classical art'
      })];
    });
    when('I view the student dashboard', () => renderAt('/student'));
    then('I should see the room card for "Art History"', async () => expect(await screen.findByTestId('room-card-art-1')).toBeInTheDocument());
    and('the room card should display the "art-history.jpg" preview image', () => {
      expect(screen.getByAltText('Art History')).toHaveAttribute('src', 'https://storage.example.com/art-history.jpg');
    });
  });

  test('Student does not discover behavior-test or DemoTutor harness rooms', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('the tutor "John Tutor" has created a room titled "Math Basics" with description "Introduction to algebra"', () => {
      mockRooms = [makeRoom('math-2', 'Math Basics', { description: 'Introduction to algebra' })];
    });
    and('a behavior-test room titled "Demo: Lock Icon Myth" exists', () => {
      mockRooms.push(makeRoom('demo-room', 'Demo: Lock Icon Myth'));
    });
    and('a behavior-test room titled "Internal Eval" is tagged with the behavior-test marker', () => {
      mockRooms.push(makeRoom('marked-room', 'Internal Eval', { description: BEHAVIOR_TEST_ROOM_MARKER }));
    });
    and('the harness tutor "DemoTutor_615166" has created a room titled "Account Security Alert Scam"', () => {
      mockRooms.push(makeRoom('harness-room', 'Account Security Alert Scam', {
        tutor: { ...tutor, display_name: 'DemoTutor_615166' }
      }));
    });
    when('I view the student dashboard', () => renderAt('/student'));
    then('I should see the available rooms section', async () => expect(await screen.findByRole('heading', { name: 'Available Rooms' })).toBeInTheDocument());
    and('I should see a room card with:', async (table: any[]) => {
      const roomCard = await screen.findByTestId('room-card-math-2');
      assertRoomTable(roomCard, 'Math Basics', table);
    });
    and('I should not see a room titled "Demo: Lock Icon Myth"', () => expect(screen.queryByText('Demo: Lock Icon Myth')).not.toBeInTheDocument());
    and('I should not see a room titled "Internal Eval"', () => expect(screen.queryByText('Internal Eval')).not.toBeInTheDocument());
    and('I should not see tutor "DemoTutor_615166" on the student dashboard', () => {
      expect(screen.queryByText('DemoTutor_615166')).not.toBeInTheDocument();
    });
  });

  test('Student still discovers classic teaching rooms from real tutors', ({ given, and, when, then }) => {
    given('the system has the following users:', (table: any[]) => expect(table).toHaveLength(4));
    given('I am logged in as "Jane Student" with role "student"', () => selectUser('Jane Student', 'student'));
    and('the tutor "Adele" has created a room titled "Secure Email Basics" with description "class period 4 with Adele"', () => {
      const adele = { ...tutor, id: 'adele-1', display_name: 'Adele' };
      mockRooms = [makeRoom('classic-1', 'Secure Email Basics', {
        description: 'class period 4 with Adele', tutor_id: adele.id, tutor: adele
      })];
    });
    when('I view the student dashboard', () => renderAt('/student'));
    then('I should see a room card for "Secure Email Basics"', async () => {
      expect(await screen.findByTestId('room-card-classic-1')).toBeInTheDocument();
    });
    and('I should see tutor "Adele" on the student dashboard', () => expect(screen.getByText('Adele')).toBeInTheDocument());
  });
});

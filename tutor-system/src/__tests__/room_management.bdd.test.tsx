#!/usr/bin/env node
// Binds room_management.feature to the tutor form, room cards, and password access flow.
import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import TutorView from '../pages/TutorView';
import RoomPagePost from '../pages/RoomPagePost';
import { RoomProvider } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import * as supabaseService from '../services/supabase';

jest.mock('../services/supabase');
jest.mock('../contexts/AuthContext', () => ({
  ...jest.requireActual('../contexts/AuthContext'),
  useAuth: jest.fn()
}));

const feature = loadFeature('./features/room_management.feature');
const mockUseAuth = useAuth as jest.Mock;
const mockCreateRoom = jest.fn();
const mockGetRoomsByTutor = jest.fn();
const mockGetRoomTemplatesByTutor = jest.fn();
const mockValidateRoomPassword = jest.fn();

const tutor = {
  id: 'tutor-1',
  email: 'tutor@example.com',
  display_name: 'John Tutor',
  current_role: 'tutor' as const,
  status: 'active' as const,
  avatar_url: 'https://example.com/tutor.png',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};
const student = {
  ...tutor,
  id: 'student-1',
  email: 'student@example.com',
  display_name: 'Jane Student',
  current_role: 'student' as const
};
const observer = {
  ...tutor,
  id: 'observer-1',
  email: 'observer@example.com',
  display_name: 'Alex Observer',
  current_role: 'observer' as const
};
const makeRoom = (id: string, title: string, values: Record<string, unknown> = {}) => ({
  id,
  tutor_id: tutor.id,
  title,
  description: '',
  image_url: null,
  is_active: true,
  ai_assistant_enabled: false,
  ai_assistant_model: null,
  ai_assistant_prompt: null,
  pre_populated_dialogue: null,
  op_id: tutor.id,
  op_display_name: tutor.display_name,
  op_avatar_url: tutor.avatar_url,
  password: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...values
});

const roomChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn()
};

let mockRoomRows: any[];
let currentView: ReturnType<typeof render> | null;
let currentLocation: string;

const LocationReader = () => {
  currentLocation = useLocation().pathname;
  return null;
};

const renderTutorDashboard = () => {
  currentView = render(
    <MemoryRouter initialEntries={['/tutor']}>
      <Routes>
        <Route path="/tutor" element={<TutorView />} />
      </Routes>
    </MemoryRouter>
  );
  return currentView;
};

const renderRoomPage = (user: typeof tutor | typeof student | typeof observer, room: ReturnType<typeof makeRoom>) => {
  currentView?.unmount();
  mockUseAuth.mockReturnValue({ user, loading: false });
  currentView = render(
    <MemoryRouter initialEntries={[`/room/${room.id}`]}>
      <RoomProvider>
        <Routes>
          <Route path="/room/:roomId" element={<RoomPagePost />} />
          <Route path="/" element={<h1>Home</h1>} />
        </Routes>
        <LocationReader />
      </RoomProvider>
    </MemoryRouter>
  );
  return currentView;
};

const openCreateForm = async () => {
  if (!screen.queryByRole('form', { name: /create room form/i })) {
    fireEvent.click(await screen.findByRole('button', { name: /Create a new Room/i }));
  }
  return screen.findByRole('form', { name: /create room form/i });
};

const enterRoomDetails = (title: string, description = '') => {
  fireEvent.change(screen.getByLabelText('Room Title'), { target: { value: title } });
  if (description) {
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: description } });
  }
};

const submitRoomForm = async () => {
  fireEvent.click(screen.getByText('🚀 Create Room'));
  await waitFor(() => expect(mockCreateRoom).toHaveBeenCalled());
};

const makeSupabaseQuery = (table: string) => {
  const filters: Record<string, unknown> = {};
  const query: any = {
    select: jest.fn(() => query),
    eq: jest.fn((field: string, value: unknown) => { filters[field] = value; return query; }),
    neq: jest.fn(() => query),
    not: jest.fn(() => query),
    in: jest.fn(async (_field: string, ids: string[]) => ({
      data: [tutor, student, observer].filter(user => ids.includes(user.id)),
      error: null
    })),
    order: jest.fn(async () => ({ data: [], error: null })),
    single: jest.fn(async () => ({
      data: table === 'rooms' ? mockRoomRows.find(room => room.id === filters.id) || null : null,
      error: null
    })),
    maybeSingle: jest.fn(async () => ({ data: null, error: null })),
    limit: jest.fn(async () => ({ data: [], error: null })),
    insert: jest.fn(() => query),
    update: jest.fn(() => query),
    upsert: jest.fn(async () => ({ data: null, error: null })),
    delete: jest.fn(() => query),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject)
  };
  return query;
};

beforeEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockRoomRows = [];
  currentView = null;
  currentLocation = '';

  const supabase = supabaseService.supabase as any;
  supabase.auth = { getSession: jest.fn(), onAuthStateChange: jest.fn() };
  supabase.from = jest.fn((table: string) => makeSupabaseQuery(table));
  supabase.channel = jest.fn(() => roomChannel);
  roomChannel.on.mockReturnThis();
  roomChannel.subscribe.mockReturnThis();

  (supabaseService.createRoom as jest.Mock) = mockCreateRoom;
  (supabaseService.getRoomsByTutor as jest.Mock) = mockGetRoomsByTutor;
  (supabaseService.getRoomTemplatesByTutor as jest.Mock) = mockGetRoomTemplatesByTutor;
  (supabaseService.validateRoomPassword as jest.Mock) = mockValidateRoomPassword;
  mockGetRoomTemplatesByTutor.mockResolvedValue([]);
  mockGetRoomsByTutor.mockImplementation(async () => [...mockRoomRows]);
  mockCreateRoom.mockImplementation(async (values: Record<string, unknown>) => {
    const room = makeRoom(`created-${mockRoomRows.length + 1}`, String(values.title), {
      ...values,
      created_at: new Date(2026, 0, mockRoomRows.length + 1).toISOString()
    });
    mockRoomRows.push(room);
    return room;
  });
  mockValidateRoomPassword.mockImplementation(async (_roomId: string, password: string) => ({
    success: password === 'SecurePass123' || password === 'MyPass123',
    message: password === 'SecurePass123' || password === 'MyPass123' ? 'Password correct' : 'Incorrect password'
  }));
  mockUseAuth.mockReturnValue({ user: tutor, loading: false });

  const nativeSetTimeout = global.setTimeout;
  jest.spyOn(global, 'setTimeout').mockImplementation(((handler: TimerHandler, timeout?: number, ...args: any[]) => {
    if (timeout === 1500) return 0 as any;
    return (nativeSetTimeout as any)(handler, timeout, ...args);
  }) as typeof global.setTimeout);
});

afterEach(() => {
  jest.restoreAllMocks();
});

defineFeature(feature, test => {
  const tutorBackground = (given: any, and: any) => {
    given('the Supabase authentication system is configured', () => {
      expect(supabaseService.supabase.auth).toBeDefined();
    });
    and('the user is authenticated as a tutor', () => {
      mockUseAuth.mockReturnValue({ user: tutor, loading: false });
    });
    and('preset room images are available', async () => {
      renderTutorDashboard();
      await openCreateForm();
      expect(screen.getByTestId('preset-images-container').children).toHaveLength(6);
    });
  };

  test('Tutor creates a basic room without image', ({ given, when, and, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    and('I enter room title "Introduction to Python"', () => enterRoomDetails('Introduction to Python'));
    and('I enter room description "Basic Python programming concepts for beginners"', () => {
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Basic Python programming concepts for beginners' } });
    });
    and('I submit the room creation form', submitRoomForm);
    then('a new room should be created in the database', () => {
      expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ title: 'Introduction to Python' }));
    });
    and('the room should be visible in the room list', async () => {
      expect(await screen.findByText('Introduction to Python')).toBeInTheDocument();
    });
    and('the room should have the correct title and description', () => {
      expect(mockRoomRows[0]).toMatchObject({
        title: 'Introduction to Python',
        description: 'Basic Python programming concepts for beginners'
      });
    });
    and('the room should be marked as active', () => {
      expect(within(screen.getByTestId('room-item')).getByText('🟢 Active')).toBeInTheDocument();
    });
  });

  test('Tutor creates a room with preset image selection', ({ given, when, and, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    and('I enter room title "Advanced JavaScript"', () => enterRoomDetails('Advanced JavaScript'));
    and('I enter room description "Advanced JavaScript concepts and patterns"', () => {
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Advanced JavaScript concepts and patterns' } });
    });
    and('I select a preset image "phishing_1.png"', () => fireEvent.click(screen.getByTestId('preset-image-phishing-1')));
    and('I submit the room creation form', submitRoomForm);
    then('a new room should be created with the selected preset image', () => {
      expect(mockRoomRows[0]).toMatchObject({
        title: 'Advanced JavaScript',
        image_url: '/images/room-presets/phishing_1.png'
      });
    });
    and('the room should display the selected preset image', async () => {
      expect(await screen.findByAltText('Advanced JavaScript')).toHaveAttribute('src', '/images/room-presets/phishing_1.png');
    });
    and('the image should be accessible via the preset image URL', () => {
      expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ image_url: '/images/room-presets/phishing_1.png' }));
    });
  });

  test('Preset image selection validation', ({ given, when, then, and }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    and('I view the available preset images', () => expect(screen.getByTestId('preset-images-container')).toBeVisible());
    then('I should see a selection of curated room images', () => {
      expect(screen.getAllByTestId(/^preset-image-/)).toHaveLength(6);
    });
    and('each image should have a descriptive name', () => {
      expect(screen.getByAltText('Phishing Training 1')).toBeInTheDocument();
      expect(screen.getByAltText('Privacy Training 1')).toBeInTheDocument();
      expect(screen.getByAltText('Default Room')).toBeInTheDocument();
    });
    and('I should be able to select one image option', () => {
      fireEvent.click(screen.getByTestId('preset-image-phishing-2'));
      expect(screen.getByTestId('preset-image-phishing-2')).toHaveClass('selected');
    });
  });

  test('Room creation without image selection', ({ given, when, and, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    and('I enter room title "Mathematics Basics"', () => enterRoomDetails('Mathematics Basics'));
    and('I enter room description "Fundamental mathematics concepts"', () => {
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Fundamental mathematics concepts' } });
    });
    and('I do not select any preset image', () => {
      expect(screen.queryByTestId('selected-image-preview')).not.toBeInTheDocument();
    });
    and('I submit the room creation form', submitRoomForm);
    then('a new room should be created with a default image', () => {
      expect(mockRoomRows[0]).toMatchObject({ image_url: '/images/room-presets/privacy_3.png' });
    });
    and('the room should display the default placeholder image', async () => {
      expect(await screen.findByAltText('Mathematics Basics')).toHaveAttribute('src', '/images/room-presets/privacy_3.png');
    });
  });

  test('Room creation form validation', ({ given, when, and, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    and('I leave the room title empty', () => expect(screen.getByLabelText('Room Title')).toHaveValue(''));
    and('I submit the room creation form', () => fireEvent.click(screen.getByText('🚀 Create Room')));
    then('I should see a validation error "Room title is required"', async () => {
      expect(await screen.findAllByText('Room title is required')).not.toHaveLength(0);
    });
    and('the room should not be created', () => expect(mockCreateRoom).not.toHaveBeenCalled());
  });

  test('Multiple room creation', ({ given, and, when, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    and('I have already created a room "Math Basics"', async () => {
      enterRoomDetails('Math Basics', 'Foundational math');
      await submitRoomForm();
      expect(await screen.findByText('Math Basics')).toBeInTheDocument();
    });
    when('I create another room "Science Fundamentals"', async () => {
      await openCreateForm();
      enterRoomDetails('Science Fundamentals', 'Introductory science');
      await submitRoomForm();
    });
    then('both rooms should be visible in the room list', async () => {
      expect(await screen.findByText('Science Fundamentals')).toBeInTheDocument();
      expect(screen.getByText('Math Basics')).toBeInTheDocument();
    });
    and('each room should maintain its own metadata', () => {
      expect(mockRoomRows).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: 'Math Basics', description: 'Foundational math' }),
        expect.objectContaining({ title: 'Science Fundamentals', description: 'Introductory science' })
      ]));
    });
    and('the rooms should be listed in creation order', () => {
      expect(screen.getAllByTestId('room-item').map(room => within(room).getByRole('heading').textContent)).toEqual([
        'Math Basics', 'Science Fundamentals'
      ]);
    });
  });

  test('Preset image display', ({ given, when, then, and }) => {
    tutorBackground(given, and);
    given('preset images are loaded', () => expect(screen.getByTestId('preset-images-container').children).toHaveLength(6));
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    then('I should see a grid of available preset images', () => expect(screen.getByTestId('preset-images-container')).toBeVisible());
    and('each image should be clearly labeled', () => {
      expect(screen.getByAltText('Phishing Training 1')).toBeInTheDocument();
      expect(screen.getByAltText('Privacy Training 2')).toBeInTheDocument();
    });
    and('I should be able to preview each image before selection', () => {
      fireEvent.click(screen.getByTestId('preset-image-privacy-1'));
      const preview = screen.getByTestId('selected-image-preview');
      expect(within(preview).getByAltText('Privacy Training 1')).toHaveAttribute('src', '/images/room-presets/privacy_1.png');
    });
  });

  test('Image selection feedback', ({ given, when, and, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    and('I select a preset image "privacy_1.png"', () => fireEvent.click(screen.getByTestId('preset-image-privacy-1')));
    then('the selected image should be highlighted', () => expect(screen.getByTestId('preset-image-privacy-1')).toHaveClass('selected'));
    and('I should see a preview of the selected image', () => {
      expect(within(screen.getByTestId('selected-image-preview')).getByAltText('Privacy Training 1')).toBeInTheDocument();
    });
    and('the image name should be displayed', () => expect(screen.getByText('Selected: Privacy Training 1')).toBeInTheDocument());
  });

  test('Default image handling', ({ given, when, then, and }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I create a room without selecting any preset image', async () => {
      enterRoomDetails('Default Image Room');
      await submitRoomForm();
    });
    then('the system should assign a default room image', () => {
      expect(mockRoomRows[0].image_url).toBe('/images/room-presets/privacy_3.png');
    });
    and('the default image should be appropriate for educational content', () => {
      expect(mockRoomRows[0].image_url).toMatch(/room-presets\/privacy_3\.png$/);
    });
    and('the room should be created successfully', async () => {
      expect(await screen.findByText('Room created successfully')).toBeInTheDocument();
    });
  });

  test('Tutor creates a password-protected room', ({ given, when, and, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', async () => expect(await openCreateForm()).toBeInTheDocument());
    and('I enter room title "Private Study Session"', () => enterRoomDetails('Private Study Session'));
    and('I enter room description "Advanced topics requiring password access"', () => {
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Advanced topics requiring password access' } });
    });
    and('I enable password protection', () => fireEvent.click(screen.getByText('Enable password protection for this room')));
    and('I enter room password "SecurePass123"', () => {
      fireEvent.change(screen.getByLabelText('Room Password'), { target: { value: 'SecurePass123' } });
    });
    and('I submit the room creation form', submitRoomForm);
    then('a new password-protected room should be created', () => {
      expect(mockRoomRows[0]).toMatchObject({ title: 'Private Study Session', password: 'SecurePass123' });
    });
    and('the room password should be visible in my room list', async () => {
      expect(await screen.findByText('SecurePass123')).toBeInTheDocument();
    });
    and('the password should be displayed in a monospace font', () => {
      expect(screen.getByText('SecurePass123')).toHaveClass('password-display');
    });
  });

  test('Room owner bypasses password protection', ({ given, and, when, then }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    and('I have created a password-protected room "Private Session" with password "MyPass123"', async () => {
      enterRoomDetails('Private Session');
      fireEvent.click(screen.getByText('Enable password protection for this room'));
      fireEvent.change(screen.getByLabelText('Room Password'), { target: { value: 'MyPass123' } });
      await submitRoomForm();
      expect(mockRoomRows[0]).toMatchObject({ title: 'Private Session', password: 'MyPass123' });
    });
    when('I click to enter my own room', () => renderRoomPage(tutor, mockRoomRows[0]));
    then('I should enter the room directly without password prompt', async () => {
      expect(await screen.findByText('Private Session')).toBeInTheDocument();
      expect(screen.queryByText('🔒 Password Required')).not.toBeInTheDocument();
    });
    and('I should see the room content immediately', () => {
      expect(screen.getByText('Private Session')).toBeInTheDocument();
    });
  });

  test('Non-owner attempts to join password-protected room', ({ given, and, when, then }) => {
    tutorBackground(given, and);
    given('a password-protected room exists with password "SecurePass123"', () => {
      mockRoomRows = [makeRoom('protected-room', 'Protected Session', { password: 'SecurePass123' })];
    });
    and('I am logged in as a student', () => mockUseAuth.mockReturnValue({ user: student, loading: false }));
    when('I attempt to join the password-protected room', () => renderRoomPage(student, mockRoomRows[0]));
    then('I should see a password prompt modal', async () => {
      expect(await screen.findByText('🔒 Password Required')).toBeInTheDocument();
    });
    and('the modal should display "This room is password protected. Please enter the password to continue."', () => {
      expect(screen.getByText('This room is password protected. Please enter the password to continue.')).toBeInTheDocument();
    });
    and('the modal should have a password input field', () => expect(screen.getByPlaceholderText('Enter password')).toHaveAttribute('type', 'password'));
  });

  test('Entering correct password for room access', ({ given, and, when, then }) => {
    tutorBackground(given, and);
    given('a password-protected room exists with password "SecurePass123"', () => {
      mockRoomRows = [makeRoom('protected-room', 'Protected Session', { password: 'SecurePass123' })];
    });
    and('I am logged in as an observer', () => mockUseAuth.mockReturnValue({ user: observer, loading: false }));
    and('I see the password prompt modal', async () => {
      renderRoomPage(observer, mockRoomRows[0]);
      expect(await screen.findByText('🔒 Password Required')).toBeInTheDocument();
    });
    when('I enter the password "SecurePass123"', () => {
      fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'SecurePass123' } });
    });
    and('I click "Join Room"', () => fireEvent.click(screen.getByRole('button', { name: 'Join Room' })));
    then('I should successfully enter the room', async () => {
      expect(await screen.findByText('Protected Session')).toBeInTheDocument();
    });
    and('the password prompt should disappear', () => expect(screen.queryByText('🔒 Password Required')).not.toBeInTheDocument());
    and('I should see the room content', () => expect(screen.getByText('Protected Session')).toBeInTheDocument());
  });

  test('Entering incorrect password for room access', ({ given, and, when, then }) => {
    tutorBackground(given, and);
    given('a password-protected room exists with password "SecurePass123"', () => {
      mockRoomRows = [makeRoom('protected-room', 'Protected Session', { password: 'SecurePass123' })];
    });
    and('I am logged in as a student', () => mockUseAuth.mockReturnValue({ user: student, loading: false }));
    and('I see the password prompt modal', async () => {
      renderRoomPage(student, mockRoomRows[0]);
      expect(await screen.findByText('🔒 Password Required')).toBeInTheDocument();
    });
    when('I enter the password "WrongPassword"', () => {
      fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'WrongPassword' } });
    });
    and('I click "Join Room"', () => fireEvent.click(screen.getByRole('button', { name: 'Join Room' })));
    then('I should see an error message "Incorrect password. Please try again."', async () => {
      expect(await screen.findByText('Incorrect password. Please try again.')).toBeInTheDocument();
    });
    and('the password prompt should remain open', () => expect(screen.getByText('🔒 Password Required')).toBeInTheDocument());
    and('the password field should be cleared', () => expect(screen.getByPlaceholderText('Enter password')).toHaveValue(''));
    and('I should be able to retry entering the password', async () => {
      fireEvent.change(screen.getByPlaceholderText('Enter password'), { target: { value: 'SecurePass123' } });
      fireEvent.click(screen.getByRole('button', { name: 'Join Room' }));
      expect(await screen.findByText('Protected Session')).toBeInTheDocument();
    });
  });

  test('Canceling password prompt', ({ given, and, when, then }) => {
    tutorBackground(given, and);
    given('a password-protected room exists', () => {
      mockRoomRows = [makeRoom('protected-room', 'Protected Session', { password: 'SecurePass123' })];
    });
    and('I am logged in as a student', () => mockUseAuth.mockReturnValue({ user: student, loading: false }));
    and('I see the password prompt modal', async () => {
      renderRoomPage(student, mockRoomRows[0]);
      expect(await screen.findByText('🔒 Password Required')).toBeInTheDocument();
    });
    when('I click "Cancel"', () => fireEvent.click(screen.getByRole('link', { name: 'Cancel' })));
    then('I should be redirected to the home page', async () => {
      await waitFor(() => expect(currentLocation).toBe('/'));
      expect(screen.getByRole('heading', { name: 'Home' })).toBeInTheDocument();
    });
    and('I should not enter the room', () => expect(screen.queryByText('Protected Session')).not.toBeInTheDocument());
  });

  test('Room without password protection', ({ given, when, then, and }) => {
    tutorBackground(given, and);
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I create a room without enabling password protection', async () => {
      enterRoomDetails('Open Study Room');
      await submitRoomForm();
    });
    then('the room should be created without a password', () => {
      expect(mockRoomRows[0]).toMatchObject({ title: 'Open Study Room', password: null });
    });
    and('any authenticated user should be able to join without password prompt', async () => {
      const view = renderRoomPage(student, mockRoomRows[0]);
      expect(await within(view.container).findByText('Open Study Room')).toBeInTheDocument();
      expect(within(view.container).queryByText('🔒 Password Required')).not.toBeInTheDocument();
    });
    and('the room card should display "No password" in the password field', async () => {
      currentView?.unmount();
      mockUseAuth.mockReturnValue({ user: tutor, loading: false });
      renderTutorDashboard();
      expect(await screen.findByText('No password')).toBeInTheDocument();
    });
  });
});

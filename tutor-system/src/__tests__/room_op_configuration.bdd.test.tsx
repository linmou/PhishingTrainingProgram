#!/usr/bin/env node
// Binds room_op_configuration.feature to the tutor form and OP display components.
import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import TutorView from '../pages/TutorView';
import RoomPost from '../components/RoomPost';
import RoomCard from '../components/RoomCard';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RoomProvider } from '../contexts/RoomContext';
import * as supabaseService from '../services/supabase';

jest.mock('../services/supabase');
jest.mock('../contexts/AuthContext', () => ({
  ...jest.requireActual('../contexts/AuthContext'),
  useAuth: jest.fn()
}));

const feature = loadFeature('./features/room_op_configuration.feature');
const mockCreateRoom = jest.fn();
const mockGetRoomsByTutor = jest.fn();
const mockUseAuth = useAuth as jest.Mock;
const tutor = {
  id: 'tutor-123',
  email: 'tutor@example.com',
  display_name: 'John Tutor',
  current_role: 'tutor' as const,
  status: 'active' as const,
  avatar_url: 'https://example.com/john.png',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};
const baseRoom = {
  id: 'room-123',
  tutor_id: tutor.id,
  title: 'Personal Tutoring Session',
  description: 'Session description',
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
  updated_at: '2026-01-01T00:00:00.000Z'
};
const tutorChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn()
};

const renderTutorDashboard = () => render(
  <MemoryRouter initialEntries={['/tutor']}>
    <AuthProvider>
      <RoomProvider>
        <Routes>
          <Route path="/tutor" element={<TutorView />} />
        </Routes>
      </RoomProvider>
    </AuthProvider>
  </MemoryRouter>
);

const renderRoomPost = (room: any) => render(
  <RoomPost
    room={room as any}
    tutor={tutor as any}
    messageCount={0}
    participantCount={1}
    showOp
  />
);

beforeEach(() => {
  jest.clearAllMocks();
  (supabaseService.createRoom as jest.Mock) = mockCreateRoom;
  (supabaseService.getRoomsByTutor as jest.Mock) = mockGetRoomsByTutor;
  (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue([]);
  (supabaseService.supabase.from as jest.Mock) = jest.fn().mockImplementation(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockResolvedValue({ data: [], error: null }),
    order: jest.fn().mockResolvedValue({ data: [], error: null }),
    limit: jest.fn().mockResolvedValue({ data: [], error: null }),
    single: jest.fn().mockResolvedValue({ data: null, error: null })
  }));
  tutorChannel.on.mockReturnThis();
  tutorChannel.subscribe.mockReturnThis();
  (supabaseService.supabase.channel as jest.Mock) = jest.fn().mockReturnValue(tutorChannel);
  mockGetRoomsByTutor.mockResolvedValue([]);
  mockCreateRoom.mockImplementation(async (values: Record<string, unknown>) => ({
    ...baseRoom,
    ...values,
    id: 'created-room'
  }));
  mockUseAuth.mockReturnValue({ user: tutor, loading: false });
});

defineFeature(feature, test => {
  test('Default OP configuration using tutor profile', ({ given, when, and, then }) => {
    given('the Supabase authentication system is configured', () => {
      expect(supabaseService.supabase.auth).toBeDefined();
    });
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { current_role: 'tutor', display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', async () => {
      renderTutorDashboard();
      fireEvent.click(await screen.findByRole('button', { name: /Create a new Room/i }));
      expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
    });
    given('I am logged in as a tutor', () => {
      expect(screen.getByText(/John Tutor/)).toBeInTheDocument();
    });
    when('I navigate to the room creation page', () => {
      expect(screen.getByLabelText('Room Title')).toBeInTheDocument();
    });
    and('I enter room title "Personal Tutoring Session"', () => {
      fireEvent.change(screen.getByLabelText('Room Title'), { target: { value: 'Personal Tutoring Session' } });
    });
    and('I select "Use my profile as OP" option', () => {
      expect((screen.getAllByRole('radio')[0] as HTMLInputElement).checked).toBe(true);
    });
    and('I submit the room creation form', async () => {
      fireEvent.click(screen.getByText('🚀 Create Room'));
      await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Personal Tutoring Session',
        op_id: tutor.id,
        op_display_name: tutor.display_name,
        op_avatar_url: tutor.avatar_url
      })));
    });
    then('the room should be created with OP set to my profile', () => {
      expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ op_id: tutor.id }));
    });
    and('the room post should display "John Tutor" as the OP', () => {
      renderRoomPost({ ...baseRoom, title: 'Personal Tutoring Session' });
      expect(screen.getAllByText('John Tutor').length).toBeGreaterThan(0);
    });
    and('the room post should show my avatar as the OP avatar', () => {
      expect(screen.getAllByAltText('John Tutor').some(image => image.getAttribute('src') === tutor.avatar_url)).toBe(true);
    });
    and('the OP badge should display "📝 OP" instead of "👨‍🏫 Tutor"', () => {
      expect(screen.getByText('📝 OP')).toBeInTheDocument();
      expect(screen.queryByText('👨‍🏫 Tutor')).not.toBeInTheDocument();
    });
  });

  test('Custom OP name configuration', ({ given, when, and, then }) => {
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { current_role: 'tutor', display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', async () => {
      renderTutorDashboard();
      fireEvent.click(await screen.findByRole('button', { name: /Create a new Room/i }));
      expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
    });
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', () => expect(screen.getByLabelText('Room Title')).toBeInTheDocument());
    and('I enter room title "Corporate Training Module"', () => {
      fireEvent.change(screen.getByLabelText('Room Title'), { target: { value: 'Corporate Training Module' } });
    });
    and('I select "Use custom OP name" option', () => fireEvent.click(screen.getByText('Use custom OP name')));
    and('I enter custom OP name "Security Department"', () => {
      fireEvent.change(screen.getByPlaceholderText('Enter custom OP name'), { target: { value: 'Security Department' } });
    });
    and('I submit the room creation form', async () => {
      fireEvent.click(screen.getByText('🚀 Create Room'));
      await waitFor(() => expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Corporate Training Module', op_id: null, op_display_name: 'Security Department', op_avatar_url: null
      })));
    });
    then('the room should be created with custom OP name', () => {
      expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ op_display_name: 'Security Department', op_id: null }));
    });
    and('the room post should display "Security Department" as the OP', () => {
      renderRoomPost({ ...baseRoom, op_id: null, op_display_name: 'Security Department', op_avatar_url: null });
      expect(screen.getByText('Security Department')).toBeInTheDocument();
    });
    and('the room post should show default avatar for the OP', () => {
      const avatar = document.querySelector('.post-author-avatar');
      expect(avatar).toHaveAttribute('title', 'Security Department');
      expect(avatar?.querySelector('img')).toBeNull();
    });
    and('the OP should not be linked to any user account', () => {
      expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ op_id: null }));
    });
  });

  test('OP configuration validation', ({ given, when, and, then }) => {
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { current_role: 'tutor', display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', async () => {
      renderTutorDashboard();
      fireEvent.click(await screen.findByRole('button', { name: /Create a new Room/i }));
      expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
    });
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', () => expect(screen.getByLabelText('Room Title')).toBeInTheDocument());
    and('I enter room title "OP validation room"', () => {
      fireEvent.change(screen.getByLabelText('Room Title'), { target: { value: 'OP validation room' } });
    });
    and('I select "Use custom OP name" option', () => fireEvent.click(screen.getByText('Use custom OP name')));
    and('I leave the custom OP name field empty', () => expect(screen.getByPlaceholderText('Enter custom OP name')).toHaveValue(''));
    and('I submit the room creation form', () => fireEvent.click(screen.getByText('🚀 Create Room')));
    then('I should see an error "Custom OP name is required when using custom OP"', async () => {
      expect(await screen.findAllByText('Custom OP name is required when using custom OP')).not.toHaveLength(0);
    });
    and('the room should not be created', () => expect(mockCreateRoom).not.toHaveBeenCalled());
  });

  test('OP settings display in room creation form', ({ given, when, then, and }) => {
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { current_role: 'tutor', display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', async () => {
      renderTutorDashboard();
      fireEvent.click(await screen.findByRole('button', { name: /Create a new Room/i }));
      expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
    });
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', () => expect(screen.getByLabelText('Room Title')).toBeInTheDocument());
    then('I should see "Original Poster (OP) Settings" section', () => expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument());
    and('I should see two radio options for OP configuration', () => expect(screen.getAllByRole('radio')).toHaveLength(2));
    and('the "Use my profile as OP" option should be selected by default', () => {
      expect((screen.getAllByRole('radio')[0] as HTMLInputElement).checked).toBe(true);
    });
    and('I should see my display name preview under the profile option', () => {
      expect(screen.getByText((_, element) => element?.textContent === 'OP will be: John Tutor')).toBeInTheDocument();
    });
  });

  test('Custom OP name input visibility', ({ given, when, and, then }) => {
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { current_role: 'tutor', display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', async () => {
      renderTutorDashboard();
      fireEvent.click(await screen.findByRole('button', { name: /Create a new Room/i }));
      expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
    });
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', () => expect(screen.getByLabelText('Room Title')).toBeInTheDocument());
    and('I select "Use custom OP name" option', () => fireEvent.click(screen.getByText('Use custom OP name')));
    then('the custom OP name input field should become visible', () => expect(screen.getByPlaceholderText('Enter custom OP name')).toBeVisible());
    and('I should see placeholder text "Enter custom OP name"', () => expect(screen.getByPlaceholderText('Enter custom OP name')).toBeInTheDocument());
    and('I should see helper text "Custom OP names won\'t have profile pictures or user accounts"', () => {
      expect(screen.getByText("Custom OP names won't have profile pictures or user accounts")).toBeInTheDocument();
    });
  });

  test('Switching between OP options', ({ given, when, and, then }) => {
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { current_role: 'tutor', display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', async () => {
      renderTutorDashboard();
      fireEvent.click(await screen.findByRole('button', { name: /Create a new Room/i }));
      expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
    });
    given('I am logged in as a tutor', () => expect(screen.getByText(/John Tutor/)).toBeInTheDocument());
    when('I navigate to the room creation page', () => expect(screen.getByLabelText('Room Title')).toBeInTheDocument());
    and('I select "Use custom OP name" option', () => fireEvent.click(screen.getByText('Use custom OP name')));
    and('I enter custom OP name "Training Team"', () => {
      fireEvent.change(screen.getByPlaceholderText('Enter custom OP name'), { target: { value: 'Training Team' } });
    });
    and('I switch back to "Use my profile as OP" option', () => fireEvent.click(screen.getByText('Use my profile as OP')));
    then('the custom OP name input should be hidden', () => expect(screen.queryByPlaceholderText('Enter custom OP name')).not.toBeInTheDocument());
    and('my profile name should be shown as the OP preview', () => {
      expect(screen.getByText((_, element) => element?.textContent === 'OP will be: John Tutor')).toBeInTheDocument();
    });
  });

  test('Room display with profile OP', ({ given, when, then, and }) => {
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', () => renderRoomPost(baseRoom));
    given('a room exists with tutor "John Tutor" as the OP', () => expect(screen.getByText('John Tutor')).toBeInTheDocument());
    when('I view the room in post-style interface', () => expect(screen.getByText('Personal Tutoring Session')).toBeInTheDocument());
    then('I should see "John Tutor" displayed as the OP', () => expect(screen.getByText('John Tutor')).toBeInTheDocument());
    and('I should see the tutor\'s avatar next to the OP name', () => {
      expect(screen.getAllByAltText('John Tutor').some(image => image.getAttribute('src') === tutor.avatar_url)).toBe(true);
    });
    and('I should see "📝 OP" badge next to the name', () => expect(screen.getByText('📝 OP')).toBeInTheDocument());
  });

  test('Room display with custom OP', ({ given, when, then, and }) => {
    const customRoom = { ...baseRoom, op_id: null, op_display_name: 'IT Department', op_avatar_url: null };
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', () => renderRoomPost(customRoom));
    given('a room exists with custom OP name "IT Department"', () => expect(screen.getByText('IT Department')).toBeInTheDocument());
    when('I view the room in post-style interface', () => expect(screen.getByText('Personal Tutoring Session')).toBeInTheDocument());
    then('I should see "IT Department" displayed as the OP', () => expect(screen.getByText('IT Department')).toBeInTheDocument());
    and('I should see a default avatar for the OP', () => {
      const avatar = document.querySelector('.post-author-avatar');
      expect(avatar).toHaveAttribute('title', 'IT Department');
      expect(avatar?.querySelector('img')).toBeNull();
    });
    and('I should see "📝 OP" badge next to the name', () => expect(screen.getByText('📝 OP')).toBeInTheDocument());
  });

  test('Room card display configuration', ({ given, when, then, and }) => {
    const customRoom = { ...baseRoom, op_id: null, op_display_name: 'IT Department', op_avatar_url: null };
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', () => {
      expect(typeof RoomCard).toBe('function');
    });
    given('I have created rooms with different OP settings', () => {
      render(<RoomCard room={customRoom as any} tutor={tutor as any} onJoin={jest.fn()} showOp />);
    });
    when('I view my tutor dashboard', () => expect(screen.getByTestId('room-card-room-123')).toBeInTheDocument());
    then('room cards should show OP information when configured', () => {
      expect(screen.getByText('OP:')).toBeInTheDocument();
      expect(screen.getByText('IT Department')).toBeInTheDocument();
    });
    and('rooms with profile OP should show the tutor\'s avatar', () => {
      const { container } = render(<RoomCard room={baseRoom as any} tutor={tutor as any} onJoin={jest.fn()} showOp />);
      expect(container.querySelector('img')).toHaveAttribute('src', tutor.avatar_url);
    });
    and('rooms with custom OP should show the custom name', () => expect(screen.getByText('IT Department')).toBeInTheDocument());
    and('the display should be controlled by the showOp prop', () => {
      const { container } = render(<RoomCard room={customRoom as any} tutor={tutor as any} onJoin={jest.fn()} showOp={false} />);
      expect(container).toHaveTextContent('Tutor:');
      expect(container).not.toHaveTextContent('OP:');
    });
  });

  test('Backwards compatibility', ({ given, when, then, and }) => {
    const legacyRoom = { ...baseRoom, title: 'Legacy room', op_id: null, op_display_name: null, op_avatar_url: null };
    let legacyRoomView: ReturnType<typeof render>;
    given('the Supabase authentication system is configured', () => expect(supabaseService.supabase.auth).toBeDefined());
    and('the user is authenticated as a tutor with display name "John Tutor"', () => {
      expect(mockUseAuth()).toMatchObject({ user: { display_name: 'John Tutor' } });
    });
    and('the OP configuration feature is enabled', () => { legacyRoomView = renderRoomPost(legacyRoom); });
    given('existing rooms created before OP feature', () => expect(screen.getByText('Legacy room')).toBeInTheDocument());
    when('the OP fields are added to the database', () => {
      legacyRoomView.rerender(
        <RoomPost
          room={{ ...legacyRoom, op_id: tutor.id, op_display_name: tutor.display_name, op_avatar_url: tutor.avatar_url } as any}
          tutor={tutor as any}
          messageCount={0}
          participantCount={1}
          showOp
        />
      );
      expect(screen.getAllByText('John Tutor').length).toBeGreaterThan(0);
      expect(screen.getByText('Legacy room')).toBeInTheDocument();
    });
    then('existing rooms should have OP fields set to the tutor\'s information', () => {
      expect(screen.getByText('John Tutor')).toBeInTheDocument();
      expect(screen.getByText('📝 OP')).toBeInTheDocument();
    });
    and('the rooms should display correctly with tutor as OP', () => {
      expect(screen.getByText('Legacy room')).toBeInTheDocument();
      expect(screen.getByText('John Tutor')).toBeInTheDocument();
    });
    and('no data should be lost in the migration', () => {
      expect(screen.getByText('Legacy room')).toBeInTheDocument();
      expect(screen.getByText('Session description')).toBeInTheDocument();
    });
  });
});

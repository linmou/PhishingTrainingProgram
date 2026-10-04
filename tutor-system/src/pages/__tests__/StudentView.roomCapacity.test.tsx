#!/usr/bin/env node
/**
 * Test file: src/pages/StudentView.roomCapacity.test.tsx
 * Purpose: verify the room's first learner can re-enter while later students join as observers.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import StudentView from '../StudentView';
import { supabase } from '../../services/supabase';

const mockNavigate = jest.fn();
let mockAuthUser: { id: string; display_name: string; current_role: string };

jest.mock('../../services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    channel: jest.fn(),
  },
}));

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser, loading: false }),
}));

jest.mock('../../services/transferAssessmentService', () => ({
  transferAssessmentService: { joinRoom: jest.fn(async (roomId: string) => ({ room_id: roomId, learner_id: 'student-2', room_role: 'observer' })) },
}));

const room = {
  id: 'room-1',
  title: 'Phishing Basics',
  description: 'Check the sender before opening links.',
  tutor_id: 'tutor-1',
  is_active: true,
  created_at: '2026-09-27T12:00:00.000Z',
  tutor: { id: 'tutor-1', display_name: 'Tutor One', current_role: 'tutor' },
};

let activeSessions: Array<{ room_id: string; student_id: string | null; status: string }>;
let insertSession: jest.Mock;

function renderStudent() {
  return render(
    <BrowserRouter>
      <StudentView />
    </BrowserRouter>
  );
}

function setupSupabase() {
  const querySessions = () => {
    const query: any = {
      select: jest.fn(() => query),
      eq: jest.fn(() => query),
      not: jest.fn(() => query),
      maybeSingle: jest.fn(async () => ({
        data: activeSessions.find((session) => session.room_id === room.id && session.status === 'active' && session.student_id !== null) || null,
        error: null,
      })),
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({
          data: activeSessions.filter((session) => session.status === 'active' && session.student_id !== null),
          error: null,
        }).then(resolve, reject),
    };
    return query;
  };

  insertSession = jest.fn().mockImplementation(() => ({
    select: jest.fn().mockImplementation(async () => ({
      data: [{ id: 'session-new', room_id: room.id, student_id: mockAuthUser.id }],
      error: null,
    })),
  }));

  (supabase.from as jest.Mock).mockImplementation((table: string) => {
    if (table === 'rooms') {
      const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        order: jest.fn().mockResolvedValue({ data: [room], error: null }),
      };
      return query;
    }

    if (table === 'sessions') {
      const query = querySessions();
      query.insert = insertSession;
      return query;
    }

    if (table === 'users') {
      const query: any = {
        select: jest.fn(() => query),
        eq: jest.fn(() => query),
        single: jest.fn().mockResolvedValue({ data: mockAuthUser, error: null }),
      };
      return query;
    }

    throw new Error(`Unexpected Supabase table: ${table}`);
  });

  (supabase.channel as jest.Mock).mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn(),
  });
}

describe('StudentView room capacity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser = { id: 'student-1', display_name: 'Student One', current_role: 'student' };
    activeSessions = [];
    setupSupabase();
  });

  it('offers observer entry when another student owns the room', async () => {
    activeSessions = [{ room_id: room.id, student_id: 'student-2', status: 'active' }];

    renderStudent();

    const card = await screen.findByTestId(`room-card-${room.id}`);
    expect(card).toHaveTextContent('Observe');
    expect(screen.getByRole('button', { name: /observe room/i })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: /observe room/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(`/room/${room.id}`));
    expect(mockNavigate).toHaveBeenCalledWith(`/room/${room.id}`);
    expect(insertSession).not.toHaveBeenCalled();
  });

  it('allows the current student to rejoin without inserting a duplicate active session', async () => {
    activeSessions = [{ room_id: room.id, student_id: mockAuthUser.id, status: 'active' }];

    renderStudent();

    await userEvent.click(await screen.findByRole('button', { name: /rejoin room/i }));

    expect(mockNavigate).toHaveBeenCalledWith(`/room/${room.id}`);
    expect(insertSession).not.toHaveBeenCalled();
  });

  it('enters as observer when another student wins the learner-seat race', async () => {
    activeSessions = [];
    insertSession.mockImplementationOnce(() => ({
      select: jest.fn().mockImplementation(async () => {
        activeSessions = [{ room_id: room.id, student_id: 'student-2', status: 'active' }];
        return { data: null, error: { code: '23505', message: 'duplicate active room' } };
      }),
    }));

    renderStudent();

    await userEvent.click(await screen.findByRole('button', { name: /join room/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(`/room/${room.id}`));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('rejoins when the current student wins the active-session insert race', async () => {
    activeSessions = [];
    insertSession.mockImplementationOnce(() => ({
      select: jest.fn().mockImplementation(async () => {
        activeSessions = [{ room_id: room.id, student_id: mockAuthUser.id, status: 'active' }];
        return { data: null, error: { code: '23505', message: 'duplicate active room' } };
      }),
    }));

    renderStudent();

    await userEvent.click(await screen.findByRole('button', { name: /join room/i }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(`/room/${room.id}`));
  });

  it('does not count active sessions without a student as room occupancy', async () => {
    activeSessions = [{ room_id: room.id, student_id: null, status: 'active' }];

    renderStudent();

    const card = await screen.findByTestId(`room-card-${room.id}`);
    expect(card).toHaveTextContent('Available');
    expect(screen.getByRole('button', { name: /join room/i })).toBeEnabled();
  });
});

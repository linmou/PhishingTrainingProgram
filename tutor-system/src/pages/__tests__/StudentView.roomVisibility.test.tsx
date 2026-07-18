/**
 * File: src/pages/StudentView.tsx
 * Purpose: Student Available Rooms must hide test/harness rooms and keep real classes.
 *
 * Spec: features/student_view.feature (test/harness visibility scenarios)
 *       features/room_discovery.feature (student discovery hide scenarios)
 *
 * Boundary under test: fetch mock returns realistic row shapes → StudentView uses
 * real filterRoomsForStudentList / isHiddenFromStudentRoomList (not reimplemented in the test).
 * Network is mocked; classification is not.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import StudentView from '../StudentView';
import { supabase } from '../../services/supabase';
import {
  BEHAVIOR_TEST_ROOM_MARKER,
  markBehaviorTestDescription
} from '../../utils/behaviorTestRooms';

jest.mock('../../services/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn()
    },
    from: jest.fn(),
    channel: jest.fn()
  }
}));

jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => jest.fn(),
    Link: jest.fn(({ children, to }: { children: React.ReactNode; to: string }) =>
      React.createElement('a', { href: to }, children)
    )
  };
});

const mockUser = {
  id: 'student-1',
  display_name: 'Jane Student',
  current_role: 'student',
  avatar_url: null
};

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    joinWithNameAndRole: jest.fn(),
    signOut: jest.fn(),
    setUserRole: jest.fn()
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

function roomRow(overrides: Record<string, unknown>) {
  return {
    id: 'id-' + Math.random().toString(36).slice(2, 8),
    title: 'Room',
    description: 'desc',
    tutor_id: 'tutor-1',
    is_active: true,
    created_at: new Date().toISOString(),
    tutor: { id: 'tutor-1', display_name: 'Grace', current_role: 'tutor' },
    ...overrides
  };
}

function mockRoomsFetch(rooms: unknown[]) {
  const mockSupabase = supabase as jest.Mocked<typeof supabase>;
  mockSupabase.from.mockImplementation((table: string) => {
    if (table === 'rooms') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: rooms, error: null })
      } as any;
    }
    if (table === 'users') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: mockUser, error: null })
      } as any;
    }
    return {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    } as any;
  });
  mockSupabase.channel.mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn()
  } as any);
}

function renderStudent() {
  return render(
    <BrowserRouter>
      <StudentView />
    </BrowserRouter>
  );
}

describe('StudentView room visibility (Available Rooms)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows real teaching rooms and hides marker + Demo: + DemoTutor harness + marked creates', async () => {
    mockRoomsFetch([
      roomRow({
        id: 'teach',
        title: 'Phishing 101',
        description: 'Normal class',
        tutor: { id: 'g', display_name: 'Grace' }
      }),
      roomRow({
        id: 'real-classic',
        title: 'Account Security Alert Scam',
        description: 'class period 4 with Adele',
        tutor: { id: 'a', display_name: 'Adele' }
      }),
      roomRow({
        id: 'marked',
        title: 'Internal Eval Room',
        description: `behavior\n\n${BEHAVIOR_TEST_ROOM_MARKER}`,
        tutor: { id: 'g', display_name: 'Grace' }
      }),
      roomRow({
        id: 'demo-title',
        title: 'Demo: Lock Icon Myth',
        description: 'practice',
        tutor: { id: 'g', display_name: 'Grace' }
      }),
      roomRow({
        id: 'heritage-615',
        title: 'Account Security Alert Scam',
        description: 'YOUR ACCOUNT IS AT RISK — unknown device',
        tutor: { id: 'd1', display_name: 'DemoTutor_615166' }
      }),
      roomRow({
        id: 'heritage-962',
        title: 'Nintendo Switch Deal Scam',
        description: 'Get a BRAND new Nintendo Switch only $19.99!!',
        tutor: { id: 'd2', display_name: 'DemoTutor_962226' }
      }),
      roomRow({
        id: 'test-rooms-create',
        title: 'iTunes Gift Card Survey Scam',
        description: markBehaviorTestDescription(
          'You won a gift card survey — http://bit.ly/FREEGIFTS'
        ),
        tutor: { id: 'r', display_name: 'Real Tutor' }
      })
    ]);

    renderStudent();

    await waitFor(() => {
      expect(screen.getByText('Phishing 101')).toBeInTheDocument();
    });
    expect(screen.getByText('class period 4 with Adele')).toBeInTheDocument();

    expect(screen.queryByText('Internal Eval Room')).not.toBeInTheDocument();
    expect(screen.queryByText('Demo: Lock Icon Myth')).not.toBeInTheDocument();
    expect(screen.queryByText('DemoTutor_615166')).not.toBeInTheDocument();
    expect(screen.queryByText('DemoTutor_962226')).not.toBeInTheDocument();
    // Heritage classic title may also appear as Adele's real class — assert harness tutor gone
    // and Nintendo heritage (only DemoTutor owned in this fixture) gone
    expect(screen.queryByText('Nintendo Switch Deal Scam')).not.toBeInTheDocument();
    // Marked create path body should not show the raw gift-card pitch without being a card
    expect(screen.queryByText(/bit\.ly\/FREEGIFTS/i)).not.toBeInTheDocument();
  });

  it('shows empty waiting state when every returned room is hidden', async () => {
    mockRoomsFetch([
      roomRow({
        title: 'Demo: Pressure Words',
        description: 'x',
        tutor: { id: 'd', display_name: 'DemoTutor_000001' }
      }),
      roomRow({
        title: 'Any',
        description: BEHAVIOR_TEST_ROOM_MARKER,
        tutor: { id: 'g', display_name: 'Grace' }
      })
    ]);

    renderStudent();

    await waitFor(() => {
      expect(screen.getByText('No rooms available')).toBeInTheDocument();
    });
    expect(screen.getByText(/wait for a tutor/i)).toBeInTheDocument();
    expect(screen.queryByText('Demo: Pressure Words')).not.toBeInTheDocument();
  });
});

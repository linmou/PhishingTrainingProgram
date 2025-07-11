import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';

import App from '../App';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';

const feature = loadFeature('./features/student_view.feature');

// --- Mocks ---
jest.mock('../services/supabase');
jest.mock('../contexts/AuthContext', () => ({
    ...jest.requireActual('../contexts/AuthContext'),
    useAuth: jest.fn(),
}));

const mockSupabaseClient = supabase as jest.Mocked<typeof supabase>;

// Helper to track navigation
let location: any;
const LocationDisplay = () => {
    location = useLocation();
    return null;
};

// Helper for mocking the query chain
const mockQuery = (data: any[] | null, error: any = null) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data, error }),
    single: jest.fn().mockResolvedValue({ data, error }),
});

defineFeature(feature, test => {
    let mockUser: any;
    let mockRoomsData: any[];
    let mockSessionsData: any;
    let realtimeCallback: ((payload: any) => void) | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 's-1', email: 'student@test.com' };
        mockRoomsData = [];
        mockSessionsData = null;
        realtimeCallback = null;
        location = null;

        (useAuth as jest.Mock).mockReturnValue({ user: mockUser, loading: false, userRole: 'student' });

        mockSupabaseClient.from.mockImplementation((tableName: string) => {
            if (tableName === 'rooms') return mockQuery(mockRoomsData);
            if (tableName === 'sessions') {
                const error = mockSessionsData ? null : { code: 'PGRST116' };
                return mockQuery(mockSessionsData, error);
            }
            return mockQuery([]);
        });

        const mockSubscription = {
            on: jest.fn().mockImplementation((event, config, callback) => {
                if (config.table === 'rooms' || config.table === 'sessions') {
                    realtimeCallback = callback;
                }
                return { subscribe: jest.fn() };
            }),
            subscribe: jest.fn(),
        };
        mockSupabaseClient.channel.mockReturnValue(mockSubscription as any);
    });

    const renderStudentView = () => {
        render(
            <MemoryRouter initialEntries={ ['/student']} >
            <App />
            < LocationDisplay />
        </MemoryRouter>
        );
    };

    // Scenario Implementations
    test('Student selects their role and sees the dashboard with a loading state', ({ when, then, and }) => {
        when('the user logs in and selects the "Student" role', () => {
            renderStudentView();
        });

        then('the student dashboard should initially display a "Loading rooms..." message', () => {
            expect(screen.getByText(/Loading/i)).toBeInTheDocument();
        });

        and('then the page should display "Available Rooms"', async () => {
            await waitFor(() => {
                expect(screen.getByText("Available Rooms")).toBeInTheDocument();
            });
        });
    });

    test('Student sees a list of available rooms', ({ given, and, when, then }) => {
        given('a user is logged in as a "Student"', () => { });
        and('a tutor has created a room with title "Phishing 101"', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Phishing 101', is_active: true }];
        });
        when('the student is on the dashboard', () => {
            renderStudentView();
        });
        then('the student should see the room "Phishing 101" in the list', async () => {
            await waitFor(() => {
                expect(screen.getByText("Phishing 101")).toBeInTheDocument();
            });
        });
    });

    test('Student sees an updated message when no rooms are available', ({ given, and, when, then }) => {
        given('a user is logged in as a "Student"', () => { });

        and('no active rooms are available', () => {
            mockRoomsData = [];
        });

        when('the student is on the dashboard', () => {
            renderStudentView();
        });

        then('the student should see the message "No rooms available"', async () => {
            await waitFor(() => {
                expect(screen.getByText("No rooms available")).toBeInTheDocument();
            });
        });

        and('the student should see the message "Please wait for a tutor to create a room."', async () => {
            await waitFor(() => {
                expect(screen.getByText("Please wait for a tutor to create a room.")).toBeInTheDocument();
            });
        });
    });

    test('Student sees a new room appear in real-time', ({ given, when, then }) => {
        given('the student is on the dashboard viewing an empty list of rooms', () => {
            renderStudentView();
        });
        when('a tutor creates a new room with title "Live Hacking Demo"', async () => {
            expect(realtimeCallback).toBeDefined();
            mockRoomsData = [{ id: 'r-2', title: 'Live Hacking Demo', is_active: true }];
            await act(async () => realtimeCallback!({ eventType: 'INSERT', new: mockRoomsData[0] }));
        });
        then('the "Live Hacking Demo" room should appear in the list automatically without a page refresh', async () => {
            await waitFor(() => {
                expect(screen.getByText("Live Hacking Demo")).toBeInTheDocument();
            });
        });
    });

    test('Student sees a room is full', ({ given, and, when, then }) => {
        given('the user is logged in as a "Student"', () => { });

        and('the "Phishing 101" room is full', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Phishing 101', is_active: true }];
            mockSessionsData = [
                { user_id: 'tutor-1', role: 'tutor' },
                { user_id: 'student-2', role: 'student' }
            ];
            mockSupabaseClient.from.mockImplementation((tableName: string) => {
                if (tableName === 'rooms') return mockQuery(mockRoomsData);
                if (tableName === 'sessions') return mockQuery(mockSessionsData);
                return mockQuery([]);
            });
        });

        when('the student views the list of available rooms', () => {
            renderStudentView();
        });

        then('the "Join" button for the "Phishing 101" room should be disabled', async () => {
            await waitFor(() => {
                const joinButton = screen.getByRole('button', { name: /join/i });
                expect(joinButton).toBeDisabled();
            });
        });

        and('the student should see a "Room Full" status indicator for that room', async () => {
            await waitFor(() => {
                expect(screen.getByText('Full')).toBeInTheDocument();
            });
        });
    });

    test('Student fails to join a room due to an error', ({ given, and, when, then }) => {
        given('the user is logged in as a "Student"', () => { });

        and('the system will produce an error when they try to join "Phishing 101"', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Phishing 101', is_active: true }];
            const mockInsert = jest.fn().mockResolvedValue({ error: { message: 'Insert failed' } });

            mockSupabaseClient.from.mockImplementation((tableName: string) => {
                if (tableName === 'rooms') return mockQuery(mockRoomsData);
                if (tableName === 'sessions') {
                    const query = mockQuery(null, { code: 'PGRST116' }); // No existing session
                    return { ...query, insert: mockInsert };
                }
                return mockQuery([]);
            });
        });

        when('the student clicks the "Join" button for the "Phishing 101" room', async () => {
            renderStudentView();
            await waitFor(() => screen.getByText("Phishing 101"));
            fireEvent.click(screen.getByRole('button', { name: /join/i }));
        });

        then('the student should see an error message "Failed to join the room. Please try again."', async () => {
            await waitFor(() => {
                expect(screen.getByText("Failed to join the room. Please try again.")).toBeInTheDocument();
            });
        });
    });

    test('Student joins a room successfully', ({ given, and, when, then }) => {
        given('a user is logged in as a "Student"', () => { });
        and('the "Phishing 101" room is available and not full', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Phishing 101', is_active: true }];
            mockSessionsData = null;
        });
        when('the student clicks the "Join" button for the "Phishing 101" room', async () => {
            renderStudentView();
            await waitFor(() => screen.getByText("Phishing 101"));
            fireEvent.click(screen.getByRole('button', { name: /join/i }));
        });
        then('the user should be navigated to the room page for "Phishing 101"', async () => {
            await waitFor(() => {
                expect(location.pathname).toBe('/room/r-1');
            });
        });
    });
}); 
import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';

import { AuthProvider } from '../contexts/AuthContext';
import { RoomProvider } from '../contexts/RoomContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import HomePage from '../pages/HomePage';
import ObserverView from '../pages/ObserverView';
import RoomPage from '../pages/RoomPage';

const feature = loadFeature('./features/observer_view.feature', { tagFilter: '@observer-ui' });

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

// Test App without Router
const TestApp = () => (
    <AuthProvider>
        <RoomProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/observer" element={<ObserverView />} />
                <Route path="/room/:roomId" element={<RoomPage />} />
            </Routes>
            <LocationDisplay />
        </RoomProvider>
    </AuthProvider>
);

// Helper for mocking the query chain
const mockQuery = (data: any[] | null, error: any = null) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data, error }),
    insert: jest.fn().mockResolvedValue({ data, error })
});

defineFeature(feature, test => {
    let mockUser: any;
    let mockRoomsData: any[];
    let mockSessionsData: any;
    let mockMessagesData: any[];
    let realtimeCallback: ((payload: any) => void) | null = null;
    let mockSetRole: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = { id: 'o-1', email: 'observer@test.com', display_name: 'Test Observer' };
        mockRoomsData = [];
        mockSessionsData = null;
        mockMessagesData = [];
        realtimeCallback = null;
        location = null;

        mockSetRole = jest.fn().mockResolvedValue(undefined);

        (useAuth as jest.Mock).mockReturnValue({ 
            user: mockUser, 
            loading: false, 
            userRole: 'observer',
            setUserRole: mockSetRole
        });

        mockSupabaseClient.from.mockImplementation((tableName: string) => {
            if (tableName === 'rooms') return mockQuery(mockRoomsData);
            if (tableName === 'sessions') {
                const error = mockSessionsData ? null : { code: 'PGRST116' };
                return mockQuery(mockSessionsData, error);
            }
            if (tableName === 'messages') return mockQuery(mockMessagesData);
            return mockQuery([]);
        });

        const mockSubscription = {
            on: jest.fn().mockImplementation((event, config, callback) => {
                if (config.table === 'rooms' || config.table === 'sessions' || config.table === 'messages') {
                    realtimeCallback = callback;
                }
                return mockSubscription;
            }),
            subscribe: jest.fn().mockReturnValue({
                unsubscribe: jest.fn()
            }),
        };
        mockSupabaseClient.channel.mockReturnValue(mockSubscription as any);

        // Mock download functionality
        global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
        global.URL.revokeObjectURL = jest.fn();
        
        // Mock for file download
        const mockDownloadLink = document.createElement('a');
        jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'a') return mockDownloadLink;
            return document.createElement(tagName);
        });
        
        mockDownloadLink.click = jest.fn();
        Object.defineProperty(document, 'body', {
            value: { appendChild: jest.fn(), removeChild: jest.fn() }
        });
    });

    const renderHomePage = () => {
        render(
            <MemoryRouter initialEntries={['/']}>
                <TestApp />
            </MemoryRouter>
        );
    };

    const renderObserverView = () => {
        render(
            <MemoryRouter initialEntries={['/observer']}>
                <TestApp />
            </MemoryRouter>
        );
    };

    const renderRoomPage = (roomId: string) => {
        render(
            <MemoryRouter initialEntries={[`/room/${roomId}`]}>
                <TestApp />
            </MemoryRouter>
        );
    };

    // Scenario Implementations
    test('Observer selects their role and sees the dashboard with loading state', ({ given, when, then, and }) => {
        given('a user is authenticated', () => {
            // User is already mocked as authenticated in beforeEach
        });

        given('the user is on the role selection page', () => {
            renderHomePage();
        });

        when('the user selects the "Observer" role', async () => {
            const observerCard = screen.getByText('Observer').closest('.role-card');
            await act(async () => {
                fireEvent.click(observerCard!);
            });
        });

        then('the user is redirected to the observer dashboard', async () => {
            await waitFor(() => {
                expect(mockSetRole).toHaveBeenCalledWith('observer');
            });
        });

        and('the observer dashboard should initially display a "Loading rooms..." message', async () => {
            renderObserverView();
            expect(screen.getByText(/Loading/i)).toBeInTheDocument();
        });

        and('then the page should display "Available Rooms"', async () => {
            await waitFor(() => {
                expect(screen.getByText("Available Rooms")).toBeInTheDocument();
            });
        });
    });

    test('Observer sees a list of available rooms', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            // User is already mocked as authenticated in beforeEach
        });
        given('the user is logged in as an "Observer"', () => {
            // Already handled by useAuth mock in beforeEach
        });
        and('a room with the title "Live Phishing Demo" is active', () => {
            mockRoomsData = [{ 
                id: 'r-1', 
                title: 'Live Phishing Demo', 
                is_active: true,
                tutor_id: 't-1',
                description: 'Learn to identify phishing attempts',
                users: { display_name: 'Test Tutor' }
            }];
        });
        when('the observer is on the dashboard', () => {
            renderObserverView();
        });
        then('the observer should see the room "Live Phishing Demo" in the list', async () => {
            await waitFor(() => {
                expect(screen.getByText("Live Phishing Demo")).toBeInTheDocument();
            });
        });
        and('the room should display the tutor name and description', async () => {
            await waitFor(() => {
                expect(screen.getByText("Learn to identify phishing attempts")).toBeInTheDocument();
            });
        });
    });

    test('Observer sees updated message when no rooms are available', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            // User is already mocked as authenticated in beforeEach
        });
        given('the user is logged in as an "Observer"', () => {
            // Already handled by useAuth mock in beforeEach
        });
        and('no active rooms are available', () => {
            mockRoomsData = [];
        });

        when('the observer is on the dashboard', () => {
            renderObserverView();
        });

        then('the observer should see the message "No rooms available"', async () => {
            await waitFor(() => {
                expect(screen.getByText("No rooms available")).toBeInTheDocument();
            });
        });

        and('the observer should see the message "Please wait for a tutor to create a room."', async () => {
            await waitFor(() => {
                expect(screen.getByText("Please wait for a tutor to create a room.")).toBeInTheDocument();
            });
        });
    });

    test('Observer sees new rooms appear in real-time', ({ given, when, then }) => {
        given('a user is authenticated', () => {
            // User is already mocked as authenticated in beforeEach
        });
        
        given('the observer is on the dashboard viewing an empty list of rooms', () => {
            renderObserverView();
        });
        
        when('a tutor creates a new room with title "Security Awareness Training"', async () => {
            expect(realtimeCallback).toBeDefined();
            mockRoomsData = [{ id: 'r-2', title: 'Security Awareness Training', is_active: true }];
            await act(async () => realtimeCallback!({ eventType: 'INSERT', new: mockRoomsData[0] }));
        });
        
        then('the "Security Awareness Training" room should appear in the list automatically without a page refresh', async () => {
            await waitFor(() => {
                expect(screen.getByText("Security Awareness Training")).toBeInTheDocument();
            });
        });
    });

    test('Observer browses and joins an available room', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            // User is already mocked as authenticated in beforeEach
        });
        given('the user is logged in as an "Observer"', () => {
            // Already handled by useAuth mock in beforeEach
        });
        and('a room with the title "Live Phishing Demo" is active', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Live Phishing Demo', is_active: true }];
        });
        when('the observer clicks the "Join" button for the "Live Phishing Demo" room', async () => {
            renderObserverView();
            await waitFor(() => screen.getByText("Live Phishing Demo"));
            fireEvent.click(screen.getByRole('button', { name: /join/i }));
        });
        then('the observer is navigated to the room page for "Live Phishing Demo"', async () => {
            await waitFor(() => {
                expect(location.pathname).toBe('/room/r-1');
            });
        });
    });

    test('Observer has a read-only view of the chat', ({ given, when, then, and }) => {
        given('an observer has joined the "Live Phishing Demo" room', () => {
            renderRoomPage('r-1');
        });
        when('the observer views the chat interface', () => {
            // Chat interface is rendered by default in room page
        });
        then('they should see a clear indicator that they are in "Read-Only Mode"', async () => {
            await waitFor(() => {
                expect(screen.getByText(/Read-Only Mode/i)).toBeInTheDocument();
            });
        });
        and('the chat message input field must be disabled or not visible', () => {
            const messageInput = screen.queryByPlaceholderText(/Type a message/i);
            expect(messageInput).toBeNull();
        });
        and('there should be a visual indicator showing their observer status', () => {
            expect(screen.getByText(/Observer Mode/i)).toBeInTheDocument();
        });
    });

    test('Observer sees the conversation unfold in real-time', ({ given, when, then, and }) => {
        given('an observer is in the "Live Phishing Demo" room', () => {
            renderRoomPage('r-1');
        });
        when('the tutor sends the message "Can you spot the fake link?"', async () => {
            expect(realtimeCallback).toBeDefined();
            mockMessagesData = [{ 
                id: 1, 
                content: 'Can you spot the fake link?', 
                user_role: 'tutor',
                user_id: 't-1',
                created_at: new Date().toISOString() 
            }];
            await act(async () => realtimeCallback!({ 
                eventType: 'INSERT', 
                new: mockMessagesData[0],
                table: 'messages'
            }));
        });
        then('the observer should see the tutor\'s message in the chat log immediately', async () => {
            await waitFor(() => {
                expect(screen.getByText("Can you spot the fake link?")).toBeInTheDocument();
            });
        });
        when('the student sends the message "I think it\'s the one with the typo."', async () => {
            const newMessage = { 
                id: 2, 
                content: 'I think it\'s the one with the typo.', 
                user_role: 'student',
                user_id: 's-1',
                created_at: new Date().toISOString() 
            };
            mockMessagesData.push(newMessage);
            await act(async () => realtimeCallback!({ 
                eventType: 'INSERT', 
                new: newMessage,
                table: 'messages'
            }));
        });
        then('the observer should also see the student\'s message immediately', async () => {
            await waitFor(() => {
                expect(screen.getByText("I think it's the one with the typo.")).toBeInTheDocument();
            });
        });
        and('messages should display with appropriate role labels (Tutor/Student)', () => {
            expect(screen.getByText('Tutor')).toBeInTheDocument();
            expect(screen.getByText('Student')).toBeInTheDocument();
        });
    });

    test('Observer fails to join a room due to an error', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            // User is already mocked as authenticated in beforeEach
        });
        given('the user is logged in as an "Observer"', () => {
            // Already handled by useAuth mock in beforeEach
        });
        and('the system will produce an error when they try to join "Live Phishing Demo"', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Live Phishing Demo', is_active: true }];
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

        when('the observer clicks the "Join" button for the "Live Phishing Demo" room', async () => {
            renderObserverView();
            await waitFor(() => screen.getByText("Live Phishing Demo"));
            fireEvent.click(screen.getByRole('button', { name: /join/i }));
        });

        then('the observer should see an error message "Failed to join the room. Please try again."', async () => {
            await waitFor(() => {
                expect(screen.getByText("Failed to join the room. Please try again.")).toBeInTheDocument();
            });
        });
    });

    test('Observer downloads the chat history', ({ given, and, when, then }) => {
        given('an observer is in the "Live Phishing Demo" room', () => {
            mockMessagesData = [
                { id: 1, content: 'Welcome to the training', user_role: 'tutor', created_at: new Date().toISOString() },
                { id: 2, content: 'Thank you!', user_role: 'student', created_at: new Date().toISOString() }
            ];
            renderRoomPage('r-1');
        });
        and('a conversation has taken place', () => {
            // Messages are already set in the given step
        });
        when('the observer clicks the "Download History" button', () => {
            fireEvent.click(screen.getByRole('button', { name: /Download History/i }));
        });
        then('a file containing the complete chat history should be downloaded', async () => {
            await waitFor(() => {
                expect(global.URL.createObjectURL).toHaveBeenCalled();
            });
        });
        and('the file should include room information and participant details', () => {
            // Verify that the download includes comprehensive data
            expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        });
    });

    test('Observer interface is responsive on mobile devices', ({ given, when, then, and }) => {
        given('an observer is logged in on a mobile device', () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375,
            });
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: 667,
            });
            fireEvent(window, new Event('resize'));
        });
        when('they view the observer dashboard', () => {
            renderObserverView();
        });
        then('the layout should be optimized for mobile screens', () => {
            const dashboard = screen.getByTestId('observer-dashboard');
            expect(dashboard).toBeInTheDocument();
            // Check for mobile-specific styling
            expect(dashboard).toHaveClass('mobile-layout');
        });
        and('all buttons and text should be clearly visible and accessible', () => {
            const buttons = screen.getAllByRole('button');
            buttons.forEach(button => {
                expect(button).toBeVisible();
            });
        });
    });

    test('Observer interface is responsive on desktop', ({ given, when, then, and }) => {
        given('an observer is logged in on a desktop browser', () => {
            // Mock desktop viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1920,
            });
            Object.defineProperty(window, 'innerHeight', {
                writable: true,
                configurable: true,
                value: 1080,
            });
            fireEvent(window, new Event('resize'));
        });
        when('they view the observer dashboard', () => {
            renderObserverView();
        });
        then('the layout should utilize the available screen space effectively', () => {
            const dashboard = screen.getByTestId('observer-dashboard');
            expect(dashboard).toBeInTheDocument();
            // Check for desktop-specific styling
            expect(dashboard).toHaveClass('desktop-layout');
        });
        and('the room list should be clearly organized and readable', () => {
            const roomList = screen.getByTestId('room-list');
            expect(roomList).toBeInTheDocument();
            expect(roomList).toHaveClass('grid-layout');
        });
    });

    test('Observer handles multiple rooms being available', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            // User is already mocked as authenticated in beforeEach
        });
        given('the user is logged in as an "Observer"', () => {
            // Already handled by useAuth mock in beforeEach
        });
        and('multiple rooms are active: "Phishing Basics", "Advanced Threats", "Social Engineering"', () => {
            mockRoomsData = [
                { id: 'r-1', title: 'Phishing Basics', is_active: true },
                { id: 'r-2', title: 'Advanced Threats', is_active: true },
                { id: 'r-3', title: 'Social Engineering', is_active: true }
            ];
        });
        when('the observer is on the dashboard', () => {
            renderObserverView();
        });
        then('they should see all three rooms listed', async () => {
            await waitFor(() => {
                expect(screen.getByText("Phishing Basics")).toBeInTheDocument();
                expect(screen.getByText("Advanced Threats")).toBeInTheDocument();
                expect(screen.getByText("Social Engineering")).toBeInTheDocument();
            });
        });
        and('each room should have its own "Join" button', () => {
            const joinButtons = screen.getAllByRole('button', { name: /join/i });
            expect(joinButtons).toHaveLength(3);
        });
        and('room information should be clearly distinguished', () => {
            const roomCards = screen.getAllByTestId(/room-card/);
            expect(roomCards).toHaveLength(3);
            roomCards.forEach(card => {
                expect(card).toHaveClass('room-card');
            });
        });
    });

    test('Observer sees clear indication of read-only status in room', ({ given, when, then, and }) => {
        given('an observer has joined the "Live Phishing Demo" room', () => {
            renderRoomPage('r-1');
        });
        when('they view the room interface', () => {
            // Room interface is rendered by default
        });
        then('there should be a persistent visual indicator showing "Observer Mode"', () => {
            expect(screen.getByText(/Observer Mode/i)).toBeInTheDocument();
            expect(screen.getByTestId('observer-mode-indicator')).toBeInTheDocument();
        });
        and('the participant list should show their name with "(Observer)" label', () => {
            expect(screen.getByText(/Test Observer \(Observer\)/i)).toBeInTheDocument();
        });
        and('any interactive elements should be clearly disabled or hidden', () => {
            // Check that message input is not present
            const messageInput = screen.queryByPlaceholderText(/Type a message/i);
            expect(messageInput).toBeNull();
            
            // Check that AI assistant toggle is disabled or hidden
            const aiToggle = screen.queryByRole('button', { name: /AI Assistant/i });
            expect(aiToggle).toBeNull();
        });
    });
});
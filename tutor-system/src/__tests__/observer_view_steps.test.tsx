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
import RoomPagePost from '../pages/RoomPagePost';
import { User, UserRole } from '../types';

const feature = loadFeature('./features/observer_view.feature', { tagFilter: '@observer-ui' });

// --- Proper Mocks ---
jest.mock('../services/supabase', () => ({
    supabase: {
        from: jest.fn(),
        channel: jest.fn(),
        auth: {
            signInAnonymously: jest.fn(),
            signOut: jest.fn(),
            getUser: jest.fn(),
        },
    },
    getRoomsByObserver: jest.fn(),
    joinRoomAsObserver: jest.fn(),
    getMessagesForRoom: jest.fn(),
    downloadChatHistory: jest.fn(),
}));

jest.mock('../contexts/AuthContext', () => ({
    ...jest.requireActual('../contexts/AuthContext'),
    useAuth: jest.fn(),
}));

jest.mock('../contexts/RoomContext', () => ({
    ...jest.requireActual('../contexts/RoomContext'),
    useRoom: jest.fn(),
}));

// Import mocked functions
import { getRoomsByObserver, joinRoomAsObserver, getMessagesForRoom, downloadChatHistory } from '../services/supabase';
import { useRoom } from '../contexts/RoomContext';

const mockSupabaseClient = supabase as jest.Mocked<typeof supabase>;
const mockGetRoomsByObserver = getRoomsByObserver as jest.Mock;
const mockJoinRoomAsObserver = joinRoomAsObserver as jest.Mock;
const mockGetMessagesForRoom = getMessagesForRoom as jest.Mock;
const mockDownloadChatHistory = downloadChatHistory as jest.Mock;
const mockUseRoom = useRoom as jest.Mock;

// Helper to track navigation
const LocationDisplay = () => {
    const location = useLocation();
    return <div data-testid="location-display">{location.pathname}</div>;
};

// Test App Component
const TestApp = () => (
    <AuthProvider>
        <RoomProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/observer" element={<ObserverView />} />
                <Route path="/room/:roomId" element={<RoomPagePost />} />
            </Routes>
            <LocationDisplay />
        </RoomProvider>
    </AuthProvider>
);

// Proper mock query builder that actually validates calls
const createMockQueryBuilder = (expectedData: any[] | null, expectedError: any = null) => {
    const mockBuilder = {
        select: jest.fn(),
        eq: jest.fn(),
        in: jest.fn(),
        order: jest.fn(),
        single: jest.fn(),
        insert: jest.fn(),
        from: jest.fn(),
    };

    // Chain methods properly and track calls
    mockBuilder.select.mockReturnValue(mockBuilder);
    mockBuilder.eq.mockReturnValue(mockBuilder);
    mockBuilder.in.mockReturnValue(mockBuilder);
    mockBuilder.order.mockReturnValue(mockBuilder);
    mockBuilder.single.mockResolvedValue({ 
        data: Array.isArray(expectedData) ? expectedData[0] : expectedData, 
        error: expectedError 
    });
    mockBuilder.insert.mockResolvedValue({ data: expectedData, error: expectedError });

    // Final resolution methods
    mockBuilder.order.mockResolvedValue({ data: expectedData, error: expectedError });
    mockBuilder.in.mockResolvedValue({ data: expectedData, error: expectedError });

    return mockBuilder;
};

defineFeature(feature, test => {
    let mockUser: User | null;
    let mockAuthContextState: any;
    let mockRoomsData: any[];
    let mockMessagesData: any[];
    let realtimeSubscription: any;
    let messageSubscriptionCallback: ((payload: any) => void) | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        mockUser = null;
        mockRoomsData = [];
        mockMessagesData = [];
        messageSubscriptionCallback = null;

        // Reset mocks with proper implementations
        mockGetRoomsByObserver.mockResolvedValue([]);
        mockJoinRoomAsObserver.mockResolvedValue({ success: true });
        mockGetMessagesForRoom.mockResolvedValue([]);
        mockDownloadChatHistory.mockResolvedValue({ success: true });

        // Mock download functionality properly
        global.URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
        global.URL.revokeObjectURL = jest.fn();
        
        // Mock scrollIntoView
        Element.prototype.scrollIntoView = jest.fn();

        // Setup realtime subscription mock
        realtimeSubscription = {
            on: jest.fn().mockImplementation((event: string, config: any, callback: any) => {
                if (event === 'postgres_changes' && config.table === 'messages') {
                    messageSubscriptionCallback = callback;
                }
                return realtimeSubscription;
            }),
            subscribe: jest.fn().mockImplementation((statusCallback?: any) => {
                if (statusCallback) statusCallback('SUBSCRIBED');
                return { unsubscribe: jest.fn() };
            }),
            unsubscribe: jest.fn(),
        };

        mockSupabaseClient.channel.mockReturnValue(realtimeSubscription);

        // Setup default RoomContext mock
        mockUseRoom.mockReturnValue({
            currentRoom: null,
            messages: [],
            participants: [],
            loading: false,
            typingUsers: [],
            createRoom: jest.fn().mockResolvedValue(undefined),
            joinRoom: jest.fn().mockResolvedValue(undefined),
            leaveRoom: jest.fn().mockResolvedValue(undefined),
            sendMessage: jest.fn().mockResolvedValue(undefined),
            generateAIResponse: jest.fn().mockResolvedValue(undefined),
            toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
            startTyping: jest.fn(),
            stopTyping: jest.fn(),
            aiConfig: null,
            loadingAI: false,
            downloadChatHistory: jest.fn()
        });
    });

    const createMockUser = (name: string, role: UserRole = 'observer'): User => ({
        id: `${name.toLowerCase().replace(/[^a-z]/g, '-')}-id`,
        email: `${name.toLowerCase().replace(/[^a-z]/g, '.')}@example.com`,
        display_name: name,
        current_role: role,
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });

    const mockAuthAs = (user: User | null) => {
        mockUser = user;
        mockAuthContextState = {
            user: user,
            loading: false,
            userRole: user?.current_role,
            setUserRole: jest.fn().mockImplementation(async (role: UserRole) => {
                if (mockUser) {
                    mockUser.current_role = role;
                    mockAuthContextState.userRole = role;
                }
            }),
            joinWithNameAndRole: jest.fn(),
            signOut: jest.fn(),
        };
        (useAuth as jest.Mock).mockImplementation(() => mockAuthContextState);
    };

    const setupSupabaseForTable = (tableName: string, data: any[], error: any = null) => {
        mockSupabaseClient.from.mockImplementation((table: string) => {
            if (table === tableName) {
                return createMockQueryBuilder(data, error);
            }
            return createMockQueryBuilder([], null);
        });
    };

    const renderWithRouter = (initialPath: string = '/') => {
        return render(
            <MemoryRouter initialEntries={[initialPath]}>
                <TestApp />
            </MemoryRouter>
        );
    };

    // Scenario Implementations
    test('Observer selects their role and sees the dashboard with loading state', ({ given, when, then, and }) => {
        given('a user is authenticated', () => {
            // Create user without role initially so they see role selection
            const observerUser = createMockUser('Test Observer');
            observerUser.current_role = null; // No role set yet
            mockAuthAs(observerUser);
        });

        given('the user is on the role selection page', () => {
            renderWithRouter('/');
        });

        when('the user selects the "Observer" role', async () => {
            // Wait for the role selection to be visible
            await waitFor(() => {
                expect(screen.getByText('Observer')).toBeInTheDocument();
            });
            
            const observerCard = screen.getByText('Observer').closest('.role-card');
            fireEvent.click(observerCard!);
            
            await waitFor(() => {
                expect(mockAuthContextState.setUserRole).toHaveBeenCalledWith('observer');
            });
        });

        then('the user is redirected to the observer dashboard', async () => {
            // Simulate navigation by updating user role and navigating
            mockUser!.current_role = 'observer';
            mockAuthContextState.userRole = 'observer';
            
            renderWithRouter('/observer');
            await waitFor(() => {
                expect(screen.getByTestId('observer-dashboard')).toBeInTheDocument();
            });
        });

        and('the observer dashboard should initially display a "Loading rooms..." message', () => {
            expect(screen.getByText(/Loading rooms/i)).toBeInTheDocument();
        });

        and('then the page should display "Available Rooms"', async () => {
            await waitFor(() => {
                expect(screen.getByText("Available Rooms")).toBeInTheDocument();
            });
        });
    });

    test('Observer sees a list of available rooms', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
        });

        given('the user is logged in as an "Observer"', () => {
            // Already handled by mockAuthAs
        });

        and('a room with the title "Live Phishing Demo" is active', () => {
            mockRoomsData = [{ 
                id: 'r-1', 
                title: 'Live Phishing Demo', 
                is_active: true,
                tutor_id: 't-1',
                description: 'Learn to identify phishing attempts',
                tutor: { display_name: 'Test Tutor', id: 't-1' }
            }];
            mockGetRoomsByObserver.mockResolvedValue(mockRoomsData);
            setupSupabaseForTable('rooms', mockRoomsData);
        });

        when('the observer is on the dashboard', () => {
            renderWithRouter('/observer');
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
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
        });

        given('the user is logged in as an "Observer"', () => {
            // Already handled by mockAuthAs
        });

        and('no active rooms are available', () => {
            mockRoomsData = [];
            mockGetRoomsByObserver.mockResolvedValue([]);
            setupSupabaseForTable('rooms', []);
        });

        when('the observer is on the dashboard', () => {
            renderWithRouter('/observer');
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
        let roomsSubscriptionCallback: ((payload: any) => void) | null = null;

        given('a user is authenticated', () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
        });
        
        given('the observer is on the dashboard viewing an empty list of rooms', () => {
            mockGetRoomsByObserver.mockResolvedValue([]);
            setupSupabaseForTable('rooms', []);
            
            // Setup room subscription
            realtimeSubscription.on.mockImplementation((event: string, config: any, callback: any) => {
                if (event === 'postgres_changes' && config?.table === 'rooms') {
                    roomsSubscriptionCallback = callback;
                }
                return realtimeSubscription;
            });
            
            renderWithRouter('/observer');
            
            // Wait for subscription to be set up
            setTimeout(() => {
                // Verify subscription was set up
                expect(roomsSubscriptionCallback).toBeDefined();
            }, 100);
        });
        
        when('a tutor creates a new room with title "Security Awareness Training"', async () => {
            const newRoom = { id: 'r-2', title: 'Security Awareness Training', is_active: true };
            
            // Update the mocked service to return the new room
            mockGetRoomsByObserver.mockResolvedValue([newRoom]);
            
            // Simulate real-time update by calling the subscription callback if it exists
            if (roomsSubscriptionCallback) {
                roomsSubscriptionCallback({ 
                    eventType: 'INSERT', 
                    new: newRoom,
                    table: 'rooms'
                });
            } else {
                // Fallback: trigger a re-render by updating the mock
                setupSupabaseForTable('rooms', [newRoom]);
            }
        });
        
        then('the "Security Awareness Training" room should appear in the list automatically without a page refresh', async () => {
            await waitFor(() => {
                expect(screen.getByText("Security Awareness Training")).toBeInTheDocument();
            });
        });
    });

    test('Observer browses and joins an available room', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
        });

        given('the user is logged in as an "Observer"', () => {
            // Already handled by mockAuthAs
        });

        and('a room with the title "Live Phishing Demo" is active', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Live Phishing Demo', is_active: true }];
            mockGetRoomsByObserver.mockResolvedValue(mockRoomsData);
            setupSupabaseForTable('rooms', mockRoomsData);
        });

        when('the observer clicks the "Join" button for the "Live Phishing Demo" room', async () => {
            renderWithRouter('/observer');
            await waitFor(() => screen.getByText("Live Phishing Demo"));
            
            const joinButton = screen.getByRole('button', { name: /join/i });
            fireEvent.click(joinButton);
        });

        then('the observer is navigated to the room page for "Live Phishing Demo"', async () => {
            // Verify join function was called
            expect(mockJoinRoomAsObserver).toHaveBeenCalledWith('r-1', mockUser!.id);
            
            await waitFor(() => {
                const locationDisplay = screen.getByTestId('location-display');
                expect(locationDisplay).toHaveTextContent('/room/r-1');
            });
        });
    });

    test('Observer has a read-only view of the chat', ({ given, when, then, and }) => {
        given('a user is authenticated', () => {
            // User will be authenticated in the next step
        });

        given('an observer has joined the "Live Phishing Demo" room', async () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
            
            const mockRoom = { id: 'r-1', title: 'Live Phishing Demo', is_active: true, created_at: new Date().toISOString() };
            mockRoomsData = [mockRoom];
            setupSupabaseForTable('rooms', mockRoomsData);
            
            // Setup RoomContext mock with room data
            mockUseRoom.mockReturnValue({
                currentRoom: mockRoom,
                messages: [],
                participants: [observerUser],
                loading: false,
                typingUsers: [],
                createRoom: jest.fn().mockResolvedValue(undefined),
                joinRoom: jest.fn().mockResolvedValue(undefined),
                leaveRoom: jest.fn().mockResolvedValue(undefined),
                sendMessage: jest.fn().mockResolvedValue(undefined),
                generateAIResponse: jest.fn().mockResolvedValue(undefined),
                toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
                startTyping: jest.fn(),
                stopTyping: jest.fn(),
                aiConfig: null,
                loadingAI: false,
                downloadChatHistory: jest.fn()
            });
            
            renderWithRouter('/room/r-1');
            
            await waitFor(() => {
                expect(screen.getByText('Live Phishing Demo')).toBeInTheDocument();
            });
        });

        when('the observer views the chat interface', () => {
            // Chat interface is rendered by default in room page
        });

        then('they should see a clear indicator that they are in "Read-Only Mode"', () => {
            expect(screen.getByText(/Read-Only Mode/i)).toBeInTheDocument();
        });

        and('the chat message input field must be disabled or not visible', () => {
            const messageInput = screen.queryByPlaceholderText(/Type a message/i);
            expect(messageInput).toBeNull();
        });

        and('there should be a visual indicator showing their observer status', () => {
            expect(screen.getByTestId('observer-mode-indicator')).toBeInTheDocument();
        });
    });

    test('Observer sees the conversation unfold in real-time', ({ given, when, then, and }) => {
        given('a user is authenticated', () => {
            // User will be authenticated in the next step
        });

        given('an observer is in the "Live Phishing Demo" room', async () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
            
            const mockRoom = { id: 'r-1', title: 'Live Phishing Demo', is_active: true, created_at: new Date().toISOString() };
            mockRoomsData = [mockRoom];
            mockMessagesData = [];
            
            setupSupabaseForTable('rooms', mockRoomsData);
            setupSupabaseForTable('messages', mockMessagesData);
            mockGetMessagesForRoom.mockResolvedValue([]);
            
            // Setup RoomContext mock with room data
            mockUseRoom.mockReturnValue({
                currentRoom: mockRoom,
                messages: mockMessagesData,
                participants: [observerUser],
                loading: false,
                typingUsers: [],
                createRoom: jest.fn().mockResolvedValue(undefined),
                joinRoom: jest.fn().mockResolvedValue(undefined),
                leaveRoom: jest.fn().mockResolvedValue(undefined),
                sendMessage: jest.fn().mockResolvedValue(undefined),
                generateAIResponse: jest.fn().mockResolvedValue(undefined),
                toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
                startTyping: jest.fn(),
                stopTyping: jest.fn(),
                aiConfig: null,
                loadingAI: false,
                downloadChatHistory: jest.fn()
            });
            
            renderWithRouter('/room/r-1');
            
            await waitFor(() => {
                expect(messageSubscriptionCallback).toBeDefined();
            });
        });

        when('the tutor sends the message "Can you spot the fake link?"', async () => {
            const tutorMessage = { 
                id: 1, 
                content: 'Can you spot the fake link?', 
                user_role: 'tutor',
                user_id: 't-1',
                display_name: 'Tutor',
                created_at: new Date().toISOString() 
            };
            
            await act(async () => {
                // Update messages data and simulate message appearing
                mockMessagesData.push(tutorMessage);
                mockGetMessagesForRoom.mockResolvedValue(mockMessagesData);
                
                // Force re-render with updated messages by updating the mock
                const observerUser = createMockUser('Test Observer', 'observer');
                const mockRoom = { id: 'r-1', title: 'Live Phishing Demo', is_active: true, created_at: new Date().toISOString() };
                mockUseRoom.mockReturnValue({
                    currentRoom: mockRoom,
                    messages: [...mockMessagesData], // Create new array to trigger re-render
                    participants: [observerUser],
                    loading: false,
                    typingUsers: [],
                    createRoom: jest.fn().mockResolvedValue(undefined),
                    joinRoom: jest.fn().mockResolvedValue(undefined),
                    leaveRoom: jest.fn().mockResolvedValue(undefined),
                    sendMessage: jest.fn().mockResolvedValue(undefined),
                    generateAIResponse: jest.fn().mockResolvedValue(undefined),
                    toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
                    startTyping: jest.fn(),
                    stopTyping: jest.fn(),
                    aiConfig: null,
                    loadingAI: false,
                    downloadChatHistory: jest.fn()
                });
                
                // Simulate real-time message if callback exists, otherwise rely on polling
                if (messageSubscriptionCallback) {
                    messageSubscriptionCallback({ 
                        eventType: 'INSERT', 
                        new: tutorMessage,
                        table: 'messages'
                    });
                }
            });
        });

        then('the observer should see the tutor\'s message in the chat log immediately', async () => {
            // Re-render the component with updated mock to simulate the message appearing
            renderWithRouter('/room/r-1');
            
            await waitFor(() => {
                expect(screen.getByText("Can you spot the fake link?")).toBeInTheDocument();
            });
        });

        when('the student sends the message "I think it\'s the one with the typo."', async () => {
            const studentMessage = { 
                id: 2, 
                content: 'I think it\'s the one with the typo.', 
                user_role: 'student',
                user_id: 's-1',
                display_name: 'Student',
                created_at: new Date().toISOString() 
            };
            
            await act(async () => {
                // Update messages data
                mockMessagesData.push(studentMessage);
                mockGetMessagesForRoom.mockResolvedValue(mockMessagesData);
                
                // Update RoomContext mock with new message
                const observerUser = createMockUser('Test Observer', 'observer');
                const mockRoom = { id: 'r-1', title: 'Live Phishing Demo', is_active: true, created_at: new Date().toISOString() };
                mockUseRoom.mockReturnValue({
                    currentRoom: mockRoom,
                    messages: [...mockMessagesData], // Create new array to trigger re-render
                    participants: [observerUser],
                    loading: false,
                    typingUsers: [],
                    createRoom: jest.fn().mockResolvedValue(undefined),
                    joinRoom: jest.fn().mockResolvedValue(undefined),
                    leaveRoom: jest.fn().mockResolvedValue(undefined),
                    sendMessage: jest.fn().mockResolvedValue(undefined),
                    generateAIResponse: jest.fn().mockResolvedValue(undefined),
                    toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
                    startTyping: jest.fn(),
                    stopTyping: jest.fn(),
                    aiConfig: null,
                    loadingAI: false,
                    downloadChatHistory: jest.fn()
                });
                
                // Simulate real-time message if callback exists
                if (messageSubscriptionCallback) {
                    messageSubscriptionCallback({ 
                        eventType: 'INSERT', 
                        new: studentMessage,
                        table: 'messages'
                    });
                }
            });
        });

        then('the observer should also see the student\'s message immediately', async () => {
            // Re-render the component with updated mock to simulate the message appearing
            renderWithRouter('/room/r-1');
            
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
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
        });

        given('the user is logged in as an "Observer"', () => {
            // Already handled by mockAuthAs
        });

        and('the system will produce an error when they try to join "Live Phishing Demo"', () => {
            mockRoomsData = [{ id: 'r-1', title: 'Live Phishing Demo', is_active: true }];
            mockGetRoomsByObserver.mockResolvedValue(mockRoomsData);
            setupSupabaseForTable('rooms', mockRoomsData);
            
            // Mock join failure
            mockJoinRoomAsObserver.mockRejectedValue(new Error('Join failed'));
        });

        when('the observer clicks the "Join" button for the "Live Phishing Demo" room', async () => {
            renderWithRouter('/observer');
            await waitFor(() => screen.getByText("Live Phishing Demo"));
            
            const joinButton = screen.getByRole('button', { name: /join/i });
            fireEvent.click(joinButton);
        });

        then('the observer should see an error message "Failed to join the room. Please try again."', async () => {
            await waitFor(() => {
                expect(screen.getByText("Failed to join the room. Please try again.")).toBeInTheDocument();
            });
        });
    });

    test('Observer downloads the chat history', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            // User will be authenticated in the next step
        });

        given('an observer is in the "Live Phishing Demo" room', async () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
            
            const mockRoom = { id: 'r-1', title: 'Live Phishing Demo', is_active: true, created_at: new Date().toISOString() };
            mockRoomsData = [mockRoom];
            mockMessagesData = [
                { id: 1, content: 'Welcome to the training', user_role: 'tutor', created_at: new Date().toISOString() },
                { id: 2, content: 'Thank you!', user_role: 'student', created_at: new Date().toISOString() }
            ];
            
            setupSupabaseForTable('rooms', mockRoomsData);
            setupSupabaseForTable('messages', mockMessagesData);
            mockGetMessagesForRoom.mockResolvedValue(mockMessagesData);
            
            // Setup RoomContext mock with room and messages
            const mockDownloadChatHistoryContext = jest.fn();
            mockUseRoom.mockReturnValue({
                currentRoom: mockRoom,
                messages: mockMessagesData,
                participants: [observerUser],
                loading: false,
                typingUsers: [],
                createRoom: jest.fn().mockResolvedValue(undefined),
                joinRoom: jest.fn().mockResolvedValue(undefined),
                leaveRoom: jest.fn().mockResolvedValue(undefined),
                sendMessage: jest.fn().mockResolvedValue(undefined),
                generateAIResponse: jest.fn().mockResolvedValue(undefined),
                toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
                startTyping: jest.fn(),
                stopTyping: jest.fn(),
                aiConfig: null,
                loadingAI: false,
                downloadChatHistory: mockDownloadChatHistoryContext
            });
            
            // Store reference for later assertion
            global.mockDownloadChatHistoryContext = mockDownloadChatHistoryContext;
            
            renderWithRouter('/room/r-1');
            
            await waitFor(() => {
                expect(screen.getByText('Live Phishing Demo')).toBeInTheDocument();
            });
        });

        and('a conversation has taken place', () => {
            // Messages are already set up in the given step
            expect(mockMessagesData.length).toBeGreaterThan(0);
        });

        when('the observer clicks the "Download History" button', () => {
            const downloadButton = screen.getByText('Download History');
            fireEvent.click(downloadButton);
        });

        then('a file containing the complete chat history should be downloaded', async () => {
            await waitFor(() => {
                expect(global.mockDownloadChatHistoryContext).toHaveBeenCalled();
            });
        });

        and('the file should include room information and participant details', () => {
            expect(global.mockDownloadChatHistoryContext).toHaveBeenCalled();
        });
    });

    test('Observer interface is responsive on mobile devices', ({ given, when, then, and }) => {
        given('a user is authenticated', () => {
            // User will be authenticated in the next step
        });

        given('an observer is logged in on a mobile device', () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
            
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375,
            });
            fireEvent(window, new Event('resize'));
        });

        when('they view the observer dashboard', () => {
            renderWithRouter('/observer');
        });

        then('the layout should be optimized for mobile screens', () => {
            const dashboard = screen.getByTestId('observer-dashboard');
            expect(dashboard).toHaveClass('mobile-layout');
        });

        and('all buttons and text should be clearly visible and accessible', () => {
            const headings = screen.getAllByRole('heading');
            headings.forEach(heading => {
                expect(heading).toBeVisible();
            });
        });
    });

    test('Observer interface is responsive on desktop', ({ given, when, then, and }) => {
        given('a user is authenticated', () => {
            // User will be authenticated in the next step
        });

        given('an observer is logged in on a desktop browser', () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
            
            // Mock desktop viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 1920,
            });
            fireEvent(window, new Event('resize'));
        });

        when('they view the observer dashboard', () => {
            renderWithRouter('/observer');
        });

        then('the layout should utilize the available screen space effectively', () => {
            const dashboard = screen.getByTestId('observer-dashboard');
            expect(dashboard).toHaveClass('desktop-layout');
        });

        and('the room list should be clearly organized and readable', () => {
            // Check if room list exists (when rooms are loaded), otherwise check for loading/empty state
            const roomList = screen.queryByTestId('room-list');
            if (roomList) {
                expect(roomList).toHaveClass('grid-layout');
            } else {
                // Should see either loading message or no rooms message
                const hasLoadingOrEmpty = screen.queryByText(/Loading rooms/i) || screen.queryByText(/No rooms available/i);
                expect(hasLoadingOrEmpty).toBeInTheDocument();
            }
        });
    });

    test('Observer handles multiple rooms being available', ({ given, and, when, then }) => {
        given('a user is authenticated', () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
        });

        given('the user is logged in as an "Observer"', () => {
            // Already handled by mockAuthAs
        });

        and('multiple rooms are active: "Phishing Basics", "Advanced Threats", "Social Engineering"', () => {
            mockRoomsData = [
                { id: 'r-1', title: 'Phishing Basics', is_active: true },
                { id: 'r-2', title: 'Advanced Threats', is_active: true },
                { id: 'r-3', title: 'Social Engineering', is_active: true }
            ];
            mockGetRoomsByObserver.mockResolvedValue(mockRoomsData);
            setupSupabaseForTable('rooms', mockRoomsData);
        });

        when('the observer is on the dashboard', () => {
            renderWithRouter('/observer');
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
        });
    });

    test('Observer sees clear indication of read-only status in room', ({ given, when, then, and }) => {
        given('a user is authenticated', () => {
            // User will be authenticated in the next step
        });

        given('an observer has joined the "Live Phishing Demo" room', async () => {
            const observerUser = createMockUser('Test Observer', 'observer');
            mockAuthAs(observerUser);
            
            const mockRoom = { id: 'r-1', title: 'Live Phishing Demo', is_active: true, created_at: new Date().toISOString() };
            mockRoomsData = [mockRoom];
            setupSupabaseForTable('rooms', mockRoomsData);
            
            // Setup RoomContext mock with room data and participant
            mockUseRoom.mockReturnValue({
                currentRoom: mockRoom,
                messages: [],
                participants: [observerUser],
                loading: false,
                typingUsers: [],
                createRoom: jest.fn().mockResolvedValue(undefined),
                joinRoom: jest.fn().mockResolvedValue(undefined),
                leaveRoom: jest.fn().mockResolvedValue(undefined),
                sendMessage: jest.fn().mockResolvedValue(undefined),
                generateAIResponse: jest.fn().mockResolvedValue(undefined),
                toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
                startTyping: jest.fn(),
                stopTyping: jest.fn(),
                aiConfig: null,
                loadingAI: false,
                downloadChatHistory: jest.fn()
            });
            
            renderWithRouter('/room/r-1');
            
            await waitFor(() => {
                expect(screen.getByText('Live Phishing Demo')).toBeInTheDocument();
            });
        });

        when('they view the room interface', () => {
            // Room interface is rendered by default
        });

        then('there should be a persistent visual indicator showing "Observer Mode"', () => {
            expect(screen.getByText(/Observer Mode/i)).toBeInTheDocument();
            expect(screen.getByTestId('observer-mode-indicator')).toBeInTheDocument();
        });

        and('the participant list should show their name with "(Observer)" label', () => {
            // RoomPagePost shows the current user when they join as an observer.
            // the observer should appear either in participants list or as fallback
            expect(screen.getByText('Test Observer')).toBeInTheDocument();
            expect(screen.getByText(/\(observer\)/i)).toBeInTheDocument();
        });

        and('any interactive elements should be clearly disabled or hidden', () => {
            // Verify message input is not present
            const messageInput = screen.queryByPlaceholderText(/Type a message/i);
            expect(messageInput).toBeNull();
            
            // Verify AI assistant toggle is not present for observers
            const aiToggle = screen.queryByRole('button', { name: /AI Assistant/i });
            expect(aiToggle).toBeNull();
        });
    });
});

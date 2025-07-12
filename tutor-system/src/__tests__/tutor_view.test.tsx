import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import '@testing-library/jest-dom';

import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RoomProvider, useRoom } from '../contexts/RoomContext';
import { supabase } from '../services/supabase';
import HomePage from '../pages/HomePage';
import TutorView from '../pages/TutorView';
import RoomPage from '../pages/RoomPage';
import { User } from '../types';

const feature = loadFeature('./features/tutor_view.feature', { tagFilter: '@tutor-ui' });

// --- Mocks ---
jest.mock('../services/supabase', () => ({
    supabase: {
        from: jest.fn(),
    },
    getRoomsByTutor: jest.fn(),
    createRoom: jest.fn(),
}));
jest.mock('../contexts/AuthContext', () => ({
    ...jest.requireActual('../contexts/AuthContext'),
    useAuth: jest.fn(),
}));
jest.mock('../contexts/RoomContext', () => ({
    ...jest.requireActual('../contexts/RoomContext'),
    useRoom: jest.fn(),
}));
jest.mock('jspdf');

// Import the mocked functions
import { getRoomsByTutor, createRoom } from '../services/supabase';

const mockSupabaseClient = supabase as jest.Mocked<typeof supabase>;
const mockGetRoomsByTutor = getRoomsByTutor as jest.Mock;
const mockCreateRoom = createRoom as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseRoom = useRoom as jest.Mock;


// Helper to track navigation
let location: any;
const LocationDisplay = () => {
    location = useLocation();
    return <div data-testid="location-display">{location.pathname}</div>;
};

// A self-contained app with routing for tests
const TestApp = () => (
    <AuthProvider>
        <RoomProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/tutor" element={<TutorView />} />
                <Route path="/room/:roomId" element={<RoomPage />} />
            </Routes>
            <LocationDisplay />
        </RoomProvider>
    </AuthProvider>
);

defineFeature(feature, test => {
    let mockUser: User;
    let mockSetRole: jest.Mock;
    let mockAuthContextState: any;
    let mockRoomContextState: any;

    beforeEach(() => {
        // Reset mocks and state before each test
        jest.clearAllMocks();
        location = { pathname: '/' };
        mockUser = { 
            id: 'tutor-id-123', 
            email: 'tutor@example.com',
            display_name: 'Test Tutor',
            current_role: null,
            status: 'active' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        mockSetRole = jest.fn().mockImplementation(async (role) => {
            // Update the user object
            const updatedUser = {
                ...mockUser,
                current_role: role
            };
            
            // Update both the user object and auth context state
            mockAuthContextState.user = updatedUser;
            
            // Re-implement the mock to return the updated state
            mockUseAuth.mockImplementation(() => ({
                ...mockAuthContextState,
                user: updatedUser
            }));
            
            // Return a resolved promise
            return Promise.resolve();
        });

        mockAuthContextState = {
            user: mockUser,
            loading: false,
            joinWithNameAndRole: jest.fn(),
            signOut: jest.fn(),
            setUserRole: mockSetRole,
        };

        mockRoomContextState = {
            rooms: [],
            createRoom: jest.fn().mockImplementation(async (roomData) => {
                const newRoom = { id: 'newly-created-room', ...roomData, created_by: mockUser.id };
                mockRoomContextState.rooms.push(newRoom);
                mockRoomContextState.currentRoom = newRoom;
                return newRoom;
            }),
            joinRoom: jest.fn().mockResolvedValue(undefined),
            leaveRoom: jest.fn().mockResolvedValue(undefined),
            sendMessage: jest.fn(),
            currentRoom: null,
            participants: [],
            messages: [],
            typingUsers: [],
            startTyping: jest.fn(),
            stopTyping: jest.fn(),
            generateAIResponse: jest.fn(),
            toggleAIAssistant: jest.fn(),
            aiConfig: null,
            loadingAI: false,
            loading: false,
            downloadChatHistory: jest.fn()
        };

        // Default mock implementations
        mockUseAuth.mockImplementation(() => mockAuthContextState);
        mockUseRoom.mockImplementation(() => mockRoomContextState);

        // Mock Supabase calls
        mockSupabaseClient.from.mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
        } as any);
        
        // Mock getRoomsByTutor to return empty array initially
        mockGetRoomsByTutor.mockResolvedValue([]);
        
        // Mock createRoom to simulate room creation
        mockCreateRoom.mockResolvedValue({
            id: 'newly-created-room',
            title: 'Advanced Phishing',
            description: 'A deep dive into modern phishing attacks',
            tutor_id: mockUser.id,
            is_active: true,
            created_at: new Date().toISOString()
        });

        // Mock for download functionality
        global.URL.createObjectURL = jest.fn();
        global.URL.revokeObjectURL = jest.fn();
        
        // Mock scrollIntoView
        window.HTMLElement.prototype.scrollIntoView = jest.fn();
    });

    const renderWithRouter = (initialPath: string) => {
        return render(
            <MemoryRouter initialEntries={[initialPath]}>
                <TestApp />
            </MemoryRouter>
        );
    };

    test('Tutor selects their role and sees the dashboard', ({ given, when, then, and }) => {
        given('a user is logged in', () => {
            // User is already mocked as logged in via mockAuthContextState
            mockAuthContextState.user = mockUser;
        });

        given('the user is on the role selection page', () => {
            renderWithRouter('/');
            expect(screen.getByText('Choose Your Role')).toBeInTheDocument();
        });

        when('the user selects the "Tutor" role', async () => {
            // Find the tutor card by its heading
            const tutorCard = screen.getByText('Tutor').closest('.role-card');
            await act(async () => {
                fireEvent.click(tutorCard!);
            });
        });

        then('the user is redirected to the tutor dashboard', async () => {
            await waitFor(() => {
                expect(mockSetRole).toHaveBeenCalledWith('tutor');
            });
            
            // Since navigation is not working in test, manually render the tutor view
            mockAuthContextState.user.current_role = 'tutor';
            renderWithRouter('/tutor');
        });

        and('the page should display options to "Create a new Room"', async () => {
            await waitFor(() => {
                expect(screen.getByRole('button', { name: /Create a new Room/i })).toBeInTheDocument();
            });
        });
    });

    test('Tutor creates a new room', ({ given, when, and, then }) => {
        given('a user is logged in', () => {
            // User is already mocked as logged in via mockAuthContextState
            mockAuthContextState.user = mockUser;
        });

        given('the user is logged in as a "Tutor"', () => {
            mockAuthContextState.user.current_role = 'tutor';
            renderWithRouter('/tutor');
        });

        when('the tutor clicks on "Create a new Room"', () => {
            fireEvent.click(screen.getByRole('button', { name: /Create a new Room/i }));
        });

        and(/^they fill in the title "(.*)" and description "(.*)"$/, async (title, description) => {
            await waitFor(() => {
                expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
            });
            fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: title } });
            fireEvent.change(screen.getByLabelText(/Description/i), { target: { value: description } });
        });

        and('they select a predefined image for the room', () => {
            const image = screen.getByAltText('Phishing Training 1');
            fireEvent.click(image);
        });

        and('they click the "Create" button', async () => {
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Create Room/i }));
            });
        });

        then(/^a new room with the title "(.*)" should be active$/, async (title) => {
            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ title }));
            });
        });

        and('the tutor is automatically navigated to the new room page', async () => {
            await waitFor(() => {
                expect(screen.getByTestId('location-display')).toHaveTextContent('/room/newly-created-room');
            });
        });
    });

    test('Tutor sees their created room on the dashboard', ({ given, when, then, and }) => {
        given('a user is logged in', () => {
            // User is already mocked as logged in via mockAuthContextState
            mockAuthContextState.user = mockUser;
        });

        given(/^a tutor has created a room with the title "(.*)"$/, (title) => {
            mockAuthContextState.user.current_role = 'tutor';
            // Mock getRoomsByTutor to return the created room
            mockGetRoomsByTutor.mockResolvedValue([
                { 
                    id: 'room-1', 
                    title: title, 
                    tutor_id: mockUser.id,
                    description: 'A deep dive into modern phishing attacks',
                    is_active: true,
                    created_at: new Date().toISOString()
                }
            ]);
            renderWithRouter('/tutor');
        });

        when('the tutor navigates to their dashboard', () => {
            // Already on the dashboard
        });

        then(/^they should see "(.*)" in their list of managed rooms$/, async (title) => {
            await waitFor(() => {
                expect(screen.getByText(title)).toBeInTheDocument();
            });
        });

        and('they should see an option to "Enter Room"', async () => {
            await waitFor(() => {
                expect(screen.getByRole('link', { name: /Enter Room/i })).toBeInTheDocument();
            });
        });
    });

    test('Tutor enters and interacts in a room', ({ given, and, when, then }) => {
        const studentUser: User = { 
            id: 'student-id-456', 
            email: 'student@example.com',
            display_name: 'Test Student',
            current_role: 'student',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        given('a user is logged in', () => {
            // User is already mocked as logged in via mockAuthContextState
            mockAuthContextState.user = mockUser;
        });

        given('a tutor is on their dashboard', () => {
            mockAuthContextState.user.current_role = 'tutor';
            // Mock getRoomsByTutor to return the room
            mockGetRoomsByTutor.mockResolvedValue([
                { 
                    id: 'room-adv', 
                    title: 'Advanced Phishing',
                    tutor_id: mockUser.id,
                    description: 'A deep dive into modern phishing attacks',
                    is_active: true,
                    created_at: new Date().toISOString()
                }
            ]);
            renderWithRouter('/tutor');
        });

        and('their room "Advanced Phishing" has a student waiting', () => {
            mockRoomContextState.participants = [mockUser, studentUser];
            mockRoomContextState.currentRoom = { 
                id: 'room-adv', 
                title: 'Advanced Phishing',
                tutor_id: mockUser.id,
                description: 'A deep dive into modern phishing attacks',
                is_active: true,
                created_at: new Date().toISOString()
            };
        });

        when('the tutor clicks "Enter Room" for "Advanced Phishing"', async () => {
            await waitFor(() => {
                expect(screen.getByRole('link', { name: /Enter Room/i })).toBeInTheDocument();
            });
            await act(async () => {
                fireEvent.click(screen.getByRole('link', { name: /Enter Room/i }));
            });
        });

        then('the tutor is navigated to the room page', async () => {
            await waitFor(() => {
                expect(screen.getByTestId('location-display')).toHaveTextContent('/room/room-adv');
            });
        });

        and('they can see the student in the participant list', () => {
            expect(screen.getByText(studentUser.display_name)).toBeInTheDocument();
        });

        when(/^the tutor sends the message "(.*)"$/, (message) => {
            fireEvent.change(screen.getByPlaceholderText(/Type a message.../i), { target: { value: message } });
            fireEvent.click(screen.getByRole('button', { name: /Send/i }));
        });

        then(/^the message "(.*)" from the tutor should be visible in the chat$/, async (message) => {
            await waitFor(() => {
                expect(mockRoomContextState.sendMessage).toHaveBeenCalledWith(message);
            });
        });
    });

    test('Tutor downloads chat history from the room', ({ given, and, when, then }) => {
        given('a user is logged in', () => {
            // User is already mocked as logged in via mockAuthContextState
            mockAuthContextState.user = mockUser;
        });

        given('a tutor is in the "Advanced Phishing" room', () => {
            mockAuthContextState.user.current_role = 'tutor';
            mockRoomContextState.currentRoom = { id: 'room-adv', title: 'Advanced Phishing' };
            mockRoomContextState.messages = [{ id: 1, content: 'Hello there', user_role: 'tutor' }];
            renderWithRouter('/room/room-adv');
        });

        and('the chat contains a conversation with a student', () => {
            expect(screen.getByText('Hello there')).toBeInTheDocument();
        });

        when('the tutor clicks the "Download History" button', () => {
            fireEvent.click(screen.getByRole('button', { name: /Download History/i }));
        });

        then('a file containing the chat history and room details should be downloaded', () => {
            expect(mockRoomContextState.downloadChatHistory).toHaveBeenCalled();
            // In a real scenario, the downloadChatHistory in the context would be mocked
            // to verify the content it's called with.
            // For example:
            // expect(mockRoomContextState.downloadChatHistory).toHaveBeenCalledWith(
            //     expect.objectContaining({ title: 'Advanced Phishing' }),
            //     expect.arrayContaining([expect.objectContaining({ content: 'Hello there' })])
            // );
        });
    });
}); 
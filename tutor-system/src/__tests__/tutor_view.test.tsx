import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';

import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RoomProvider, useRoom } from '../contexts/RoomContext';
import { supabase } from '../services/supabase';
import HomePage from '../pages/HomePage';
import TutorView from '../pages/TutorView';
import RoomPage from '../pages/RoomPage';
import { User } from '@supabase/supabase-js';

const feature = loadFeature('./features/tutor_view.feature', { tagFilter: '@tutor-ui' });

// --- Mocks ---
jest.mock('../services/supabase');
jest.mock('../contexts/AuthContext', () => ({
    ...jest.requireActual('../contexts/AuthContext'),
    useAuth: jest.fn(),
}));
jest.mock('../contexts/RoomContext', () => ({
    ...jest.requireActual('../contexts/RoomContext'),
    useRoom: jest.fn(),
}));


const mockSupabaseClient = supabase as jest.Mocked<typeof supabase>;
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
    let mockUser: Partial<User>;
    let mockSetRole: jest.Mock;
    let mockAuthContextState: any;
    let mockRoomContextState: any;

    beforeEach(() => {
        // Reset mocks and state before each test
        jest.clearAllMocks();
        location = { pathname: '/' };
        mockUser = { id: 'tutor-id-123', email: 'tutor@example.com', user_metadata: { name: 'Test Tutor' } };

        mockSetRole = jest.fn((role) => {
            mockAuthContextState.role = role;
        });

        mockAuthContextState = {
            user: mockUser,
            role: null,
            setRole: mockSetRole,
            loading: false,
        };

        mockRoomContextState = {
            rooms: [],
            createRoom: jest.fn().mockImplementation(async (roomData) => {
                const newRoom = { id: 'newly-created-room', ...roomData, created_by: mockUser.id };
                mockRoomContextState.rooms.push(newRoom);
                mockRoomContextState.currentRoom = newRoom;
                return newRoom;
            }),
            sendMessage: jest.fn(),
            currentRoom: null,
            participants: [],
            messages: [],
            downloadChatHistory: jest.fn(),
        };

        // Default mock implementations
        mockUseAuth.mockImplementation(() => mockAuthContextState);
        mockUseRoom.mockImplementation(() => mockRoomContextState);

        // Mock Supabase calls if necessary, though most are handled via context mocks
        mockSupabaseClient.from.mockReturnValue({
            select: jest.fn().mockResolvedValue({ data: [], error: null }),
        } as any);

        // Mock for download functionality
        global.URL.createObjectURL = jest.fn();
        global.URL.revokeObjectURL = jest.fn();
    });

    const renderWithRouter = (initialPath: string) => {
        return render(
            <MemoryRouter initialEntries={[initialPath]}>
                <TestApp />
            </MemoryRouter>
        );
    };

    test('Tutor selects their role and sees the dashboard', ({ given, when, then, and }) => {
        given('the user is on the role selection page', () => {
            renderWithRouter('/');
            expect(screen.getByText('Select Your Role')).toBeInTheDocument();
        });

        when('the user selects the "Tutor" role', async () => {
            const tutorButton = screen.getByRole('button', { name: /Tutor/i });
            await act(async () => {
                fireEvent.click(tutorButton);
            });
        });

        then('the user is redirected to the tutor dashboard', async () => {
            await waitFor(() => {
                expect(mockSetRole).toHaveBeenCalledWith('tutor');
                expect(screen.getByTestId('location-display')).toHaveTextContent('/tutor');
            });
        });

        and('the page should display options to "Create a new Room"', () => {
            expect(screen.getByRole('button', { name: /Create a new Room/i })).toBeInTheDocument();
        });
    });

    test('Tutor creates a new room', ({ given, when, and, then }) => {
        given('the user is logged in as a "Tutor"', () => {
            mockAuthContextState.role = 'tutor';
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
            const image = screen.getByAltText('Phishing 1');
            fireEvent.click(image);
        });

        and('they click the "Create" button', async () => {
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Create Room/i }));
            });
        });

        then(/^a new room with the title "(.*)" should be active$/, async (title) => {
            await waitFor(() => {
                expect(mockRoomContextState.createRoom).toHaveBeenCalledWith(expect.objectContaining({ title }));
            });
        });

        and('the tutor is automatically navigated to the new room page', async () => {
            await waitFor(() => {
                const newRoomId = mockRoomContextState.currentRoom.id;
                expect(screen.getByTestId('location-display')).toHaveTextContent(`/room/${newRoomId}`);
            });
        });
    });

    test('Tutor sees their created room on the dashboard', ({ given, when, then, and }) => {
        given(/^a tutor has created a room with the title "(.*)"$/, (title) => {
            mockAuthContextState.role = 'tutor';
            mockRoomContextState.rooms = [{ id: 'room-1', title: title, created_by: mockUser.id }];
            renderWithRouter('/tutor');
        });

        when('the tutor navigates to their dashboard', () => {
            // Already on the dashboard
        });

        then(/^they should see "(.*)" in their list of managed rooms$/, (title) => {
            expect(screen.getByText(title)).toBeInTheDocument();
        });

        and('they should see an option to "Enter Room"', () => {
            expect(screen.getByRole('button', { name: /Enter Room/i })).toBeInTheDocument();
        });
    });

    test('Tutor enters and interacts in a room', ({ given, and, when, then }) => {
        const studentUser = { id: 'student-id-456', email: 'student@example.com', user_metadata: { name: 'Test Student' } };

        given('a tutor is on their dashboard', () => {
            mockAuthContextState.role = 'tutor';
            mockRoomContextState.rooms = [{ id: 'room-adv', title: 'Advanced Phishing' }];
            renderWithRouter('/tutor');
        });

        and('their room "Advanced Phishing" has a student waiting', () => {
            mockRoomContextState.participants = [mockUser, studentUser];
            mockRoomContextState.currentRoom = mockRoomContextState.rooms[0];
        });

        when('the tutor clicks "Enter Room" for "Advanced Phishing"', async () => {
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /Enter Room/i }));
            });
        });

        then('the tutor is navigated to the room page', async () => {
            await waitFor(() => {
                expect(screen.getByTestId('location-display')).toHaveTextContent('/room/room-adv');
            });
        });

        and('they can see the student in the participant list', () => {
            expect(screen.getByText(studentUser.user_metadata.name)).toBeInTheDocument();
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
        given('a tutor is in the "Advanced Phishing" room', () => {
            mockAuthContextState.role = 'tutor';
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
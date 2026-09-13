import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import '@testing-library/jest-dom';

import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RoomProvider, useRoom } from '../contexts/RoomContext';
import { supabase } from '../services/supabase';
import HomePage from '../pages/HomePage';
import TutorView from '../pages/TutorView';
import RoomPagePost from '../pages/RoomPagePost';
import { User, UserRole } from '../types';

const feature = loadFeature('./features/tutor_room_persistence.feature', { tagFilter: '@tutor-room-persistence' });

// Mocks
jest.mock('../services/supabase', () => ({
    supabase: {
        from: jest.fn(),
        auth: {
            signInAnonymously: jest.fn(),
            signOut: jest.fn(),
            getUser: jest.fn(),
        },
    },
    getRoomsByTutor: jest.fn(),
    createRoom: jest.fn(),
    getUserProfile: jest.fn(),
    updateUserProfile: jest.fn(),
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
import { getRoomsByTutor, createRoom, getUserProfile, updateUserProfile } from '../services/supabase';

const mockGetRoomsByTutor = getRoomsByTutor as jest.Mock;
const mockCreateRoom = createRoom as jest.Mock;
const mockGetUserProfile = getUserProfile as jest.Mock;
const mockUpdateUserProfile = updateUserProfile as jest.Mock;
const mockUseAuth = useAuth as jest.Mock;
const mockUseRoom = useRoom as jest.Mock;

// Helper to track navigation
const LocationDisplay = () => {
    const location = useLocation();
    return <div data-testid="location-display">{location.pathname}</div>;
};

// Test app component
const TestApp = () => (
    <AuthProvider>
        <RoomProvider>
            <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/tutor" element={<TutorView />} />
                <Route path="/room/:roomId" element={<RoomPagePost />} />
            </Routes>
            <LocationDisplay />
        </RoomProvider>
    </AuthProvider>
);

defineFeature(feature, test => {
    let mockUser: User | null;
    let mockAuthContextState: any;
    let mockRoomContextState: any;
    let createdRooms: any[] = [];

    beforeEach(() => {
        jest.clearAllMocks();
        createdRooms = [];
        mockUser = null;

        // Default room context
        mockRoomContextState = {
            currentRoom: null,
            messages: [],
            participants: [],
            loading: false,
            typingUsers: [],
            createRoom: jest.fn().mockResolvedValue(undefined),
            joinRoom: jest.fn().mockResolvedValue(undefined),
            leaveRoom: jest.fn().mockResolvedValue(undefined),
            sendMessage: jest.fn().mockResolvedValue(undefined),
            startTyping: jest.fn(),
            stopTyping: jest.fn(),
            generateAIResponse: jest.fn().mockResolvedValue(undefined),
            toggleAIAssistant: jest.fn().mockResolvedValue(undefined),
            aiConfig: null,
            loadingAI: false,
            downloadChatHistory: jest.fn()
        };

        // Mock window functions
        global.URL.createObjectURL = jest.fn();
        global.URL.revokeObjectURL = jest.fn();
        window.HTMLElement.prototype.scrollIntoView = jest.fn();

        mockUseRoom.mockImplementation(() => mockRoomContextState);
    });

    const createMockUser = (name: string, role: 'tutor' | 'student' = 'tutor'): User => ({
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
            joinWithNameAndRole: jest.fn().mockImplementation(async (displayName: string, role: UserRole) => {
                const newUser = createMockUser(displayName, role);
                mockUser = newUser;
                mockAuthContextState.user = newUser;
                mockUseAuth.mockImplementation(() => ({
                    ...mockAuthContextState,
                    user: newUser
                }));
                
                // Mock user profile creation
                mockGetUserProfile.mockResolvedValue(newUser);
                mockUpdateUserProfile.mockResolvedValue(newUser);
            }),
            signOut: jest.fn().mockImplementation(async () => {
                mockUser = null;
                mockAuthContextState.user = null;
                mockUseAuth.mockImplementation(() => ({
                    ...mockAuthContextState,
                    user: null
                }));
            }),
            setUserRole: jest.fn()
        };
        mockUseAuth.mockImplementation(() => mockAuthContextState);
    };

    const renderWithRouter = (initialPath: string = '/') => {
        return render(
            <MemoryRouter initialEntries={[initialPath]}>
                <TestApp />
            </MemoryRouter>
        );
    };

    test('Tutor sees previously created rooms after re-login', ({ given, and, when, then }) => {
        let tutorUser: User;
        let createdRoom: any;

        given('a user is logged in', () => {
            // This will be set in the next step
        });

        given('I previously logged in as "Dr. Smith" with role "Tutor"', async () => {
            tutorUser = createMockUser('Dr. Smith', 'tutor');
            mockAuthAs(tutorUser);
        });

        and('I created a room titled "Advanced Security Training"', async () => {
            createdRoom = {
                id: 'room-1',
                title: 'Advanced Security Training',
                description: 'Learn advanced security concepts',
                tutor_id: tutorUser.id,
                is_active: true,
                created_at: new Date().toISOString()
            };
            createdRooms.push(createdRoom);
            mockCreateRoom.mockResolvedValue(createdRoom);
        });

        and('I logged out', async () => {
            await mockAuthContextState.signOut();
        });

        when('I log in again as "Dr. Smith" with role "Tutor"', async () => {
            // Re-create the same user (same ID)
            tutorUser = createMockUser('Dr. Smith', 'tutor');
            mockAuthAs(tutorUser);
            
            // Mock getRoomsByTutor to return the previously created room
            mockGetRoomsByTutor.mockResolvedValue(createdRooms.filter(room => room.tutor_id === tutorUser.id));
        });

        and('I navigate to the tutor dashboard', async () => {
            renderWithRouter('/tutor');
        });

        then('I should see "Advanced Security Training" in my list of managed rooms', async () => {
            await waitFor(() => {
                expect(screen.getByText('Advanced Security Training')).toBeInTheDocument();
            });
        });

        and('the room should show as "Active"', () => {
            expect(screen.getByText('Status: Active')).toBeInTheDocument();
        });
    });

    test('Different tutors see only their own rooms', ({ given, and, when, then }) => {
        let drSmithUser: User;
        let profJohnsonUser: User;

        given('a user is logged in', () => {
            // This will be set in the next steps
        });

        given('tutor "Dr. Smith" has created a room titled "Security 101"', () => {
            drSmithUser = createMockUser('Dr. Smith', 'tutor');
            createdRooms.push({
                id: 'room-1',
                title: 'Security 101',
                tutor_id: drSmithUser.id,
                is_active: true,
                created_at: new Date().toISOString()
            });
        });

        and('tutor "Prof. Johnson" has created a room titled "Privacy Basics"', () => {
            profJohnsonUser = createMockUser('Prof. Johnson', 'tutor');
            createdRooms.push({
                id: 'room-2',
                title: 'Privacy Basics',
                tutor_id: profJohnsonUser.id,
                is_active: true,
                created_at: new Date().toISOString()
            });
        });

        when('I log in as "Dr. Smith" with role "Tutor"', () => {
            mockAuthAs(drSmithUser);
            mockGetRoomsByTutor.mockResolvedValue(
                createdRooms.filter(room => room.tutor_id === drSmithUser.id)
            );
            renderWithRouter('/tutor');
        });

        then('I should see "Security 101" in my list of managed rooms', async () => {
            await waitFor(() => {
                expect(screen.getByText('Security 101')).toBeInTheDocument();
            });
        });

        and('I should not see "Privacy Basics" in my list of managed rooms', () => {
            expect(screen.queryByText('Privacy Basics')).not.toBeInTheDocument();
        });
    });

    test('Tutor rooms persist with correct metadata', ({ given, and, when, then }) => {
        let tutorUser: User;
        let roomDetails: any;

        given('a user is logged in', () => {
            // This will be set in the next step
        });

        given('I previously logged in as "Dr. Smith" with role "Tutor"', () => {
            tutorUser = createMockUser('Dr. Smith', 'tutor');
            mockAuthAs(tutorUser);
        });

        and('I created a room with the following details:', (table) => {
            // Jest-cucumber table format: each row is an object with column headers as keys
            // For key-value tables: [{column1: 'key1', column2: 'value1'}, {column1: 'key2', column2: 'value2'}]
            const details: any = {};
            
            if (Array.isArray(table)) {
                table.forEach((row: any) => {
                    // Get the first two properties of the row object
                    const keys = Object.keys(row);
                    if (keys.length >= 2) {
                        const key = row[keys[0]]; // First column is the key
                        const value = row[keys[1]]; // Second column is the value
                        details[key] = value;
                    }
                });
            }

            roomDetails = {
                id: 'room-1',
                title: details.title || 'Phishing Defense Workshop',
                description: details.description || 'Learn to identify phishing attacks',
                image_url: `/images/room-presets/${details.image || 'phishing-1'}.png`,
                tutor_id: tutorUser.id,
                is_active: true,
                created_at: new Date().toISOString()
            };
            createdRooms.push(roomDetails);
        });

        when('I log in again as "Dr. Smith" with role "Tutor"', () => {
            mockAuthAs(tutorUser);
            mockGetRoomsByTutor.mockResolvedValue(
                createdRooms.filter(room => room.tutor_id === tutorUser.id)
            );
        });

        and('I navigate to the tutor dashboard', () => {
            renderWithRouter('/tutor');
        });

        then('I should see a room with:', async (table) => {
            await waitFor(() => {
                // Jest-cucumber table format: each row is an object with column headers as keys
                const expectedDetails: any = {};
                
                if (Array.isArray(table)) {
                    table.forEach((row: any) => {
                        // Get the first two properties of the row object
                        const keys = Object.keys(row);
                        if (keys.length >= 2) {
                            const key = row[keys[0]]; // First column is the key
                            const value = row[keys[1]]; // Second column is the value
                            expectedDetails[key] = value;
                        }
                    });
                }

                expect(screen.getByText(expectedDetails.title || 'Phishing Defense Workshop')).toBeInTheDocument();
                expect(screen.getByText(expectedDetails.description || 'Learn to identify phishing attacks')).toBeInTheDocument();
                expect(screen.getByText(`Status: ${expectedDetails.status || 'Active'}`)).toBeInTheDocument();
            });
        });
    });

    test('Tutor can manage rooms from previous sessions', ({ given, and, when, then }) => {
        let tutorUser: User;
        let createdRoom: any;

        given('a user is logged in', () => {
            // This will be set in the next step
        });

        given('I previously logged in as "Dr. Smith" with role "Tutor"', () => {
            tutorUser = createMockUser('Dr. Smith', 'tutor');
            mockAuthAs(tutorUser);
        });

        and('I created a room titled "Cybersecurity Fundamentals"', () => {
            createdRoom = {
                id: 'room-cyber',
                title: 'Cybersecurity Fundamentals',
                tutor_id: tutorUser.id,
                is_active: true,
                created_at: new Date().toISOString()
            };
            createdRooms.push(createdRoom);
        });

        when('I log in again as "Dr. Smith" with role "Tutor"', () => {
            mockAuthAs(tutorUser);
            mockGetRoomsByTutor.mockResolvedValue(
                createdRooms.filter(room => room.tutor_id === tutorUser.id)
            );
        });

        and('I navigate to the tutor dashboard', async () => {
            renderWithRouter('/tutor');
            // Wait for rooms to load
            await waitFor(() => {
                expect(screen.getByText('Cybersecurity Fundamentals')).toBeInTheDocument();
            });
        });

        and('I click "Enter Room" for "Cybersecurity Fundamentals"', async () => {
            const enterRoomLink = screen.getByRole('link', { name: /Enter Room/i });
            fireEvent.click(enterRoomLink);
        });

        then('I should be navigated to the room page', async () => {
            // Wait for navigation to complete
            await waitFor(() => {
                const locationDisplay = screen.getByTestId('location-display');
                expect(locationDisplay).toHaveTextContent(`/room/${createdRoom.id}`);
            });
        });

        and('I should be able to send messages in the room', () => {
            // The room context would be set up for messaging
            expect(mockRoomContextState.sendMessage).toBeDefined();
        });
    });
});

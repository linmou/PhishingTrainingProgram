import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import TutorView from '../pages/TutorView';
import RoomPagePost from '../pages/RoomPagePost';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import { RoomProvider } from '../contexts/RoomContext';
import * as supabaseService from '../services/supabase';

// Mock Supabase service
jest.mock('../services/supabase');
jest.mock('../contexts/AuthContext', () => ({
    ...jest.requireActual('../contexts/AuthContext'),
    useAuth: jest.fn()
}));

// Mock implementations
const mockCreateRoom = jest.fn();
const mockGetRoomsByTutor = jest.fn();
const mockGetRoomById = jest.fn();
const mockValidateRoomPassword = jest.fn();
const mockUseAuth = useAuth as jest.Mock;
let mockRoomQueryData: any = null;
const mockRoomChannel = {
    on: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn()
};

const createSupabaseQuery = (data: any = null) => {
    const query: any = {};
    query.select = jest.fn().mockReturnValue(query);
    query.eq = jest.fn().mockReturnValue(query);
    query.in = jest.fn().mockResolvedValue({ data: [], error: null });
    query.order = jest.fn().mockResolvedValue({ data: [], error: null });
    query.limit = jest.fn().mockResolvedValue({ data: [], error: null });
    query.single = jest.fn().mockResolvedValue({ data, error: null });
    return query;
};

// Setup mocks
beforeEach(() => {
    jest.clearAllMocks();
    mockRoomQueryData = null;
    
    (supabaseService.createRoom as jest.Mock) = mockCreateRoom;
    (supabaseService.getRoomsByTutor as jest.Mock) = mockGetRoomsByTutor;
    (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue([]);
    (supabaseService.supabase.from as jest.Mock) = jest.fn().mockImplementation((table: string) =>
        createSupabaseQuery(table === 'rooms' ? mockRoomQueryData : null)
    );
    mockRoomChannel.on.mockReturnThis();
    mockRoomChannel.subscribe.mockReturnThis();
    (supabaseService.supabase.channel as jest.Mock) = jest.fn().mockReturnValue(mockRoomChannel);
    (supabaseService.validateRoomPassword as jest.Mock) = mockValidateRoomPassword;
    mockUseAuth.mockReturnValue({ user: null, loading: false });
});

describe('Room Password Protection', () => {
    const mockTutor = {
        id: 'tutor-123',
        email: 'tutor@test.com',
        display_name: 'Test Tutor',
        current_role: 'tutor' as const,
        status: 'active' as const,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const mockStudent = {
        id: 'student-456',
        email: 'student@test.com',
        display_name: 'Test Student',
        current_role: 'student' as const,
        status: 'active' as const,
        avatar_url: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const mockPasswordRoom = {
        id: 'room-789',
        tutor_id: 'tutor-123',
        title: 'Password Protected Room',
        description: 'This room requires a password',
        image_url: null,
        is_active: true,
        ai_assistant_enabled: false,
        ai_assistant_model: null,
        ai_assistant_prompt: null,
        pre_populated_dialogue: null,
        op_id: 'tutor-123',
        op_display_name: 'Test Tutor',
        op_avatar_url: null,
        password: 'SecurePass123',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    describe('Creating Password-Protected Rooms', () => {
        it('should create a room with password when password is provided', async () => {
            mockCreateRoom.mockResolvedValueOnce(mockPasswordRoom);
            mockGetRoomsByTutor.mockResolvedValueOnce([]);
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            
            const TestApp = () => (
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

            render(<TestApp />);

            // Click create room button
            const createButton = await screen.findByRole('button', { name: /Create a new Room/i });
            fireEvent.click(createButton);

            // Fill in room details
            const titleInput = screen.getByLabelText('Room Title');
            fireEvent.change(titleInput, { target: { value: 'Password Protected Room' } });

            // Enable password protection
            fireEvent.click(screen.getByText('Enable password protection for this room'));

            // Enter password
            const passwordInput = screen.getByLabelText('Room Password');
            fireEvent.change(passwordInput, { target: { value: 'SecurePass123' } });

            // Submit form
            const submitButton = screen.getByText('🚀 Create Room');
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Password Protected Room',
                        password: 'SecurePass123'
                    })
                );
            });
        });

        it('should display password in room card for tutor', async () => {
            mockGetRoomsByTutor.mockResolvedValueOnce([mockPasswordRoom]);
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            
            const TestApp = () => (
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

            render(<TestApp />);

            await waitFor(() => {
                expect(screen.getByText('SecurePass123')).toBeInTheDocument();
                expect(screen.getByText('Password:')).toBeInTheDocument();
            });
        });
    });

    describe('Password Validation for Room Access', () => {
        it('should bypass password check for room owner', async () => {
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            mockRoomQueryData = mockPasswordRoom;

            const TestApp = () => (
                <MemoryRouter initialEntries={['/room/room-789']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/room/:roomId" element={<RoomPagePost />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Should not show password prompt for room owner
            await waitFor(() => {
                expect(screen.queryByText('🔒 Password Required')).not.toBeInTheDocument();
            });
        });

        it('should show password prompt for non-owner users', async () => {
            mockUseAuth.mockReturnValue({ user: mockStudent, loading: false });
            mockRoomQueryData = mockPasswordRoom;

            const TestApp = () => (
                <MemoryRouter initialEntries={['/room/room-789']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/room/:roomId" element={<RoomPagePost />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Should show password prompt
            await waitFor(() => {
                expect(screen.getByText('🔒 Password Required')).toBeInTheDocument();
                expect(screen.getByText('This room is password protected. Please enter the password.')).toBeInTheDocument();
            });
        });

        it('should accept correct password and grant access', async () => {
            mockUseAuth.mockReturnValue({ user: mockStudent, loading: false });
            mockRoomQueryData = mockPasswordRoom;
            mockValidateRoomPassword.mockResolvedValueOnce({ 
                success: true, 
                message: 'Password correct' 
            });

            const TestApp = () => (
                <MemoryRouter initialEntries={['/room/room-789']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/room/:roomId" element={<RoomPagePost />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Wait for password prompt
            await waitFor(() => {
                expect(screen.getByText('🔒 Password Required')).toBeInTheDocument();
            });

            // Enter correct password
            const passwordInput = screen.getByPlaceholderText('Enter password');
            fireEvent.change(passwordInput, { target: { value: 'SecurePass123' } });

            const joinButton = screen.getByText('Join Room');
            fireEvent.click(joinButton);

            await waitFor(() => {
                expect(mockValidateRoomPassword).toHaveBeenCalledWith('room-789', 'SecurePass123');
                // Password prompt should disappear after successful validation
                expect(screen.queryByText('🔒 Password Required')).not.toBeInTheDocument();
            });
        });

        it('should show error for incorrect password and allow retry', async () => {
            mockUseAuth.mockReturnValue({ user: mockStudent, loading: false });
            mockRoomQueryData = mockPasswordRoom;
            mockValidateRoomPassword.mockResolvedValueOnce({ 
                success: false, 
                message: 'Incorrect password' 
            });

            const TestApp = () => (
                <MemoryRouter initialEntries={['/room/room-789']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/room/:roomId" element={<RoomPagePost />} />
                            </Routes>
                        </RoomProvider>
                    </AuthProvider>
                </MemoryRouter>
            );

            render(<TestApp />);

            // Wait for password prompt
            await waitFor(() => {
                expect(screen.getByText('🔒 Password Required')).toBeInTheDocument();
            });

            // Enter incorrect password
            const passwordInput = screen.getByPlaceholderText('Enter password');
            fireEvent.change(passwordInput, { target: { value: 'WrongPassword' } });

            const joinButton = screen.getByText('Join Room');
            fireEvent.click(joinButton);

            await waitFor(() => {
                expect(mockValidateRoomPassword).toHaveBeenCalledWith('room-789', 'WrongPassword');
                // Error message should appear
                expect(screen.getByText('Incorrect password. Please try again.')).toBeInTheDocument();
                // Password prompt should remain open
                expect(screen.getByText('🔒 Password Required')).toBeInTheDocument();
            });
        });
    });

    describe('Room Display Without Password', () => {
        it('should display "No password" for unprotected rooms', async () => {
            const unprotectedRoom = {
                ...mockPasswordRoom,
                password: null
            };
            
            mockGetRoomsByTutor.mockResolvedValueOnce([unprotectedRoom]);
            mockUseAuth.mockReturnValue({ user: mockTutor, loading: false });
            
            const TestApp = () => (
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

            render(<TestApp />);

            await waitFor(() => {
                expect(screen.getByText('No password')).toBeInTheDocument();
            });
        });
    });
});

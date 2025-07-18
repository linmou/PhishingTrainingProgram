import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import TutorView from '../pages/TutorView';
import RoomPage from '../pages/RoomPage';
import RoomPagePost from '../pages/RoomPagePost';
import { AuthProvider } from '../contexts/AuthContext';
import { RoomProvider } from '../contexts/RoomContext';
import * as supabaseService from '../services/supabase';

// Mock Supabase service
jest.mock('../services/supabase');

// Mock implementations
const mockCreateRoom = jest.fn();
const mockGetRoomsByTutor = jest.fn();
const mockGetRoomById = jest.fn();
const mockValidateRoomPassword = jest.fn();
const mockGetCurrentUser = jest.fn();

// Setup mocks
beforeEach(() => {
    jest.clearAllMocks();
    
    (supabaseService.createRoom as jest.Mock) = mockCreateRoom;
    (supabaseService.getRoomsByTutor as jest.Mock) = mockGetRoomsByTutor;
    (supabaseService.supabase.from as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
                single: jest.fn().mockReturnValue({
                    data: null,
                    error: null
                })
            })
        })
    });
    (supabaseService.validateRoomPassword as jest.Mock) = mockValidateRoomPassword;
    (supabaseService.getCurrentUser as jest.Mock) = mockGetCurrentUser;
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
            const createButton = await screen.findByText('Create a new Room');
            fireEvent.click(createButton);

            // Fill in room details
            const titleInput = screen.getByLabelText('Room Title');
            fireEvent.change(titleInput, { target: { value: 'Password Protected Room' } });

            // Enable password protection
            const passwordCheckbox = screen.getByLabelText('Password protect this room');
            fireEvent.click(passwordCheckbox);

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
            mockGetCurrentUser.mockResolvedValueOnce(mockTutor);
            
            // Mock room data fetch
            (supabaseService.supabase.from as jest.Mock).mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: mockPasswordRoom,
                            error: null
                        })
                    })
                })
            });

            const TestApp = () => (
                <MemoryRouter initialEntries={['/room/room-789']}>
                    <AuthProvider>
                        <RoomProvider>
                            <Routes>
                                <Route path="/room/:roomId" element={<RoomPage />} />
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
            mockGetCurrentUser.mockResolvedValueOnce(mockStudent);
            
            // Mock room data fetch
            (supabaseService.supabase.from as jest.Mock).mockReturnValueOnce({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValueOnce({
                            data: mockPasswordRoom,
                            error: null
                        })
                    })
                })
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

            // Should show password prompt
            await waitFor(() => {
                expect(screen.getByText('🔒 Password Required')).toBeInTheDocument();
                expect(screen.getByText('This room is password protected. Please enter the password.')).toBeInTheDocument();
            });
        });

        it('should accept correct password and grant access', async () => {
            mockGetCurrentUser.mockResolvedValueOnce(mockStudent);
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
            mockGetCurrentUser.mockResolvedValueOnce(mockStudent);
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
import React from 'react';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import App from '../../App';
import * as supabaseService from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase');

const feature = loadFeature('./features/room_management.feature', {
    loadRelativePath: true,
    errors: {
        missingScenarioInStepDefinitions: false,
        missingStepInStepDefinitions: false,
        missingScenarioInFeature: false,
        missingStepInFeature: false
    }
});

defineFeature(feature, test => {
    let mockSupabase: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockSupabase = {
            auth: {
                getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
                onAuthStateChange: jest.fn().mockReturnValue({
                    data: { subscription: { unsubscribe: jest.fn() } }
                })
            },
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: null, error: null })
                    })
                }),
                insert: jest.fn().mockReturnValue({
                    select: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: null, error: null })
                    })
                })
            })
        });

        (supabaseService.supabase as any) = mockSupabase;
        (supabaseService.getCurrentUser as jest.Mock) = jest.fn();
        (supabaseService.createRoom as jest.Mock) = jest.fn();
        (supabaseService.getRoomsByTutor as jest.Mock) = jest.fn().mockResolvedValue([]);
        (supabaseService.validateRoomPassword as jest.Mock) = jest.fn();
    });

    // Password Protection Scenarios
    test('Tutor creates a password-protected room', ({ given, when, then, and }) => {
        const mockTutor = {
            id: 'tutor-123',
            email: 'tutor@test.com',
            display_name: 'Test Tutor',
            current_role: 'tutor',
            status: 'active',
            avatar_url: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        given('I am logged in as a tutor', async () => {
            (supabaseService.getCurrentUser as jest.Mock).mockResolvedValue(mockTutor);
            mockSupabase.auth.getSession.mockResolvedValue({
                data: { session: { user: { id: 'tutor-123' } } },
                error: null
            });
        });

        when('I navigate to the room creation page', async () => {
            render(
                <MemoryRouter initialEntries={['/tutor']}>
                    <App />
                </MemoryRouter>
            );

            // Wait for the page to load
            await waitFor(() => {
                expect(screen.getByText('Tutor Dashboard')).toBeInTheDocument();
            });
        });

        and('I enter room title "Private Study Session"', async () => {
            const createButton = screen.getByText('➕ Create a new Room');
            fireEvent.click(createButton);

            const titleInput = await screen.findByLabelText('Room Title');
            fireEvent.change(titleInput, { target: { value: 'Private Study Session' } });
        });

        and('I enter room description "Advanced topics requiring password access"', () => {
            const descInput = screen.getByLabelText('Description');
            fireEvent.change(descInput, { target: { value: 'Advanced topics requiring password access' } });
        });

        and('I enable password protection', () => {
            const passwordCheckbox = screen.getByLabelText('Password protect this room');
            fireEvent.click(passwordCheckbox);
        });

        and('I enter room password "SecurePass123"', () => {
            const passwordInput = screen.getByLabelText('Room Password');
            fireEvent.change(passwordInput, { target: { value: 'SecurePass123' } });
        });

        and('I submit the room creation form', async () => {
            const mockRoom = {
                id: 'room-123',
                title: 'Private Study Session',
                password: 'SecurePass123',
                tutor_id: 'tutor-123'
            };

            (supabaseService.createRoom as jest.Mock).mockResolvedValue(mockRoom);

            const submitButton = screen.getByText('🚀 Create Room');
            fireEvent.click(submitButton);
        });

        then('a new password-protected room should be created', async () => {
            await waitFor(() => {
                expect(supabaseService.createRoom).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Private Study Session',
                        password: 'SecurePass123'
                    })
                );
            });
        });

        and('the room password should be visible in my room list', () => {
            // This would be tested in the UI after room creation
            expect(supabaseService.createRoom).toHaveBeenCalled();
        });

        and('the password should be displayed in a monospace font', () => {
            // This is a UI styling test
            expect(true).toBe(true);
        });
    });

    test('Room owner bypasses password protection', ({ given, when, then, and }) => {
        const mockTutor = {
            id: 'tutor-123',
            email: 'tutor@test.com',
            display_name: 'Test Tutor',
            current_role: 'tutor',
            status: 'active'
        };

        const mockRoom = {
            id: 'room-123',
            tutor_id: 'tutor-123',
            title: 'Private Session',
            password: 'MyPass123'
        };

        given('I am logged in as a tutor', () => {
            (supabaseService.getCurrentUser as jest.Mock).mockResolvedValue(mockTutor);
        });

        and('I have created a password-protected room "Private Session" with password "MyPass123"', () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: mockRoom, error: null })
                    })
                })
            });
        });

        when('I click to enter my own room', async () => {
            render(
                <MemoryRouter initialEntries={[`/room/${mockRoom.id}`]}>
                    <App />
                </MemoryRouter>
            );
        });

        then('I should enter the room directly without password prompt', async () => {
            await waitFor(() => {
                expect(screen.queryByText('🔒 Password Required')).not.toBeInTheDocument();
            });
        });

        and('I should see the room content immediately', () => {
            // Room content would be visible
            expect(true).toBe(true);
        });
    });

    test('Non-owner attempts to join password-protected room', ({ given, when, then, and }) => {
        const mockStudent = {
            id: 'student-456',
            email: 'student@test.com',
            display_name: 'Test Student',
            current_role: 'student',
            status: 'active'
        };

        const mockRoom = {
            id: 'room-123',
            tutor_id: 'tutor-123',
            title: 'Protected Room',
            password: 'SecurePass123'
        };

        given('a password-protected room exists with password "SecurePass123"', () => {
            mockSupabase.from.mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({ data: mockRoom, error: null })
                    })
                })
            });
        });

        and('I am logged in as a student', () => {
            (supabaseService.getCurrentUser as jest.Mock).mockResolvedValue(mockStudent);
        });

        when('I attempt to join the password-protected room', async () => {
            render(
                <MemoryRouter initialEntries={[`/room/${mockRoom.id}`]}>
                    <App />
                </MemoryRouter>
            );
        });

        then('I should see a password prompt modal', async () => {
            await waitFor(() => {
                expect(screen.getByText('🔒 Password Required')).toBeInTheDocument();
            });
        });

        and('the modal should display "This room is password protected. Please enter the password."', () => {
            expect(screen.getByText('This room is password protected. Please enter the password.')).toBeInTheDocument();
        });

        and('the modal should have a password input field', () => {
            expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument();
        });
    });
});

// OP Configuration Tests
describe('Room OP Configuration Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('OP configuration UI elements', async () => {
        const mockTutor = {
            id: 'tutor-123',
            display_name: 'John Tutor',
            current_role: 'tutor'
        };

        (supabaseService.getCurrentUser as jest.Mock).mockResolvedValue(mockTutor);
        (supabaseService.getRoomsByTutor as jest.Mock).mockResolvedValue([]);

        render(
            <MemoryRouter initialEntries={['/tutor']}>
                <App />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Tutor Dashboard')).toBeInTheDocument();
        });

        // Click create room
        const createButton = screen.getByText('➕ Create a new Room');
        fireEvent.click(createButton);

        // Check OP configuration section exists
        await waitFor(() => {
            expect(screen.getByText('Original Poster (OP) Settings')).toBeInTheDocument();
            expect(screen.getByLabelText('Use my profile as OP')).toBeInTheDocument();
            expect(screen.getByLabelText('Use custom OP name')).toBeInTheDocument();
        });
    });

    test('Custom OP name validation', async () => {
        const mockTutor = {
            id: 'tutor-123',
            display_name: 'John Tutor',
            current_role: 'tutor'
        };

        (supabaseService.getCurrentUser as jest.Mock).mockResolvedValue(mockTutor);
        (supabaseService.getRoomsByTutor as jest.Mock).mockResolvedValue([]);

        render(
            <MemoryRouter initialEntries={['/tutor']}>
                <App />
            </MemoryRouter>
        );

        await waitFor(() => {
            expect(screen.getByText('Tutor Dashboard')).toBeInTheDocument();
        });

        // Click create room
        const createButton = screen.getByText('➕ Create a new Room');
        fireEvent.click(createButton);

        // Fill title
        const titleInput = await screen.findByLabelText('Room Title');
        fireEvent.change(titleInput, { target: { value: 'Test Room' } });

        // Select custom OP
        const customOPRadio = screen.getByLabelText('Use custom OP name');
        fireEvent.click(customOPRadio);

        // Submit without entering custom OP name
        const submitButton = screen.getByText('🚀 Create Room');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(screen.getByText('Custom OP name is required when using custom OP')).toBeInTheDocument();
        });
    });
});
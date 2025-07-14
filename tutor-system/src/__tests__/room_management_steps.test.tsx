import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import TutorView from '../pages/TutorView';
import { AuthProvider } from '../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { createRoom, getRoomsByTutor } from '../services/supabase';

// Mock variables to be used in tests
let mockDatabase: any;
let mockSupabaseClient: any;

// Mock the preset images
const mockPresetImages = [
    { id: 'phishing-1', name: 'Phishing Training 1', url: '/images/room-presets/phishing_1.png' },
    { id: 'phishing-2', name: 'Phishing Training 2', url: '/images/room-presets/phishing_2.png' },
    { id: 'phishing-3', name: 'Phishing Training 3', url: '/images/room-presets/phishing_3.png' },
    { id: 'privacy-1', name: 'Privacy Training 1', url: '/images/room-presets/privacy_1.png' },
    { id: 'privacy-2', name: 'Privacy Training 2', url: '/images/room-presets/privacy_2.png' },
    { id: 'default', name: 'Default Room', url: '/images/room-presets/privacy_3.png' }
];

// We'll mock supabase in the service itself
jest.mock('../services/supabase', () => ({
    ...jest.requireActual('../services/supabase'),
    createRoom: jest.fn(),
    getRoomsByTutor: jest.fn(),
    getPresetImages: jest.fn(() => mockPresetImages),
}));

jest.mock('../contexts/AuthContext', () => ({
    ...jest.requireActual('../contexts/AuthContext'),
    useAuth: jest.fn(),
}));

describe('Room Management Tests', () => {
    let mockUser: any;
    let mockRoom: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Initialize mocks
        mockDatabase = {
            insert: jest.fn(),
            select: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        };

        mockSupabaseClient = {
            auth: {
                getUser: jest.fn(),
                onAuthStateChange: jest.fn(),
            },
            from: jest.fn(() => mockDatabase),
            channel: jest.fn(() => ({
                on: jest.fn(),
                subscribe: jest.fn(),
            })),
        };

        // Reset mock implementations
        mockDatabase.insert.mockImplementation((items: any[]) => {
            const newItem = items[0];
            mockRoom = {
                ...mockRoom,
                ...newItem,
                id: 'new-room-id',
                created_at: new Date().toISOString(),
                is_active: true
            };
            return Promise.resolve({ data: [mockRoom], error: null });
        });
        
        mockDatabase.select.mockImplementation(() => ({
            eq: () => ({
                order: () => Promise.resolve({ data: [], error: null })
            })
        }));

        mockUser = {
            id: 'test-tutor-id',
            email: 'tutor@example.com',
            user_metadata: { display_name: 'Test Tutor' },
        };

        (useAuth as jest.Mock).mockReturnValue({ user: mockUser, loading: false });

        // Setup service function mocks
        (createRoom as jest.Mock).mockImplementation((roomData) => {
            mockRoom = {
                ...roomData,
                id: 'new-room-id',
                created_at: new Date().toISOString(),
                is_active: true
            };
            return Promise.resolve(mockRoom);
        });

        (getRoomsByTutor as jest.Mock).mockResolvedValue([]);

        mockRoom = {
            id: 'test-room-id',
            title: '',
            description: '',
            tutor_id: 'test-tutor-id',
            image_url: null,
            created_at: new Date().toISOString(),
            is_active: true,
        };
    });

    const givenTheSystemIsConfigured = (given: any, and: any) => {
        given('the Supabase authentication system is configured', () => {
            expect(mockSupabaseClient).toBeDefined();
        });

        and('the user is authenticated as a tutor', () => {
            mockSupabaseClient.auth.getUser.mockResolvedValue({
                data: { user: { ...mockUser, app_metadata: { role: 'tutor' } } },
                error: null,
            });
        });

        and('preset room images are available', () => {
            expect(mockPresetImages).toBeDefined();
            expect(mockPresetImages.length).toBeGreaterThan(0);
        });
    };

    test('should create a basic room without image', async () => {
        // Render the tutor view
        render(
            <MemoryRouter>
                <AuthProvider>
                    <TutorView />
                </AuthProvider>
            </MemoryRouter>
        );

        // Click the "Create a new Room" button to show the form
        const createButton = screen.getByRole('button', { name: /create a new room/i });
        fireEvent.click(createButton);

        // Now the form should be visible
        const form = screen.getByRole('form', { name: /create room form/i });
        expect(form).toBeInTheDocument();

        // Fill in room title
        const titleInput = screen.getByLabelText(/room title/i);
        fireEvent.change(titleInput, { target: { value: 'Introduction to Python' } });
        expect(titleInput).toHaveValue('Introduction to Python');

        // Fill in room description
        const descriptionInput = screen.getByLabelText(/description/i);
        fireEvent.change(descriptionInput, { target: { value: 'Basic Python programming concepts for beginners' } });
        expect(descriptionInput).toHaveValue('Basic Python programming concepts for beginners');

        // Submit the form
        const submitButton = screen.getByRole('button', { name: /create room/i });
        fireEvent.click(submitButton);

        // Verify room creation was called
        await waitFor(() => {
            expect(createRoom).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Introduction to Python',
                    description: 'Basic Python programming concepts for beginners',
                    tutor_id: 'test-tutor-id',
                    image_url: '/images/room-presets/privacy_3.png', // Default image
                    pre_populated_dialogue: null
                })
            );
        });

        // Check for success message
        await waitFor(() => {
            expect(screen.getByText('Room created successfully')).toBeInTheDocument();
        });
    });
});
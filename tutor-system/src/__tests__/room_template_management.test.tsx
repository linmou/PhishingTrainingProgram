/**
 * Test file for Room Template Management functionality
 * This file tests the template creation, storage, and usage functionality
 * that allows tutors to save room configurations as reusable templates.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TutorView from '../pages/TutorView';
import * as supabaseService from '../services/supabase';

// Mock the supabase service
jest.mock('../services/supabase', () => ({
    createRoom: jest.fn(),
    getRoomsByTutor: jest.fn(),
    deleteRoom: jest.fn(),
    createRoomTemplate: jest.fn(),
    getRoomTemplatesByTutor: jest.fn(),
    deleteRoomTemplate: jest.fn(),
}));

// Mock RoomContext
const mockRoomContextValue = {
    currentRoom: null,
    messages: [],
    participants: [],
    loading: false,
    typingUsers: [],
    createRoom: jest.fn(),
    joinRoom: jest.fn(),
    leaveRoom: jest.fn(),
    sendMessage: jest.fn(),
    generateAIResponse: jest.fn(),
    regenerateAIResponse: jest.fn(),
    toggleAIAssistant: jest.fn(),
    startTyping: jest.fn(),
    stopTyping: jest.fn(),
    aiConfig: null,
    clearChatHistory: jest.fn(),
    exportChatHistory: jest.fn(),
    recordAISuggestionFeedback: jest.fn(),
};

// Mock the AuthContext module
jest.mock('../contexts/AuthContext', () => ({
    useAuth: () => ({
        user: {
            id: 'tutor-123',
            email: 'tutor@test.com',
            display_name: 'Test Tutor',
            current_role: 'tutor',
            avatar_url: null
        },
        login: jest.fn(),
        logout: jest.fn(),
        setRole: jest.fn(),
        loading: false
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock the RoomContext module
jest.mock('../contexts/RoomContext', () => ({
    useRoom: () => mockRoomContextValue,
    RoomProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <MemoryRouter>
        {children}
    </MemoryRouter>
);

describe('Room Template Management', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (supabaseService.getRoomsByTutor as jest.Mock).mockResolvedValue([]);
        (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue([]);
    });

    describe('Template Creation', () => {
        test('should show "Save as template" checkbox in room creation form', async () => {
            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            // Click "Create a new Room" button
            const createButton = screen.getByText('➕ Create a new Room');
            fireEvent.click(createButton);

            // Wait for form to appear and check for "Save as template" checkbox
            await waitFor(() => {
                expect(screen.getByLabelText(/save as template/i)).toBeInTheDocument();
            });
        });

        test('should save room as template when checkbox is checked', async () => {
            const mockCreateRoom = supabaseService.createRoom as jest.Mock;
            const mockCreateTemplate = supabaseService.createRoomTemplate as jest.Mock;
            
            mockCreateRoom.mockResolvedValue({
                id: 'room-123',
                title: 'Test Room',
                description: 'Test Description'
            });
            mockCreateTemplate.mockResolvedValue({
                id: 'template-123',
                template_name: 'Test Room'
            });

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            // Open room creation form
            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/room title/i)).toBeInTheDocument();
            });

            // Fill out the form
            fireEvent.change(screen.getByLabelText(/room title/i), {
                target: { value: 'Test Room' }
            });
            fireEvent.change(screen.getByLabelText(/description/i), {
                target: { value: 'Test Description' }
            });

            // Check "Save as template"
            const saveAsTemplateCheckbox = screen.getByLabelText(/save as template/i);
            fireEvent.click(saveAsTemplateCheckbox);

            // Submit form
            const submitButton = screen.getByText('🚀 Create Room');
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith({
                    title: 'Test Room',
                    description: 'Test Description',
                    tutor_id: 'tutor-123',
                    image_url: expect.any(String),
                    pre_populated_dialogue: null,
                    op_id: 'tutor-123',
                    op_display_name: 'Test Tutor',
                    op_avatar_url: null,
                    password: null
                });

                expect(mockCreateTemplate).toHaveBeenCalledWith({
                    tutor_id: 'tutor-123',
                    template_name: 'Test Room',
                    template_description: null,
                    title_template: 'Test Room',
                    description_template: 'Test Description',
                    image_url: expect.any(String),
                    pre_populated_dialogue: null,
                    ai_config_template: null,
                    op_config_template: expect.any(Object),
                    password_config: null
                });
            });
        });

        test('should not save template when checkbox is unchecked', async () => {
            const mockCreateRoom = supabaseService.createRoom as jest.Mock;
            const mockCreateTemplate = supabaseService.createRoomTemplate as jest.Mock;
            
            mockCreateRoom.mockResolvedValue({
                id: 'room-123',
                title: 'Test Room'
            });

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            // Open form and fill it out without checking template checkbox
            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/room title/i)).toBeInTheDocument();
            });

            fireEvent.change(screen.getByLabelText(/room title/i), {
                target: { value: 'Test Room' }
            });

            // Submit without checking "Save as template"
            fireEvent.click(screen.getByText('🚀 Create Room'));

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalled();
                expect(mockCreateTemplate).not.toHaveBeenCalled();
            });
        });
    });

    describe('Template Usage', () => {
        test('should show template dropdown when templates exist', async () => {
            const mockTemplates = [
                {
                    id: 'template-1',
                    template_name: 'Phishing Training Template',
                    title_template: 'Phishing Detection',
                    description_template: 'Learn to spot phishing emails'
                },
                {
                    id: 'template-2',
                    template_name: 'Privacy Workshop Template',
                    title_template: 'Privacy Basics',
                    description_template: 'Digital privacy fundamentals'
                }
            ];

            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue(mockTemplates);

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            // Open room creation form
            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/use template/i)).toBeInTheDocument();
                expect(screen.getByText('Phishing Training Template')).toBeInTheDocument();
                expect(screen.getByText('Privacy Workshop Template')).toBeInTheDocument();
            });
        });

        test('should auto-fill form when template is selected', async () => {
            const mockTemplates = [
                {
                    id: 'template-1',
                    template_name: 'Privacy Workshop Template',
                    title_template: 'Privacy Basics Workshop',
                    description_template: 'Understanding digital privacy fundamentals',
                    image_url: '/images/room-presets/privacy_1.png',
                    pre_populated_dialogue: [
                        { user_name: 'Student', message: 'What is digital privacy?', role: 'student' }
                    ],
                    ai_config_template: {
                        model_name: 'gpt-3.5-turbo',
                        temperature: 0.7,
                        max_tokens: 150
                    }
                }
            ];

            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue(mockTemplates);

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            // Open form and select template
            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/use template/i)).toBeInTheDocument();
            });

            const templateDropdown = screen.getByLabelText(/use template/i);
            fireEvent.change(templateDropdown, { target: { value: 'template-1' } });

            await waitFor(() => {
                const titleInput = screen.getByLabelText(/room title/i) as HTMLInputElement;
                const descInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
                
                expect(titleInput.value).toBe('Privacy Basics Workshop');
                expect(descInput.value).toBe('Understanding digital privacy fundamentals');
            });
        });

        test('should allow modification of template values before room creation', async () => {
            const mockTemplates = [
                {
                    id: 'template-1',
                    template_name: 'Privacy Workshop Template',
                    title_template: 'Privacy Basics Workshop',
                    description_template: 'Understanding digital privacy fundamentals'
                }
            ];

            const mockCreateRoom = supabaseService.createRoom as jest.Mock;
            mockCreateRoom.mockResolvedValue({ id: 'room-123' });

            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue(mockTemplates);

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            // Open form, select template, and modify values
            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                const templateDropdown = screen.getByLabelText(/use template/i);
                fireEvent.change(templateDropdown, { target: { value: 'template-1' } });
            });

            await waitFor(() => {
                const titleInput = screen.getByLabelText(/room title/i);
                fireEvent.change(titleInput, {
                    target: { value: 'Advanced Privacy Workshop' }
                });
            });

            fireEvent.click(screen.getByText('🚀 Create Room'));

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Advanced Privacy Workshop'
                    })
                );
            });
        });
    });

    describe('Template Management', () => {
        test('should only show templates created by the current tutor', async () => {
            const mockTemplates = [
                {
                    id: 'template-1',
                    tutor_id: 'tutor-123', // Current tutor
                    template_name: 'My Template'
                },
                {
                    id: 'template-2', 
                    tutor_id: 'other-tutor', // Different tutor
                    template_name: 'Other Template'
                }
            ];

            // Service should only return current tutor's templates
            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue([
                mockTemplates[0] // Only current tutor's template
            ]);

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByText('My Template')).toBeInTheDocument();
                expect(screen.queryByText('Other Template')).not.toBeInTheDocument();
            });
        });

        test('should preserve all room configurations in template', async () => {
            const mockCreateRoom = supabaseService.createRoom as jest.Mock;
            const mockCreateTemplate = supabaseService.createRoomTemplate as jest.Mock;
            
            mockCreateRoom.mockResolvedValue({ 
                id: 'room-123', 
                title: 'Complex Training Room',
                description: 'Advanced training scenario'
            });

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            // Open form and fill out basic data
            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/room title/i)).toBeInTheDocument();
            });

            // Fill form with complex configuration data
            fireEvent.change(screen.getByLabelText(/room title/i), {
                target: { value: 'Complex Training Room' }
            });
            
            fireEvent.change(screen.getByLabelText(/description/i), {
                target: { value: 'Advanced training scenario' }
            });

            // Check save as template checkbox
            const saveAsTemplateCheckbox = screen.getByLabelText(/save as template/i);
            fireEvent.click(saveAsTemplateCheckbox);

            // Submit the form
            fireEvent.click(screen.getByText('🚀 Create Room'));

            // Verify that createRoomTemplate was called with the correct data structure
            await waitFor(() => {
                expect(mockCreateTemplate).toHaveBeenCalledWith({
                    tutor_id: 'tutor-123',
                    template_name: 'Complex Training Room',
                    template_description: null,
                    title_template: 'Complex Training Room',
                    description_template: 'Advanced training scenario',
                    image_url: expect.any(String),
                    pre_populated_dialogue: null,
                    ai_config_template: null,
                    op_config_template: expect.objectContaining({
                        use_custom_op: false,
                        custom_op_name: null,
                        op_id: 'tutor-123',
                        op_display_name: 'Test Tutor',
                        op_avatar_url: null
                    }),
                    password_config: null
                });
            });
        });
    });
});
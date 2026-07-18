/**
 * Test file for Room Template Management functionality
 * This file tests the template creation, storage, and usage functionality
 * that allows tutors to save room configurations as reusable templates.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TutorView from '../pages/TutorView';
import TestRoomsView from '../pages/TestRoomsView';
import * as supabaseService from '../services/supabase';
import * as aiService from '../services/aiService';

// Mock the supabase service
jest.mock('../services/supabase', () => ({
    createRoom: jest.fn(),
    getRoomsByTutor: jest.fn(),
    deleteRoom: jest.fn(),
    createRoomTemplate: jest.fn(),
    getRoomTemplatesByTutor: jest.fn(),
    deleteRoomTemplate: jest.fn(),
}));

jest.mock('../services/aiService', () => ({
    initializeAIAssistant: jest.fn().mockResolvedValue('room-ai-id'),
    updateAIConfig: jest.fn().mockResolvedValue({}),
    getAIConfig: jest.fn().mockResolvedValue({
        model_name: 'gpt-4o-mini',
        system_prompt: 'Improved tutor prompt',
        prompt_config: { role: { role: 'low' } },
        temperature: 0.7,
        max_tokens: 150
    })
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

    describe('Template Selection', () => {
        test('should not show "Save as template" controls in room creation form', async () => {
            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            const createButton = screen.getByText('➕ Create a new Room');
            fireEvent.click(createButton);

            await waitFor(() => {
                expect(screen.getByLabelText(/room title/i)).toBeInTheDocument();
            });

            expect(screen.queryByLabelText(/save as template/i)).not.toBeInTheDocument();
        });

        test('should create room from selected template without saving a new template', async () => {
            const mockCreateRoom = supabaseService.createRoom as jest.Mock;
            const mockCreateTemplate = supabaseService.createRoomTemplate as jest.Mock;
            const mockTemplates = [
                {
                    id: 'template-1',
                    template_name: 'Global Privacy Template',
                    title_template: 'Template Title',
                    description_template: 'Template Description',
                    image_url: '/images/room-presets/privacy_2.png',
                    pre_populated_dialogue: null,
                    op_config_template: null,
                    password_config: null
                }
            ];
            
            mockCreateRoom.mockResolvedValue({
                id: 'room-123',
                title: 'Template Title',
                description: 'Template Description'
            });
            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue(mockTemplates);

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/use template/i)).toBeInTheDocument();
            });

            fireEvent.change(screen.getByLabelText(/use template/i), {
                target: { value: 'template-1' }
            });

            fireEvent.click(screen.getByText('🚀 Create Room'));

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith({
                    title: 'Template Title',
                    description: 'Template Description',
                    tutor_id: 'tutor-123',
                    image_url: '/images/room-presets/privacy_2.png',
                    pre_populated_dialogue: null,
                    op_id: 'tutor-123',
                    op_display_name: 'Test Tutor',
                    op_avatar_url: null,
                    password: null
                });
            });

            expect(mockCreateTemplate).not.toHaveBeenCalled();
            expect(aiService.initializeAIAssistant).not.toHaveBeenCalled();
        });

        test('should hide behavior-demo templates on main Tutor dashboard', async () => {
            const mockTemplates = [
                {
                    id: 'template-demo',
                    template_name: 'Demo: Lock Icon Myth (Direct Correction)',
                    title_template: 'Demo: Lock Icon Myth',
                    description_template: 'x',
                    image_url: null,
                    pre_populated_dialogue: null,
                    op_config_template: null,
                    password_config: null
                },
                {
                    id: 'template-normal',
                    template_name: 'Global Privacy Template',
                    title_template: 'Privacy',
                    description_template: 'y',
                    image_url: null,
                    pre_populated_dialogue: null,
                    op_config_template: null,
                    password_config: null
                }
            ];
            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue(mockTemplates);

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/use template/i)).toBeInTheDocument();
            });

            const select = screen.getByLabelText(/use template/i) as HTMLSelectElement;
            const optionTexts = Array.from(select.options).map((o) => o.textContent || '');
            expect(optionTexts.join(' ')).toContain('Global Privacy Template');
            expect(optionTexts.join(' ')).not.toContain('Demo: Lock Icon Myth');
            expect(screen.getByTestId('test-rooms-link')).toHaveAttribute('href', '/tutor/test-rooms');
        });

        test('should create test rooms only from behavior templates on Test Rooms page', async () => {
            const mockCreateRoom = supabaseService.createRoom as jest.Mock;
            const mockTemplates = [
                {
                    id: 'template-ai-1',
                    template_name: 'Demo: Lock Icon Myth (Direct Correction)',
                    title_template: 'Demo: Lock Icon Myth',
                    description_template: 'Security notice shared in feed',
                    image_url: '/images/room-presets/phishing_2.png',
                    pre_populated_dialogue: [
                        {
                            user_name: 'Alex',
                            role: 'student',
                            message: 'If the site has a lock icon it is safe, right?'
                        }
                    ],
                    ai_config_template: {
                        enabled: true,
                        model_name: 'gpt-4o-mini',
                        temperature: 0.3,
                        max_tokens: 100,
                        preset: 'casual_peer',
                        scenario: 'Account Security Alert',
                        system_prompt: 'Ask at most one focused question',
                        prompt_config: {
                            role: { role: 'low' },
                            communication_style: {
                                teen_slang: 'low',
                                conversational_markers: 'low',
                                uncertainty_expression: 'high'
                            },
                            cognitive_parameters: {
                                concept_density: 'low',
                                perspective_taking: 'low',
                                personal_examples: 'high',
                                consequence_highlighting: 'low'
                            },
                            emotional_parameters: {
                                enthusiasm_level: 'low',
                                validation_frequency: 'low',
                                mistake_normalization: 'high',
                                confidence_building: 'high'
                            },
                            detection_areas: ['Fear-Based Urgency'],
                            verification_steps: ['Do NOT Click']
                        }
                    },
                    op_config_template: null,
                    password_config: null
                }
            ];

            mockCreateRoom.mockResolvedValue({
                id: 'room-ai-123',
                title: 'Demo: Lock Icon Myth'
            });
            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue(mockTemplates);

            render(
                <TestWrapper>
                    <TestRoomsView />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(supabaseService.getRoomTemplatesByTutor).toHaveBeenCalled();
            });

            fireEvent.click(screen.getByTestId('create-test-room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/use template/i)).toBeInTheDocument();
            });

            const templateSelect = screen.getByLabelText(/use template/i);
            await waitFor(() => {
                expect(
                    Array.from((templateSelect as HTMLSelectElement).options).some(
                        (o) => o.value === 'template-ai-1'
                    )
                ).toBe(true);
            });

            fireEvent.change(templateSelect, {
                target: { value: 'template-ai-1' }
            });

            await waitFor(() => {
                expect((templateSelect as HTMLSelectElement).value).toBe('template-ai-1');
            });

            fireEvent.click(screen.getByText('🚀 Create Room'));

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Demo: Lock Icon Myth',
                        description: expect.stringContaining('[behavior-test-room]')
                    })
                );
            });

            await waitFor(() => {
                expect(aiService.initializeAIAssistant).toHaveBeenCalledWith(
                    'room-ai-123',
                    'gpt-4o-mini',
                    undefined,
                    'tutor-123',
                    expect.objectContaining({
                        role: 'peer',
                        scenario: 'Account Security Alert'
                    })
                );
            });

            expect(
                await screen.findByText(/Test room created with improved AI tutor prompt/i)
            ).toBeInTheDocument();
        });

        test('should load templates using the current tutor id', async () => {
            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            await waitFor(() => {
                expect(supabaseService.getRoomTemplatesByTutor).toHaveBeenCalledWith('tutor-123');
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

        test('should clear stale password and custom OP state when selected template does not define them', async () => {
            const mockTemplates = [
                {
                    id: 'template-1',
                    template_name: 'Global Basics Template',
                    title_template: 'Global Basics Workshop',
                    description_template: 'Default template without password or custom OP',
                    image_url: '/images/room-presets/privacy_1.png',
                    pre_populated_dialogue: null,
                    op_config_template: null,
                    password_config: null
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

            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/use template/i)).toBeInTheDocument();
            });

            fireEvent.click(screen.getByText(/use custom op name/i));
            fireEvent.click(screen.getByText(/enable password protection for this room/i));

            const templateDropdown = screen.getByLabelText(/use template/i);
            fireEvent.change(templateDropdown, { target: { value: 'template-1' } });

            await waitFor(() => {
                const titleInput = screen.getByLabelText(/room title/i) as HTMLInputElement;
                expect(titleInput.value).toBe('Global Basics Workshop');
            });

            fireEvent.click(screen.getByText('🚀 Create Room'));

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith(
                    expect.objectContaining({
                        title: 'Global Basics Workshop',
                        description: 'Default template without password or custom OP',
                        op_id: 'tutor-123',
                        op_display_name: 'Test Tutor',
                        op_avatar_url: null,
                        password: null
                    })
                );
            });

            expect(screen.queryByText('Custom OP name is required when using custom OP')).not.toBeInTheDocument();
            expect(screen.queryByText('Password is required when password protection is enabled')).not.toBeInTheDocument();
        });
    });

    describe('Template Management', () => {
        test('should create room using template-provided password and custom OP configuration', async () => {
            const mockCreateRoom = supabaseService.createRoom as jest.Mock;
            const mockTemplates = [
                {
                    id: 'template-1',
                    template_name: 'Protected Scenario Template',
                    title_template: 'Protected Scenario',
                    description_template: 'Room created from protected template',
                    image_url: '/images/room-presets/phishing_3.png',
                    pre_populated_dialogue: [
                        { user_name: 'OP', message: 'Is this real?', role: 'others' }
                    ],
                    op_config_template: {
                        use_custom_op: true,
                        custom_op_name: 'TrainingBot'
                    },
                    password_config: {
                        use_password: true,
                        password: 'SecureTraining'
                    }
                }
            ];
            
            mockCreateRoom.mockResolvedValue({ 
                id: 'room-123', 
                title: 'Protected Scenario',
                description: 'Room created from protected template'
            });
            (supabaseService.getRoomTemplatesByTutor as jest.Mock).mockResolvedValue(mockTemplates);

            render(
                <TestWrapper>
                    <TutorView />
                </TestWrapper>
            );

            fireEvent.click(screen.getByText('➕ Create a new Room'));

            await waitFor(() => {
                expect(screen.getByLabelText(/use template/i)).toBeInTheDocument();
            });

            fireEvent.change(screen.getByLabelText(/use template/i), {
                target: { value: 'template-1' }
            });

            fireEvent.click(screen.getByText('🚀 Create Room'));

            await waitFor(() => {
                expect(mockCreateRoom).toHaveBeenCalledWith({
                    title: 'Protected Scenario',
                    description: 'Room created from protected template',
                    tutor_id: 'tutor-123',
                    image_url: '/images/room-presets/phishing_3.png',
                    pre_populated_dialogue: [
                        { user_name: 'OP', message: 'Is this real?', role: 'others' }
                    ],
                    op_id: null,
                    op_display_name: 'TrainingBot',
                    op_avatar_url: null,
                    password: 'SecureTraining'
                });
            });
        });
    });
});

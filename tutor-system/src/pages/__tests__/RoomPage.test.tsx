/**
 * Unit Tests for RoomPage Component - UI and Interaction Testing
 * 
 * Test Strategy: "Test room page rendering, user interactions, message display, AI assistant UI, and role-based functionality"
 * 
 * This test suite covers:
 * - Component rendering with different states
 * - User role-based UI elements and permissions
 * - Message sending and display functionality
 * - AI assistant settings and response generation
 * - Loading states and error handling
 * - Navigation and room management
 * 
 * Run with: npm test src/pages/__tests__/RoomPage.test.tsx
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import RoomPage from '../RoomPage';
import { useAuth } from '../../contexts/AuthContext';
import { useRoom } from '../../contexts/RoomContext';
import { User, Room, Message, AIAssistantConfig } from '../../types';

// Mock dependencies
jest.mock('../../contexts/AuthContext');
jest.mock('../../contexts/RoomContext');
jest.mock('../../components/ChatMessage', () => {
    return function MockChatMessage({ message, onGenerateAIResponse, canGenerateAI, isGeneratingAI }: any) {
        return (
            <div data-testid={`message-${message.id}`}>
                <div>{message.content}</div>
                <div>Role: {message.user_role}</div>
                {canGenerateAI && onGenerateAIResponse && (
                    <button
                        onClick={() => onGenerateAIResponse(message.id)}
                        disabled={isGeneratingAI}
                        data-testid={`ai-response-btn-${message.id}`}
                    >
                        {isGeneratingAI ? 'Generating...' : 'Generate AI Response'}
                    </button>
                )}
            </div>
        );
    };
});

jest.mock('../../components/AIAssistantSettings', () => {
    return function MockAIAssistantSettings({ onClose }: any) {
        return (
            <div data-testid="ai-settings-modal">
                <h2>AI Settings</h2>
                <button onClick={onClose} data-testid="close-ai-settings">Close</button>
            </div>
        );
    };
});

// Test wrapper component
const TestRoomPageWrapper: React.FC<{ roomId?: string }> = ({ roomId = 'test-room-id' }) => (
    <MemoryRouter initialEntries={[`/room/${roomId}`]}>
        <RoomPage />
    </MemoryRouter>
);

describe('RoomPage Component Tests', () => {
    let mockUser: User;
    let mockRoom: Room;
    let mockMessages: Message[];
    let mockAIConfig: AIAssistantConfig;
    let mockUseAuth: jest.MockedFunction<typeof useAuth>;
    let mockUseRoom: jest.MockedFunction<typeof useRoom>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockUser = {
            id: 'test-user-id',
            email: 'test@example.com',
            display_name: 'Test User',
            current_role: 'tutor',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        mockRoom = {
            id: 'test-room-id',
            tutor_id: mockUser.id,
            title: 'Test Room',
            description: 'Test Description',
            image_url: null,
            is_active: true,
            ai_assistant_enabled: false,
            ai_assistant_model: null,
            ai_assistant_prompt: null,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        mockMessages = [
            {
                id: 'msg-1',
                room_id: mockRoom.id,
                user_id: 'student-id',
                content: 'Hello, I need help',
                user_role: 'student',
                is_ai_generated: false,
                ai_model_used: null,
                ai_response_time_ms: null,
                parent_message_id: null,
                created_at: '2024-01-01T10:00:00Z'
            },
            {
                id: 'msg-2',
                room_id: mockRoom.id,
                user_id: mockUser.id,
                content: 'How can I help you?',
                user_role: 'tutor',
                is_ai_generated: false,
                ai_model_used: null,
                ai_response_time_ms: null,
                parent_message_id: null,
                created_at: '2024-01-01T10:01:00Z'
            }
        ];

        mockAIConfig = {
            id: 'ai-config-id',
            room_id: mockRoom.id,
            model_name: 'gpt-4o',
            system_prompt: 'Test prompt',
            temperature: 0.7,
            max_tokens: 1000,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
        mockUseRoom = useRoom as jest.MockedFunction<typeof useRoom>;

        // Default mocks
        mockUseAuth.mockReturnValue({
            user: mockUser,
            loading: false,
            signIn: jest.fn(),
            signUp: jest.fn(),
            signOut: jest.fn(),
            setUserRole: jest.fn()
        });

        mockUseRoom.mockReturnValue({
            currentRoom: mockRoom,
            messages: mockMessages,
            loading: false,
            loadingAI: false,
            aiConfig: null,
            createRoom: jest.fn(),
            joinRoom: jest.fn(),
            leaveRoom: jest.fn(),
            sendMessage: jest.fn(),
            generateAIResponse: jest.fn(),
            toggleAIAssistant: jest.fn()
        });
    });

    describe('Component Rendering', () => {
        it('should render loading state', () => {
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                loading: true,
                currentRoom: null
            });

            render(<TestRoomPageWrapper />);

            expect(screen.getByText('Loading room...')).toBeInTheDocument();
        });

        it('should render room not found state', () => {
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                loading: false,
                currentRoom: null
            });

            render(<TestRoomPageWrapper />);

            expect(screen.getByText('Room not found')).toBeInTheDocument();
            expect(screen.getByText("The room you're looking for doesn't exist or is no longer active.")).toBeInTheDocument();
            expect(screen.getByText('Back to Home')).toBeInTheDocument();
        });

        it('should render room with basic information', () => {
            render(<TestRoomPageWrapper />);

            expect(screen.getByText('Test Room')).toBeInTheDocument();
            expect(screen.getByText('Test Description')).toBeInTheDocument();
            expect(screen.getByText('Leave Room')).toBeInTheDocument();
        });

        it('should render room without description', () => {
            const roomWithoutDesc = { ...mockRoom, description: null };
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithoutDesc
            });

            render(<TestRoomPageWrapper />);

            expect(screen.getByText('Test Room')).toBeInTheDocument();
            expect(screen.queryByText('Test Description')).not.toBeInTheDocument();
        });
    });

    describe('Message Display and Interaction', () => {
        it('should display messages correctly', () => {
            render(<TestRoomPageWrapper />);

            expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
            expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
            expect(screen.getByText('Hello, I need help')).toBeInTheDocument();
            expect(screen.getByText('How can I help you?')).toBeInTheDocument();
        });

        it('should display empty message state', () => {
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                messages: []
            });

            render(<TestRoomPageWrapper />);

            expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
        });

        it('should scroll to bottom when messages update', () => {
            const scrollIntoViewMock = jest.fn();
            HTMLDivElement.prototype.scrollIntoView = scrollIntoViewMock;

            const { rerender } = render(<TestRoomPageWrapper />);

            // Update messages
            const newMessages = [...mockMessages, {
                id: 'msg-3',
                room_id: mockRoom.id,
                user_id: mockUser.id,
                content: 'New message',
                user_role: 'tutor',
                is_ai_generated: false,
                ai_model_used: null,
                ai_response_time_ms: null,
                parent_message_id: null,
                created_at: '2024-01-01T10:02:00Z'
            }];

            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                messages: newMessages
            });

            rerender(<TestRoomPageWrapper />);

            expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
        });
    });

    describe('Message Sending Functionality', () => {
        it('should send message successfully as tutor', async () => {
            const mockSendMessage = jest.fn().mockResolvedValue(undefined);
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                sendMessage: mockSendMessage
            });

            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const input = screen.getByPlaceholderText('Type your message...');
            const sendButton = screen.getByText('Send');

            await user.type(input, 'Test message');
            await user.click(sendButton);

            await waitFor(() => {
                expect(mockSendMessage).toHaveBeenCalledWith('Test message');
            });

            // Input should be cleared after sending
            expect(input).toHaveValue('');
        });

        it('should send message successfully as student', async () => {
            const studentUser = { ...mockUser, current_role: 'student' as const };
            mockUseAuth.mockReturnValue({
                ...mockUseAuth(),
                user: studentUser
            });

            const mockSendMessage = jest.fn().mockResolvedValue(undefined);
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                sendMessage: mockSendMessage
            });

            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const input = screen.getByPlaceholderText('Type your message...');
            const sendButton = screen.getByText('Send');

            await user.type(input, 'Student question');
            await user.click(sendButton);

            await waitFor(() => {
                expect(mockSendMessage).toHaveBeenCalledWith('Student question');
            });
        });

        it('should not show message input for observers', () => {
            const observerUser = { ...mockUser, current_role: 'observer' as const };
            mockUseAuth.mockReturnValue({
                ...mockUseAuth(),
                user: observerUser
            });

            render(<TestRoomPageWrapper />);

            expect(screen.queryByPlaceholderText('Type your message...')).not.toBeInTheDocument();
            expect(screen.getByText('👁️ You are observing this session. You cannot send messages.')).toBeInTheDocument();
        });

        it('should handle message sending errors', async () => {
            const mockSendMessage = jest.fn().mockRejectedValue(new Error('Send failed'));
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                sendMessage: mockSendMessage
            });

            // Mock window.alert
            const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const input = screen.getByPlaceholderText('Type your message...');
            const sendButton = screen.getByText('Send');

            await user.type(input, 'Test message');
            await user.click(sendButton);

            await waitFor(() => {
                expect(alertSpy).toHaveBeenCalledWith('Failed to send message. Please try again.');
            });

            alertSpy.mockRestore();
        });

        it('should disable send button when message is empty', () => {
            render(<TestRoomPageWrapper />);

            const sendButton = screen.getByText('Send');
            expect(sendButton).toBeDisabled();
        });

        it('should disable send button when sending message', async () => {
            const mockSendMessage = jest.fn(() => new Promise(resolve => setTimeout(resolve, 100)));
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                sendMessage: mockSendMessage
            });

            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const input = screen.getByPlaceholderText('Type your message...');
            const sendButton = screen.getByText('Send');

            await user.type(input, 'Test message');

            await act(async () => {
                await user.click(sendButton);
            });

            expect(screen.getByText('Sending...')).toBeInTheDocument();
        });
    });

    describe('AI Assistant Functionality', () => {
        it('should show AI controls for tutors', () => {
            render(<TestRoomPageWrapper />);

            expect(screen.getByText('🤖 AI Assistant: Disabled')).toBeInTheDocument();
            expect(screen.getByText('AI Settings')).toBeInTheDocument();
        });

        it('should not show AI controls for non-tutors', () => {
            const studentUser = { ...mockUser, current_role: 'student' as const };
            mockUseAuth.mockReturnValue({
                ...mockUseAuth(),
                user: studentUser
            });

            render(<TestRoomPageWrapper />);

            expect(screen.queryByText('🤖 AI Assistant: Disabled')).not.toBeInTheDocument();
            expect(screen.queryByText('AI Settings')).not.toBeInTheDocument();
        });

        it('should show AI enabled status with model info', () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithAI,
                aiConfig: mockAIConfig
            });

            render(<TestRoomPageWrapper />);

            expect(screen.getByText('🤖 AI Assistant: Enabled')).toBeInTheDocument();
            expect(screen.getByText('(gpt-4o)')).toBeInTheDocument();
            expect(screen.getByText('🤖 Generate Response')).toBeInTheDocument();
        });

        it('should open AI settings modal', async () => {
            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const settingsButton = screen.getByText('AI Settings');
            await user.click(settingsButton);

            expect(screen.getByTestId('ai-settings-modal')).toBeInTheDocument();
        });

        it('should close AI settings modal', async () => {
            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            // Open modal
            const settingsButton = screen.getByText('AI Settings');
            await user.click(settingsButton);

            expect(screen.getByTestId('ai-settings-modal')).toBeInTheDocument();

            // Close modal
            const closeButton = screen.getByTestId('close-ai-settings');
            await user.click(closeButton);

            expect(screen.queryByTestId('ai-settings-modal')).not.toBeInTheDocument();
        });

        it('should generate AI response successfully', async () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            const mockGenerateAI = jest.fn().mockResolvedValue(undefined);
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithAI,
                aiConfig: mockAIConfig,
                generateAIResponse: mockGenerateAI
            });

            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const generateButton = screen.getByText('🤖 Generate Response');
            await user.click(generateButton);

            await waitFor(() => {
                expect(mockGenerateAI).toHaveBeenCalled();
            });
        });

        it('should handle AI response generation errors', async () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            const mockGenerateAI = jest.fn().mockRejectedValue(new Error('AI generation failed'));
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithAI,
                aiConfig: mockAIConfig,
                generateAIResponse: mockGenerateAI
            });

            const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const generateButton = screen.getByText('🤖 Generate Response');
            await user.click(generateButton);

            await waitFor(() => {
                expect(alertSpy).toHaveBeenCalledWith('Failed to generate AI response. Please try again.');
            });

            alertSpy.mockRestore();
        });

        it('should show loading state when generating AI response', () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithAI,
                aiConfig: mockAIConfig,
                loadingAI: true
            });

            render(<TestRoomPageWrapper />);

            expect(screen.getByText('Generating...')).toBeInTheDocument();
        });

        it('should generate AI response to specific message', async () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            const mockGenerateAI = jest.fn().mockResolvedValue(undefined);
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithAI,
                aiConfig: mockAIConfig,
                generateAIResponse: mockGenerateAI
            });

            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const aiResponseButton = screen.getByTestId('ai-response-btn-msg-1');
            await user.click(aiResponseButton);

            await waitFor(() => {
                expect(mockGenerateAI).toHaveBeenCalledWith('Hello, I need help');
            });
        });

        it('should disable AI response buttons when loading', () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithAI,
                aiConfig: mockAIConfig,
                loadingAI: true
            });

            render(<TestRoomPageWrapper />);

            const aiResponseButton = screen.getByTestId('ai-response-btn-msg-1');
            expect(aiResponseButton).toBeDisabled();
        });
    });

    describe('Room Management and Navigation', () => {
        it('should join room on component mount', () => {
            const mockJoinRoom = jest.fn();
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                joinRoom: mockJoinRoom
            });

            render(<TestRoomPageWrapper />);

            expect(mockJoinRoom).toHaveBeenCalledWith('test-room-id');
        });

        it('should leave room on component unmount', () => {
            const mockLeaveRoom = jest.fn();
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                leaveRoom: mockLeaveRoom
            });

            const { unmount } = render(<TestRoomPageWrapper />);
            unmount();

            expect(mockLeaveRoom).toHaveBeenCalled();
        });

        it('should handle join room errors gracefully', () => {
            const mockJoinRoom = jest.fn().mockRejectedValue(new Error('Join failed'));
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                joinRoom: mockJoinRoom
            });

            render(<TestRoomPageWrapper />);

            expect(mockJoinRoom).toHaveBeenCalledWith('test-room-id');

            consoleSpy.mockRestore();
        });

        it('should show download chat history button (disabled)', () => {
            render(<TestRoomPageWrapper />);

            const downloadButton = screen.getByText('Download Chat History [Task 8]');
            expect(downloadButton).toBeDisabled();
        });
    });

    describe('User Role-Based Behavior', () => {
        it('should show correct functionality for tutor role', () => {
            render(<TestRoomPageWrapper />);

            // Can send messages
            expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();

            // Can access AI controls
            expect(screen.getByText('AI Settings')).toBeInTheDocument();

            // Messages should show AI response buttons for student messages
            expect(screen.getByTestId('ai-response-btn-msg-1')).toBeInTheDocument();
        });

        it('should show correct functionality for student role', () => {
            const studentUser = { ...mockUser, current_role: 'student' as const };
            mockUseAuth.mockReturnValue({
                ...mockUseAuth(),
                user: studentUser
            });

            render(<TestRoomPageWrapper />);

            // Can send messages
            expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();

            // Cannot access AI controls
            expect(screen.queryByText('AI Settings')).not.toBeInTheDocument();

            // Messages should not show AI response buttons
            expect(screen.queryByTestId('ai-response-btn-msg-1')).not.toBeInTheDocument();
        });

        it('should show correct functionality for observer role', () => {
            const observerUser = { ...mockUser, current_role: 'observer' as const };
            mockUseAuth.mockReturnValue({
                ...mockUseAuth(),
                user: observerUser
            });

            render(<TestRoomPageWrapper />);

            // Cannot send messages
            expect(screen.queryByPlaceholderText('Type your message...')).not.toBeInTheDocument();
            expect(screen.getByText('👁️ You are observing this session. You cannot send messages.')).toBeInTheDocument();

            // Cannot access AI controls
            expect(screen.queryByText('AI Settings')).not.toBeInTheDocument();

            // Messages should not show AI response buttons
            expect(screen.queryByTestId('ai-response-btn-msg-1')).not.toBeInTheDocument();
        });
    });

    describe('Edge Cases and Error States', () => {
        it('should handle missing user gracefully', () => {
            mockUseAuth.mockReturnValue({
                ...mockUseAuth(),
                user: null
            });

            render(<TestRoomPageWrapper />);

            // Should not show message input
            expect(screen.queryByPlaceholderText('Type your message...')).not.toBeInTheDocument();

            // Should not show AI controls
            expect(screen.queryByText('AI Settings')).not.toBeInTheDocument();
        });

        it('should handle missing roomId parameter', () => {
            const TestWrapperWithoutId: React.FC = () => (
                <MemoryRouter initialEntries={['/room/']}>
                    <RoomPage />
                </MemoryRouter>
            );

            render(<TestWrapperWithoutId />);

            // Should still attempt to join with undefined roomId
            expect(mockUseRoom().joinRoom).toHaveBeenCalledWith(undefined);
        });

        it('should prevent form submission with empty message', async () => {
            const mockSendMessage = jest.fn();
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                sendMessage: mockSendMessage
            });

            const user = userEvent.setup();
            render(<TestRoomPageWrapper />);

            const form = screen.getByRole('form');

            await act(async () => {
                fireEvent.submit(form);
            });

            expect(mockSendMessage).not.toHaveBeenCalled();
        });

        it('should not generate AI response when no messages exist', () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            mockUseRoom.mockReturnValue({
                ...mockUseRoom(),
                currentRoom: roomWithAI,
                aiConfig: mockAIConfig,
                messages: []
            });

            render(<TestRoomPageWrapper />);

            const generateButton = screen.getByText('🤖 Generate Response');
            expect(generateButton).toBeDisabled();
        });
    });
}); 
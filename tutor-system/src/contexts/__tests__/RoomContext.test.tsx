/**
 * Unit Tests for RoomContext - Room Management and Real-time Features
 * 
 * Test Strategy: "Test room creation, joining, messaging, AI assistant integration, real-time updates, and state management"
 * 
 * This test suite covers:
 * - RoomProvider initialization and context management
 * - Room creation, joining, and leaving functionality
 * - Message sending and real-time subscription
 * - AI assistant integration and configuration
 * - Error handling and permission validation
 * - State management and loading states
 * 
 * Run with: npm test src/contexts/__tests__/RoomContext.test.tsx
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RoomProvider, useRoom } from '../RoomContext';
import { AuthProvider, useAuth } from '../AuthContext';
import {
    supabase,
    getMessagesFeedbackStats,
    getMessageFeedbackStats,
    getUserMessageFeedback,
    submitMessageFeedback,
    getRoomFeedbackSummary
} from '../../services/supabase';
import { User, Room, Message, AIAssistantConfig } from '../../types';

// Mock all dependencies
jest.mock('../../services/supabase', () => ({
    supabase: {
        channel: jest.fn(),
        from: jest.fn(),
        storage: {
            from: jest.fn()
        }
    },
    validateRoomPassword: jest.fn(),
    submitMessageFeedback: jest.fn(),
    getMessageFeedbackStats: jest.fn(),
    getMessagesFeedbackStats: jest.fn(),
    getUserMessageFeedback: jest.fn(),
    getRoomFeedbackSummary: jest.fn(),
    clearChatHistory: jest.fn()
}));

jest.mock('../../services/aiService', () => ({
    DEFAULT_AI_MODEL: 'gpt-4o-mini',
    generateTutorSuggestion: jest.fn(),
    getAIConfig: jest.fn(),
    updateAIConfig: jest.fn()
}));

jest.mock('../AuthContext', () => ({
    useAuth: jest.fn(),
    AuthProvider: ({ children }: { children: React.ReactNode }) => children
}));

// Test component to access room context
const TestRoomComponent: React.FC = () => {
    const {
        currentRoom,
        messages,
        loading,
        loadingAI,
        aiConfig,
        messageFeedbackStats,
        createRoom,
        joinRoom,
        leaveRoom,
        sendMessage,
        generateAIResponse,
        toggleAIAssistant
    } = useRoom();

    const handleCreateRoom = async () => {
        try {
            await createRoom('Test Room', 'Test Description');
        } catch (error) {
            // Handle errors silently in tests
        }
    };

    const handleJoinRoom = async () => {
        try {
            await joinRoom('test-room-id');
        } catch (error) {
            // Handle errors silently in tests
        }
    };

    const handleSendMessage = async () => {
        try {
            await sendMessage('Test message');
        } catch (error) {
            // Handle errors silently in tests
        }
    };

    const handleGenerateAI = async () => {
        try {
            await generateAIResponse('Test prompt');
        } catch (error) {
            // Handle errors silently in tests
        }
    };

    const handleToggleAI = async () => {
        try {
            await toggleAIAssistant(true, { model_name: 'gpt-4' });
        } catch (error) {
            // Handle errors silently in tests
        }
    };

    return (
        <div>
            <div data-testid="loading">{loading ? 'loading' : 'not-loading'}</div>
            <div data-testid="loading-ai">{loadingAI ? 'loading-ai' : 'not-loading-ai'}</div>
            <div data-testid="current-room">{currentRoom ? JSON.stringify(currentRoom) : 'no-room'}</div>
            <div data-testid="messages">{JSON.stringify(messages)}</div>
            <div data-testid="message-feedback-stats">{JSON.stringify(messageFeedbackStats)}</div>
            <div data-testid="ai-config">{aiConfig ? JSON.stringify(aiConfig) : 'no-ai-config'}</div>
            <button onClick={handleCreateRoom}>Create Room</button>
            <button onClick={handleJoinRoom}>Join Room</button>
            <button onClick={() => leaveRoom()}>Leave Room</button>
            <button onClick={handleSendMessage}>Send Message</button>
            <button onClick={handleGenerateAI}>Generate AI</button>
            <button onClick={handleToggleAI}>Toggle AI</button>
        </div>
    );
};

// Helper component that exposes room functions for direct testing
const TestRoomHelper: React.FC<{ onRoomFunctions?: (functions: any) => void }> = ({ onRoomFunctions }) => {
    const roomFunctions = useRoom();

    React.useEffect(() => {
        if (onRoomFunctions) {
            onRoomFunctions(roomFunctions);
        }
    }, [roomFunctions, onRoomFunctions]);

    return null;
};

describe('RoomContext - Room Management Tests', () => {
    let mockUser: User;
    let mockRoom: Room;
    let mockMessage: Message;
    let mockAIConfig: AIAssistantConfig;
    let mockSubscription: any;

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

        mockMessage = {
            id: 'test-message-id',
            room_id: mockRoom.id,
            user_id: mockUser.id,
            content: 'Test message',
            user_role: 'tutor',
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: '2024-01-01T00:00:00Z'
        };

        mockAIConfig = {
            id: 'test-ai-config-id',
            room_id: mockRoom.id,
            model_name: 'gpt-4o-mini',
            system_prompt: 'Test prompt',
            temperature: 0.7,
            max_tokens: 1000,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        };

        mockSubscription = {
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
            unsubscribe: jest.fn(),
            send: jest.fn()
        };

        (submitMessageFeedback as jest.Mock).mockResolvedValue({
            id: 'feedback-1',
            message_id: mockMessage.id,
            user_id: mockUser.id,
            room_id: mockRoom.id,
            feedback_type: 'like',
            rating: 4
        });

        (getMessageFeedbackStats as jest.Mock).mockResolvedValue({
            message_id: mockMessage.id,
            total_feedback_count: 0,
            like_count: 0,
            dislike_count: 0,
            average_like_rating: null,
            average_dislike_rating: null,
            overall_average_rating: null,
            user_feedback: null
        });

        (getUserMessageFeedback as jest.Mock).mockResolvedValue(null);
        // Reuse the per-message fixtures while exercising the real batched hook integration.
        (getMessagesFeedbackStats as jest.Mock).mockImplementation(async (_roomId, userId, ids: string[]) =>
            Object.fromEntries(await Promise.all(ids.map(async id => [id, {
                ...await getMessageFeedbackStats(id),
                message_id: id,
                user_feedback: await getUserMessageFeedback(id, userId)
            }]))));
        (getRoomFeedbackSummary as jest.Mock).mockResolvedValue({
            total_messages_with_feedback: 0,
            total_feedback_entries: 0,
            average_room_rating: null
        });

        // Setup default useAuth mock
        (useAuth as jest.Mock).mockReturnValue({
            user: mockUser,
            loading: false
        });

        // Setup default supabase channel mock
        (supabase.channel as jest.Mock).mockReturnValue(mockSubscription);
    });

    const mockJoinedRoomQueries = (
        messagesData: Message[] = [],
        roomData: Room = mockRoom,
        insertError: Error | null = null
    ) => {
        const supabaseFrom = supabase.from as jest.Mock;
        supabaseFrom.mockReset();

        const roomQuery: any = {};
        roomQuery.select = jest.fn(() => roomQuery);
        roomQuery.eq = jest.fn(() => roomQuery);
        roomQuery.single = jest.fn().mockResolvedValue({ data: roomData, error: null });

        const insertResult = jest.fn().mockResolvedValue({
            data: insertError ? null : mockMessage,
            error: insertError
        });
        const insertMessage = jest.fn(() => ({
            select: jest.fn(() => ({ single: insertResult }))
        }));
        const messagesQuery: any = {};
        messagesQuery.select = jest.fn(() => messagesQuery);
        messagesQuery.eq = jest.fn(() => messagesQuery);
        messagesQuery.order = jest.fn().mockResolvedValue({ data: messagesData, error: null });
        messagesQuery.insert = insertMessage;

        const participantsQuery: any = {};
        participantsQuery.select = jest.fn(() => participantsQuery);
        participantsQuery.in = jest.fn().mockResolvedValue({ data: [mockUser], error: null });

        const emptyQuery: any = {};
        emptyQuery.select = jest.fn(() => emptyQuery);
        emptyQuery.eq = jest.fn(() => emptyQuery);
        emptyQuery.limit = jest.fn().mockResolvedValue({ data: [], error: null });

        supabaseFrom.mockImplementation((table: string) => {
            if (table === 'rooms') return roomQuery;
            if (table === 'messages') return messagesQuery;
            if (table === 'users') return participantsQuery;
            return emptyQuery;
        });

        return { roomQuery, messagesQuery, participantsQuery, insertMessage };
    };

    // RoomContext.tsx: exercise the real feedback hook with room transitions and overlapping channel notifications.
    it('batches room history, drops old in-flight feedback and targets overlapping refresh events', async () => {
        let api: ReturnType<typeof useRoom>;
        let resolveOld!: (value: any) => void;
        const oldRead = new Promise(done => { resolveOld = done; });
        const makeStats = (id: string, count: number) => ({
            message_id: id, total_feedback_count: count, like_count: count, dislike_count: 0,
            average_like_rating: count ? 4 : null, average_dislike_rating: null,
            overall_average_rating: count ? 4 : null, user_feedback: null
        });
        const rows = Array.from({ length: 50 }, (_, index) => ({ ...mockMessage, id: `persisted-${index}` }));
        mockJoinedRoomQueries(rows);
        (getMessagesFeedbackStats as jest.Mock).mockImplementationOnce(() => oldRead)
            .mockImplementation(async (_room, _user, ids: string[]) =>
                Object.fromEntries(ids.map(id => [id, makeStats(id, 0)])));
        render(<RoomProvider><TestRoomHelper onRoomFunctions={value => { api = value; }} /></RoomProvider>);
        await act(async () => { await api!.joinRoom(mockRoom.id); });
        await waitFor(() => expect(getMessagesFeedbackStats).toHaveBeenCalledTimes(1));
        expect(getMessagesFeedbackStats).toHaveBeenCalledWith(mockRoom.id, mockUser.id, expect.arrayContaining(rows.map(row => row.id)));
        expect((getMessagesFeedbackStats as jest.Mock).mock.calls[0][2]).toHaveLength(50);
        const oldHandler = mockSubscription.on.mock.calls.find(([event, config]: any[]) =>
            event === 'postgres_changes' && config.table === 'message_feedback' && config.event === 'INSERT')[2];
        const nextRoom = { ...mockRoom, id: 'next-room' };
        const nextMessage = { ...mockMessage, id: 'next-message', room_id: nextRoom.id };
        mockJoinedRoomQueries([nextMessage], nextRoom);
        await act(async () => { await api!.joinRoom(nextRoom.id); });
        await waitFor(() => expect(api!.messageFeedbackStats['next-message']).toBeDefined());
        await act(async () => {
            resolveOld(Object.fromEntries(rows.map(row => [row.id, makeStats(row.id, 99)])));
            await oldHandler({ new: { message_id: rows[0].id, room_id: mockRoom.id } });
        });
        expect(Object.keys(api!.messageFeedbackStats)).toEqual(['next-message']);
        expect(getMessagesFeedbackStats).toHaveBeenCalledTimes(2);
        const currentInsert = mockSubscription.on.mock.calls.filter(([event, config]: any[]) =>
            event === 'postgres_changes' && config.table === 'message_feedback' && config.event === 'INSERT').slice(-1)[0][2];
        const broadcast = mockSubscription.on.mock.calls.filter(([event, config]: any[]) =>
            event === 'broadcast' && config.event === 'message_feedback_changed').slice(-1)[0][2];
        await act(async () => {
            const refresh = currentInsert({ new: { message_id: nextMessage.id, room_id: nextRoom.id } });
            broadcast({ payload: { messageId: nextMessage.id } });
            await refresh;
        });
        expect(getMessagesFeedbackStats).toHaveBeenCalledTimes(3);
        expect(getMessagesFeedbackStats).toHaveBeenLastCalledWith(nextRoom.id, mockUser.id, [nextMessage.id]);
    });

    describe('RoomProvider Initialization', () => {
        it('should initialize with default state', () => {
            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            expect(screen.getByTestId('loading')).toHaveTextContent('not-loading');
            expect(screen.getByTestId('loading-ai')).toHaveTextContent('not-loading-ai');
            expect(screen.getByTestId('current-room')).toHaveTextContent('no-room');
            expect(screen.getByTestId('messages')).toHaveTextContent('[]');
            expect(screen.getByTestId('ai-config')).toHaveTextContent('no-ai-config');
        });

        it('should throw error when useRoom is used outside RoomProvider', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            expect(() => {
                render(<TestRoomComponent />);
            }).toThrow('useRoom must be used within a RoomProvider');

            consoleSpy.mockRestore();
        });
    });

    describe('Room Creation', () => {
        beforeEach(() => {
            const mockFromChain = {
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: mockRoom,
                            error: null
                        })
                    }))
                })),
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        order: jest.fn().mockResolvedValue({ data: [], error: null })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);
        });

        it('should create room successfully as tutor', async () => {
            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Create Room').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('current-room')).toHaveTextContent(JSON.stringify(mockRoom));
            });

            expect(supabase.from).toHaveBeenCalledWith('rooms');
        });

        it('should handle room creation with image upload', async () => {
            const mockStorageChain = {
                upload: jest.fn().mockResolvedValue({
                    data: { path: 'test-path' },
                    error: null
                }),
                getPublicUrl: jest.fn().mockReturnValue({
                    data: { publicUrl: 'https://test.com/image.jpg' }
                })
            };

            (supabase.storage.from as jest.Mock).mockReturnValue(mockStorageChain);

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            const imageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

            await act(async () => {
                await roomFunctions.createRoom('Test Room', 'Description', imageFile);
            });

            expect(mockStorageChain.upload).toHaveBeenCalled();
            expect(mockStorageChain.getPublicUrl).toHaveBeenCalled();
        });

        it('should throw error when non-tutor tries to create room', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: { ...mockUser, current_role: 'student' },
                loading: false
            });

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            await expect(roomFunctions.createRoom('Test Room')).rejects.toThrow('Only tutors can create rooms');
        });

        it('should handle room creation errors', async () => {
            const mockError = new Error('Database error');
            const mockFromChain = {
                insert: jest.fn(() => ({
                    select: jest.fn(() => ({
                        single: jest.fn().mockResolvedValue({
                            data: null,
                            error: mockError
                        })
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            await expect(roomFunctions.createRoom('Test Room')).rejects.toThrow('Database error');
        });
    });

    describe('Room Joining and Leaving', () => {
        it('should join room successfully', async () => {
            mockJoinedRoomQueries([mockMessage]);

            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('current-room')).toHaveTextContent(JSON.stringify(mockRoom));
                const messages = JSON.parse(screen.getByTestId('messages').textContent || '[]');
                expect(messages).toMatchObject([{
                    id: mockMessage.id,
                    content: mockMessage.content,
                    display_name: mockUser.display_name
                }]);
            });
        });

        it('should leave room and clear state', async () => {
            mockJoinedRoomQueries([mockMessage]);

            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            // Join room first
            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('current-room')).toHaveTextContent(JSON.stringify(mockRoom));
            });

            // Now leave room
            await act(async () => {
                screen.getByText('Leave Room').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('current-room')).toHaveTextContent('no-room');
                expect(screen.getByTestId('messages')).toHaveTextContent('[]');
                expect(screen.getByTestId('ai-config')).toHaveTextContent('no-ai-config');
            });
        });

        it('should handle join room errors', async () => {
            const mockError = new Error('Room not found');
            const mockFromChain = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: null,
                                error: mockError
                            })
                        }))
                    }))
                }))
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            await expect(roomFunctions.joinRoom('invalid-room-id')).rejects.toThrow('Room not found');
        });
    });

    describe('Message Sending', () => {
        it('should send message successfully', async () => {
            const { insertMessage } = mockJoinedRoomQueries();

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            // First join the room to set up the context state
            await act(async () => {
                await roomFunctions.joinRoom(mockRoom.id);
            });

            // Now send the message
            await act(async () => {
                await roomFunctions.sendMessage('Test message');
            });

            expect(insertMessage).toHaveBeenCalledWith({
                room_id: mockRoom.id,
                user_id: mockUser.id,
                content: 'Test message',
                user_role: 'tutor',
                parent_message_id: null,
                response_mode: 'tutoring'
            });
        });

        it('should prevent observers from sending messages', async () => {
            const observerUser = { ...mockUser, current_role: 'observer' as const };
            (useAuth as jest.Mock).mockReturnValue({
                user: observerUser,
                loading: false
            });

            mockJoinedRoomQueries();

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            // First join the room to set up the context state
            await act(async () => {
                await roomFunctions.joinRoom(mockRoom.id);
            });

            // Now try to send message as observer - should fail
            await expect(roomFunctions.sendMessage('Test')).rejects.toThrow('Observers cannot send messages');
        });

        it('should handle message sending errors', async () => {
            const mockError = new Error('Database error');
            const { insertMessage } = mockJoinedRoomQueries([], mockRoom, mockError);

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            // First join the room to set up the context state
            await act(async () => {
                await roomFunctions.joinRoom(mockRoom.id);
            });

            // Now try to send message - should fail with database error
            await expect(roomFunctions.sendMessage('Test')).rejects.toThrow('Database error');
            expect(insertMessage).toHaveBeenCalled();
        });
    });

    describe('AI Assistant Integration', () => {
        const { generateTutorSuggestion, getAIConfig, updateAIConfig } = require('../../services/aiService');

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should load AI config when room changes', async () => {
            (getAIConfig as jest.Mock).mockResolvedValue(mockAIConfig);
            mockJoinedRoomQueries([], { ...mockRoom, ai_assistant_enabled: true });

            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(getAIConfig).toHaveBeenCalledWith(mockRoom.id);
                expect(screen.getByTestId('ai-config')).toHaveTextContent(JSON.stringify(mockAIConfig));
            });
        });

        it('should generate AI response successfully', async () => {
            const roomWithAI = { ...mockRoom, ai_assistant_enabled: true };
            const studentMessage = { ...mockMessage, user_role: 'student' as const };
            (generateTutorSuggestion as jest.Mock).mockResolvedValue({
                success: true,
                suggestion: 'Check the sender address before you open it.',
                decision: {
                    guard_mode: false,
                    instruction: 'scaffolding',
                    guard_reason: 'Help the learner inspect evidence.',
                    suggested_response: 'What does the sender address tell you?'
                },
                contextMessages: []
            });
            mockJoinedRoomQueries([studentMessage], roomWithAI);

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            await act(async () => {
                await roomFunctions.joinRoom(roomWithAI.id);
            });

            await act(async () => {
                await roomFunctions.generateAIResponse();
            });

            expect(generateTutorSuggestion).toHaveBeenCalledWith(
                roomWithAI.id,
                mockUser.id,
                undefined,
                { focusStudentMessage: studentMessage.content, focusStudentId: studentMessage.user_id, expectedAssessmentResultIds: [] }
            );
        });

        it('should prevent non-tutors from generating AI responses', async () => {
            const studentUser = { ...mockUser, current_role: 'student' as const };
            (useAuth as jest.Mock).mockReturnValue({
                user: studentUser,
                loading: false
            });
            mockJoinedRoomQueries([], { ...mockRoom, ai_assistant_enabled: true });

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            // First join the room to set up the context state
            await act(async () => {
                await roomFunctions.joinRoom(mockRoom.id);
            });

            await expect(roomFunctions.generateAIResponse()).rejects.toThrow('Only tutors can generate AI responses');
        });

        it('should toggle AI assistant successfully', async () => {
            (updateAIConfig as jest.Mock).mockResolvedValue(mockAIConfig);
            (getAIConfig as jest.Mock).mockResolvedValue(mockAIConfig);
            const updatedRoom = { ...mockRoom, ai_assistant_enabled: true };
            const { roomQuery } = mockJoinedRoomQueries();
            roomQuery.single
                .mockResolvedValueOnce({ data: mockRoom, error: null })
                .mockResolvedValueOnce({ data: updatedRoom, error: null });

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            // First join the room to set up the context state
            await act(async () => {
                await roomFunctions.joinRoom(mockRoom.id);
            });

            await act(async () => {
                await roomFunctions.toggleAIAssistant(true, { model_name: 'gpt-4' });
            });

            expect(updateAIConfig).toHaveBeenCalledWith(
                mockRoom.id,
                expect.objectContaining({ model_name: 'gpt-4', is_active: true }),
                mockUser.id,
                'settings_enable'
            );
        });
    });

    describe('Real-time Message Subscription', () => {
        const createRoomChannel = () => ({
            on: jest.fn().mockReturnThis(),
            send: jest.fn(),
            subscribe: jest.fn().mockReturnValue(mockSubscription),
            unsubscribe: jest.fn()
        });

        const mockSuccessfulRoomJoin = (messagesData: Message[] = []) => {
            const mockRoomQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: mockRoom,
                                error: null
                            })
                        }))
                    }))
                }))
            };

            const mockMessagesQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        order: jest.fn().mockResolvedValue({
                            data: messagesData,
                            error: null
                        })
                    }))
                }))
            };

            const mockUsersQuery = {
                select: jest.fn(() => ({
                    in: jest.fn().mockResolvedValue({
                        data: [mockUser],
                        error: null
                    })
                }))
            };

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(mockRoomQuery)
                .mockReturnValueOnce(mockMessagesQuery)
                .mockReturnValueOnce(mockUsersQuery)
                .mockReturnValueOnce(mockMessagesQuery)
                .mockReturnValue(mockMessagesQuery);
        };

        it('should setup message subscription when room is joined', async () => {
            const mockChannel = createRoomChannel();

            (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
            mockSuccessfulRoomJoin();

            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(supabase.channel).toHaveBeenCalledWith(`room_${mockRoom.id}`);
                expect(mockChannel.on).toHaveBeenCalledWith(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `room_id=eq.${mockRoom.id}`
                    },
                    expect.any(Function)
                );
                expect(mockChannel.on).toHaveBeenCalledWith(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'message_feedback',
                        filter: `room_id=eq.${mockRoom.id}`
                    },
                    expect.any(Function)
                );
                expect(mockChannel.on).toHaveBeenCalledWith(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'message_feedback',
                        filter: `room_id=eq.${mockRoom.id}`
                    },
                    expect.any(Function)
                );
                expect(mockChannel.on).toHaveBeenCalledWith(
                    'broadcast',
                    { event: 'message_feedback_changed' },
                    expect.any(Function)
                );
                expect(mockChannel.subscribe).toHaveBeenCalled();
            });
        });

        it('should refresh feedback stats when a message_feedback insert arrives', async () => {
            const mockChannel = createRoomChannel();

            (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
            mockSuccessfulRoomJoin([mockMessage]);

            (getMessageFeedbackStats as jest.Mock)
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 0,
                    like_count: 0,
                    dislike_count: 0,
                    average_like_rating: null,
                    average_dislike_rating: null,
                    overall_average_rating: null,
                    user_feedback: null
                })
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 1,
                    like_count: 1,
                    dislike_count: 0,
                    average_like_rating: 4,
                    average_dislike_rating: null,
                    overall_average_rating: 4,
                    user_feedback: null
                });

            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(getMessageFeedbackStats).toHaveBeenCalledWith(mockMessage.id);
                expect(screen.getByTestId('message-feedback-stats')).toHaveTextContent('"like_count":0');
            });

            const feedbackInsertHandler = mockChannel.on.mock.calls.find(
                ([eventType, config]: [string, { table?: string; event?: string }]) =>
                    eventType === 'postgres_changes' &&
                    config.table === 'message_feedback' &&
                    config.event === 'INSERT'
            )?.[2];

            expect(feedbackInsertHandler).toBeDefined();

            await act(async () => {
                await feedbackInsertHandler({
                    new: {
                        room_id: mockRoom.id,
                        message_id: mockMessage.id
                    }
                });
            });

            await waitFor(() => {
                expect(getMessageFeedbackStats).toHaveBeenCalledTimes(2);
                expect(screen.getByTestId('message-feedback-stats')).toHaveTextContent('"like_count":1');
                expect(screen.getByTestId('message-feedback-stats')).toHaveTextContent('"overall_average_rating":4');
            });
        });

        it('should refresh feedback stats when a message_feedback update arrives', async () => {
            const mockChannel = createRoomChannel();

            (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
            mockSuccessfulRoomJoin([mockMessage]);

            (getMessageFeedbackStats as jest.Mock)
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 1,
                    like_count: 1,
                    dislike_count: 0,
                    average_like_rating: 4,
                    average_dislike_rating: null,
                    overall_average_rating: 4,
                    user_feedback: null
                })
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 1,
                    like_count: 0,
                    dislike_count: 1,
                    average_like_rating: null,
                    average_dislike_rating: 2,
                    overall_average_rating: 2,
                    user_feedback: null
                });

            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(screen.getByTestId('message-feedback-stats')).toHaveTextContent('"like_count":1');
            });

            const feedbackUpdateHandler = mockChannel.on.mock.calls.find(
                ([eventType, config]: [string, { table?: string; event?: string }]) =>
                    eventType === 'postgres_changes' &&
                    config.table === 'message_feedback' &&
                    config.event === 'UPDATE'
            )?.[2];

            expect(feedbackUpdateHandler).toBeDefined();

            await act(async () => {
                await feedbackUpdateHandler({
                    new: {
                        room_id: mockRoom.id,
                        message_id: mockMessage.id
                    }
                });
            });

            await waitFor(() => {
                expect(getMessageFeedbackStats).toHaveBeenCalledTimes(2);
                expect(screen.getByTestId('message-feedback-stats')).toHaveTextContent('"like_count":0');
                expect(screen.getByTestId('message-feedback-stats')).toHaveTextContent('"dislike_count":1');
                expect(screen.getByTestId('message-feedback-stats')).toHaveTextContent('"overall_average_rating":2');
            });
        });

        it('should cleanup subscription when room is left', async () => {
            const mockChannel = createRoomChannel();

            (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
            mockSuccessfulRoomJoin();

            const { unmount } = render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            // Join room to trigger subscription creation
            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(mockChannel.subscribe).toHaveBeenCalled();
            });

            unmount();

            expect(mockChannel.unsubscribe).toHaveBeenCalled();
        });

        it('should broadcast feedback changes after submitting message feedback', async () => {
            const mockChannel = createRoomChannel();
            let roomFunctions: any;

            (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
            mockSuccessfulRoomJoin([mockMessage]);

            (getMessageFeedbackStats as jest.Mock)
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 0,
                    like_count: 0,
                    dislike_count: 0,
                    average_like_rating: null,
                    average_dislike_rating: null,
                    overall_average_rating: null,
                    user_feedback: null
                })
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 1,
                    like_count: 1,
                    dislike_count: 0,
                    average_like_rating: 4,
                    average_dislike_rating: null,
                    overall_average_rating: 4,
                    user_feedback: null
                });

            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(roomFunctions?.submitMessageFeedback).toBeDefined();
            });

            await act(async () => {
                await roomFunctions.submitMessageFeedback(mockMessage.id, 'like', 4);
            });

            expect(submitMessageFeedback).toHaveBeenCalledWith(
                mockMessage.id,
                mockUser.id,
                mockRoom.id,
                'like',
                4
            );
            expect(mockChannel.send).toHaveBeenCalledWith({
                type: 'broadcast',
                event: 'message_feedback_changed',
                payload: {
                    messageId: mockMessage.id
                }
            });
        });
    });

    // RoomContext.test.tsx: regression coverage for chat-history exports using refreshed feedback state without requiring a room reload.
    describe('Download Chat History Regression', () => {
        const createRoomChannel = () => ({
            on: jest.fn().mockReturnThis(),
            send: jest.fn(),
            subscribe: jest.fn().mockReturnValue(mockSubscription),
            unsubscribe: jest.fn()
        });

        const mockSuccessfulRoomJoin = (messagesData: Message[] = []) => {
            const mockRoomQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        eq: jest.fn(() => ({
                            single: jest.fn().mockResolvedValue({
                                data: mockRoom,
                                error: null
                            })
                        }))
                    }))
                }))
            };

            const mockMessagesQuery = {
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        order: jest.fn().mockResolvedValue({
                            data: messagesData,
                            error: null
                        })
                    }))
                }))
            };

            const mockUsersQuery = {
                select: jest.fn(() => ({
                    in: jest.fn().mockResolvedValue({
                        data: [mockUser],
                        error: null
                    })
                }))
            };

            (supabase.from as jest.Mock)
                .mockReturnValueOnce(mockRoomQuery)
                .mockReturnValueOnce(mockMessagesQuery)
                .mockReturnValueOnce(mockUsersQuery)
                .mockReturnValueOnce(mockMessagesQuery)
                .mockReturnValue(mockMessagesQuery);
        };

        const createDownloadMocks = () => {
            const originalBlob = global.Blob;
            const originalCreateElement = document.createElement.bind(document);
            const originalAppendChild = document.body.appendChild.bind(document.body);
            const originalRemoveChild = document.body.removeChild.bind(document.body);
            const originalCreateObjectURL = global.URL.createObjectURL;
            const originalRevokeObjectURL = global.URL.revokeObjectURL;

            const click = jest.fn();
            const link = {
                href: '',
                download: '',
                click
            } as unknown as HTMLAnchorElement;

            const blobMock = jest.fn((content: BlobPart[], options?: BlobPropertyBag) => ({
                content: content[0],
                type: options?.type
            }));

            (global as any).Blob = blobMock;
            document.createElement = jest.fn((tagName: string) => (
                tagName === 'a' ? link : originalCreateElement(tagName)
            )) as typeof document.createElement;
            document.body.appendChild = jest.fn(() => link) as typeof document.body.appendChild;
            document.body.removeChild = jest.fn(() => link) as typeof document.body.removeChild;
            global.URL.createObjectURL = jest.fn(() => 'blob:mock-download-url');
            global.URL.revokeObjectURL = jest.fn();

            return {
                blobMock,
                click,
                restore: () => {
                    (global as any).Blob = originalBlob;
                    document.createElement = originalCreateElement;
                    document.body.appendChild = originalAppendChild;
                    document.body.removeChild = originalRemoveChild;
                    global.URL.createObjectURL = originalCreateObjectURL;
                    global.URL.revokeObjectURL = originalRevokeObjectURL;
                }
            };
        };

        it('should include updated like feedback in txt export without a refresh', async () => {
            const mockChannel = createRoomChannel();
            let roomFunctions: any;

            (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
            mockSuccessfulRoomJoin([mockMessage]);

            (getMessageFeedbackStats as jest.Mock)
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 0,
                    like_count: 0,
                    dislike_count: 0,
                    average_like_rating: null,
                    average_dislike_rating: null,
                    overall_average_rating: null,
                    user_feedback: null
                })
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 1,
                    like_count: 1,
                    dislike_count: 0,
                    average_like_rating: 4,
                    average_dislike_rating: null,
                    overall_average_rating: 4,
                    user_feedback: null
                });

            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            const feedbackInsertHandler = mockChannel.on.mock.calls.find(
                ([eventType, config]: [string, { table?: string; event?: string }]) =>
                    eventType === 'postgres_changes' &&
                    config.table === 'message_feedback' &&
                    config.event === 'INSERT'
            )?.[2];

            expect(feedbackInsertHandler).toBeDefined();

            await act(async () => {
                await feedbackInsertHandler({
                    new: {
                        room_id: mockRoom.id,
                        message_id: mockMessage.id
                    }
                });
            });

            const downloadMocks = createDownloadMocks();

            await act(async () => {
                await roomFunctions.downloadChatHistory('txt');
            });

            const exportedContent = downloadMocks.blobMock.mock.calls[0][0][0] as string;

            expect(exportedContent).toContain('Feedback Summary:');
            expect(exportedContent).toContain('Messages with feedback: 1');
            expect(exportedContent).toContain('Total feedback entries: 1');
            expect(exportedContent).toContain('[👍1 👎0 ★4.0]');
            expect(downloadMocks.click).toHaveBeenCalled();

            downloadMocks.restore();
        });

        it('should include updated dislike feedback in json export without a refresh', async () => {
            const mockChannel = createRoomChannel();
            let roomFunctions: any;

            (supabase.channel as jest.Mock).mockReturnValue(mockChannel);
            mockSuccessfulRoomJoin([mockMessage]);

            (getMessageFeedbackStats as jest.Mock)
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 1,
                    like_count: 1,
                    dislike_count: 0,
                    average_like_rating: 4,
                    average_dislike_rating: null,
                    overall_average_rating: 4,
                    user_feedback: null
                })
                .mockResolvedValueOnce({
                    message_id: mockMessage.id,
                    total_feedback_count: 1,
                    like_count: 0,
                    dislike_count: 1,
                    average_like_rating: null,
                    average_dislike_rating: 2,
                    overall_average_rating: 2,
                    user_feedback: null
                });

            (getRoomFeedbackSummary as jest.Mock).mockResolvedValue({
                total_messages_with_feedback: 1,
                total_feedback_entries: 1,
                average_room_rating: 2
            });

            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            const feedbackUpdateHandler = mockChannel.on.mock.calls.find(
                ([eventType, config]: [string, { table?: string; event?: string }]) =>
                    eventType === 'postgres_changes' &&
                    config.table === 'message_feedback' &&
                    config.event === 'UPDATE'
            )?.[2];

            expect(feedbackUpdateHandler).toBeDefined();

            await act(async () => {
                await feedbackUpdateHandler({
                    new: {
                        room_id: mockRoom.id,
                        message_id: mockMessage.id
                    }
                });
            });

            const downloadMocks = createDownloadMocks();

            await act(async () => {
                await roomFunctions.downloadChatHistory('json');
            });

            const exportedData = JSON.parse(downloadMocks.blobMock.mock.calls[0][0][0] as string);

            expect(exportedData.messages).toHaveLength(1);
            expect(exportedData.messages[0].feedback_stats.like_count).toBe(0);
            expect(exportedData.messages[0].feedback_stats.dislike_count).toBe(1);
            expect(exportedData.messages[0].feedback_stats.average_dislike_rating).toBe(2);
            expect(exportedData.feedback_summary).toEqual({
                total_messages_with_feedback: 1,
                total_feedback_entries: 1,
                average_room_rating: 2
            });
            expect(downloadMocks.click).toHaveBeenCalled();

            downloadMocks.restore();
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle AI config loading errors gracefully', async () => {
            const { getAIConfig } = require('../../services/aiService');
            (getAIConfig as jest.Mock).mockRejectedValue(new Error('Config load failed'));

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockJoinedRoomQueries([], { ...mockRoom, ai_assistant_enabled: true });

            render(
                <RoomProvider>
                    <TestRoomComponent />
                </RoomProvider>
            );

            await act(async () => {
                screen.getByText('Join Room').click();
            });

            await waitFor(() => {
                expect(consoleSpy).toHaveBeenCalledWith('Failed to load AI config:', expect.any(Error));
                expect(screen.getByTestId('ai-config')).toHaveTextContent('"room_id":"test-room-id"');
                expect(screen.getByTestId('ai-config')).toHaveTextContent('"model_name":"gpt-4o-mini"');
            });

            consoleSpy.mockRestore();
        });

        it('should handle missing user context', async () => {
            (useAuth as jest.Mock).mockReturnValue({
                user: null,
                loading: false
            });

            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            await expect(roomFunctions.createRoom('Test')).rejects.toThrow('Only tutors can create rooms');
            await expect(roomFunctions.sendMessage('Test')).rejects.toThrow('No user or room available');
        });

        it('should handle missing room context for actions requiring room', async () => {
            let roomFunctions: any;
            render(
                <RoomProvider>
                    <TestRoomComponent />
                    <TestRoomHelper onRoomFunctions={(functions) => { roomFunctions = functions; }} />
                </RoomProvider>
            );

            await waitFor(() => {
                expect(roomFunctions).toBeDefined();
            });

            await expect(roomFunctions.sendMessage('Test')).rejects.toThrow('No user or room available');
            await expect(roomFunctions.generateAIResponse()).rejects.toThrow('No user or room available');
            await expect(roomFunctions.toggleAIAssistant(true)).rejects.toThrow('No user or room available');
        });
    });
}); 

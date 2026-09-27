/** Test responsible for RoomContext export role filtering using state reached through public provider actions. */

import React, { act } from 'react';
import { renderHook } from '@testing-library/react';
import { RoomProvider, useRoom } from '../RoomContext';
import { User, UserRole } from '../../types';
import { generateTutorSuggestion, recordAISuggestionFeedback } from '../../services/aiService';
import {
    getMessageFeedbackStats,
    getRoomFeedbackSummary,
    getUserMessageFeedback,
    supabase,
} from '../../services/supabase';

let mockAuthUser: User | null = null;
let mockRoomResponse: any;
let mockMessagesResponse: any[] = [];
let mockParticipantsResponse: User[] = [];

jest.mock('../AuthContext', () => ({
    useAuth: () => ({ user: mockAuthUser, loading: false }),
}));

// Mock supabase
jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(),
        channel: jest.fn(),
    },
    validateRoomPassword: jest.fn(),
    submitMessageFeedback: jest.fn(),
    getMessageFeedbackStats: jest.fn().mockResolvedValue({
        like_count: 0,
        dislike_count: 0,
        overall_average_rating: 0,
        total_feedback_count: 0,
    }),
    getUserMessageFeedback: jest.fn().mockResolvedValue(null),
    getRoomFeedbackSummary: jest.fn().mockResolvedValue(null),
    clearChatHistory: jest.fn(),
}));

// Mock AI service
jest.mock('../../services/aiService', () => ({
    initializeAIAssistant: jest.fn(),
    getAIConfig: jest.fn(),
    updateAIConfig: jest.fn(),
    generateTutorSuggestion: jest.fn(),
    recordAISuggestionFeedback: jest.fn(),
}));

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock document methods
const mockClick = jest.fn();
const createElement = document.createElement.bind(document);
const mockDownloadDom = () => {
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
        const element = createElement(tagName);
        if (tagName.toLowerCase() === 'a') {
            element.click = mockClick;
        }
        return element;
    });
    jest.spyOn(document.body, 'appendChild').mockImplementation((element: Node) => element);
    jest.spyOn(document.body, 'removeChild').mockImplementation((element: Node) => element);
};

describe('RoomContext - Role-based Export Filtering', () => {
    const mockRoom = {
        id: 'room-123',
        tutor_id: 'tutor-123',
        title: 'Test Room',
        description: 'Test Description',
        image_url: null,
        is_active: true,
        ai_assistant_enabled: true,
        ai_assistant_model: 'GPT-3.5 Turbo',
        ai_assistant_prompt: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
    };

    const mockMessages = [
        {
            id: 'msg-1',
            room_id: 'room-123',
            user_id: 'student-123',
            content: 'What is phishing?',
            user_role: 'student' as UserRole,
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: '2024-01-01T00:01:00Z',
            display_name: 'Student',
        },
        {
            id: 'msg-2',
            room_id: 'room-123',
            user_id: 'tutor-123',
            content: 'Phishing is a cybercrime...',
            user_role: 'tutor' as UserRole,
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: '2024-01-01T00:02:00Z',
            display_name: 'Tutor',
        },
    ];

    const createWrapper = (user: User | null) => {
        mockAuthUser = user;
        return ({ children }: { children: React.ReactNode }) => (
            <RoomProvider>{children}</RoomProvider>
        );
    };

    const renderJoinedRoom = async (user: User, createAIInteraction = false) => {
        mockRoomResponse = mockRoom;
        mockMessagesResponse = mockMessages;
        const student: User = {
            id: 'student-123',
            display_name: 'Student',
            current_role: 'student',
            status: 'active',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
        };
        mockParticipantsResponse = user.id === student.id ? [user] : [user, student];

        const hook = renderHook(() => useRoom(), { wrapper: createWrapper(user) });
        await act(async () => {
            await hook.result.current.joinRoom(mockRoom.id);
        });

        if (createAIInteraction) {
            await act(async () => {
                await hook.result.current.generateAIResponse();
            });
            await act(async () => {
                await hook.result.current.recordAIFeedback('modified', 'Phishing is a cybercrime...');
            });
        }

        return hook;
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockAuthUser = null;
        mockRoomResponse = null;
        mockMessagesResponse = [];
        mockParticipantsResponse = [];
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            const query: any = {};
            query.select = jest.fn().mockReturnValue(query);
            query.eq = jest.fn().mockReturnValue(query);
            query.single = jest.fn().mockResolvedValue({ data: mockRoomResponse, error: null });
            query.order = jest.fn().mockResolvedValue({
                data: table === 'messages' ? mockMessagesResponse : [],
                error: null,
            });
            query.in = jest.fn().mockResolvedValue({ data: mockParticipantsResponse, error: null });
            query.limit = jest.fn().mockResolvedValue({ data: [], error: null });
            query.insert = jest.fn().mockReturnValue(query);
            query.update = jest.fn().mockReturnValue(query);
            return query;
        });
        (supabase.channel as jest.Mock).mockImplementation(() => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
        }));
        (generateTutorSuggestion as jest.Mock).mockResolvedValue({
            success: true,
            suggestion: 'Phishing is a type of cyber attack where...',
            decision: {
                mode: 'tutoring',
                instruction: 'explanation',
                mode_reason: 'A direct explanation is appropriate.',
                suggested_response: 'Phishing is a type of cyber attack where...',
            },
            contextMessages: ['What is phishing?'],
        });
        (recordAISuggestionFeedback as jest.Mock).mockResolvedValue(undefined);
        (getMessageFeedbackStats as jest.Mock).mockResolvedValue({
            like_count: 0,
            dislike_count: 0,
            overall_average_rating: 0,
            total_feedback_count: 0,
        });
        (getUserMessageFeedback as jest.Mock).mockResolvedValue(null);
        (getRoomFeedbackSummary as jest.Mock).mockResolvedValue(null);
        // Reset Blob mock to capture content
        global.Blob = jest.fn((content, options) => ({
            content: content[0],
            type: options?.type,
        })) as any;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('JSON Export', () => {
        it('should include AI data for tutors', async () => {
            const tutorUser: User = {
                id: 'tutor-123',
                display_name: 'Test Tutor',
                current_role: 'tutor',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = await renderJoinedRoom(tutorUser, true);

            mockDownloadDom();

            // Call downloadChatHistory
            await act(async () => {
                await result.current.downloadChatHistory('json');
            });

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedData = JSON.parse(blobCall[0]);

            // Verify AI data is included
            expect(exportedData.room.ai_enabled).toBe(true);
            expect(exportedData.room.ai_model).toBe('GPT-3.5 Turbo');
            expect(exportedData.ai_interactions).toHaveLength(1);
            expect(exportedData.ai_interactions[0]).toMatchObject({
                ai_suggestion: 'Phishing is a type of cyber attack where...',
                tutor_action: 'modified',
                tutor_final_response: 'Phishing is a cybercrime...',
            });
            expect(exportedData.export_metadata.total_ai_interactions).toBe(1);
            expect(exportedData.export_metadata.interaction_summary).toEqual({
                accepted: 0,
                rejected: 0,
                modified: 1,
                ignored: 0,
            });
        });

        it('should exclude AI data for students', async () => {
            const studentUser: User = {
                id: 'student-123',
                display_name: 'Test Student',
                current_role: 'student',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = await renderJoinedRoom(studentUser);

            mockDownloadDom();

            // Call downloadChatHistory
            await act(async () => {
                await result.current.downloadChatHistory('json');
            });

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedData = JSON.parse(blobCall[0]);

            // Verify AI data is excluded
            expect(exportedData.room.ai_enabled).toBeUndefined();
            expect(exportedData.room.ai_model).toBeUndefined();
            expect(exportedData.ai_interactions).toBeUndefined();
            expect(exportedData.export_metadata.total_ai_interactions).toBeUndefined();
            expect(exportedData.export_metadata.interaction_summary).toBeUndefined();
            
            // Verify basic data is still included
            expect(exportedData.room.title).toBe('Test Room');
            expect(exportedData.messages).toHaveLength(2);
        });

        it('should exclude AI data for observers', async () => {
            const observerUser: User = {
                id: 'observer-123',
                display_name: 'Test Observer',
                current_role: 'observer',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = await renderJoinedRoom(observerUser);

            mockDownloadDom();

            // Call downloadChatHistory
            await act(async () => {
                await result.current.downloadChatHistory('json');
            });

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedData = JSON.parse(blobCall[0]);

            // Verify AI data is excluded
            expect(exportedData.room.ai_enabled).toBeUndefined();
            expect(exportedData.room.ai_model).toBeUndefined();
            expect(exportedData.ai_interactions).toBeUndefined();
        });
    });

    describe('TXT Export', () => {
        it('should include AI summary for tutors', async () => {
            const tutorUser: User = {
                id: 'tutor-123',
                display_name: 'Test Tutor',
                current_role: 'tutor',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = await renderJoinedRoom(tutorUser, true);

            mockDownloadDom();

            // Call downloadChatHistory
            await act(async () => {
                await result.current.downloadChatHistory('txt');
            });

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedContent = blobCall[0][0];

            // Verify AI data is included
            expect(exportedContent).toContain('AI Assistant: Enabled');
            expect(exportedContent).toContain('AI Model: GPT-3.5 Turbo');
            expect(exportedContent).toContain('AI Assistant Summary:');
            expect(exportedContent).toContain('Total AI suggestions: 1');
            expect(exportedContent).toContain('Modified: 1 (100.00%)');
            expect(exportedContent).toContain('AI Suggestion: "Phishing is a type of cyber attack where..."');
        });

        it('should exclude AI summary for students', async () => {
            const studentUser: User = {
                id: 'student-123',
                display_name: 'Test Student',
                current_role: 'student',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = await renderJoinedRoom(studentUser);

            mockDownloadDom();

            // Call downloadChatHistory
            await act(async () => {
                await result.current.downloadChatHistory('txt');
            });

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedContent = blobCall[0][0];

            // Verify AI data is excluded
            expect(exportedContent).not.toContain('AI Assistant:');
            expect(exportedContent).not.toContain('AI Model:');
            expect(exportedContent).not.toContain('AI Assistant Summary:');
            expect(exportedContent).not.toContain('AI Suggestion:');
            
            // Verify basic data is still included
            expect(exportedContent).toContain('Room: Test Room');
            expect(exportedContent).toContain('What is phishing?');
            expect(exportedContent).toContain('Phishing is a cybercrime...');
        });
    });
});

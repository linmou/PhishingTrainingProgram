import React from 'react';
import { renderHook } from '@testing-library/react-hooks';
import { RoomProvider, useRoom } from '../RoomContext';
import { AuthContext } from '../AuthContext';
import { User, UserRole } from '../../types';

// Mock supabase
jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            insert: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
        })),
        channel: jest.fn(() => ({
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
        })),
    },
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
const mockRemove = jest.fn();
document.createElement = jest.fn(() => ({
    href: '',
    download: '',
    click: mockClick,
    remove: mockRemove,
}));
document.body.appendChild = jest.fn();
document.body.removeChild = jest.fn();

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
            is_ai_generated: false,
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
            is_ai_generated: false,
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: '2024-01-01T00:02:00Z',
            display_name: 'Tutor',
        },
    ];

    const mockAIInteractions = [
        {
            timestamp: '2024-01-01T00:01:30Z',
            parent_message_id: 'msg-1',
            parent_message_content: 'What is phishing?',
            ai_suggestion: 'Phishing is a type of cyber attack where...',
            tutor_action: 'modified' as const,
            tutor_final_response: 'Phishing is a cybercrime...',
            response_time_ms: 5000,
        },
    ];

    const createWrapper = (user: User | null) => {
        return ({ children }: { children: React.ReactNode }) => (
            <AuthContext.Provider
                value={{
                    user,
                    loading: false,
                    joinWithNameAndRole: jest.fn(),
                    signOut: jest.fn(),
                    setUserRole: jest.fn(),
                    updateUserProfile: jest.fn(),
                }}
            >
                <RoomProvider>{children}</RoomProvider>
            </AuthContext.Provider>
        );
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Reset Blob mock to capture content
        global.Blob = jest.fn((content, options) => ({
            content: content[0],
            type: options?.type,
        })) as any;
    });

    describe('JSON Export', () => {
        it('should include AI data for tutors', () => {
            const tutorUser: User = {
                id: 'tutor-123',
                display_name: 'Test Tutor',
                current_role: 'tutor',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = renderHook(() => useRoom(), {
                wrapper: createWrapper(tutorUser),
            });

            // Set up test data
            (result.current as any).currentRoom = mockRoom;
            (result.current as any).messages = mockMessages;
            (result.current as any).aiInteractions = mockAIInteractions;

            // Call downloadChatHistory
            result.current.downloadChatHistory('json');

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedData = JSON.parse(blobCall[0]);

            // Verify AI data is included
            expect(exportedData.room.ai_enabled).toBe(true);
            expect(exportedData.room.ai_model).toBe('GPT-3.5 Turbo');
            expect(exportedData.ai_interactions).toEqual(mockAIInteractions);
            expect(exportedData.export_metadata.total_ai_interactions).toBe(1);
            expect(exportedData.export_metadata.interaction_summary).toEqual({
                accepted: 0,
                rejected: 0,
                modified: 1,
                ignored: 0,
            });
        });

        it('should exclude AI data for students', () => {
            const studentUser: User = {
                id: 'student-123',
                display_name: 'Test Student',
                current_role: 'student',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = renderHook(() => useRoom(), {
                wrapper: createWrapper(studentUser),
            });

            // Set up test data
            (result.current as any).currentRoom = mockRoom;
            (result.current as any).messages = mockMessages;
            (result.current as any).aiInteractions = mockAIInteractions;

            // Call downloadChatHistory
            result.current.downloadChatHistory('json');

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

        it('should exclude AI data for observers', () => {
            const observerUser: User = {
                id: 'observer-123',
                display_name: 'Test Observer',
                current_role: 'observer',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = renderHook(() => useRoom(), {
                wrapper: createWrapper(observerUser),
            });

            // Set up test data
            (result.current as any).currentRoom = mockRoom;
            (result.current as any).messages = mockMessages;
            (result.current as any).aiInteractions = mockAIInteractions;

            // Call downloadChatHistory
            result.current.downloadChatHistory('json');

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
        it('should include AI summary for tutors', () => {
            const tutorUser: User = {
                id: 'tutor-123',
                display_name: 'Test Tutor',
                current_role: 'tutor',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = renderHook(() => useRoom(), {
                wrapper: createWrapper(tutorUser),
            });

            // Set up test data
            (result.current as any).currentRoom = mockRoom;
            (result.current as any).messages = mockMessages;
            (result.current as any).aiInteractions = mockAIInteractions;

            // Call downloadChatHistory
            result.current.downloadChatHistory('txt');

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedContent = blobCall[0];

            // Verify AI data is included
            expect(exportedContent).toContain('AI Assistant: Enabled');
            expect(exportedContent).toContain('AI Model: GPT-3.5 Turbo');
            expect(exportedContent).toContain('AI Assistant Summary:');
            expect(exportedContent).toContain('Total AI suggestions: 1');
            expect(exportedContent).toContain('Modified: 1 (100.00%)');
            expect(exportedContent).toContain('AI Suggestion: "Phishing is a type of cyber attack where..."');
        });

        it('should exclude AI summary for students', () => {
            const studentUser: User = {
                id: 'student-123',
                display_name: 'Test Student',
                current_role: 'student',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
            };

            const { result } = renderHook(() => useRoom(), {
                wrapper: createWrapper(studentUser),
            });

            // Set up test data
            (result.current as any).currentRoom = mockRoom;
            (result.current as any).messages = mockMessages;
            (result.current as any).aiInteractions = mockAIInteractions;

            // Call downloadChatHistory
            result.current.downloadChatHistory('txt');

            // Get the blob content
            const blobCall = (global.Blob as jest.Mock).mock.calls[0];
            const exportedContent = blobCall[0];

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

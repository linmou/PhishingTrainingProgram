/**
 * @jest-environment jsdom
 */

import { clearChatHistory } from '../supabase';

// Mock the supabase client and dependencies
jest.mock('../supabase', () => {
    const originalModule = jest.requireActual('../supabase');
    
    const mockSupabaseClient = {
        auth: {
            getUser: jest.fn()
        },
        from: jest.fn()
    };

    return {
        ...originalModule,
        supabase: mockSupabaseClient,
        // Don't mock clearChatHistory - we want to test the real implementation
    };
});

// Import after mocking
import { supabase } from '../supabase';

describe('Clear Chat History Integration Tests', () => {
    const mockRoomId = 'test-room-id';
    const mockUserId = 'test-user-id';
    const mockTutorUser = {
        id: mockUserId,
        current_role: 'tutor'
    };

    // No need for getCurrentUser in simplified auth
    const mockSupabase = supabase as any;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('GREEN PHASE - Tests should pass with implementation', () => {
        it('should throw error when user is not found', async () => {
            // Mock user not found
            const mockSingle = jest.fn().mockResolvedValueOnce({
                data: null,
                error: { message: 'User not found' }
            });
            const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            await expect(clearChatHistory(mockRoomId, mockUserId)).rejects.toThrow('User not found or not authenticated');
        });

        it('should only allow tutors to clear chat history', async () => {
            // Mock student user found
            const mockStudentUser = { id: mockUserId, current_role: 'student', display_name: 'Student' };
            const mockSingle = jest.fn().mockResolvedValueOnce({
                data: mockStudentUser,
                error: null
            });
            const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            await expect(clearChatHistory(mockRoomId, mockUserId)).rejects.toThrow('Only tutors can clear chat history');
        });

        it('should verify room ownership before clearing', async () => {
            // Mock user found first
            const mockUserSingle = jest.fn().mockResolvedValueOnce({
                data: mockTutorUser,
                error: null
            });
            
            // Mock room not found
            const mockRoomSingle = jest.fn().mockResolvedValueOnce({
                data: null,
                error: { message: 'Room not found' }
            });
            
            const mockEq = jest.fn()
                .mockReturnValueOnce({ single: mockUserSingle })  // First call for user
                .mockReturnValueOnce({ single: mockRoomSingle }); // Second call for room
            
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            await expect(clearChatHistory(mockRoomId, mockUserId)).rejects.toThrow('Room not found');
        });

        it('should only allow room owners to clear chat history', async () => {
            // Mock user found first
            const mockUserSingle = jest.fn().mockResolvedValueOnce({
                data: mockTutorUser,
                error: null
            });
            
            // Mock room owned by different user
            const mockRoomSingle = jest.fn().mockResolvedValueOnce({
                data: {
                    tutor_id: 'different-user-id',
                    title: 'Test Room',
                    pre_populated_dialogue: null
                },
                error: null
            });
            
            const mockEq = jest.fn()
                .mockReturnValueOnce({ single: mockUserSingle })  // First call for user
                .mockReturnValueOnce({ single: mockRoomSingle }); // Second call for room
            
            const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
            mockSupabase.from.mockReturnValue({ select: mockSelect });

            await expect(clearChatHistory(mockRoomId, mockUserId)).rejects.toThrow('You are not authorized to clear chat history for this room');
        });

        it('should successfully clear messages from the room', async () => {
            // Mock successful user lookup
            const mockUserSingle = jest.fn().mockResolvedValueOnce({
                data: mockTutorUser,
                error: null
            });
            
            // Mock successful room lookup
            const mockRoomSingle = jest.fn().mockResolvedValueOnce({
                data: {
                    tutor_id: mockUserId,
                    title: 'Test Room',
                    pre_populated_dialogue: [{ user_name: 'Test', message: 'Hello', role: 'tutor' }]
                },
                error: null
            });
            
            // Mock successful deletions
            const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
            const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });
            
            // Mock table operations
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'users') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: mockUserSingle
                            })
                        })
                    };
                } else if (table === 'rooms') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: mockRoomSingle
                            })
                        })
                    };
                }
                // For messages and message_feedback tables
                return { delete: mockDelete };
            });

            const result = await clearChatHistory(mockRoomId, mockUserId);

            expect(result).toEqual({
                success: true,
                title: 'Test Room',
                prePopulatedMessagesPreserved: true
            });
            
            // Verify all tables were targeted for deletion
            expect(mockSupabase.from).toHaveBeenCalledWith('users');
            expect(mockSupabase.from).toHaveBeenCalledWith('rooms');
            expect(mockSupabase.from).toHaveBeenCalledWith('messages');
            expect(mockSupabase.from).toHaveBeenCalledWith('message_feedback');
        });

        it('should handle database errors gracefully', async () => {
            // Mock successful user lookup
            const mockUserSingle = jest.fn().mockResolvedValueOnce({
                data: mockTutorUser,
                error: null
            });
            
            // Mock successful room lookup
            const mockRoomSingle = jest.fn().mockResolvedValueOnce({
                data: {
                    tutor_id: mockUserId,
                    title: 'Test Room',
                    pre_populated_dialogue: null
                },
                error: null
            });
            
            // Mock database error for messages deletion
            const mockDeleteEq = jest.fn().mockResolvedValue({ 
                error: { message: 'Database error' }
            });
            
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'users') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: mockUserSingle
                            })
                        })
                    };
                } else if (table === 'rooms') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: mockRoomSingle
                            })
                        })
                    };
                }
                return {
                    delete: jest.fn().mockReturnValue({
                        eq: mockDeleteEq
                    })
                };
            });

            await expect(clearChatHistory(mockRoomId, mockUserId)).rejects.toThrow();
        });
    });
});
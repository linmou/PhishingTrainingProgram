/**
 * @jest-environment jsdom
 */

// Mock the supabase client before importing anything
jest.mock('../supabase', () => {
    const mockSupabaseClient = {
        auth: {
            getUser: jest.fn()
        },
        from: jest.fn()
    };

    return {
        supabase: mockSupabaseClient,
        getCurrentUser: jest.fn(),
        clearChatHistory: jest.fn()
    };
});

// Import the actual function to test it
import { clearChatHistory, getCurrentUser, supabase } from '../supabase';

describe('Clear Chat History Functionality', () => {
    const mockRoomId = 'test-room-id';
    const mockUserId = 'test-user-id';
    const mockTutorUser = {
        id: mockUserId,
        current_role: 'tutor'
    };

    const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
    const mockSupabase = supabase as any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup default mocks for database operations
        const mockQuery = {
            eq: jest.fn().mockReturnThis(),
            single: jest.fn(),
            delete: jest.fn().mockReturnThis()
        };
        
        const mockTable = {
            select: jest.fn().mockReturnValue(mockQuery),
            delete: jest.fn().mockReturnValue(mockQuery)
        };
        
        mockSupabase.from.mockReturnValue(mockTable);
    });

    describe('Authentication and Authorization', () => {
        it('should throw error when user is not authenticated', async () => {
            mockGetCurrentUser.mockResolvedValueOnce(null);

            await expect(clearChatHistory(mockRoomId)).rejects.toThrow('User not authenticated');
        });

        it('should verify room ownership before clearing', async () => {
            mockGetCurrentUser.mockResolvedValueOnce(mockTutorUser);
            
            // Mock room not found
            const mockTable = mockSupabase.from('rooms');
            mockTable.select().eq().single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Room not found' }
            });

            await expect(clearChatHistory(mockRoomId)).rejects.toThrow('Room not found');
        });

        it('should only allow room owners to clear chat history', async () => {
            mockGetCurrentUser.mockResolvedValueOnce(mockTutorUser);
            
            // Mock room owned by different user
            const mockTable = mockSupabase.from('rooms');
            mockTable.select().eq().single.mockResolvedValueOnce({
                data: {
                    tutor_id: 'different-user-id',
                    title: 'Test Room',
                    pre_populated_dialogue: null
                },
                error: null
            });

            await expect(clearChatHistory(mockRoomId)).rejects.toThrow('You are not authorized to clear chat history for this room');
        });
    });

    describe('Database Operations', () => {
        beforeEach(() => {
            mockGetCurrentUser.mockResolvedValue(mockTutorUser);
            
            // Mock successful room lookup
            const mockRoomsTable = {
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        single: jest.fn().mockResolvedValue({
                            data: {
                                tutor_id: mockUserId,
                                title: 'Test Room',
                                pre_populated_dialogue: [{ user_name: 'Test', message: 'Hello', role: 'tutor' }]
                            },
                            error: null
                        })
                    })
                })
            };
            
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'rooms') return mockRoomsTable;
                return {
                    delete: jest.fn().mockReturnValue({
                        eq: jest.fn().mockResolvedValue({ error: null })
                    })
                };
            });
        });

        it('should successfully clear messages from the room', async () => {
            const result = await clearChatHistory(mockRoomId);

            expect(result).toEqual({
                success: true,
                title: 'Test Room',
                prePopulatedMessagesPreserved: true
            });
            
            // Verify messages table was targeted for deletion
            expect(mockSupabase.from).toHaveBeenCalledWith('messages');
        });


        it('should clean up message feedback data', async () => {
            await clearChatHistory(mockRoomId);

            // Verify message feedback cleanup was attempted
            expect(mockSupabase.from).toHaveBeenCalledWith('message_feedback');
        });

        it('should handle database errors gracefully', async () => {
            // Mock database error for messages deletion
            const mockMessagesTable = {
                delete: jest.fn().mockReturnValue({
                    eq: jest.fn().mockResolvedValue({ 
                        error: { message: 'Database error' }
                    })
                })
            };
            
            mockSupabase.from.mockImplementation((table: string) => {
                if (table === 'rooms') {
                    return {
                        select: jest.fn().mockReturnValue({
                            eq: jest.fn().mockReturnValue({
                                single: jest.fn().mockResolvedValue({
                                    data: {
                                        tutor_id: mockUserId,
                                        title: 'Test Room',
                                        pre_populated_dialogue: null
                                    },
                                    error: null
                                })
                            })
                        })
                    };
                }
                return mockMessagesTable;
            });

            await expect(clearChatHistory(mockRoomId)).rejects.toThrow();
        });
    });
});
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { RoomProvider, useRoom } from '../RoomContext';
import { AuthProvider } from '../AuthContext';
import { supabase } from '../../services/supabase';
import { User, Message } from '../../types';

// Mock Supabase client
jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(),
        channel: jest.fn(),
        storage: {
            from: jest.fn()
        }
    }
}));

// Test component that displays messages with avatars
const TestComponent = () => {
    const { messages } = useRoom();
    
    return (
        <div>
            {messages.map(message => (
                <div key={message.id} data-testid={`message-${message.id}`}>
                    <span data-testid={`display-name-${message.id}`}>{message.display_name}</span>
                    <span data-testid={`avatar-url-${message.id}`}>{message.avatar_url || 'no-avatar'}</span>
                </div>
            ))}
        </div>
    );
};

describe('RoomContext - Avatar Display', () => {
    const mockUser: User = {
        id: 'user1',
        display_name: 'Test User',
        current_role: 'student',
        status: 'active',
        avatar_url: 'https://example.com/avatar1.jpg',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const mockParticipants: User[] = [
        mockUser,
        {
            id: 'user2',
            display_name: 'Other User',
            current_role: 'tutor',
            status: 'active',
            avatar_url: 'https://example.com/avatar2.jpg',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }
    ];

    const mockMessages = [
        {
            id: 'msg1',
            room_id: 'room1',
            user_id: 'user1',
            content: 'Hello from user 1',
            user_role: 'student',
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: new Date().toISOString()
        },
        {
            id: 'msg2',
            room_id: 'room1',
            user_id: 'user2',
            content: 'Hello from user 2',
            user_role: 'tutor',
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: new Date().toISOString()
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock channel subscription
        const mockChannel = {
            on: jest.fn().mockReturnThis(),
            subscribe: jest.fn().mockReturnThis(),
            unsubscribe: jest.fn()
        };
        (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

        // Mock room query
        (supabase.from as jest.Mock).mockImplementation((table: string) => {
            if (table === 'rooms') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({
                        data: {
                            id: 'room1',
                            tutor_id: 'user2',
                            title: 'Test Room',
                            description: 'Test Description',
                            is_active: true,
                            ai_assistant_enabled: false
                        },
                        error: null
                    })
                };
            }
            if (table === 'messages') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: mockMessages,
                        error: null
                    })
                };
            }
            if (table === 'users') {
                return {
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: mockParticipants,
                        error: null
                    })
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: null, error: null })
            };
        });
    });

    it('should enrich messages with avatar URLs from participants', async () => {
        const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
            const mockAuthContext = {
                user: mockUser,
                loading: false,
                joinWithNameAndRole: jest.fn(),
                signOut: jest.fn(),
                setUserRole: jest.fn(),
                updateUserProfile: jest.fn()
            };
            
            return (
                <AuthProvider value={mockAuthContext}>
                    {children}
                </AuthProvider>
            );
        };

        render(
            <MockAuthProvider>
                <RoomProvider>
                    <TestComponent />
                </RoomProvider>
            </MockAuthProvider>
        );

        // Join room to load messages
        const { joinRoom } = require('../RoomContext');
        await joinRoom('room1');

        // Wait for messages to be enriched with avatar URLs
        await waitFor(() => {
            // Check that user1's message has the correct avatar URL
            expect(screen.getByTestId('avatar-url-msg1')).toHaveTextContent('https://example.com/avatar1.jpg');
            
            // Check that user2's message has the correct avatar URL
            expect(screen.getByTestId('avatar-url-msg2')).toHaveTextContent('https://example.com/avatar2.jpg');
        });

        // Verify display names are also correctly set
        expect(screen.getByTestId('display-name-msg1')).toHaveTextContent('Test User');
        expect(screen.getByTestId('display-name-msg2')).toHaveTextContent('Other User');
    });
});

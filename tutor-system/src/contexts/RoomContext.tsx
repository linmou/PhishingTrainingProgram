import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { RoomContextType, Room, Message, UserRole, AIAssistantConfig, TypingIndicator, User } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import {
    initializeAIAssistant,
    getAIConfig,
    updateAIConfig,
    generateAndSaveAIResponse
} from '../services/aiService';

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = () => {
    const context = useContext(RoomContext);
    if (context === undefined) {
        throw new Error('useRoom must be used within a RoomProvider');
    }
    return context;
};

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [participants, setParticipants] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [aiConfig, setAiConfig] = useState<AIAssistantConfig | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<any>(null);
    const { user } = useAuth();

    // Stable function to add display names to messages
    const addDisplayNameToMessage = useCallback((message: any): Message => {
        return {
            ...message,
            display_name: message.user_id === user?.id ? (user?.display_name || 'User') : 
                         message.user_role === 'tutor' ? 'Tutor' :
                         message.user_role === 'student' ? 'Student' : 'Observer'
        };
    }, [user?.id, user?.display_name]);

    // Real-time subscription for messages and typing indicators
    useEffect(() => {
        if (!currentRoom) return;

        console.log('🔴 Setting up real-time subscription for room:', currentRoom.id);

        const channel = supabase.channel(`room_${currentRoom.id}`);
        
        channel
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${currentRoom.id}`
                },
                (payload) => {
                    console.log('🟢 Real-time message received:', payload);
                    const newMessage = payload.new as any;
                    const messageWithDisplayName = addDisplayNameToMessage(newMessage);
                    
                    setMessages(prev => {
                        console.log('📝 Adding message to state:', messageWithDisplayName);
                        return [...prev, messageWithDisplayName];
                    });
                }
            )
            .on('broadcast', { event: 'typing_start' }, (payload) => {
                const { userId, displayName } = payload.payload;
                if (userId !== user?.id) {
                    setTypingUsers(prev => {
                        const filtered = prev.filter(t => t.userId !== userId);
                        return [...filtered, { userId, displayName, timestamp: Date.now() }];
                    });
                }
            })
            .on('broadcast', { event: 'typing_stop' }, (payload) => {
                const { userId } = payload.payload;
                setTypingUsers(prev => prev.filter(t => t.userId !== userId));
            })
            .subscribe((status) => {
                console.log('📡 Subscription status:', status);
            });

        // Store channel reference
        channelRef.current = channel;

        return () => {
            console.log('🔴 Unsubscribing from real-time channel');
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, [currentRoom, user?.id, addDisplayNameToMessage]);

    // Stable polling function to prevent infinite loops
    const pollMessages = useCallback(async () => {
        if (!currentRoom) return;
        
        try {
            const { data: messagesData, error } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', currentRoom.id)
                .order('created_at', { ascending: true });

            if (error) {
                console.error('Failed to poll messages:', error);
                return;
            }

            if (messagesData) {
                // Add display_name to messages using stable function
                const messagesWithDisplayName = messagesData.map(addDisplayNameToMessage);
                setMessages(messagesWithDisplayName);
            }
        } catch (error) {
            console.error('Error polling messages:', error);
        }
    }, [currentRoom, addDisplayNameToMessage]);

    // Polling mechanism for messages (temporary until real-time replication is available)
    useEffect(() => {
        if (!currentRoom) return;

        console.log('🔄 Starting message polling for room:', currentRoom.id);

        // Poll immediately
        pollMessages();

        // Set up interval to poll every 2 seconds
        const interval = setInterval(pollMessages, 2000);

        return () => {
            console.log('🔄 Stopping message polling');
            clearInterval(interval);
        };
    }, [currentRoom, pollMessages]);

    // Clean up stale typing indicators
    useEffect(() => {
        const interval = setInterval(() => {
            const now = Date.now();
            setTypingUsers(prev => prev.filter(t => now - t.timestamp < 5000)); // 5 second timeout
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // Load AI configuration when room changes
    useEffect(() => {
        const loadAIConfig = async () => {
            if (!currentRoom) {
                setAiConfig(null);
                return;
            }

            try {
                const config = await getAIConfig(currentRoom.id);
                setAiConfig(config);
            } catch (error) {
                console.error('Failed to load AI config:', error);
                setAiConfig(null);
            }
        };

        loadAIConfig();
    }, [currentRoom]);

    const createRoom = async (title: string, description?: string, imageFile?: File): Promise<void> => {
        if (!user || user.current_role !== 'tutor') {
            throw new Error('Only tutors can create rooms');
        }

        setLoading(true);
        try {
            let imageUrl = null;

            // Upload image if provided
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const { data, error: uploadError } = await supabase.storage
                    .from('room-images')
                    .upload(fileName, imageFile);

                if (uploadError) throw uploadError;

                // Get public URL
                const { data: urlData } = supabase.storage
                    .from('room-images')
                    .getPublicUrl(data.path);

                imageUrl = urlData.publicUrl;
            }

            // Create room
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .insert({
                    tutor_id: user.id,
                    title,
                    description,
                    image_url: imageUrl
                })
                .select()
                .single();

            if (roomError) throw roomError;

            setCurrentRoom(roomData);
        } finally {
            setLoading(false);
        }
    };

    const joinRoom = useCallback(async (roomId: string): Promise<void> => {
        setLoading(true);
        try {
            // Get room details
            const { data: roomData, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', roomId)
                .eq('is_active', true)
                .single();

            if (roomError) throw roomError;

            // Get existing messages
            const { data: messagesData, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            if (messagesError) throw messagesError;

            // Get unique user IDs from messages and room
            const userIds = new Set<string>();
            if (roomData.tutor_id) userIds.add(roomData.tutor_id);
            if (messagesData) {
                messagesData.forEach(msg => userIds.add(msg.user_id));
            }
            
            // Always include current user if they're not already in the list
            if (user?.id) {
                userIds.add(user.id);
            }

            // Fetch user details for all participants
            const { data: participantsData, error: participantsError } = await supabase
                .from('users')
                .select('*')
                .in('id', Array.from(userIds));

            if (participantsError) throw participantsError;

            // Add display_name to existing messages
            const messagesWithDisplayName = (messagesData || []).map(addDisplayNameToMessage);

            setCurrentRoom(roomData);
            setMessages(messagesWithDisplayName);
            setParticipants(participantsData || []);
        } finally {
            setLoading(false);
        }
    }, [addDisplayNameToMessage, user?.id]);

    const leaveRoom = useCallback(async (): Promise<void> => {
        setCurrentRoom(null);
        setMessages([]);
        setParticipants([]);
        setAiConfig(null);
    }, []);

    const sendMessage = async (content: string): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role === 'observer') {
            throw new Error('Observers cannot send messages');
        }

        console.log('Sending message:', { roomId: currentRoom.id, userId: user.id, content });

        // Create optimistic message
        const optimisticMessage: Message = {
            id: `temp-${Date.now()}`, // Temporary ID
            room_id: currentRoom.id,
            user_id: user.id,
            content,
            user_role: user.current_role as UserRole,
            is_ai_generated: false,
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: null,
            created_at: new Date().toISOString(),
            display_name: user.display_name || 'User'
        };

        // Add message optimistically
        setMessages(prev => [...prev, optimisticMessage]);

        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: currentRoom.id,
                user_id: user.id,
                content,
                user_role: user.current_role as UserRole
            })
            .select()
            .single();

        if (error) {
            console.error('Failed to send message:', error);
            // Remove optimistic message on error
            setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
            throw error;
        }
        
        console.log('Message sent successfully');
        
        // Replace optimistic message with real message
        if (data) {
            setMessages(prev => prev.map(msg => 
                msg.id === optimisticMessage.id 
                    ? { ...data, display_name: user.display_name || 'User' }
                    : msg
            ));
        }
    };

    const generateAIResponse = async (prompt?: string): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can generate AI responses');
        }

        if (!currentRoom.ai_assistant_enabled) {
            throw new Error('AI assistant is not enabled for this room');
        }

        setLoadingAI(true);
        try {
            // Get the latest student message if no prompt provided
            let parentMessageId: string | undefined;
            if (!prompt) {
                const latestMessage = messages
                    .filter(m => m.user_role === 'student' && !m.is_ai_generated)
                    .slice(-1)[0];

                if (latestMessage) {
                    parentMessageId = latestMessage.id;
                    prompt = latestMessage.content;
                }
            }

            await generateAndSaveAIResponse(
                currentRoom.id,
                user.id,
                prompt,
                parentMessageId
            );

            // The message will appear via real-time subscription
        } catch (error) {
            console.error('Failed to generate AI response:', error);
            throw error;
        } finally {
            setLoadingAI(false);
        }
    };

    const toggleAIAssistant = async (
        enabled: boolean,
        config?: Partial<AIAssistantConfig>
    ): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can configure AI assistant');
        }

        setLoadingAI(true);
        try {
            if (enabled) {
                if (!aiConfig) {
                    // Initialize AI assistant
                    await initializeAIAssistant(
                        currentRoom.id,
                        config?.model_name || 'gpt-3.5-turbo',
                        config?.system_prompt || undefined
                    );
                } else {
                    // Update existing configuration
                    await updateAIConfig(currentRoom.id, {
                        is_active: true,
                        ...config
                    });
                }

                // Update room to reflect AI assistant status
                const { data: updatedRoom, error: roomError } = await supabase
                    .from('rooms')
                    .update({ ai_assistant_enabled: true })
                    .eq('id', currentRoom.id)
                    .select()
                    .single();

                if (roomError) throw roomError;
                setCurrentRoom(updatedRoom);

                // Reload AI config
                const newConfig = await getAIConfig(currentRoom.id);
                setAiConfig(newConfig);
            } else {
                // Disable AI assistant
                if (aiConfig) {
                    await updateAIConfig(currentRoom.id, { is_active: false });
                }

                const { data: updatedRoom, error: roomError } = await supabase
                    .from('rooms')
                    .update({ ai_assistant_enabled: false })
                    .eq('id', currentRoom.id)
                    .select()
                    .single();

                if (roomError) throw roomError;
                setCurrentRoom(updatedRoom);
                setAiConfig(null);
            }
        } catch (error) {
            console.error('Failed to toggle AI assistant:', error);
            throw error;
        } finally {
            setLoadingAI(false);
        }
    };

    const startTyping = () => {
        if (!user || !currentRoom || user.current_role === 'observer' || !channelRef.current) return;

        // Clear existing timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
        }

        // Broadcast typing start using the existing channel
        try {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing_start',
                payload: {
                    userId: user.id,
                    displayName: user.display_name
                }
            });
        } catch (error) {
            console.warn('Failed to send typing start broadcast:', error);
        }

        // Auto-stop typing after 3 seconds
        typingTimeoutRef.current = setTimeout(() => {
            stopTyping();
        }, 3000);
    };

    const stopTyping = () => {
        if (!user || !currentRoom || user.current_role === 'observer' || !channelRef.current) return;

        // Clear timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = null;
        }

        // Broadcast typing stop using the existing channel
        try {
            channelRef.current.send({
                type: 'broadcast',
                event: 'typing_stop',
                payload: {
                    userId: user.id
                }
            });
        } catch (error) {
            console.warn('Failed to send typing stop broadcast:', error);
        }
    };

    const downloadChatHistory = () => {
        if (!currentRoom || !messages) return;

        const roomTitle = currentRoom.title.replace(/\s+/g, '_');
        const content = [
            `Room: ${currentRoom.title}`,
            `Created: ${new Date(currentRoom.created_at).toISOString()}`,
            '',
            'Messages:',
            '=========',
            ...messages.map(message => 
                `[${message.created_at}] ${message.display_name || message.user_role} (${message.user_role}): ${message.content}`
            )
        ].join('\n');

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${roomTitle}_chat_history.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const value: RoomContextType = {
        currentRoom,
        messages,
        participants,
        loading,
        typingUsers,
        createRoom,
        joinRoom,
        leaveRoom,
        sendMessage,
        generateAIResponse,
        toggleAIAssistant,
        startTyping,
        stopTyping,
        aiConfig,
        loadingAI,
        downloadChatHistory
    };

    return (
        <RoomContext.Provider value={value}>
            {children}
        </RoomContext.Provider>
    );
}; 
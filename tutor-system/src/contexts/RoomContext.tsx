import React, { createContext, useContext, useState, useEffect } from 'react';
import { RoomContextType, Room, Message, UserRole, AIAssistantConfig } from '../types';
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
    const [loading, setLoading] = useState(false);
    const [aiConfig, setAiConfig] = useState<AIAssistantConfig | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const { user } = useAuth();

    // Real-time subscription for messages
    useEffect(() => {
        if (!currentRoom) return;

        const subscription = supabase
            .channel(`room_${currentRoom.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${currentRoom.id}`
                },
                (payload) => {
                    const newMessage = payload.new as Message;
                    setMessages(prev => [...prev, newMessage]);
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [currentRoom]);

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

    const joinRoom = async (roomId: string): Promise<void> => {
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

            setCurrentRoom(roomData);
            setMessages(messagesData || []);
        } finally {
            setLoading(false);
        }
    };

    const leaveRoom = async (): Promise<void> => {
        setCurrentRoom(null);
        setMessages([]);
        setAiConfig(null);
    };

    const sendMessage = async (content: string): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role === 'observer') {
            throw new Error('Observers cannot send messages');
        }

        const { error } = await supabase
            .from('messages')
            .insert({
                room_id: currentRoom.id,
                user_id: user.id,
                content,
                user_role: user.current_role as UserRole
            });

        if (error) throw error;
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

    const value: RoomContextType = {
        currentRoom,
        messages,
        loading,
        createRoom,
        joinRoom,
        leaveRoom,
        sendMessage,
        generateAIResponse,
        toggleAIAssistant,
        aiConfig,
        loadingAI
    };

    return (
        <RoomContext.Provider value={value}>
            {children}
        </RoomContext.Provider>
    );
}; 
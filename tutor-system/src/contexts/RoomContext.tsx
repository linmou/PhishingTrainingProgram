import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { RoomContextType, Room, Message, UserRole, AIAssistantConfig, TypingIndicator, User, AIInteraction, MessageFeedbackStats } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import {
    initializeAIAssistant,
    getAIConfig,
    updateAIConfig,
    generateAISuggestion,
    recordAISuggestionFeedback
} from '../services/aiService';
import { 
    validateRoomPassword,
    submitMessageFeedback,
    getMessageFeedbackStats,
    getUserMessageFeedback,
    getRoomFeedbackSummary,
    clearChatHistory as clearChatHistoryService
} from '../services/supabase';
import { ParameterOverrides } from '../components/AISuggestionBox';

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
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [aiInteractions, setAIInteractions] = useState<AIInteraction[]>([]);
    const [currentSuggestionContext, setCurrentSuggestionContext] = useState<{ 
        parentMessageId: string; 
        parentMessageContent: string;
        startTime: number;
        contextMessages: string[];
    } | null>(null);
    const [messageFeedbackStats, setMessageFeedbackStats] = useState<Record<string, MessageFeedbackStats>>({});
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<any>(null);
    const { user } = useAuth();

    // Stable function to add display names and avatars to messages
    const addDisplayNameToMessage = useCallback((message: any, participantsList?: User[]): Message => {
        // Find the user from participants list
        const messageUser = participantsList?.find(p => p.id === message.user_id);
        
        // For prepopulated messages, preserve the existing display_name
        if (message.user_id === 'system' && message.display_name) {
            return {
                ...message,
                // Keep the original display_name from prepopulated data
                display_name: message.display_name,
                avatar_url: null // No avatar for prepopulated messages
            };
        }
        
        return {
            ...message,
            display_name: message.user_id === user?.id ? (user?.display_name || 'User') : 
                         messageUser?.display_name || 
                         (message.user_role === 'tutor' ? 'Tutor' :
                          message.user_role === 'student' ? 'Student' : 'Observer'),
            avatar_url: message.user_id === user?.id ? user?.avatar_url : messageUser?.avatar_url
        };
    }, [user?.id, user?.display_name, user?.avatar_url]);

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
                    const messageWithDisplayName = addDisplayNameToMessage(newMessage, participants);
                    
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
    }, [currentRoom, user?.id, addDisplayNameToMessage, participants]);

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
                // Add display_name and avatar_url to messages using stable function
                const messagesWithDisplayName = messagesData.map(msg => addDisplayNameToMessage(msg, participants));
                
                // Preserve pre-populated messages by combining them with database messages
                setMessages(prevMessages => {
                    // Separate pre-populated messages (those with IDs starting with 'prepop-')
                    const prePopulatedMessages = prevMessages.filter(msg => msg.id.startsWith('prepop-'));
                    
                    // Combine pre-populated messages with fresh database messages
                    return [...prePopulatedMessages, ...messagesWithDisplayName];
                });
            }
        } catch (error) {
            console.error('Error polling messages:', error);
        }
    }, [currentRoom, addDisplayNameToMessage, participants]);

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

    // Update participants list when current user changes (e.g., avatar update)
    useEffect(() => {
        if (!currentRoom || !user) return;

        // Update the current user in participants list
        setParticipants(prev => {
            const updatedParticipants = prev.map(p => 
                p.id === user.id ? { ...p, ...user } : p
            );
            
            // If user is not in participants, add them
            if (!updatedParticipants.some(p => p.id === user.id)) {
                updatedParticipants.push(user);
            }
            
            return updatedParticipants;
        });
    }, [user, currentRoom]);

    // Re-enrich existing messages when participants change (e.g., when user updates avatar)
    useEffect(() => {
        if (!currentRoom || !participants.length) return;

        // Re-enrich all existing messages with updated participant info
        setMessages(prevMessages => 
            prevMessages.map(msg => addDisplayNameToMessage(msg, participants))
        );
    }, [participants, currentRoom, addDisplayNameToMessage]);

    // Load AI configuration when room changes
    useEffect(() => {
        const loadAIConfig = async () => {
            if (!currentRoom) {
                setAiConfig(null);
                return;
            }

            // For simplified auth, use room data as AI config source
            if (currentRoom.ai_assistant_enabled) {
                setAiConfig({
                    id: currentRoom.id,
                    room_id: currentRoom.id,
                    model_name: currentRoom.ai_assistant_model || 'gpt-4o',
                    system_prompt: currentRoom.ai_assistant_prompt || 
                        'You are a helpful AI assistant in an educational tutoring session. ' +
                        'Provide clear, educational responses to help students learn. ' +
                        'Be encouraging, patient, and focus on building understanding.',
                    temperature: 0.7,
                    max_tokens: 150,
                    is_active: true,
                    created_at: currentRoom.created_at,
                    updated_at: currentRoom.updated_at
                });
            } else {
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

    const joinRoom = useCallback(async (roomId: string, password?: string): Promise<void> => {
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

            // Validate password if room is password protected
            if (roomData.password) {
                // Skip password validation if current user is the room owner (tutor)
                if (user?.id === roomData.tutor_id) {
                    console.log('🔓 RoomContext: Room owner bypassing password validation');
                } else {
                    if (!password) {
                        throw new Error('This room is password protected. Please enter the password.');
                    }
                    
                    const validation = await validateRoomPassword(roomId, password);
                    if (!validation.success) {
                        throw new Error(validation.message);
                    }
                }
            }

            // Get existing messages
            const { data: messagesData, error: messagesError } = await supabase
                .from('messages')
                .select('*')
                .eq('room_id', roomId)
                .order('created_at', { ascending: true });

            if (messagesError) throw messagesError;

            // Process pre-populated dialogue if it exists
            let prePopulatedMessages: Message[] = [];
            if (roomData.pre_populated_dialogue && Array.isArray(roomData.pre_populated_dialogue)) {
                console.log('🔄 Processing pre-populated dialogue:', roomData.pre_populated_dialogue);
                
                prePopulatedMessages = roomData.pre_populated_dialogue.map((item: any, index: number) => {
                    // Create a timestamp that's earlier than any real messages
                    const baseTimestamp = new Date(roomData.created_at);
                    baseTimestamp.setSeconds(baseTimestamp.getSeconds() + index);
                    
                    return {
                        id: `prepop-${roomId}-${index}`,
                        room_id: roomId,
                        user_id: 'system', // Use system as user_id for pre-populated messages
                        content: item.message,
                        user_role: item.role as UserRole,
                        is_ai_generated: false,
                        ai_model_used: null,
                        ai_response_time_ms: null,
                        parent_message_id: null,
                        created_at: baseTimestamp.toISOString(),
                        display_name: item.user_name
                    } as Message;
                });
                
                console.log('✅ Created pre-populated messages:', prePopulatedMessages);
            }

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

            // Add display_name and avatar_url to existing messages
            const messagesWithDisplayName = (messagesData || []).map(msg => addDisplayNameToMessage(msg, participantsData || []));

            // Combine pre-populated messages with existing messages
            const allMessages = [...prePopulatedMessages, ...messagesWithDisplayName];

            setCurrentRoom(roomData);
            setMessages(allMessages);
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

        // Check if this is a tutor response after seeing an AI suggestion
        if (user.current_role === 'tutor' && currentSuggestionContext && aiSuggestion) {
            // Determine the action type
            let action: 'accepted' | 'modified' = 'modified';
            if (content.trim() === aiSuggestion.trim()) {
                action = 'accepted';
            }
            
            // Record the feedback
            await recordAIFeedback(action, content);
            
            // Clear the suggestion context
            clearAISuggestion();
        }

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
            parent_message_id: (currentSuggestionContext?.parentMessageId && !currentSuggestionContext.parentMessageId.startsWith('prepop-')) 
                ? currentSuggestionContext.parentMessageId 
                : null,
            created_at: new Date().toISOString(),
            display_name: user.display_name || 'User',
            avatar_url: user.avatar_url
        };

        // Add message optimistically
        setMessages(prev => [...prev, optimisticMessage]);

        const { data, error } = await supabase
            .from('messages')
            .insert({
                room_id: currentRoom.id,
                user_id: user.id,
                content,
                user_role: user.current_role as UserRole,
                parent_message_id: (currentSuggestionContext?.parentMessageId && !currentSuggestionContext.parentMessageId.startsWith('prepop-')) 
                    ? currentSuggestionContext.parentMessageId 
                    : null
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
                    ? { ...data, display_name: user.display_name || 'User', avatar_url: user.avatar_url }
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
            // If there's an existing suggestion, mark it as ignored
            if (currentSuggestionContext && aiSuggestion) {
                await recordAIFeedback('ignored');
                clearAISuggestion();
            }

            // Get the latest student message if no prompt provided
            let parentMessageId: string | undefined;
            let parentMessageContent: string = '';
            if (!prompt) {
                const latestMessage = messages
                    .filter(m => m.user_role === 'student' && !m.is_ai_generated)
                    .slice(-1)[0];

                if (latestMessage) {
                    parentMessageId = latestMessage.id;
                    parentMessageContent = latestMessage.content;
                    prompt = latestMessage.content;
                }
            }

            if (!parentMessageId) {
                throw new Error('No student message found to respond to');
            }

            const result = await generateAISuggestion(
                currentRoom.id,
                user.id,
                prompt,
                parentMessageId
            );

            // Store the AI suggestion for the tutor
            if (result.aiResponse.suggested_response) {
                setAiSuggestion(result.aiResponse.suggested_response);
                
                // Store context for tracking
                setCurrentSuggestionContext({
                    parentMessageId,
                    parentMessageContent,
                    startTime: Date.now(),
                    contextMessages: result.contextMessages
                });
            }
        } catch (error) {
            console.error('Failed to generate AI response:', error);
            throw error;
        } finally {
            setLoadingAI(false);
        }
    };

    const regenerateAIResponse = async (parameterOverrides: ParameterOverrides): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can regenerate AI responses');
        }

        if (!currentRoom.ai_assistant_enabled) {
            throw new Error('AI assistant is not enabled for this room');
        }

        if (!currentSuggestionContext) {
            throw new Error('No current suggestion to regenerate');
        }

        setLoadingAI(true);
        try {
            // Mark the current suggestion as modified/ignored
            if (aiSuggestion) {
                await recordAIFeedback('modified');
            }

            // Generate new suggestion with parameter overrides
            const result = await generateAISuggestion(
                currentRoom.id,
                user.id,
                currentSuggestionContext.parentMessageContent,
                currentSuggestionContext.parentMessageId,
                parameterOverrides // Pass the parameter overrides
            );

            // Update the AI suggestion
            if (result.aiResponse.suggested_response) {
                setAiSuggestion(result.aiResponse.suggested_response);
                
                // Update context with new generation time
                setCurrentSuggestionContext({
                    ...currentSuggestionContext,
                    startTime: Date.now(),
                    contextMessages: result.contextMessages
                });
            }
        } catch (error) {
            console.error('Failed to regenerate AI response:', error);
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
                // For simplified auth, just update the room directly
                const aiModel = config?.model_name || 'gpt-4o';
                const aiPrompt = config?.system_prompt || 
                    'You are a helpful AI assistant in an educational tutoring session. ' +
                    'Provide clear, educational responses to help students learn. ' +
                    'Be encouraging, patient, and focus on building understanding.';
                
                // Store AI config in the room itself
                const { error: updateError } = await supabase
                    .from('rooms')
                    .update({ 
                        ai_assistant_enabled: true,
                        ai_assistant_model: aiModel,
                        ai_assistant_prompt: aiPrompt
                    })
                    .eq('id', currentRoom.id);

                if (updateError) throw updateError;
                
                // Set a dummy AI config for the app to use
                setAiConfig({
                    id: currentRoom.id,
                    room_id: currentRoom.id,
                    model_name: aiModel,
                    system_prompt: aiPrompt,
                    temperature: config?.temperature || 0.7,
                    max_tokens: config?.max_tokens || 150,
                    is_active: true,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

                // Reload the room to get updated data
                const { data: updatedRoom, error: roomError } = await supabase
                    .from('rooms')
                    .select('*')
                    .eq('id', currentRoom.id)
                    .single();

                if (roomError) throw roomError;
                setCurrentRoom(updatedRoom);
            } else {
                // Disable AI assistant
                const { data: updatedRoom, error: roomError } = await supabase
                    .from('rooms')
                    .update({ 
                        ai_assistant_enabled: false,
                        ai_assistant_model: null,
                        ai_assistant_prompt: null
                    })
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

    const downloadChatHistory = async (format: 'txt' | 'json' | 'feedback' = 'txt') => {
        if (!currentRoom || !messages) return;

        const roomTitle = currentRoom.title.replace(/\s+/g, '_');
        const timestamp = new Date().toISOString().split('T')[0];
        
        // Only include AI data for tutors
        const isTutor = user?.current_role === 'tutor';
        
        if (format === 'json' || format === 'feedback') {
            // Get feedback summary for the room
            let feedbackSummary = null;
            try {
                feedbackSummary = await getRoomFeedbackSummary(currentRoom.id);
            } catch (error) {
                console.warn('Failed to get room feedback summary:', error);
            }

            const exportData: any = {
                room: {
                    id: currentRoom.id,
                    title: currentRoom.title,
                    created_at: currentRoom.created_at
                },
                messages: messages.map(msg => ({
                    id: msg.id,
                    user_role: msg.user_role,
                    display_name: msg.display_name,
                    content: msg.content,
                    created_at: msg.created_at,
                    is_ai_generated: msg.is_ai_generated,
                    feedback_stats: messageFeedbackStats[msg.id] || undefined
                })),
                export_metadata: {
                    exported_at: new Date().toISOString(),
                    total_messages: messages.length
                }
            };

            // Add feedback summary if available
            if (feedbackSummary) {
                exportData.feedback_summary = feedbackSummary;
            }
            
            // Only add AI-related data for tutors
            if (isTutor) {
                exportData.room.ai_enabled = currentRoom.ai_assistant_enabled;
                exportData.room.ai_model = currentRoom.ai_assistant_model;
                exportData.messages = messages.map(msg => ({
                    id: msg.id,
                    user_role: msg.user_role,
                    display_name: msg.display_name,
                    content: msg.content,
                    created_at: msg.created_at,
                    is_ai_generated: msg.is_ai_generated,
                    ai_model_used: msg.ai_model_used
                }));
                exportData.ai_interactions = aiInteractions;
                exportData.export_metadata.total_ai_interactions = aiInteractions.length;
                exportData.export_metadata.interaction_summary = {
                    accepted: aiInteractions.filter(i => i.tutor_action === 'accepted').length,
                    rejected: aiInteractions.filter(i => i.tutor_action === 'rejected').length,
                    modified: aiInteractions.filter(i => i.tutor_action === 'modified').length,
                    ignored: aiInteractions.filter(i => i.tutor_action === 'ignored').length
                };
            }
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = format === 'feedback' 
                ? `${roomTitle}_feedback_export_${timestamp}.json`
                : `${roomTitle}_chat_export_${timestamp}.json`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            // If this is feedback format, we're done
            if (format === 'feedback') return;
        } else {
            // TXT format - only include AI data for tutors
            const aiSummary = isTutor && aiInteractions.length > 0 ? [
                '',
                'AI Assistant Summary:',
                '====================',
                `Total AI suggestions: ${aiInteractions.length}`,
                `Accepted: ${aiInteractions.filter(i => i.tutor_action === 'accepted').length} (${(aiInteractions.filter(i => i.tutor_action === 'accepted').length / aiInteractions.length * 100).toFixed(2)}%)`,
                `Modified: ${aiInteractions.filter(i => i.tutor_action === 'modified').length} (${(aiInteractions.filter(i => i.tutor_action === 'modified').length / aiInteractions.length * 100).toFixed(2)}%)`,
                `Rejected: ${aiInteractions.filter(i => i.tutor_action === 'rejected').length} (${(aiInteractions.filter(i => i.tutor_action === 'rejected').length / aiInteractions.length * 100).toFixed(2)}%)`,
                `Ignored: ${aiInteractions.filter(i => i.tutor_action === 'ignored').length} (${(aiInteractions.filter(i => i.tutor_action === 'ignored').length / aiInteractions.length * 100).toFixed(2)}%)`,
                '',
                'Detailed AI Interactions:',
                '========================',
                ...aiInteractions.map((interaction, idx) => [
                    `#${idx + 1} - ${interaction.timestamp}`,
                    `Parent Message: "${interaction.parent_message_content}"`,
                    `AI Suggestion: "${interaction.ai_suggestion}"`,
                    `Tutor Action: ${interaction.tutor_action}`,
                    interaction.tutor_final_response ? `Final Response: "${interaction.tutor_final_response}"` : '',
                    `Response Time: ${interaction.response_time_ms}ms`,
                    ''
                ].filter(line => line).join('\n'))
            ] : [];

            // Add feedback summary for TXT format
            const messagesWithFeedback = Object.keys(messageFeedbackStats).length;
            const totalFeedbackCount = Object.values(messageFeedbackStats).reduce((sum, stats) => sum + stats.total_feedback_count, 0);
            const feedbackSummaryTxt = messagesWithFeedback > 0 ? [
                '',
                'Feedback Summary:',
                '================',
                `Messages with feedback: ${messagesWithFeedback}`,
                `Total feedback entries: ${totalFeedbackCount}`,
                ''
            ] : [];

            const content = [
                `Room: ${currentRoom.title}`,
                `Created: ${new Date(currentRoom.created_at).toISOString()}`,
                ...(isTutor ? [
                    `AI Assistant: ${currentRoom.ai_assistant_enabled ? 'Enabled' : 'Disabled'}`,
                    currentRoom.ai_assistant_model ? `AI Model: ${currentRoom.ai_assistant_model}` : ''
                ] : []),
                ...feedbackSummaryTxt,
                'Messages:',
                '=========',
                ...messages.map(message => {
                    const feedbackStats = messageFeedbackStats[message.id];
                    const feedbackInfo = feedbackStats && feedbackStats.total_feedback_count > 0 
                        ? ` [👍${feedbackStats.like_count} 👎${feedbackStats.dislike_count}${feedbackStats.overall_average_rating ? ` ★${feedbackStats.overall_average_rating.toFixed(1)}` : ''}]`
                        : '';
                    return `[${message.created_at}] ${message.display_name || message.user_role} (${message.user_role}): ${message.content}${feedbackInfo}`;
                }),
                ...aiSummary
            ].filter(line => line !== '').join('\n');

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${roomTitle}_chat_history_${timestamp}.txt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }
    };

    const clearChatHistory = async (): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can clear chat history');
        }

        try {
            // Call the service function to clear database messages - pass user ID
            await clearChatHistoryService(currentRoom.id, user.id);

            // Clear messages from local state but preserve pre-populated messages
            const prePopulatedMessages = messages.filter(msg => msg.id.startsWith('prepop-'));
            setMessages(prePopulatedMessages);
            
            // Clear message feedback stats
            setMessageFeedbackStats({});
            
            // Clear AI interactions
            setAIInteractions([]);
            
            console.log('✅ Chat history cleared successfully');
        } catch (error) {
            console.error('❌ Failed to clear chat history:', error);
            throw error;
        }
    };

    const clearAISuggestion = () => {
        setAiSuggestion(null);
        setCurrentSuggestionContext(null);
    };

    const recordAIFeedback = async (
        action: 'accepted' | 'rejected' | 'modified' | 'ignored',
        finalResponse?: string
    ): Promise<void> => {
        if (!user || !currentRoom || !currentSuggestionContext || !aiSuggestion) {
            console.warn('Cannot record AI feedback: missing context');
            return;
        }

        const responseTime = Date.now() - currentSuggestionContext.startTime;

        try {
            // Record to database
            await recordAISuggestionFeedback(
                currentRoom.id,
                user.id,
                currentSuggestionContext.parentMessageId,
                aiSuggestion,
                action,
                finalResponse,
                undefined, // tutor_message_id will be set later if needed
                responseTime,
                currentSuggestionContext.contextMessages
            );

            // Add to local interactions for export
            const interaction: AIInteraction = {
                timestamp: new Date().toISOString(),
                parent_message_id: currentSuggestionContext.parentMessageId,
                parent_message_content: currentSuggestionContext.parentMessageContent,
                ai_suggestion: aiSuggestion,
                tutor_action: action,
                tutor_final_response: finalResponse,
                response_time_ms: responseTime
            };

            setAIInteractions(prev => [...prev, interaction]);
        } catch (error) {
            console.error('Failed to record AI feedback:', error);
            // Don't throw - we don't want to interrupt the user flow
        }
    };

    // Message feedback functions
    const handleSubmitMessageFeedback = async (messageId: string, feedbackType: 'like' | 'dislike', rating: number): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('User must be logged in and in a room to submit feedback');
        }

        try {
            // Submit feedback to database
            await submitMessageFeedback(messageId, user.id, currentRoom.id, feedbackType, rating);
            
            // Refresh feedback stats for this message
            await handleGetMessageFeedbackStats(messageId);
            
        } catch (error) {
            console.error('Failed to submit message feedback:', error);
            throw error;
        }
    };

    const handleGetMessageFeedbackStats = async (messageId: string): Promise<MessageFeedbackStats | null> => {
        if (!user) return null;

        try {
            // Get overall stats
            const stats = await getMessageFeedbackStats(messageId);
            
            // Get user's specific feedback
            const userFeedback = await getUserMessageFeedback(messageId, user.id);
            
            // Combine stats with user feedback
            const fullStats: MessageFeedbackStats = {
                ...stats,
                user_feedback: userFeedback ? {
                    feedback_type: userFeedback.feedback_type,
                    rating: userFeedback.rating
                } : null
            };

            // Update local state
            setMessageFeedbackStats(prev => ({
                ...prev,
                [messageId]: fullStats
            }));

            return fullStats;
        } catch (error) {
            console.error('Failed to get message feedback stats:', error);
            return null;
        }
    };

    // Load feedback stats for all messages when messages change
    useEffect(() => {
        if (messages.length > 0 && user) {
            // Load feedback stats for each message
            messages.forEach(message => {
                // Only load if we don't already have stats for this message
                if (!messageFeedbackStats[message.id]) {
                    handleGetMessageFeedbackStats(message.id);
                }
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [messages.length, user]);

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
        regenerateAIResponse,
        toggleAIAssistant,
        startTyping,
        stopTyping,
        aiConfig,
        loadingAI,
        downloadChatHistory,
        clearChatHistory,
        aiSuggestion,
        clearAISuggestion,
        aiInteractions,
        currentSuggestionContext,
        recordAIFeedback,
        submitMessageFeedback: handleSubmitMessageFeedback,
        getMessageFeedbackStats: handleGetMessageFeedbackStats,
        messageFeedbackStats
    };

    return (
        <RoomContext.Provider value={value}>
            {children}
        </RoomContext.Provider>
    );
}; 
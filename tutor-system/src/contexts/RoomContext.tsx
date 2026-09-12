import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { RoomContextType, Room, Message, UserRole, AIAssistantConfig, AIAssistantConfigSnapshot, TypingIndicator, User, AIInteraction, MessageFeedbackStats, MultiAgentDraft, StudentAIChoice, TutorActionDecision, TutorResponseMode, TutorDecisionV3 } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import {
    generateTutorSuggestion,
    recordAISuggestionFeedback,
    updateAIConfig,
    getAIConfig,
    DEFAULT_AI_MODEL
} from '../services/aiService';
import { setStudentAITone as persistStudentAITone } from '../services/studentAIToneService';
import {
    decodeMultiAgentResponse,
    formatAgentTaggedContent,
    MULTI_AGENT_PLAYBACK_DELAY_MS,
    toRoomParticipationMode
} from '../services/tutorDecisionContract';
import { 
    validateRoomPassword,
    submitMessageFeedback,
    getMessageFeedbackStats,
    getUserMessageFeedback,
    getRoomFeedbackSummary,
    clearChatHistory as clearChatHistoryService
} from '../services/supabase';
import { sendReviewedTutorResponse, setRoomResponseMode } from '../services/guardModeService';
import { ChecklistService } from '../services/checklistService';
import { transferAssessmentService } from '../services/transferAssessmentService';
import { ParameterOverrides } from '../components/AISuggestionBox';
import { buildRoomExportData, buildRoomTextExport } from './roomExportBuilder';

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
    const [aiDecision, setAiDecision] = useState<TutorActionDecision | null>(null);
    const [multiAgentDraft, setMultiAgentDraft] = useState<MultiAgentDraft | null>(null);
    const [transferDraft, setTransferDraft] = useState<{
        draftId: string;
        revision: number;
        decision: TutorDecisionV3;
        progressSnapshotHash: string;
    } | null>(null);
    const [finalMode, setFinalMode] = useState<TutorResponseMode>('tutoring');
    const [aiInteractions, setAIInteractions] = useState<AIInteraction[]>([]);
    const [currentSuggestionContext, setCurrentSuggestionContext] = useState<{ 
        rawDecision: TutorActionDecision;
        finalMode: TutorResponseMode;
        finalResponse: string;
        parentMessageId: string; 
        parentMessageContent: string;
        startTime: number;
        contextMessages: string[];
        aiConfigSnapshot?: AIAssistantConfigSnapshot;
    } | null>(null);
    const [messageFeedbackStats, setMessageFeedbackStats] = useState<Record<string, MessageFeedbackStats>>({});
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<any>(null);
    const { user } = useAuth();

    const normalizeRoom = useCallback((room: Room): Room => {
        if (!room.active_response_mode) {
            return room;
        }

        return {
            ...room,
            mode_changed_at: room.mode_changed_at || null,
            mode_change_source: room.mode_change_source || null
        };
    }, []);

    const refreshMessageFeedbackStats = useCallback(async (messageId: string) => {
        if (!user) return null;

        try {
            const stats = await getMessageFeedbackStats(messageId);
            const userFeedback = await getUserMessageFeedback(messageId, user.id);

            const fullStats: MessageFeedbackStats = {
                ...stats,
                user_feedback: userFeedback ? {
                    feedback_type: userFeedback.feedback_type,
                    rating: userFeedback.rating
                } : null
            };

            setMessageFeedbackStats(prev => ({
                ...prev,
                [messageId]: fullStats
            }));

            return fullStats;
        } catch (error) {
            console.error('Failed to get message feedback stats:', error);
            return null;
        }
    }, [user]);

    const handleFeedbackRealtime = useCallback(async (payload: any) => {
        const feedbackMessageId = payload?.new?.message_id;
        if (!feedbackMessageId) return;

        await refreshMessageFeedbackStats(feedbackMessageId);
    }, [refreshMessageFeedbackStats]);

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
        
        const isGuardMessage = message.response_mode === 'guard';
        return {
            ...message,
            display_name: isGuardMessage ? 'Security Supervisor' : message.user_id === user?.id ? (user?.display_name || 'User') :
                         messageUser?.display_name || 
                         (message.user_role === 'tutor' ? 'Tutor' :
                          message.user_role === 'student' ? 'Student' : 'Observer'),
            avatar_url: isGuardMessage ? null : message.user_id === user?.id ? user?.avatar_url : messageUser?.avatar_url
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
                        if (prev.some(message => message.id === messageWithDisplayName.id)) {
                            return prev;
                        }
                        return [...prev, messageWithDisplayName];
                    });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                    filter: `id=eq.${currentRoom.id}`
                },
                (payload) => {
                    setCurrentRoom(normalizeRoom(payload.new as Room));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message_feedback',
                    filter: `room_id=eq.${currentRoom.id}`
                },
                handleFeedbackRealtime
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'message_feedback',
                    filter: `room_id=eq.${currentRoom.id}`
                },
                handleFeedbackRealtime
            )
            .on('broadcast', { event: 'message_feedback_changed' }, (payload) => {
                const feedbackMessageId = payload?.payload?.messageId;
                if (!feedbackMessageId) return;

                void refreshMessageFeedbackStats(feedbackMessageId);
            })
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
    }, [currentRoom, user?.id, addDisplayNameToMessage, normalizeRoom, participants, handleFeedbackRealtime]);

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

            if (!currentRoom.ai_assistant_enabled) {
                setAiConfig(null);
                return;
            }

            try {
                const persistedConfig = await getAIConfig(currentRoom.id);

                if (persistedConfig) {
                    setAiConfig(persistedConfig);
                    return;
                }
            } catch (error) {
                console.error('Failed to load AI config:', error);
            }

            setAiConfig(prevConfig => ({
                id: currentRoom.id,
                room_id: currentRoom.id,
                model_name: currentRoom.ai_assistant_model || prevConfig?.model_name || DEFAULT_AI_MODEL,
                system_prompt: currentRoom.ai_assistant_prompt || prevConfig?.system_prompt ||
                    'You are a helpful AI assistant in an educational tutoring session. ' +
                    'Provide clear, educational responses to help students learn. ' +
                    'Be encouraging, patient, and focus on building understanding.',
                prompt_config: prevConfig?.room_id === currentRoom.id ? prevConfig.prompt_config ?? null : null,
                temperature: prevConfig?.room_id === currentRoom.id ? prevConfig.temperature : 0.7,
                max_tokens: prevConfig?.room_id === currentRoom.id ? prevConfig.max_tokens : 150,
                is_active: true,
                created_at: currentRoom.created_at,
                updated_at: currentRoom.updated_at
            }));
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

            setCurrentRoom(normalizeRoom(roomData));
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

            setCurrentRoom(normalizeRoom(roomData));
            setMessages(allMessages);
            setParticipants(participantsData || []);
        } finally {
            setLoading(false);
        }
    }, [addDisplayNameToMessage, normalizeRoom, user?.id]);

    const leaveRoom = useCallback(async (): Promise<void> => {
        setCurrentRoom(null);
        setMessages([]);
        setParticipants([]);
        setAiConfig(null);
    }, []);

    const sendMessage = async (
        content: string,
        options?: { replyToMessageId?: string; assessmentId?: string }
    ): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role === 'observer') {
            throw new Error('Observers cannot send messages');
        }

        // Transfer-policy messages use the trusted API boundary. If this room
        // has no owner-scoped transfer checklist, retain the legacy path.
        let transferChecklist = null;
        try {
            const checklistService = ChecklistService as typeof ChecklistService & {
                getChecklistForStudent?: typeof ChecklistService.getChecklistForStudent;
                getActiveTransferChecklistForRoom?: typeof ChecklistService.getActiveTransferChecklistForRoom;
            };
            transferChecklist = user.current_role === 'student'
                ? await checklistService.getChecklistForStudent?.(currentRoom.id, user.id) || null
                : await checklistService.getActiveTransferChecklistForRoom?.(currentRoom.id) || null;
        } catch (transferError) {
            console.warn('Transfer checklist unavailable; using legacy message path:', transferError);
        }
        if (!currentSuggestionContext && transferChecklist?.progress_policy_version === 'transfer_v1') {
            const result = await transferAssessmentService.postMessage({
                roomId: currentRoom.id,
                content,
                replyToMessageId: options?.replyToMessageId,
                assessmentId: options?.assessmentId,
            });
            const storedMessage = result.message as Message | undefined;
            if (!storedMessage) {
                throw new Error('Transfer message operation did not return a stored message');
            }
            setMessages(prev => prev.some(message => message.id === storedMessage.id)
                ? prev
                : [...prev, addDisplayNameToMessage(storedMessage, participants)]);
            if (user.current_role === 'student') {
                try {
                    await transferAssessmentService.processMessage(storedMessage.id);
                } catch (assessmentError) {
                    if (!String(assessmentError).includes('ASSESSMENT_NOT_OPEN')) {
                        throw assessmentError;
                    }
                    try {
                        await transferAssessmentService.analyzeMessage(storedMessage.id, currentRoom.id);
                    } catch (analysisError) {
                        console.warn('Transfer evidence analysis unavailable; message was stored:', analysisError);
                    }
                }
            }
            return;
        }

        console.log('Sending message:', { roomId: currentRoom.id, userId: user.id, content });

        if (user.current_role === 'tutor' && currentSuggestionContext && aiDecision && aiSuggestion) {
            const tutorAction = content.trim() === currentSuggestionContext.rawDecision.suggested_response.trim()
                ? 'accepted'
                : 'modified';
            const responseTimeMs = Date.now() - currentSuggestionContext.startTime;
            const reviewedResult = await sendReviewedTutorResponse({
                roomId: currentRoom.id,
                tutorId: user.id,
                parentMessageId: currentSuggestionContext.parentMessageId.startsWith('prepop-')
                    ? null
                    : currentSuggestionContext.parentMessageId,
                rawDecision: currentSuggestionContext.rawDecision,
                finalMode,
                finalResponse: content,
                tutorAction,
                responseTimeMs,
                contextMessages: currentSuggestionContext.contextMessages
            });

            setMessages(prev => [...prev, addDisplayNameToMessage(reviewedResult.message, participants)]);
            setCurrentRoom(normalizeRoom(reviewedResult.room));
            setAIInteractions(prev => [...prev, {
                timestamp: new Date().toISOString(),
                parent_message_id: currentSuggestionContext.parentMessageId,
                parent_message_content: currentSuggestionContext.parentMessageContent,
                ai_suggestion: currentSuggestionContext.rawDecision.suggested_response,
                tutor_action: tutorAction,
                tutor_final_response: content,
                response_time_ms: responseTimeMs,
                ai_config_snapshot: currentSuggestionContext.aiConfigSnapshot,
                raw_mode: currentSuggestionContext.rawDecision.mode,
                raw_instruction: currentSuggestionContext.rawDecision.instruction,
                mode_reason: currentSuggestionContext.rawDecision.mode_reason,
                final_mode: finalMode,
                mode_rectified: currentSuggestionContext.rawDecision.mode !== finalMode
            }]);
            clearAISuggestion();
            return;
        }

        const responseMode = user.current_role === 'tutor'
            ? currentRoom.active_response_mode || 'tutoring'
            : null;
        const parentMessageId = options?.replyToMessageId || (
            currentSuggestionContext?.parentMessageId && !currentSuggestionContext.parentMessageId.startsWith('prepop-')
                ? currentSuggestionContext.parentMessageId
                : null
        );

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
            parent_message_id: parentMessageId,
            created_at: new Date().toISOString(),
            display_name: user.display_name || 'User',
            avatar_url: user.avatar_url,
            response_mode: responseMode
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
                parent_message_id: parentMessageId,
                response_mode: responseMode
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

    /** Store one ordinary single-Tutor (tutoring or Guard) suggestion for human review. */
    const applySingleAgentSuggestion = (
        decision: TutorActionDecision,
        suggestion: string,
        parentMessageId: string,
        parentMessageContent: string,
        result: { contextMessages: string[]; appliedConfig?: AIAssistantConfigSnapshot }
    ) => {
        const finalMode = toRoomParticipationMode(decision.mode);
        setMultiAgentDraft(null);
        setAiSuggestion(suggestion);
        setAiDecision(decision);
        setFinalMode(finalMode);
        setCurrentSuggestionContext({
            rawDecision: decision,
            finalMode,
            finalResponse: decision.suggested_response,
            parentMessageId,
            parentMessageContent,
            startTime: Date.now(),
            contextMessages: result.contextMessages,
            aiConfigSnapshot: result.appliedConfig
        });
    };

    /** Store one two-character Multi-agent decision for human review. */
    const applyMultiAgentDraft = (
        decision: TutorActionDecision,
        parentMessageId: string,
        parentMessageContent: string,
        result: { contextMessages: string[]; appliedConfig?: AIAssistantConfigSnapshot }
    ) => {
        setMultiAgentDraft({
            rawDecision: decision,
            parentMessageId,
            parentMessageContent,
            generatedMessages: decodeMultiAgentResponse(decision.suggested_response),
            startTime: Date.now(),
            contextMessages: result.contextMessages,
            aiConfigSnapshot: result.appliedConfig
        });
        setAiSuggestion(null);
        setAiDecision(null);
        setFinalMode('tutoring');
        setCurrentSuggestionContext(null);
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
            if (multiAgentDraft) {
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

            let transferChecklist = null;
            try {
                const checklistService = ChecklistService as typeof ChecklistService & {
                    getActiveTransferChecklistForRoom?: typeof ChecklistService.getActiveTransferChecklistForRoom;
                };
                transferChecklist = await checklistService.getActiveTransferChecklistForRoom?.(currentRoom.id) || null;
            } catch (transferError) {
                console.warn('Transfer preparation unavailable; keeping legacy AI generation:', transferError);
            }
            if (transferChecklist?.progress_policy_version === 'transfer_v1') {
                const prepared = await transferAssessmentService.prepareTurn({
                    roomId: currentRoom.id,
                    focusStudentMessageId: parentMessageId,
                    checklistId: transferChecklist.id,
                });
                const preparedDecision = prepared.decision as TutorDecisionV3 | undefined;
                if (!preparedDecision) {
                    throw new Error('Transfer preparation did not return a structured tutor decision');
                }
                setTransferDraft({
                    draftId: String(prepared.draft_id),
                    revision: Number(prepared.revision),
                    decision: preparedDecision,
                    progressSnapshotHash: String(prepared.progress_snapshot_hash || ''),
                });
                setAiSuggestion(preparedDecision.assessment?.rendered_text || preparedDecision.response);
                setAiDecision(null);
                setFinalMode('tutoring');
                setCurrentSuggestionContext(null);
                return;
            }

            const result = await generateTutorSuggestion(
                currentRoom.id,
                user.id,
                undefined,
                {
                    // Same student line the tutor is responding to in the UI
                    focusStudentMessage: parentMessageContent || prompt
                }
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to generate AI response');
            }

            if (!result.decision) {
                throw new Error('AI response did not contain a structured tutor decision');
            }

            if (result.decision.mode === 'multiagent') {
                applyMultiAgentDraft(result.decision, parentMessageId, parentMessageContent, result);
                return;
            }

            // Store the AI suggestion for the tutor
            if (result.suggestion) {
                applySingleAgentSuggestion(result.decision, result.suggestion, parentMessageId, parentMessageContent, result);
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
            const studentToneLock = aiConfig?.prompt_config?.student_tone_lock;
            const lockedRole = studentToneLock?.locked
                ? studentToneLock.chosen_role
                : undefined;
            const effectiveParameterOverrides = lockedRole
                ? { ...parameterOverrides, role: { role: lockedRole } }
                : parameterOverrides;

            // Mark the current suggestion as modified/ignored
            if (aiSuggestion) {
                await recordAIFeedback('modified');
            }

            // Generate new suggestion with parameter overrides
            const result = await generateTutorSuggestion(
                currentRoom.id,
                user.id,
                effectiveParameterOverrides,
                {
                    focusStudentMessage: currentSuggestionContext.parentMessageContent
                }
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to regenerate AI response');
            }

            if (result.appliedConfig) {
                const savedConfig = await updateAIConfig(currentRoom.id, {
                    model_name: result.appliedConfig.model_name ?? undefined,
                    system_prompt: result.appliedConfig.system_prompt,
                    prompt_config: result.appliedConfig.prompt_config,
                    temperature: result.appliedConfig.temperature ?? undefined,
                    max_tokens: result.appliedConfig.max_tokens ?? undefined,
                    is_active: true
                }, user.id, 'suggestion_regeneration');

                setAiConfig(savedConfig);
                setCurrentRoom(prevRoom => prevRoom ? {
                    ...prevRoom,
                    ai_assistant_model: savedConfig.model_name,
                    ai_assistant_prompt: savedConfig.system_prompt,
                    updated_at: savedConfig.updated_at
                } : prevRoom);
            }

            // Update the AI suggestion
            if (result.suggestion) {
                if (!result.decision) {
                    throw new Error('AI response did not contain a structured tutor decision');
                }

                if (result.decision.mode === 'multiagent') {
                    applyMultiAgentDraft(
                        result.decision,
                        currentSuggestionContext.parentMessageId,
                        currentSuggestionContext.parentMessageContent,
                        result
                    );
                } else {
                    const finalMode = toRoomParticipationMode(result.decision.mode);
                    setAiSuggestion(result.suggestion);
                    setAiDecision(result.decision);
                    setFinalMode(finalMode);

                    // Update context with new generation time
                    setCurrentSuggestionContext({
                        ...currentSuggestionContext,
                        rawDecision: result.decision,
                        finalMode,
                        finalResponse: result.decision.suggested_response,
                        startTime: Date.now(),
                        contextMessages: result.contextMessages,
                        aiConfigSnapshot: result.appliedConfig
                    });
                }
            }
        } catch (error) {
            console.error('Failed to regenerate AI response:', error);
            throw error;
        } finally {
            setLoadingAI(false);
        }
    };

    /**
     * Regenerate the current Multi-agent draft through the ordinary generation path.
     * The regenerated turn may come back as a single-Tutor decision; whichever decision
     * returns decides which reviewer UI is shown. A failed attempt keeps the edited draft.
     */
    const regenerateMultiAgentDraft = async (): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }
        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can regenerate AI responses');
        }
        if (!multiAgentDraft) {
            throw new Error('No Multi-agent draft to regenerate');
        }

        const draft = multiAgentDraft;
        // Regeneration answers the learner's latest turn, which may have moved on during review.
        const latestLearnerMessage = messages
            .filter(message => message.user_role === 'student' && !message.is_ai_generated)
            .slice(-1)[0];
        const parentMessageId = latestLearnerMessage?.id || draft.parentMessageId;
        const parentMessageContent = latestLearnerMessage?.content || draft.parentMessageContent;

        setLoadingAI(true);
        try {
            const result = await generateTutorSuggestion(
                currentRoom.id,
                user.id,
                undefined,
                { focusStudentMessage: parentMessageContent }
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to regenerate AI response');
            }
            if (!result.decision) {
                throw new Error('AI response did not contain a structured tutor decision');
            }

            if (result.decision.mode === 'multiagent') {
                applyMultiAgentDraft(result.decision, parentMessageId, parentMessageContent, result);
                return;
            }

            applySingleAgentSuggestion(
                result.decision,
                result.suggestion,
                parentMessageId,
                parentMessageContent,
                result
            );
        } catch (error) {
            console.error('Failed to regenerate Multi-agent response:', error);
            throw error;
        } finally {
            setLoadingAI(false);
        }
    };

    const rejectMultiAgentDraft = async (): Promise<void> => {
        if (!multiAgentDraft) return;
        clearAISuggestion();
    };

    /**
     * Persist an approved two-character pair as ordinary AI-generated tutor messages.
     * Row 1 keeps the approval time; row 2 is future-dated by the playback delay.
     */
    const approveMultiAgentDraft = async (editedMessages: [string, string]): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }
        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can approve AI responses');
        }
        const draft = multiAgentDraft;
        if (!draft) {
            throw new Error('No Multi-agent draft to approve');
        }
        if (editedMessages.some((content) => !content.trim())) {
            throw new Error('Both character messages are required');
        }

        // Stale draft: the learner moved the conversation forward while the tutor reviewed.
        const latestLearnerMessage = messages
            .filter(message => message.user_role === 'student' && !message.is_ai_generated)
            .slice(-1)[0];
        if (!latestLearnerMessage || latestLearnerMessage.id !== draft.parentMessageId) {
            throw new Error('The learner sent a newer message, so this draft is stale. Regenerate before approving.');
        }

        const approvalTime = Date.now();
        const rows = draft.generatedMessages.map((generated, index) => ({
            room_id: currentRoom.id,
            user_id: user.id,
            user_role: 'tutor' as UserRole,
            is_ai_generated: true,
            ai_model_used: draft.aiConfigSnapshot?.model_name || currentRoom.ai_assistant_model || DEFAULT_AI_MODEL,
            ai_response_time_ms: approvalTime - draft.startTime,
            parent_message_id: draft.parentMessageId.startsWith('prepop-') ? null : draft.parentMessageId,
            response_mode: 'tutoring' as TutorResponseMode,
            content: formatAgentTaggedContent(generated.character, editedMessages[index]),
            created_at: new Date(approvalTime + index * MULTI_AGENT_PLAYBACK_DELAY_MS).toISOString()
        }));

        const { data, error } = await supabase.from('messages').insert(rows).select();
        if (error) {
            throw new Error(`Failed to store the approved Multi-agent response: ${error.message}`);
        }
        if (!data || data.length !== rows.length) {
            throw new Error('Approved Multi-agent response was not stored as a complete pair');
        }

        const stored = [...(data as Message[])].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        setMessages(prev => [
            ...prev,
            ...stored.map(message => addDisplayNameToMessage(message, participants))
        ]);
        clearAISuggestion();
    };

    const setStudentAITone = async (choice: StudentAIChoice): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }
        if (user.current_role !== 'student') {
            throw new Error('Only students can set AI tone preference');
        }

        setLoadingAI(true);
        try {
            const savedConfig = await persistStudentAITone({
                roomId: currentRoom.id,
                userId: user.id,
                tone: choice,
                participants,
                aiEnabled: Boolean(currentRoom.ai_assistant_enabled),
            });
            setAiConfig(savedConfig);
            setCurrentRoom((prevRoom) =>
                prevRoom
                    ? {
                          ...prevRoom,
                          ai_assistant_model: savedConfig.model_name,
                          ai_assistant_prompt: savedConfig.system_prompt,
                          updated_at: savedConfig.updated_at,
                      }
                    : prevRoom
            );
        } finally {
            setLoadingAI(false);
        }
    };

    const setResponseMode = async (mode: TutorResponseMode): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }
        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can change Guard Mode');
        }

        const updatedRoom = await setRoomResponseMode(currentRoom.id, user.id, mode);
        setCurrentRoom(normalizeRoom(updatedRoom));
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
            let savedConfig: AIAssistantConfig | null = null;

            if (enabled) {
                const aiModel = config?.model_name || DEFAULT_AI_MODEL;
                const aiPrompt = config?.system_prompt ||
                    'You are a helpful AI assistant in an educational tutoring session. ' +
                    'Provide clear, educational responses to help students learn. ' +
                    'Be encouraging, patient, and focus on building understanding.';

                savedConfig = await updateAIConfig(currentRoom.id, {
                    model_name: aiModel,
                    system_prompt: aiPrompt,
                    prompt_config: config?.prompt_config ?? null,
                    temperature: config?.temperature || 0.7,
                    max_tokens: config?.max_tokens || 150,
                    is_active: true
                }, user.id, 'settings_enable');
            } else {
                savedConfig = await updateAIConfig(currentRoom.id, {
                    system_prompt: null,
                    is_active: false
                }, user.id, 'settings_disable');
            }

            const { data: updatedRoom, error: roomError } = await supabase
                .from('rooms')
                .select('*')
                .eq('id', currentRoom.id)
                .single();

            if (roomError) throw roomError;
            setCurrentRoom(updatedRoom);
            setAiConfig(savedConfig);
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

    const downloadChatHistory = async (format: 'txt' | 'json' = 'txt') => {
        if (!currentRoom || !messages) return;

        const roomTitle = currentRoom.title.replace(/\s+/g, '_');
        const timestamp = new Date().toISOString().split('T')[0];
        
        // Only include AI data for tutors
        const isTutor = user?.current_role === 'tutor';
        
        if (format === 'json') {
            // Get feedback summary for the room
            let feedbackSummary = null;
            try {
                feedbackSummary = await getRoomFeedbackSummary(currentRoom.id);
            } catch (error) {
                console.warn('Failed to get room feedback summary:', error);
            }

            const exportData = buildRoomExportData({
                room: currentRoom,
                messages,
                messageFeedbackStats,
                feedbackSummary,
                aiInteractions,
                isTutor
            });
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filename = `${roomTitle}_chat_export_${timestamp}.json`;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            } else {
            const content = buildRoomTextExport({
                room: currentRoom,
                messages,
                messageFeedbackStats,
                aiInteractions,
                isTutor
            });

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
        setAiDecision(null);
        setTransferDraft(null);
        setMultiAgentDraft(null);
        setFinalMode('tutoring');
        setCurrentSuggestionContext(null);
    };

    const confirmTransferDraft = async (decision: TutorDecisionV3): Promise<void> => {
        if (!transferDraft) throw new Error('No transfer assessment draft is available');
        const reviewed = await transferAssessmentService.reviewDraft({
            draftId: transferDraft.draftId,
            expectedRevision: transferDraft.revision,
            finalPayload: decision,
            contentConfirmed: true,
        });
        const sent = await transferAssessmentService.sendReviewed({
            draftId: transferDraft.draftId,
            expectedRevision: Number(reviewed.revision),
            expectedHash: String(reviewed.final_hash),
        });
        const sentMessage = sent.message as Message | undefined;
        if (sentMessage) {
            setMessages(prev => prev.some(message => message.id === sentMessage.id)
                ? prev
                : [...prev, addDisplayNameToMessage(sentMessage, participants)]);
        }
        if (sent.room) setCurrentRoom(normalizeRoom(sent.room as Room));
        clearAISuggestion();
    };

    const updateFinalResponse = (response: string) => {
        setAiSuggestion(response);
        setCurrentSuggestionContext(prev => prev ? { ...prev, finalResponse: response } : prev);
    };

    const updateFinalMode = (mode: TutorResponseMode) => {
        setFinalMode(mode);
        setCurrentSuggestionContext(prev => prev ? { ...prev, finalMode: mode } : prev);
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
                currentSuggestionContext.contextMessages,
                currentSuggestionContext.rawDecision.mode,
                currentSuggestionContext.rawDecision.instruction,
                currentSuggestionContext.rawDecision.mode_reason,
                currentSuggestionContext.finalMode
            );

            // Add to local interactions for export
            const interaction: AIInteraction = {
                timestamp: new Date().toISOString(),
                parent_message_id: currentSuggestionContext.parentMessageId,
                parent_message_content: currentSuggestionContext.parentMessageContent,
                ai_suggestion: aiSuggestion,
                tutor_action: action,
                tutor_final_response: finalResponse,
                response_time_ms: responseTime,
                ai_config_snapshot: currentSuggestionContext.aiConfigSnapshot,
                raw_mode: currentSuggestionContext.rawDecision.mode,
                raw_instruction: currentSuggestionContext.rawDecision.instruction,
                mode_reason: currentSuggestionContext.rawDecision.mode_reason,
                final_mode: currentSuggestionContext.finalMode,
                mode_rectified: currentSuggestionContext.rawDecision.mode !== currentSuggestionContext.finalMode
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
            await refreshMessageFeedbackStats(messageId);

            try {
                channelRef.current?.send({
                    type: 'broadcast',
                    event: 'message_feedback_changed',
                    payload: {
                        messageId
                    }
                });
            } catch (broadcastError) {
                console.warn('Failed to broadcast message feedback change:', broadcastError);
            }
            
        } catch (error) {
            console.error('Failed to submit message feedback:', error);
            throw error;
        }
    };

    const handleGetMessageFeedbackStats = async (messageId: string): Promise<MessageFeedbackStats | null> => {
        return refreshMessageFeedbackStats(messageId);
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
        setResponseMode,
        generateAIResponse,
        regenerateAIResponse,
        toggleAIAssistant,
        setStudentAITone,
        startTyping,
        stopTyping,
        aiConfig,
        loadingAI,
        downloadChatHistory,
        clearChatHistory,
        aiSuggestion,
        aiDecision,
        transferDraft,
        confirmTransferDraft,
        finalMode,
        updateFinalResponse,
        updateFinalMode,
        clearAISuggestion,
        multiAgentDraft,
        approveMultiAgentDraft,
        regenerateMultiAgentDraft,
        rejectMultiAgentDraft,
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

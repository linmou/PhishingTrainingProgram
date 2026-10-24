import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { RoomContextType, Room, Message, UserRole, AIAssistantConfig, AIAssistantConfigSnapshot, TypingIndicator, User, AIInteraction, StudentAIChoice, TutorActionDecision, TutorResponseMode, TransferAssessmentDraft } from '../types';
import type { AssessmentOptionId } from '../types/assessment';
import type { CyberbullyingCharacter, CyberbullyingSuggestion } from '../types';
import type { LearningTargetInput } from '../types/checklist';
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
    validateRoomPassword,
    submitMessageFeedback,
    getRoomFeedbackSummary,
    clearChatHistory as clearChatHistoryService
} from '../services/supabase';
import { sendReviewedTutorResponse, setRoomGuardMode } from '../services/guardModeService';
import { ChecklistService } from '../services/checklistService';
import { transferAssessmentService } from '../services/transferAssessmentService';
import {
  answerLifecycleFromProcessed,
  assertDeliverableReview,
  createReviewCandidate,
  findOpenLearnerAssessment,
  mergeRoomMessages,
    participationModeFromRoom,
    projectRoomMessage,
    publicAssessmentForDecision,
    readAnswerLifecycle,
    readAssessmentId,
    withAnswerLifecycle,
} from './transferAssessmentUiAdapter';
import type { AnswerLifecycleView, RoomMessageView } from './transferAssessmentUiAdapter';
import { ParameterOverrides } from '../components/AISuggestionBox';
import { buildRoomExportData, buildRoomTextExport } from './roomExportBuilder';
import { useMessageFeedback } from '../hooks/useMessageFeedback';
import { readRoomMessagePages, startRoomMessageSync } from './roomMessageSync';

const RoomContext = createContext<RoomContextType | undefined>(undefined);

function preferredQuestionLifecycle(
    question: RoomMessageView,
    incoming: AnswerLifecycleView
): AnswerLifecycleView {
    const current = readAnswerLifecycle(question);
    const currentIsAcceptedTerminal = current?.terminal === true &&
        (current.answerOutcome === 'passed' || current.answerOutcome === 'failed');
    const incomingHasNoAcceptedAttempt = incoming.answerOutcome === null ||
        incoming.attemptNumber === null || !incoming.terminal;

    return currentIsAcceptedTerminal && incomingHasNoAcceptedAttempt ? current : incoming;
}

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
    const [cyberbullyingDraft, setCyberbullyingDraft] = useState<CyberbullyingSuggestion | null>(null);
    const [finalCharacter, setFinalCharacter] = useState<CyberbullyingCharacter | null>(null);
    const generationEpoch = useRef(0);
    const activeRoomId = useRef<string | null>(null);
    const joinEpoch = useRef(0);
    const joinController = useRef<AbortController | null>(null);
    const joinRealtimeIds = useRef(new Set<string>());
    useEffect(() => () => { joinEpoch.current += 1; joinController.current?.abort(); }, []);
    activeRoomId.current = currentRoom?.id ?? null;
    const [transferDraft, setTransferDraft] = useState<{
        decision: TransferAssessmentDraft;
        progressSnapshotHash: string;
        roomId: string;
        studentId: string;
        checklistId: string;
        itemId: string;
        focusStudentMessageId: string;
        itemLabel?: string;
    } | null>(null);
    const [finalGuardMode, setFinalGuardMode] = useState<TutorResponseMode>(false);
    const [aiInteractions, setAIInteractions] = useState<AIInteraction[]>([]);
    const [currentSuggestionContext, setCurrentSuggestionContext] = useState<{ 
        rawDecision: TutorActionDecision;
        finalGuardMode: TutorResponseMode;
        finalResponse: string;
        parentMessageId: string; 
        parentMessageContent: string;
        startTime: number;
        contextMessages: string[];
        aiConfigSnapshot?: AIAssistantConfigSnapshot;
    } | null>(null);
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const channelRef = useRef<any>(null);
    // True while a reviewed delivery is in flight, so one tab cannot deliver twice.
    const deliveryInFlightRef = useRef(false);
    const { user } = useAuth();
    const { messageFeedbackStats, getMessageFeedbackStats: handleGetMessageFeedbackStats,
        refreshMessageFeedbackStats, resetFeedback } = useMessageFeedback(currentRoom?.id, user?.id, messages);

    const normalizeRoom = useCallback((room: Room): Room => {
        if (!room.guard_mode) {
            return room;
        }

        return {
            ...room,
            guard_mode_changed_at: room.guard_mode_changed_at || null,
            guard_mode_change_source: room.guard_mode_change_source || null
        };
    }, []);

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
                avatar_url: message.avatar_url || null
            };
        }
        
        const isGuardMessage = message.response_mode === 'guard';
        return {
            ...message,
            display_name: message.persona_name || (isGuardMessage ? 'Security Supervisor' : message.user_id === user?.id ? (user?.display_name || 'User') :
                         messageUser?.display_name || 
                         (message.user_role === 'tutor' ? 'Tutor' :
                          message.user_role === 'student' ? 'Student' : 'Observer')),
            avatar_url: message.persona_avatar || (isGuardMessage ? null : message.user_id === user?.id ? user?.avatar_url : messageUser?.avatar_url)
        };
    }, [user?.id, user?.display_name, user?.avatar_url]);

    // Mutable presentation/feedback callbacks must not recreate the room subscription.
    const syncCallbacks = useRef({ addDisplayNameToMessage, participants, handleFeedbackRealtime, refreshMessageFeedbackStats });
    syncCallbacks.current = { addDisplayNameToMessage, participants, handleFeedbackRealtime, refreshMessageFeedbackStats };
    const currentRoomId = currentRoom?.id;

    // Real-time subscription for messages and typing indicators
    useEffect(() => {
        if (!currentRoomId) return;
        const roomId = currentRoomId;
        let cancelled = false;
        const sync = startRoomMessageSync(roomId, rows => {
            if (cancelled || activeRoomId.current !== roomId) return;
            const callbacks = syncCallbacks.current;
            const incoming = rows.map(row => callbacks.addDisplayNameToMessage(projectRoomMessage(row), callbacks.participants));
            setMessages(prev => mergeRoomMessages(prev.filter(message => message.room_id === roomId), incoming));
        });

        console.log('🔴 Setting up real-time subscription for room:', roomId);

        const channel = supabase.channel(`room_${roomId}`);
        
        channel
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `room_id=eq.${roomId}`
                },
                (payload) => {
                    console.log('🟢 Real-time message received:', payload);
                    const newMessage = payload.new as any;
                    if (!cancelled) joinRealtimeIds.current.add(String(newMessage.id));
                    // Project before the row enters React state: a stored row can carry the
                    // private assessment key, and only allowlisted fields may be retained.
                    sync.realtime(newMessage);
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
                payload => {
                    if (!cancelled) joinRealtimeIds.current.add(String((payload.new as any).id));
                    sync.realtime(payload.new as any);
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rooms',
                    filter: `id=eq.${roomId}`
                },
                (payload) => {
                    if (cancelled || activeRoomId.current !== roomId) return;
                    const incoming = payload.new as Room;
                    const mode = participationModeFromRoom(incoming);
                    // Room participation stays binary: an unrecognized value is never adopted as
                    // a mode, while the rest of the room row is still applied.
                    setCurrentRoom(prev => normalizeRoom({
                        ...incoming,
                        guard_mode: mode ?? prev?.guard_mode ?? false,
                    }));
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'message_feedback',
                    filter: `room_id=eq.${roomId}`
                },
                payload => { if (!cancelled) void syncCallbacks.current.handleFeedbackRealtime(payload); }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'message_feedback',
                    filter: `room_id=eq.${roomId}`
                },
                payload => { if (!cancelled) void syncCallbacks.current.handleFeedbackRealtime(payload); }
            )
            .on('broadcast', { event: 'message_feedback_changed' }, (payload) => {
                const feedbackMessageId = payload?.payload?.messageId;
                if (!feedbackMessageId) return;

                if (!cancelled) void syncCallbacks.current.refreshMessageFeedbackStats(feedbackMessageId);
            })
            .on('broadcast', { event: 'typing_start' }, (payload) => {
                if (cancelled) return;
                const { userId, displayName } = payload.payload;
                if (userId !== user?.id) {
                    setTypingUsers(prev => {
                        const filtered = prev.filter(t => t.userId !== userId);
                        return [...filtered, { userId, displayName, timestamp: Date.now() }];
                    });
                }
            })
            .on('broadcast', { event: 'typing_stop' }, (payload) => {
                if (cancelled) return;
                const { userId } = payload.payload;
                setTypingUsers(prev => prev.filter(t => t.userId !== userId));
            })
            .subscribe((status) => {
                console.log('📡 Subscription status:', status);
                sync.status(status);
            });

        // Store channel reference
        channelRef.current = channel;

        return () => {
            cancelled = true;
            sync.stop();
            console.log('🔴 Unsubscribing from real-time channel');
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, [currentRoomId, user?.id, normalizeRoom]);

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
        const epoch = ++joinEpoch.current;
        joinRealtimeIds.current = new Set();
        joinController.current?.abort();
        const controller = new AbortController();
        joinController.current = controller;
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
            const messagesData: Record<string, any>[] = [];
            await readRoomMessagePages(roomId, controller.signal, rows => messagesData.push(...rows));
            if (controller.signal.aborted) return;

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
                        ai_model_used: null,
                        ai_response_time_ms: null,
                        parent_message_id: null,
                        created_at: baseTimestamp.toISOString(),
                        display_name: item.user_name,
                        persona_id: item.persona_id || null,
                        persona_name: item.user_name,
                        persona_avatar: item.avatar_url || null,
                        avatar_url: item.avatar_url || null
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

            // Add display_name and avatar_url to existing messages, projecting each stored row
            // onto the allowlisted message view first.
            const messagesWithDisplayName = (messagesData || []).map(msg =>
                addDisplayNameToMessage(projectRoomMessage(msg), participantsData || []));

            // Combine pre-populated messages with existing messages.
            const allMessages = mergeRoomMessages([], [...prePopulatedMessages, ...messagesWithDisplayName]);

            // Re-read the server's idempotent result for this learner's persisted assessment
            // answers so lifecycle feedback is available after reload or reconnect.
            if (user?.current_role === 'student' && user.id) {
                for (const answer of allMessages) {
                    if (answer.user_id !== user.id || answer.user_role !== 'student' || !answer.parent_message_id) {
                        continue;
                    }

                    const questionIndex = allMessages.findIndex(message => {
                        const publicQuestion = (message as Partial<RoomMessageView>).publicQuestion;
                        return (
                            message.id === answer.parent_message_id &&
                            publicQuestion?.studentId === user.id &&
                            Boolean(publicQuestion.id)
                        );
                    });
                    if (questionIndex < 0) continue;

                    const question = allMessages[questionIndex] as RoomMessageView;
                    const assessmentId = question.publicQuestion?.id;
                    if (!assessmentId || readAssessmentId(answer) !== assessmentId) continue;

                    try {
                        const processed = await transferAssessmentService.processMessage(answer.id, assessmentId);
                        if (processed.message_id !== answer.id || processed.assessment_id !== assessmentId) {
                            continue;
                        }

                        const lifecycle = answerLifecycleFromProcessed(processed);
                        const answerIndex = allMessages.findIndex(message => message.id === answer.id);
                        if (answerIndex >= 0) {
                            allMessages[answerIndex] = withAnswerLifecycle(
                                allMessages[answerIndex] as RoomMessageView,
                                lifecycle
                            );
                        }
                        allMessages[questionIndex] = withAnswerLifecycle(
                            question,
                            preferredQuestionLifecycle(question, lifecycle)
                        );
                        if (processed.result_message && !allMessages.some(message => message.id===processed.result_message?.id)) {
                            allMessages.push(addDisplayNameToMessage(projectRoomMessage(processed.result_message as unknown as Record<string,unknown>),participantsData || []));
                        }
                    } catch (restoreError) {
                        console.warn('Could not restore transfer assessment feedback:', restoreError);
                    }
                }
            }

            let restoredAIInteractions: AIInteraction[] = [];
            if (user?.current_role === 'tutor') {
                try {
                    const feedbackQuery = supabase
                        .from('ai_suggestion_feedback')
                        .select('*')
                        .eq('room_id', roomId);
                    const feedbackResult = typeof (feedbackQuery as any).order === 'function'
                        ? await (feedbackQuery as any).order('created_at', { ascending: true })
                        : { data: [], error: null };
                    if (feedbackResult.error) {
                        console.warn('Could not restore AI suggestion feedback:', feedbackResult.error);
                    } else {
                        restoredAIInteractions = (feedbackResult.data || []).map((feedback: any) => ({
                            timestamp: feedback.created_at,
                            parent_message_id: feedback.parent_message_id,
                            parent_message_content: allMessages.find((message) => message.id === feedback.parent_message_id)?.content || '',
                            ai_suggestion: feedback.ai_suggestion,
                            tutor_action: feedback.tutor_action,
                            tutor_final_response: feedback.tutor_final_response ?? undefined,
                            response_time_ms: feedback.response_time_ms ?? undefined,
                            raw_guard_mode: feedback.raw_guard_mode,
                            raw_instruction: feedback.raw_instruction,
                            guard_reason: feedback.guard_reason,
                            final_guard_mode: feedback.final_guard_mode,
                            guard_rectified: feedback.guard_rectified,
                            raw_character: feedback.raw_character,
                            final_character: feedback.final_character,
                            tutor_id: feedback.tutor_id,
                            tutor_message_id: feedback.tutor_message_id,
                            generation_provenance: feedback.generation_provenance,
                        }));
                    }
                } catch (feedbackLoadError) {
                    console.warn('Could not restore AI suggestion feedback:', feedbackLoadError);
                }
            }

            if (epoch !== joinEpoch.current) return;
            setCurrentRoom(normalizeRoom(roomData));
            // Merge rather than replace: a realtime insert that arrived before this fetch
            // completed must survive it.
            const realtimeIds = joinRealtimeIds.current;
            setMessages(prev => mergeRoomMessages(
                mergeRoomMessages(prev.filter(message => message.room_id === roomId), allMessages),
                prev.filter(message => message.room_id === roomId && realtimeIds.has(message.id))
            ));
            setParticipants(participantsData || []);
            setAIInteractions(restoredAIInteractions);
        } finally {
            if (epoch === joinEpoch.current) setLoading(false);
        }
    }, [addDisplayNameToMessage, normalizeRoom, user?.id, user?.current_role]);

    const leaveRoom = useCallback(async (): Promise<void> => {
        joinEpoch.current += 1;
        joinController.current?.abort();
        activeRoomId.current = null;
        setCurrentRoom(null);
        setMessages([]);
        setParticipants([]);
        setAiConfig(null);
    }, []);

    const sendMessage = async (
        content: string,
        options?: { replyToMessageId?: string; assessmentId?: string; selectedOptionIds?: AssessmentOptionId[] }
    ): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role === 'observer') {
            throw new Error('Observers cannot send messages');
        }

        if (user.current_role === 'student') {
            const activeQuestion = findOpenLearnerAssessment(messages, user.id);
            if (activeQuestion || options?.assessmentId || options?.selectedOptionIds) {
                const question = activeQuestion?.publicQuestion;
                const selected = options?.selectedOptionIds;
                const canonicalSelection = question?.options
                    .filter(option => selected?.includes(option.id))
                    .map(option => option.id);
                if (!question || options?.assessmentId !== question.id ||
                    options?.replyToMessageId !== activeQuestion?.id || !selected?.length ||
                    canonicalSelection?.length !== selected.length ||
                    canonicalSelection.some((id, index) => id !== selected[index]) ||
                    (question.selectionType === 'single' && selected.length !== 1)) {
                    throw new Error('ASSESSMENT_OPTIONS_REQUIRED: Choose an option in your assessment and submit your answer.');
                }
            }
        }

        // Assessment answers always use the trusted API boundary. Ordinary messages
        // retain the legacy path when there is no owner-scoped transfer checklist.
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
            if (currentRoom.transfer_learning_enabled) throw transferError;
            console.warn('Transfer checklist unavailable; using legacy message path:', transferError);
        }
        if (user.current_role === 'student' && (currentRoom.practice_type === 'cyberbullying' || options?.assessmentId ||
            (currentRoom.transfer_learning_enabled && transferChecklist?.progress_policy_version === 'transfer_v1'))) {
            const answerOptions = options;
            const result = await transferAssessmentService.postMessage({
                roomId: currentRoom.id,
                content,
                replyToMessageId: answerOptions?.replyToMessageId,
                assessmentId: answerOptions?.assessmentId,
                selectedOptionIds: answerOptions?.selectedOptionIds,
            });
            const storedRow = result.message as Record<string, unknown> | undefined;
            if (!storedRow) {
                throw new Error('Transfer message operation did not return a stored message');
            }
            // Project the stored row before it enters React state: the row is a raw messages
            // record and can carry the private assessment key.
            const storedMessage = projectRoomMessage(storedRow);
            setMessages(prev => mergeRoomMessages(prev, [addDisplayNameToMessage(storedMessage, participants)]));
            if (user.current_role === 'student') {
                const analyzeEvidence = async () => {
                    try {
                        await ChecklistService.analyzeStudentMessages(currentRoom.id, user.id, storedMessage.id, user.id);
                    } catch (analysisError) {
                        console.warn('Transfer evidence analysis unavailable; message was stored:', analysisError);
                    }
                };
                if (answerOptions?.assessmentId) {
                    const processed = await transferAssessmentService.processMessage(
                        storedMessage.id,
                        answerOptions.assessmentId
                    );
                    if (
                        processed.message_id !== storedMessage.id ||
                        processed.assessment_id !== answerOptions.assessmentId ||
                        storedMessage.parent_message_id !== answerOptions.replyToMessageId
                    ) {
                        throw new Error('Assessment processing returned mismatched answer, assessment, or parent identity');
                    }
                    // Keep the trusted result on the answer and its question so the answer surface
                    // can render feedback and the question can disable another submission.
                    const lifecycle = answerLifecycleFromProcessed(processed);
                    const answerWithLifecycle = addDisplayNameToMessage(
                        withAnswerLifecycle(storedMessage, lifecycle),
                        participants
                    );
                    setMessages(prev => {
                        const question = prev.find(message => {
                            const view = message as Partial<RoomMessageView>;
                            const publicQuestion = view.publicQuestion;
                            return (
                                message.id === storedMessage.parent_message_id &&
                                publicQuestion?.id === processed.assessment_id &&
                                publicQuestion.studentId === user.id
                            );
                        }) as RoomMessageView | undefined;
                        const incoming = [answerWithLifecycle];
                        if (processed.result_message) incoming.push(addDisplayNameToMessage(
                            projectRoomMessage(processed.result_message as unknown as Record<string,unknown>),participants
                        ));
                        if (question) {
                            incoming.push(addDisplayNameToMessage(
                                withAnswerLifecycle(question, preferredQuestionLifecycle(question, lifecycle)),
                                participants
                            ));
                        }
                        return mergeRoomMessages(prev, incoming);
                    });
                } else {
                    await analyzeEvidence();
                }
            }
            return;
        }

        console.log('Sending message:', { roomId: currentRoom.id, userId: user.id, content });

        if (currentRoom.practice_type === 'cyberbullying' && user.current_role === 'tutor' &&
            (!cyberbullyingDraft || !currentSuggestionContext || !aiDecision || !aiSuggestion || !finalCharacter)) {
            throw new Error('Generate and review a character reply before sending.');
        }
        if (user.current_role === 'tutor' && currentSuggestionContext && aiDecision && aiSuggestion) {
            const tutorAction = content.trim() === currentSuggestionContext.rawDecision.suggested_response.trim() &&
                (!cyberbullyingDraft || finalCharacter === cyberbullyingDraft.raw_character)
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
                finalGuardMode,
                finalResponse: content,
                tutorAction,
                responseTimeMs,
                contextMessages: currentSuggestionContext.contextMessages,
                rawCharacter: cyberbullyingDraft?.raw_character,
                finalCharacter: currentRoom.practice_type === 'cyberbullying' ? finalCharacter : null,
                generationProvenance: cyberbullyingDraft?.generation_provenance,
            });

            setMessages(prev => mergeRoomMessages(prev, [addDisplayNameToMessage(reviewedResult.message, participants)]));
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
                raw_guard_mode: currentSuggestionContext.rawDecision.guard_mode,
                raw_instruction: currentSuggestionContext.rawDecision.instruction,
                guard_reason: currentSuggestionContext.rawDecision.guard_reason,
                final_guard_mode: finalGuardMode,
                guard_rectified: currentSuggestionContext.rawDecision.guard_mode !== finalGuardMode,
                raw_character: cyberbullyingDraft?.raw_character,
                final_character: cyberbullyingDraft ? finalCharacter : undefined,
                tutor_id: user.id,
                tutor_message_id: reviewedResult.message.id,
                generation_provenance: cyberbullyingDraft?.generation_provenance,
            }]);
            clearAISuggestion();
            return;
        }

        const responseMode = user.current_role === 'tutor'
            ? currentRoom.guard_mode ? 'guard' : 'tutoring'
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
            ai_model_used: null,
            ai_response_time_ms: null,
            parent_message_id: parentMessageId,
            created_at: new Date().toISOString(),
            display_name: user.display_name || 'User',
            avatar_url: user.avatar_url,
            response_mode: responseMode
        };

        // Add message optimistically
        setMessages(prev => mergeRoomMessages(prev, [optimisticMessage]));

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
            const persistedMessage = addDisplayNameToMessage(
                projectRoomMessage(data as Record<string, unknown>),
                participants
            );
            setMessages(prev => mergeRoomMessages(
                prev.filter(message => message.id !== optimisticMessage.id),
                [persistedMessage]
            ));
            if (user.current_role === 'student') {
                try {
                    // Targets can be initialized while this earlier ordinary insert is in flight.
                    if (currentRoom.transfer_learning_enabled && !transferChecklist) {
                        transferChecklist = await ChecklistService.getChecklistForStudent(currentRoom.id, user.id);
                    }
                    if (currentRoom.transfer_learning_enabled && transferChecklist?.progress_policy_version === 'transfer_v1') {
                        await ChecklistService.analyzeStudentMessages(currentRoom.id, user.id, persistedMessage.id, user.id);
                    } else {
                        await ChecklistService.processStudentMessage(
                            currentRoom.id,
                            content,
                            persistedMessage.id,
                            messages.filter(message => !message.id.startsWith('temp-')).map(message => ({
                                role: message.user_role === 'student' ? 'user' : 'assistant',
                                content: message.content,
                                timestamp: Math.floor(new Date(message.created_at).getTime() / 1000)
                            }))
                        );
                    }
                } catch (analysisError) {
                    console.warn('Checklist analysis unavailable; message was stored:', analysisError);
                }
            }
        }
    };

    /** Store one ordinary single-Tutor (tutoring or Guard) suggestion for human review. */
    const applySingleAgentSuggestion = (
        decision: TutorActionDecision,
        suggestion: string,
        parentMessageId: string,
        parentMessageContent: string,
        result: { contextMessages: string[]; appliedConfig?: AIAssistantConfigSnapshot; cyberbullyingDraft?: CyberbullyingSuggestion }
    ) => {
        const finalGuardMode = decision.guard_mode;
        setCyberbullyingDraft(result.cyberbullyingDraft ?? null);
        setFinalCharacter(result.cyberbullyingDraft?.raw_character ?? null);
        setAiSuggestion(suggestion);
        setAiDecision(decision);
        setFinalGuardMode(finalGuardMode);
        setCurrentSuggestionContext({
            rawDecision: decision,
            finalGuardMode,
            finalResponse: decision.suggested_response,
            parentMessageId,
            parentMessageContent,
            startTime: Date.now(),
            contextMessages: result.contextMessages,
            aiConfigSnapshot: result.appliedConfig
        });
    };

    const generateCyberbullyingResponse = async (regenerate: boolean): Promise<void> => {
        if (!currentRoom || !user || currentRoom.tutor_id !== user.id || user.current_role !== 'tutor') {
            throw new Error('Only the room tutor can generate a role reply');
        }
        const roomId = currentRoom.id;
        const savedLearnerMessages = messages.filter(message => message.user_role === 'student' &&
            !message.id.startsWith('temp-') && !message.id.startsWith('prepop-'));
        const learnerMessage = regenerate && currentSuggestionContext
            ? savedLearnerMessages.find(message => message.id === currentSuggestionContext.parentMessageId)
            : savedLearnerMessages.slice(-1)[0];
        if (!learnerMessage) throw new Error('A learner comment is needed before generating a reply');
        const epoch = ++generationEpoch.current;
        const selectedCharacter = regenerate ? finalCharacter : null;
        setLoadingAI(true);
        try {
            if (currentSuggestionContext && aiSuggestion) {
                await recordAIFeedback(regenerate ? 'modified' : 'ignored');
                if (!regenerate) {
                    setCyberbullyingDraft(null);
                    setFinalCharacter(null);
                    setAiSuggestion(null);
                    setAiDecision(null);
                    setCurrentSuggestionContext(null);
                }
            }
            await ChecklistService.analyzeStudentMessages(roomId, learnerMessage.user_id, learnerMessage.id, user.id);
            if (epoch !== generationEpoch.current || activeRoomId.current !== roomId) return;
            const result = await generateTutorSuggestion(roomId, user.id, undefined, {
                parentMessageId: learnerMessage.id,
                character: selectedCharacter,
            });
            if (epoch !== generationEpoch.current || activeRoomId.current !== roomId) return;
            if (!result.success || !result.decision || !result.cyberbullyingDraft) {
                throw new Error(result.error || 'Role generation failed. Generate a new suggestion to retry.');
            }
            applySingleAgentSuggestion(result.decision, result.suggestion,
                result.cyberbullyingDraft.parent_message_id, learnerMessage.content, result);
        } finally {
            if (epoch === generationEpoch.current) setLoadingAI(false);
        }
    };
    const createTransferPreparationError = (code: string, message: string, retryable = false) => {
        const error = new Error(`${code}: ${message}`) as Error & { code: string; retryable: boolean };
        error.code = code;
        error.retryable = retryable;
        return error;
    };

    const generateAIResponse = async (
        prompt?: string,
        focusMessageId?: string,
        parameterOverrides?: ParameterOverrides
    ): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }

        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can generate AI responses');
        }

        if (!currentRoom.ai_assistant_enabled) {
            throw new Error('AI assistant is not enabled for this room');
        }

        if (currentRoom.practice_type === 'cyberbullying') {
            await generateCyberbullyingResponse(false);
            return;
        }

        setLoadingAI(true);
        try {
            // If there's an existing suggestion, mark it as ignored
            if (currentSuggestionContext && aiSuggestion) {
                await recordAIFeedback('ignored');
                clearAISuggestion();
            }

            // Keep an explicitly selected focus stable across regeneration.
            let parentMessageId: string | undefined;
            let parentStudentId: string | undefined;
            let parentMessageContent: string = '';
            if (focusMessageId) {
                const selectedMessage = messages.find(m => m.id === focusMessageId && m.user_role === 'student');
                if (!selectedMessage) throw new Error('Selected learner message is no longer available');
                parentMessageId = selectedMessage.id;
                parentStudentId = selectedMessage.user_id;
                parentMessageContent = selectedMessage.content;
                prompt = selectedMessage.content;
            } else if (!prompt) {
                const latestMessage = messages
                    .filter(m => m.user_role === 'student')
                    .slice(-1)[0];

                if (latestMessage) {
                    parentMessageId = latestMessage.id;
                    parentStudentId = latestMessage.user_id;
                    parentMessageContent = latestMessage.content;
                    prompt = latestMessage.content;
                }
            }

            if (!parentMessageId) {
                throw new Error('No student message found to respond to');
            }

            let expectedAssessmentResultIds: string[] = [];
            let transferChecklist: Awaited<ReturnType<typeof ChecklistService.getActiveTransferChecklistForRoom>> | null = null;
            try {
                const checklistService = ChecklistService as typeof ChecklistService & {
                    getActiveTransferChecklistForRoom?: typeof ChecklistService.getActiveTransferChecklistForRoom;
                };
                transferChecklist = await checklistService.getActiveTransferChecklistForRoom?.(currentRoom.id) || null;
            } catch (transferError) {
                if (currentRoom.transfer_learning_enabled) throw transferError;
                console.warn('Transfer preparation unavailable; keeping legacy AI generation:', transferError);
            }
            if (currentRoom.transfer_learning_enabled) {
                if (!transferChecklist ||
                    transferChecklist.detection_areas.length + transferChecklist.verification_steps.length === 0) {
                    throw createTransferPreparationError(
                        'TARGET_SETUP_REQUIRED',
                        'Add at least one learning target in Learning Progress before generating an assessment.'
                    );
                }
                const checklistOwnerId = transferChecklist.student_id;
                const checklistOwnerMessage = focusMessageId
                    ? messages.find(message => message.id === focusMessageId && message.user_id === checklistOwnerId)
                    : messages.filter(message => message.user_role === 'student' && message.user_id === checklistOwnerId).slice(-1)[0];
                if (!checklistOwnerMessage) {
                    throw createTransferPreparationError(
                        'WRONG_LEARNER',
                        'The active learning progress belongs to a learner without a message in this room.'
                    );
                }
                parentMessageId = checklistOwnerMessage.id;
                parentStudentId = checklistOwnerMessage.user_id;
                parentMessageContent = checklistOwnerMessage.content;
                // Assessment answers already belong to the grading lifecycle. Re-analyzing
                // them as ordinary learning evidence is rejected by the trusted API.
                const assessmentId = readAssessmentId(checklistOwnerMessage);
                const isAssessmentAnswer = Boolean(assessmentId);
                const readinessAssessmentId = assessmentId ?? [...messages].reverse().map(message =>
                    (message as Partial<RoomMessageView>).publicQuestion
                ).find(question => question?.studentId === checklistOwnerId)?.id;
                if (readinessAssessmentId) {
                    const review = await transferAssessmentService.readReview(currentRoom.id, readinessAssessmentId);
                    const readiness = review.history_readiness;
                    if (!readiness || readiness.ready !== true || !Array.isArray(readiness.result_message_ids) ||
                        !Array.isArray(readiness.pending_answer_message_ids) || readiness.pending_answer_message_ids.length ||
                        !Array.isArray(readiness.unavailable_assessment_ids) || readiness.unavailable_assessment_ids.length) {
                        throw createTransferPreparationError(
                            'ASSESSMENT_RESULT_UNAVAILABLE',
                            'Assessment results are still processing or unavailable. Refresh the room and retry.',
                            true
                        );
                    }
                    expectedAssessmentResultIds = readiness.result_message_ids;
                }
                if (!isAssessmentAnswer) {
                    await ChecklistService.analyzeStudentMessages(currentRoom.id, checklistOwnerMessage.user_id, parentMessageId, user.id);
                }
                const prepared = isAssessmentAnswer ? null : await transferAssessmentService.prepareAssessment({
                    roomId: currentRoom.id,
                    focusStudentMessageId: parentMessageId,
                  checklistId: transferChecklist.id,
                });
                if (prepared) {
                    const candidate = createReviewCandidate(prepared);
                    if (!candidate) {
                        throw createTransferPreparationError(
                            'AI_OUTPUT_INVALID',
                            'Transfer preparation returned an invalid assessment candidate.'
                        );
                    }
                    setTransferDraft({
                        decision: candidate.decision,
                        progressSnapshotHash: String(prepared.progress_snapshot_hash || ''),
                        roomId: candidate.scope.roomId,
                        studentId: candidate.scope.studentId,
                        checklistId: candidate.scope.checklistId,
                        itemId: candidate.scope.itemId,
                        focusStudentMessageId: candidate.scope.focusStudentMessageId,
                        itemLabel: [
                            ...transferChecklist.detection_areas,
                            ...transferChecklist.verification_steps,
                        ].find(item => item.id === candidate.scope.itemId)?.area_text,
                    });
                    setAiSuggestion(candidate.decision.assessment.rendered_text);
                    setAiDecision(null);
                    setFinalGuardMode(false);
                    setCurrentSuggestionContext(null);
                    return;
                }
            }

            const result = await generateTutorSuggestion(
                currentRoom.id,
                user.id,
                parameterOverrides,
                {
                    // Same student line the tutor is responding to in the UI
                    focusStudentMessage: parentMessageContent || prompt,
                    focusStudentId:parentStudentId,
                    expectedAssessmentResultIds,
                }
            );

            if (!result.success) {
                throw new Error(result.error || 'Failed to generate AI response');
            }

            if (!result.decision) {
                throw new Error('AI response did not contain a structured tutor decision');
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

        if (currentRoom.practice_type === 'cyberbullying') {
            await generateCyberbullyingResponse(true);
            return;
        }
        if (currentRoom.transfer_learning_enabled) {
            await generateAIResponse(undefined, currentSuggestionContext.parentMessageId, parameterOverrides);
            return;
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
                    focusStudentMessage: currentSuggestionContext.parentMessageContent,
                    focusStudentId:messages.find(message=>message.id===currentSuggestionContext.parentMessageId)?.user_id,
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

                applySingleAgentSuggestion(result.decision, result.suggestion,
                    currentSuggestionContext.parentMessageId, currentSuggestionContext.parentMessageContent, result);
            }
        } catch (error) {
            console.error('Failed to regenerate AI response:', error);
            throw error;
        } finally {
            setLoadingAI(false);
        }
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

    const setGuardMode = async (mode: TutorResponseMode): Promise<void> => {
        if (!user || !currentRoom) {
            throw new Error('No user or room available');
        }
        if (user.current_role !== 'tutor') {
            throw new Error('Only tutors can change Guard Mode');
        }

        const updatedRoom = await setRoomGuardMode(currentRoom.id, user.id, mode);
        setCurrentRoom(normalizeRoom(updatedRoom));
    };

    const setTransferLearningEnabled = async (enabled: boolean): Promise<void> => {
        if (!currentRoom || !user || user.id !== currentRoom.tutor_id) {
            throw new Error('Only the room tutor can configure transfer learning');
        }
        const { data, error } = await supabase.from('rooms')
            .update({ transfer_learning_enabled: enabled })
            .eq('id', currentRoom.id)
            .eq('tutor_id', user.id)
            .select('*')
            .single();
        if (error) throw error;

        if (enabled) {
            const { data: activeSessions, error: sessionError } = await supabase
                .from('sessions')
                .select('student_id')
                .eq('room_id', currentRoom.id)
                .eq('status', 'active');
            if (sessionError) throw sessionError;

            const studentId = (activeSessions || []).find((session) => session.student_id)?.student_id;
            if (studentId) {
                const legacyChecklist = await ChecklistService.getChecklistByRoom(currentRoom.id);
                if (legacyChecklist) {
                    const items: LearningTargetInput[] = [
                        ...legacyChecklist.detection_areas,
                        ...legacyChecklist.verification_steps,
                    ].map(({ area_text, item_type, priority }) => ({
                        area_text,
                        item_type,
                        priority: priority ?? 'important',
                    }));
                    if (items.length > 0) {
                        await ChecklistService.initializeTransferChecklistForStudent(
                            currentRoom.id,
                            studentId,
                            items,
                        );
                    }
                }
            }
        }
        setCurrentRoom(normalizeRoom(data));
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
        
        const userRole = user?.current_role ?? 'observer';
        const userId = user?.id ?? null;
        const learningProgress = currentRoom.practice_type === 'cyberbullying'
            ? userRole === 'student' && userId
                ? await ChecklistService.getChecklistForStudent(currentRoom.id, userId)
                : await ChecklistService.getActiveTransferChecklistForRoom(currentRoom.id)
            : undefined;
        
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
                participants,
                userRole,
                userId,
                learningProgress,
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
                userRole,
                userId,
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
            resetFeedback();
            
            // Clear AI interactions
            setAIInteractions([]);
            
            console.log('✅ Chat history cleared successfully');
        } catch (error) {
            console.error('❌ Failed to clear chat history:', error);
            throw error;
        }
    };

    const clearAISuggestion = () => {
        generationEpoch.current += 1;
        setCyberbullyingDraft(null);
        setFinalCharacter(null);
        setAiSuggestion(null);
        setAiDecision(null);
        setTransferDraft(null);
        setFinalGuardMode(false);
        setCurrentSuggestionContext(null);
    };

    const confirmTransferDraft = async (decision: TransferAssessmentDraft): Promise<void> => {
        if (!transferDraft) throw new Error('No transfer assessment draft is available');
        if (deliveryInFlightRef.current) {
            throw new Error('A delivery is already in flight for this candidate.');
        }

        const scope = {
            roomId: transferDraft.roomId,
            studentId: transferDraft.studentId,
            checklistId: transferDraft.checklistId,
            itemId: transferDraft.itemId,
            focusStudentMessageId: transferDraft.focusStudentMessageId,
        };
        // Fail closed locally: the server would reject an incompatible payload anyway, and a
        // wrong itemId must never leave the browser.
        const deliverable = assertDeliverableReview(decision, scope);
        if (!deliverable.ok) throw new Error(deliverable.message);

        deliveryInFlightRef.current = true;
        try {
            // No draft row exists, so the reviewed payload and its scope are delivered in one call.
            const sent = await transferAssessmentService.sendReviewed({
                reviewedPayload: decision,
                roomId: scope.roomId,
                studentId: scope.studentId,
                checklistId: scope.checklistId,
                itemId: scope.itemId,
                focusStudentMessageId: scope.focusStudentMessageId,
            });
            const sentMessage = sent.message as unknown;
            if (sentMessage) {
                const storedRow = sentMessage as Record<string, unknown>;
                const deliveredView = addDisplayNameToMessage(
                    projectRoomMessage(
                        storedRow,
                        publicAssessmentForDecision(decision, String(storedRow.id ?? ''), scope.studentId)
                    ),
                    participants
                );
                setMessages(prev => mergeRoomMessages(prev, [deliveredView]));
            }
            if (sent.room) setCurrentRoom(normalizeRoom(sent.room as Room));
            clearAISuggestion();
        } finally {
            deliveryInFlightRef.current = false;
        }
    };

    const updateFinalResponse = (response: string) => {
        setAiSuggestion(response);
        setCurrentSuggestionContext(prev => prev ? { ...prev, finalResponse: response } : prev);
    };

    const updateFinalGuardMode = (mode: TutorResponseMode) => {
        setFinalGuardMode(mode);
        setCurrentSuggestionContext(prev => prev ? { ...prev, finalGuardMode: mode } : prev);
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
                currentSuggestionContext.rawDecision.suggested_response,
                action,
                finalResponse ?? (cyberbullyingDraft ? aiSuggestion : undefined),
                undefined, // tutor_message_id will be set later if needed
                responseTime,
                currentSuggestionContext.contextMessages,
                currentSuggestionContext.rawDecision.guard_mode,
                currentSuggestionContext.rawDecision.instruction,
                currentSuggestionContext.rawDecision.guard_reason,
                currentSuggestionContext.finalGuardMode,
                cyberbullyingDraft && finalCharacter ? {
                    rawCharacter: cyberbullyingDraft.raw_character,
                    finalCharacter,
                    generationProvenance: cyberbullyingDraft.generation_provenance,
                } : undefined
            );

            // Add to local interactions for export
            const interaction: AIInteraction = {
                timestamp: new Date().toISOString(),
                parent_message_id: currentSuggestionContext.parentMessageId,
                parent_message_content: currentSuggestionContext.parentMessageContent,
                ai_suggestion: currentSuggestionContext.rawDecision.suggested_response,
                tutor_action: action,
                tutor_final_response: finalResponse ?? (cyberbullyingDraft ? aiSuggestion : undefined),
                response_time_ms: responseTime,
                ai_config_snapshot: currentSuggestionContext.aiConfigSnapshot,
                raw_guard_mode: currentSuggestionContext.rawDecision.guard_mode,
                raw_instruction: currentSuggestionContext.rawDecision.instruction,
                guard_reason: currentSuggestionContext.rawDecision.guard_reason,
                final_guard_mode: currentSuggestionContext.finalGuardMode,
                guard_rectified: currentSuggestionContext.rawDecision.guard_mode !== currentSuggestionContext.finalGuardMode,
                raw_character: cyberbullyingDraft?.raw_character,
                final_character: cyberbullyingDraft ? finalCharacter : undefined,
                tutor_id: user.id,
                generation_provenance: cyberbullyingDraft?.generation_provenance,
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
            if (activeRoomId.current !== currentRoom.id) return;
            
            // Refresh feedback stats for this message
            await refreshMessageFeedbackStats(messageId);
            if (activeRoomId.current !== currentRoom.id) return;

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

    const value: RoomContextType = {
        cyberbullyingDraft,
        finalCharacter,
        updateFinalCharacter: setFinalCharacter,
        currentRoom,
        messages,
        participants,
        loading,
        typingUsers,
        createRoom,
        joinRoom,
        leaveRoom,
        sendMessage,
        setGuardMode,
        setTransferLearningEnabled,
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
        finalGuardMode,
        updateFinalResponse,
        updateFinalGuardMode,
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

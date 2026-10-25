import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { RoomContextType, Room, Message, UserRole, AIAssistantConfig, AIAssistantConfigSnapshot, AIInteraction, StudentAIChoice, TutorActionDecision, TutorResponseMode, TransferAssessmentDraft } from '../types';
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
    projectRoomMessage,
    publicAssessmentForDecision,
    preferredQuestionLifecycle,
    readAssessmentId,
    withAnswerLifecycle,
} from './transferAssessmentUiAdapter';
import type { RoomMessageView } from './transferAssessmentUiAdapter';
import { ParameterOverrides } from '../components/AISuggestionBox';
import { buildRoomExportData, buildRoomTextExport } from './roomExportBuilder';
import { useMessageFeedback } from '../hooks/useMessageFeedback';
import { normalizeRoom, useRoomMembership } from './useRoomMembership';
import { useRoomRealtime } from './useRoomRealtime';

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const useRoom = () => {
    const context = useContext(RoomContext);
    if (context === undefined) {
        throw new Error('useRoom must be used within a RoomProvider');
    }
    return context;
};

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [aiConfig, setAiConfig] = useState<AIAssistantConfig | null>(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
    const [aiDecision, setAiDecision] = useState<TutorActionDecision | null>(null);
    const [cyberbullyingDraft, setCyberbullyingDraft] = useState<CyberbullyingSuggestion | null>(null);
    const [finalCharacter, setFinalCharacter] = useState<CyberbullyingCharacter | null>(null);
    const generationEpoch = useRef(0);
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
    // True while a reviewed delivery is in flight, so one tab cannot deliver twice.
    const deliveryInFlightRef = useRef(false);
    const { user } = useAuth();
    const {
        currentRoom, setCurrentRoom, messages, setMessages, participants, loading,
        activeRoomId, joinRealtimeIds, addDisplayNameToMessage, createRoom, joinRoom, leaveRoom,
    } = useRoomMembership(user, setAIInteractions, setAiConfig);
    const { messageFeedbackStats, getMessageFeedbackStats: handleGetMessageFeedbackStats,
        refreshMessageFeedbackStats, resetFeedback } = useMessageFeedback(currentRoom?.id, user?.id, messages);

    const handleFeedbackRealtime = useCallback(async (payload: any) => {
        const feedbackMessageId = payload?.new?.message_id;
        if (!feedbackMessageId) return;

        await refreshMessageFeedbackStats(feedbackMessageId);
    }, [refreshMessageFeedbackStats]);

    const { typingUsers, startTyping, stopTyping, channelRef } = useRoomRealtime({
        currentRoom, user, participants, activeRoomId, joinRealtimeIds, setMessages,
        setCurrentRoom, addDisplayNameToMessage, handleFeedbackRealtime, refreshMessageFeedbackStats,
    });

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
            let assessmentPreparation: 'no_candidate' | 'assessment_answer' | undefined;
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
                assessmentPreparation = isAssessmentAnswer ? 'assessment_answer' : 'no_candidate';
            }

            const result = await generateTutorSuggestion(
                currentRoom.id,
                user.id,
                parameterOverrides,
                {
                    // Same student line the tutor is responding to in the UI
                    focusStudentMessage: parentMessageContent || prompt,
                    focusStudentId:parentStudentId,
                    focusStudentMessageId: parentMessageId,
                    assessmentPreparation,
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
                    focusStudentMessageId: currentSuggestionContext.parentMessageId,
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

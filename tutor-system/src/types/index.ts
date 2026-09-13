// Supabase uses ISO string dates instead of Firestore Timestamps

import { SystemPromptConfig } from '../services/prompts/types';
import type { TutorDecisionV3 } from './assessment';

// User types
export type UserRole = 'student' | 'tutor' | 'observer';
export type UserStatus = 'active' | 'inactive';

export interface User {
    id: string;
    email?: string; // Made optional since we're not using email authentication
    display_name: string;
    current_role: UserRole | null;
    status: UserStatus;
    avatar_url?: string | null; // Added for avatar functionality
    created_at: string;
    updated_at: string;
}

// Extended role type for pre-populated messages to include 'others'
export type PrePopulatedMessageRole = UserRole | 'others';

// Pre-populated dialogue message for room setup
export interface PrePopulatedMessage {
    user_name: string;
    message: string;
    role: PrePopulatedMessageRole;
    timestamp?: string; // Optional custom timestamp
}

// Room interface
export interface Room {
    id: string;
    tutor_id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    is_active: boolean;
    ai_assistant_enabled: boolean;
    ai_assistant_model: string | null;
    ai_assistant_prompt: string | null;
    pre_populated_dialogue?: PrePopulatedMessage[] | null; // Added for dialogue customization
    observer_count?: number; // Number of active observers in the room
    op_id: string | null;
    op_display_name: string | null;
    op_avatar_url: string | null;
    password: string | null; // Added for password protection
    active_response_mode?: RoomParticipationMode;
    mode_changed_at?: string | null;
    mode_change_source?: 'reviewed_response' | 'manual_override' | null;
    created_at: string;
    updated_at: string;
}

// Room Template interface for saving and reusing room configurations
export interface RoomTemplate {
    id: string;
    tutor_id: string;
    template_name: string;
    template_description: string | null;
    title_template: string;
    description_template: string | null;
    image_url: string | null;
    pre_populated_dialogue: PrePopulatedMessage[] | null;
    ai_config_template: any | null; // Stores AI configuration as JSON
    op_config_template: any | null; // Stores OP configuration as JSON
    password_config: any | null; // Stores password configuration as JSON
    usage_count: number;
    created_at: string;
    updated_at: string;
}

// Message interface
export interface Message {
    id: string;
    room_id: string;
    user_id: string;
    content: string;
    user_role: UserRole;
    is_ai_generated: boolean;
    ai_model_used: string | null;
    ai_response_time_ms: number | null;
    parent_message_id: string | null;
    created_at: string;
    display_name?: string; // Added for UI display
    avatar_url?: string | null; // Added for avatar display
    response_mode?: TutorTurnMode | null;
}

// Session interface
export interface Session {
    id: string;
    tutor_id: string;
    student_id: string | null;
    room_id: string;
    status: 'active' | 'completed' | 'cancelled';
    started_at: string;
    ended_at: string | null;
}

// AI Assistant interfaces
export interface AIAssistantConfig {
    id: string;
    room_id: string;
    model_name: string;
    system_prompt: string | null;
    prompt_config?: SystemPromptConfig | null; // Stores the configuration used to generate the prompt
    temperature: number;
    max_tokens: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface AIAssistantConfigSnapshot {
    model_name: string | null;
    system_prompt: string | null;
    prompt_config: SystemPromptConfig | null;
    temperature: number | null;
    max_tokens: number | null;
    is_active: boolean;
}

export interface AIConfigChangeLog {
    id: string;
    room_id: string;
    changed_by_user_id: string;
    change_reason: string;
    changed_fields: string[];
    previous_config: AIAssistantConfigSnapshot;
    new_config: AIAssistantConfigSnapshot;
    changed_at: string;
}

export interface AIConversationContext {
    id: string;
    room_id: string;
    conversation_history: ConversationMessage[];
    last_updated: string;
}

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface AIResponse {
    content: string;
    suggested_response?: string;
    model_used: string;
    response_time_ms: number;
    success: boolean;
    error?: string;
}

export type RoomParticipationMode = 'tutoring' | 'guard';
export type TutorTurnMode = RoomParticipationMode | 'assessment';
/** Legacy alias for APIs that exclusively control room participation. */
export type TutorResponseMode = RoomParticipationMode;

/** Model decision mode. `multiagent` is a presentation decision, never persisted room participation. */
export type TutorDecisionMode = RoomParticipationMode | 'multiagent';

export type TutorInstruction = 'protective_instruction' | 'correction' | 'scaffolding' | 'explanation' | 'consolidation' | 'transfer_assess' | 'guard' | 'multiagent';

export interface TutorActionDecision {
    mode: TutorDecisionMode;
    instruction: TutorInstruction | null;
    mode_reason: string;
    suggested_response: string;
}

// Raw v2 model contract; the reviewed-response workflow maps this to TutorActionDecision.
export interface TutorBehaviorDecision {
    reason: string;
    decision: { mode: TutorDecisionMode; instruction: TutorInstruction | null };
    response: string;
}

/** One decoded character message from a multi-agent response or stored tagged row. */
export interface DecodedAgentMessage {
    character: 'riley' | 'tutor';
    content: string;
}

/** Learner-visible Student AI choice. Peer/Adult are single-agent; Multi-agent enables one-or-two-character decisions. */
export type StudentAIChoice = 'peer' | 'adult' | 'multi_agent';

/** Model-facing interaction mode carried by the request and the room AI prompt config. */
export type InteractionMode = 'single_agent' | 'multi_agent';

/** Human-review draft for one approved-pending Multi-agent response. */
export interface MultiAgentDraft {
    rawDecision: TutorActionDecision;
    parentMessageId: string;
    parentMessageContent: string;
    generatedMessages: DecodedAgentMessage[];
    startTime: number;
    contextMessages: string[];
    aiConfigSnapshot?: AIAssistantConfigSnapshot;
}

export type { AssessmentOption, AssessmentOptionId, AssessmentSelectionType, PrivateAssessment, PublicAssessment, RoomParticipationMode as AssessmentRoomParticipationMode, TeachingInstruction, TutorDecisionV3, TutorTurnMode as AssessmentTutorTurnMode, TransferBasis, TransferChecklistItemSnapshot, TransferTurnContext } from './assessment';
export type { ProgressPolicyVersion, TransferProgress, TransferStatus, TransferUnderstandingLevel } from './learningProgress';

// Context types
export interface AuthContextType {
    user: User | null;
    loading: boolean;
    // Simplified authentication - just join with name and role
    joinWithNameAndRole: (displayName: string, role: UserRole) => Promise<void>;
    signOut: () => Promise<void>;
    setUserRole: (role: UserRole) => Promise<void>;
    // Update user profile (display name, avatar, etc.)
    updateUserProfile: (updates: Partial<Pick<User, 'display_name' | 'avatar_url'>>) => Promise<void>;
}

// Typing indicator type
export interface TypingIndicator {
    userId: string;
    displayName: string;
    timestamp: number;
}

// Room context type
export interface RoomContextType {
    currentRoom: Room | null;
    messages: Message[];
    participants: User[];
    loading: boolean;
    typingUsers: TypingIndicator[];
    createRoom: (title: string, description?: string, imageFile?: File) => Promise<void>;
    joinRoom: (roomId: string, password?: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    sendMessage: (content: string, options?: { replyToMessageId?: string; assessmentId?: string }) => Promise<void>;
    setResponseMode: (mode: TutorResponseMode) => Promise<void>;
    generateAIResponse: (prompt?: string) => Promise<void>;
    regenerateAIResponse: (parameterOverrides: any) => Promise<void>;
    toggleAIAssistant: (enabled: boolean, config?: Partial<AIAssistantConfig>) => Promise<void>;
    /** Student claims an AI interaction choice (peer/adult/multi-agent; single-student rooms only). */
    setStudentAITone: (choice: StudentAIChoice) => Promise<void>;
    startTyping: () => void;
    stopTyping: () => void;
    aiConfig: AIAssistantConfig | null;
    loadingAI: boolean;
    downloadChatHistory: (format?: 'txt' | 'json') => void;
    aiSuggestion: string | null;
    aiDecision: TutorActionDecision | null;
    transferDraft: {
        decision: TutorDecisionV3;
        progressSnapshotHash: string;
        roomId: string;
        studentId: string;
        checklistId: string;
        // Null for a tutoring or Guard turn: only an assessment names a checklist item.
        itemId: string | null;
        focusStudentMessageId: string;
    } | null;
    confirmTransferDraft: (decision: TutorDecisionV3) => Promise<void>;
    finalMode: TutorResponseMode;
    updateFinalResponse: (response: string) => void;
    updateFinalMode: (mode: TutorResponseMode) => void;
    clearAISuggestion: () => void;
    /** Human-review draft for a model decision of mode `multiagent`. */
    multiAgentDraft: MultiAgentDraft | null;
    approveMultiAgentDraft: (editedMessages: string[]) => Promise<void>;
    regenerateMultiAgentDraft: () => Promise<void>;
    rejectMultiAgentDraft: () => Promise<void>;
    aiInteractions: AIInteraction[];
    currentSuggestionContext: { 
        rawDecision: TutorActionDecision;
        finalMode: TutorResponseMode;
        finalResponse: string;
        parentMessageId: string; 
        parentMessageContent: string;
        startTime: number;
        contextMessages: string[];
        aiConfigSnapshot?: AIAssistantConfigSnapshot;
    } | null;
    recordAIFeedback: (action: 'accepted' | 'rejected' | 'modified' | 'ignored', finalResponse?: string) => Promise<void>;
    // Message feedback functions
    submitMessageFeedback: (messageId: string, feedbackType: 'like' | 'dislike', rating: number) => Promise<void>;
    getMessageFeedbackStats: (messageId: string) => Promise<MessageFeedbackStats | null>;
    messageFeedbackStats: Record<string, MessageFeedbackStats>;
    // Clear chat history function (tutor-only)
    clearChatHistory: () => Promise<void>;
}

// Image Upload Types
export interface TutorImage {
    id: string;
    tutor_id: string;
    room_id: string;
    image_url: string;
    filename: string;
    file_size: number;
    upload_date: string;
    is_active: boolean;
}

export interface ImageValidationResult {
    isValid: boolean;
    errors: string[];
    fileSize?: number;
    fileType?: string;
    dimensions?: {
        width: number;
        height: number;
    };
}

export interface ImageUploadResult {
    success: boolean;
    error?: string;
    avatarUrl?: string;
    tutorImage?: TutorImage;
    previousAvatarRemoved?: boolean;
}

export interface ImageDimensions {
    maxWidth?: number;
    maxHeight?: number;
    minWidth?: number;
    minHeight?: number;
}

// Engagement and Social Features Types
export interface MessageEngagement {
    messageId: string;
    userId: string;
    type: 'like' | 'dislike';
    created_at: string;
}

export interface RoomEngagement {
    roomId: string;
    userId: string;
    type: 'like' | 'bookmark' | 'flag';
    created_at: string;
}

export interface EngagementStats {
    messageId?: string;
    roomId?: string;
    likeCount: number;
    dislikeCount: number;
    bookmarkCount?: number;
    flagCount?: number;
}

export interface CommentReply {
    id: string;
    parentMessageId: string;
    roomId: string;
    userId: string;
    content: string;
    userRole: UserRole;
    created_at: string;
    display_name?: string;
}

// Message Feedback Types (Two-step feedback system)
export interface MessageFeedback {
    id: string;
    message_id: string;
    user_id: string;
    room_id: string;
    feedback_type: 'like' | 'dislike';
    rating: number; // 1-5 scale
    created_at: string;
    updated_at: string;
}

export interface MessageFeedbackStats {
    message_id: string;
    total_feedback_count: number;
    like_count: number;
    dislike_count: number;
    average_like_rating: number | null;
    average_dislike_rating: number | null;
    overall_average_rating: number | null;
    user_feedback?: {
        feedback_type: 'like' | 'dislike';
        rating: number;
    } | null;
}

export interface FeedbackSubmission {
    messageId: string;
    userId: string;
    roomId: string;
    feedbackType: 'like' | 'dislike';
    rating: number;
}

// Extended Message interface with engagement
export interface MessageWithEngagement extends Message {
    likeCount?: number;
    dislikeCount?: number;
    replyCount?: number;
    userLiked?: boolean;
    userDisliked?: boolean;
    replies?: CommentReply[];
    feedbackStats?: MessageFeedbackStats;
}

// Room social features
export interface RoomSocialFeatures {
    roomId: string;
    likeCount: number;
    bookmarkCount: number;
    shareCount: number;
    isLiked: boolean;
    isBookmarked: boolean;
    isFlagged: boolean;
}

// AI Suggestion Tracking
export interface AISuggestionFeedback {
    id: string;
    room_id: string;
    tutor_id: string;
    parent_message_id: string;
    ai_suggestion: string;
    tutor_action: 'accepted' | 'rejected' | 'modified' | 'ignored';
    tutor_final_response: string | null;
    tutor_message_id: string | null;
    response_time_ms: number | null;
    context_messages: string[] | null;
    created_at: string;
    raw_mode: TutorDecisionMode | null;
    raw_instruction: TutorInstruction | null;
    mode_reason: string | null;
    final_mode: TutorResponseMode | null;
    mode_rectified: boolean;
}

export interface AIInteraction {
    timestamp: string;
    parent_message_id: string;
    parent_message_content: string;
    ai_suggestion: string;
    tutor_action: 'accepted' | 'rejected' | 'modified' | 'ignored';
    tutor_final_response?: string;
    response_time_ms?: number;
    ai_config_snapshot?: AIAssistantConfigSnapshot;
    raw_mode?: TutorDecisionMode;
    raw_instruction: TutorInstruction | null;
    mode_reason?: string;
    final_mode?: TutorResponseMode;
    mode_rectified?: boolean;
}

export interface ChatExportData {
    room: {
        id: string;
        title: string;
        created_at: string;
        ai_enabled?: boolean;
        ai_model?: string | null;
    };
    messages: Array<{
        id: string;
        user_role: string;
        display_name?: string;
        content: string;
        created_at: string;
        is_ai_generated: boolean;
        ai_model_used?: string | null;
        feedback_stats?: MessageFeedbackStats;
    }>;
    export_metadata: {
        exported_at: string;
        total_messages: number;
        total_ai_interactions?: number;
        interaction_summary?: {
            accepted: number;
            rejected: number;
            modified: number;
            ignored: number;
        };
    };
    ai_interactions?: AIInteraction[];
    feedback_summary?: {
        [key: string]: any;
    };
} 

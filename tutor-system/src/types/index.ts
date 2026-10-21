// Supabase uses ISO string dates instead of Firestore Timestamps

import { SystemPromptConfig } from '../services/prompts/types';
import type { AssessmentEvent, AssessmentOptionId, TransferAssessmentDraft } from './assessment';

// User types
export type UserRole = 'student' | 'tutor' | 'observer';
export type UserStatus = 'active' | 'inactive';

export type PracticeType = 'phishing' | 'cyberbullying';
export type CyberbullyingCharacter = 'same_age_peer' | 'older_peer' | 'victim' | 'bully' | 'educator';
export interface CyberbullyingSuggestion {
    id: string;
    room_id: string;
    parent_message_id: string;
    context_revision: number;
    status: 'generating' | 'ready' | 'failed' | 'rejected' | 'superseded' | 'approved';
    requested_character: CyberbullyingCharacter | null;
    raw_character: CyberbullyingCharacter;
    raw_response: string;
    raw_guard_mode: boolean;
    reason: string;
}

/** Stable scenario data retained across room/template copies and exports. */
export interface CyberbullyingScenario {
    id: string;
    source_commit: string;
    post: {
        text: string;
        image: string;
        timestamp: string;
        author: { id: string; name: string; profile_picture: string; role: string };
    };
    initial_comments: Array<{
        id: string;
        text: string;
        timestamp: string;
        author: { id: string; name: string; profile_picture: string; role: string };
    }>;
}

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
    source_comment_id?: string;
    persona_id?: string;
    avatar_url?: string;
    user_name: string;
    message: string;
    role: PrePopulatedMessageRole;
    timestamp?: string; // Optional custom timestamp
}

// Room interface
export interface Room {
    id: string;
    practice_type?: PracticeType;
    scenario_config?: CyberbullyingScenario | null;
    conversation_revision?: number;
    tutor_id: string;
    title: string;
    description: string | null;
    image_url: string | null;
    is_active: boolean;
    ai_assistant_enabled: boolean;
    transfer_learning_enabled?: boolean;
    ai_assistant_model: string | null;
    ai_assistant_prompt: string | null;
    pre_populated_dialogue?: PrePopulatedMessage[] | null; // Added for dialogue customization
    observer_count?: number; // Number of active observers in the room
    op_id: string | null;
    op_display_name: string | null;
    op_avatar_url: string | null;
    password: string | null; // Added for password protection
    guard_mode?: RoomParticipationMode;
    guard_mode_changed_at?: string | null;
    guard_mode_change_source?: 'reviewed_response' | 'manual_override' | null;
    created_at: string;
    updated_at: string;
}

// Room Template interface for saving and reusing room configurations
export interface RoomTemplate {
    id: string;
    practice_type?: PracticeType;
    scenario_config?: CyberbullyingScenario | null;
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
    guard_mode?: boolean | null;
    character?: CyberbullyingCharacter | null;
    persona_id?: string | null;
    persona_name?: string | null;
    persona_avatar?: string | null;
    assessment_event?: AssessmentEvent | null;
    assessment_selected_option_ids?: AssessmentOptionId[] | null;
    id: string;
    room_id: string;
    user_id: string;
    content: string;
    user_role: UserRole;
    ai_model_used: string | null;
    ai_response_time_ms: number | null;
    parent_message_id: string | null;
    created_at: string;
    is_ai_generated?: boolean;
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

export type RoomParticipationMode = boolean;
export type TutorTurnMode = 'tutoring' | 'guard' | 'assessment';
/** Legacy alias for APIs that exclusively control room participation. */
export type TutorResponseMode = boolean;

export type TutorDecisionMode = boolean;

export type TutorInstruction = 'protective_instruction' | 'correction' | 'scaffolding' | 'explanation' | 'consolidation' | 'transfer_assess' | 'guard';

export interface TutorActionDecision {
    guard_mode: boolean;
    instruction: TutorInstruction | null;
    guard_reason: string;
    suggested_response: string;
}

// Raw v2 model contract; the reviewed-response workflow maps this to TutorActionDecision.
export interface TutorBehaviorDecision {
    reason: string;
    decision: { guard_mode: boolean; instruction: TutorInstruction | null };
    response: string;
}

export type StudentAIChoice = 'peer' | 'adult';
export type InteractionMode = 'single_agent';

export type {
    AssessmentOption,
    AssessmentOptionId,
    AssessmentSelectionType,
    PrivateAssessment,
    TransferAssessmentDraft,
    PublicAssessment,
    RoomParticipationMode as AssessmentRoomParticipationMode,
    TransferAttemptResult,
    TransferAttemptResultBase,
    TransferAttemptResultNextAction,
    TransferAttemptSnapshot,
    TransferBasis,
    TransferChecklistItemSnapshot,
    TransferFailedResult,
    TransferNonConsumingDisposition,
    TransferNonConsumingResult,
    TransferPassedResult,
    TransferRetryResult,
    TransferTerminalFeedback,
    TransferTurnContext,
} from './assessment';
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
    cyberbullyingDraft: CyberbullyingSuggestion | null;
    finalCharacter: CyberbullyingCharacter | null;
    updateFinalCharacter: (character: CyberbullyingCharacter) => void;
    currentRoom: Room | null;
    messages: Message[];
    participants: User[];
    loading: boolean;
    typingUsers: TypingIndicator[];
    createRoom: (title: string, description?: string, imageFile?: File) => Promise<void>;
    joinRoom: (roomId: string, password?: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    sendMessage: (content: string, options?: { replyToMessageId?: string; assessmentId?: string; selectedOptionIds?: AssessmentOptionId[] }) => Promise<void>;
    setGuardMode: (mode: TutorResponseMode) => Promise<void>;
    setTransferLearningEnabled: (enabled: boolean) => Promise<void>;
    generateAIResponse: (prompt?: string) => Promise<void>;
    regenerateAIResponse: (parameterOverrides: any) => Promise<void>;
    toggleAIAssistant: (enabled: boolean, config?: Partial<AIAssistantConfig>) => Promise<void>;
    /** Student claims an AI interaction choice (peer/adult; single-student rooms only). */
    setStudentAITone: (choice: StudentAIChoice) => Promise<void>;
    startTyping: () => void;
    stopTyping: () => void;
    aiConfig: AIAssistantConfig | null;
    loadingAI: boolean;
    downloadChatHistory: (format?: 'txt' | 'json') => void;
    aiSuggestion: string | null;
    aiDecision: TutorActionDecision | null;
    transferDraft: {
        decision: TransferAssessmentDraft;
        progressSnapshotHash: string;
        roomId: string;
        studentId: string;
        checklistId: string;
        itemId: string;
        focusStudentMessageId: string;
        itemLabel?: string;
    } | null;
    confirmTransferDraft: (decision: TransferAssessmentDraft) => Promise<void>;
    finalGuardMode: TutorResponseMode;
    updateFinalResponse: (response: string) => void;
    updateFinalGuardMode: (mode: TutorResponseMode) => void;
    clearAISuggestion: () => void;
    aiInteractions: AIInteraction[];
    currentSuggestionContext: { 
        rawDecision: TutorActionDecision;
        finalGuardMode: TutorResponseMode;
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
    raw_guard_mode: TutorDecisionMode | null;
    raw_instruction: TutorInstruction | null;
    guard_reason: string | null;
    final_guard_mode: TutorResponseMode | null;
    guard_rectified: boolean;
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
    raw_guard_mode?: TutorDecisionMode;
    raw_instruction: TutorInstruction | null;
    guard_reason?: string;
    final_guard_mode?: TutorResponseMode;
    guard_rectified?: boolean;
}

export interface ChatExportData {
    learning_progress?: import('./checklist').SessionChecklist | null;
    room: {
        id: string;
        practice_type?: PracticeType;
        scenario_config?: CyberbullyingScenario | null;
        guard_mode?: boolean;
        title: string;
        created_at: string;
        ai_enabled?: boolean;
        ai_model?: string | null;
    };
    messages: Array<{
        id: string;
        user_id?: string;
        guard_mode?: boolean | null;
        character?: CyberbullyingCharacter | null;
        persona_id?: string | null;
        persona_name?: string | null;
        persona_avatar?: string | null;
        user_role: string;
        display_name?: string;
        content: string;
        created_at: string;
        response_mode?: TutorTurnMode | null;
        ai_model_used?: string | null;
        ai_response_time_ms?: number | null;
        feedback_stats?: MessageFeedbackStats;
    }>;
    participants?: Array<{
        id: string;
        display_name: string;
        role: UserRole | null;
    }>;
    export_metadata: {
        exported_at: string;
        total_messages: number;
        total_ai_interactions?: number;
    };
    ai_interactions?: AIInteraction[];
    feedback_summary?: {
        [key: string]: any;
    };
}

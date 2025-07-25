// Supabase uses ISO string dates instead of Firestore Timestamps

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

// Pre-populated dialogue message for room setup
export interface PrePopulatedMessage {
    user_name: string;
    message: string;
    role: UserRole;
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
    temperature: number;
    max_tokens: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
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
    sendMessage: (content: string) => Promise<void>;
    generateAIResponse: (prompt?: string) => Promise<void>;
    regenerateAIResponse: (parameterOverrides: any) => Promise<void>;
    toggleAIAssistant: (enabled: boolean, config?: Partial<AIAssistantConfig>) => Promise<void>;
    startTyping: () => void;
    stopTyping: () => void;
    aiConfig: AIAssistantConfig | null;
    loadingAI: boolean;
    downloadChatHistory: (format?: 'txt' | 'json') => void;
    aiSuggestion: string | null;
    clearAISuggestion: () => void;
    aiInteractions: AIInteraction[];
    currentSuggestionContext: { 
        parentMessageId: string; 
        parentMessageContent: string;
        startTime: number;
        contextMessages: string[];
    } | null;
    recordAIFeedback: (action: 'accepted' | 'rejected' | 'modified' | 'ignored', finalResponse?: string) => Promise<void>;
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

// Extended Message interface with engagement
export interface MessageWithEngagement extends Message {
    likeCount?: number;
    dislikeCount?: number;
    replyCount?: number;
    userLiked?: boolean;
    userDisliked?: boolean;
    replies?: CommentReply[];
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
}

export interface AIInteraction {
    timestamp: string;
    parent_message_id: string;
    parent_message_content: string;
    ai_suggestion: string;
    tutor_action: 'accepted' | 'rejected' | 'modified' | 'ignored';
    tutor_final_response?: string;
    response_time_ms?: number;
}

export interface ChatExportData {
    room: {
        id: string;
        title: string;
        created_at: string;
    };
    messages: Array<{
        id: string;
        user_role: string;
        display_name?: string;
        content: string;
        created_at: string;
        is_ai_generated: boolean;
    }>;
    ai_interactions: AIInteraction[];
} 
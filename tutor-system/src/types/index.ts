// Supabase uses ISO string dates instead of Firestore Timestamps

// User types
export type UserRole = 'student' | 'tutor' | 'observer';
export type UserStatus = 'active' | 'inactive';

export interface User {
    id: string;
    email: string;
    display_name: string | null;
    current_role: UserRole | null;
    status: UserStatus;
    created_at: string;
    updated_at: string;
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
    model_used: string;
    response_time_ms: number;
    success: boolean;
    error?: string;
}

// Context types
export interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, displayName: string) => Promise<void>;
    signOut: () => Promise<void>;
    setUserRole: (role: UserRole) => Promise<void>;
}

// Room context type
export interface RoomContextType {
    currentRoom: Room | null;
    messages: Message[];
    loading: boolean;
    createRoom: (title: string, description?: string, imageFile?: File) => Promise<void>;
    joinRoom: (roomId: string) => Promise<void>;
    leaveRoom: () => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    generateAIResponse: (prompt?: string) => Promise<void>;
    toggleAIAssistant: (enabled: boolean, config?: Partial<AIAssistantConfig>) => Promise<void>;
    aiConfig: AIAssistantConfig | null;
    loadingAI: boolean;
} 
export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    email: string
                    display_name: string | null
                    current_role: 'student' | 'tutor' | 'observer' | null
                    status: 'active' | 'inactive'
                    avatar_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    email: string
                    display_name?: string | null
                    current_role?: 'student' | 'tutor' | 'observer' | null
                    status?: 'active' | 'inactive'
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    email?: string
                    display_name?: string | null
                    current_role?: 'student' | 'tutor' | 'observer' | null
                    status?: 'active' | 'inactive'
                    avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            rooms: {
                Row: {
                    id: string
                    tutor_id: string
                    title: string
                    description: string | null
                    image_url: string | null
                    is_active: boolean
                    ai_assistant_enabled: boolean
                    ai_assistant_model: string | null
                    ai_assistant_prompt: string | null
                    pre_populated_dialogue: Json | null
                    op_id: string | null
                    op_display_name: string | null
                    op_avatar_url: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    tutor_id: string
                    title: string
                    description?: string | null
                    image_url?: string | null
                    is_active?: boolean
                    ai_assistant_enabled?: boolean
                    ai_assistant_model?: string | null
                    ai_assistant_prompt?: string | null
                    pre_populated_dialogue?: Json | null
                    op_id?: string | null
                    op_display_name?: string | null
                    op_avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    tutor_id?: string
                    title?: string
                    description?: string | null
                    image_url?: string | null
                    is_active?: boolean
                    ai_assistant_enabled?: boolean
                    ai_assistant_model?: string | null
                    ai_assistant_prompt?: string | null
                    pre_populated_dialogue?: Json | null
                    op_id?: string | null
                    op_display_name?: string | null
                    op_avatar_url?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            messages: {
                Row: {
                    id: string
                    room_id: string
                    user_id: string
                    content: string
                    user_role: 'student' | 'tutor' | 'observer'
                    is_ai_generated: boolean
                    ai_model_used: string | null
                    ai_response_time_ms: number | null
                    parent_message_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    room_id: string
                    user_id: string
                    content: string
                    user_role: 'student' | 'tutor' | 'observer'
                    is_ai_generated?: boolean
                    ai_model_used?: string | null
                    ai_response_time_ms?: number | null
                    parent_message_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    room_id?: string
                    user_id?: string
                    content?: string
                    user_role?: 'student' | 'tutor' | 'observer'
                    is_ai_generated?: boolean
                    ai_model_used?: string | null
                    ai_response_time_ms?: number | null
                    parent_message_id?: string | null
                    created_at?: string
                }
            }
            sessions: {
                Row: {
                    id: string
                    tutor_id: string
                    student_id: string | null
                    room_id: string
                    status: 'active' | 'completed' | 'cancelled'
                    started_at: string
                    ended_at: string | null
                }
                Insert: {
                    id?: string
                    tutor_id: string
                    student_id?: string | null
                    room_id: string
                    status?: 'active' | 'completed' | 'cancelled'
                    started_at?: string
                    ended_at?: string | null
                }
                Update: {
                    id?: string
                    tutor_id?: string
                    student_id?: string | null
                    room_id?: string
                    status?: 'active' | 'completed' | 'cancelled'
                    started_at?: string
                    ended_at?: string | null
                }
            }
            ai_assistant_configs: {
                Row: {
                    id: string
                    room_id: string
                    model_name: string
                    system_prompt: string | null
                    temperature: number
                    max_tokens: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    room_id: string
                    model_name?: string
                    system_prompt?: string | null
                    temperature?: number
                    max_tokens?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    room_id?: string
                    model_name?: string
                    system_prompt?: string | null
                    temperature?: number
                    max_tokens?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            ai_conversation_contexts: {
                Row: {
                    id: string
                    room_id: string
                    conversation_history: Json
                    last_updated: string
                }
                Insert: {
                    id?: string
                    room_id: string
                    conversation_history?: Json
                    last_updated?: string
                }
                Update: {
                    id?: string
                    room_id?: string
                    conversation_history?: Json
                    last_updated?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            initialize_ai_assistant: {
                Args: {
                    p_room_id: string
                    p_model_name?: string
                    p_system_prompt?: string
                }
                Returns: string
            }
            add_conversation_context: {
                Args: {
                    p_room_id: string
                    p_role: string
                    p_content: string
                }
                Returns: void
            }
        }
        Enums: {
            user_role: 'student' | 'tutor' | 'observer'
            user_status: 'active' | 'inactive'
            session_status: 'active' | 'completed' | 'cancelled'
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
} 
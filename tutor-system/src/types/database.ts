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
                    password: string | null
                    active_response_mode: 'tutoring' | 'guard'
                    mode_changed_at: string | null
                    mode_change_source: 'reviewed_response' | 'manual_override' | null
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
                    password?: string | null
                    active_response_mode?: 'tutoring' | 'guard'
                    mode_changed_at?: string | null
                    mode_change_source?: 'reviewed_response' | 'manual_override' | null
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
                    password?: string | null
                    active_response_mode?: 'tutoring' | 'guard'
                    mode_changed_at?: string | null
                    mode_change_source?: 'reviewed_response' | 'manual_override' | null
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
                    response_mode: 'tutoring' | 'guard' | 'assessment' | null
                    assessment_id: string | null
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
                    response_mode?: 'tutoring' | 'guard' | 'assessment' | null
                    assessment_id?: string | null
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
                    response_mode?: 'tutoring' | 'guard' | 'assessment' | null
                    assessment_id?: string | null
                    created_at?: string
                }
            }
            assessment_questions: {
                Row: {
                    id: string
                    room_id: string
                    student_id: string
                    checklist_id: string
                    item_id: string
                    tutor_message_id: string
                    source_student_message_id: string
                    selection_type: 'single' | 'multiple'
                    stem: string
                    rendered_text: string
                    options: Json
                    lifecycle: 'delivered' | 'answered' | 'cancelled' | 'invalidated'
                    answer_message_id: string | null
                    selected_option_ids: string[] | null
                    result: 'pass' | 'fail' | null
                    closed_reason: string | null
                    feedback_message_id: string | null
                    created_at: string
                    answered_at: string | null
                    closed_at: string | null
                }
                Insert: {
                    id?: string
                    room_id: string
                    student_id: string
                    checklist_id: string
                    item_id: string
                    tutor_message_id: string
                    source_student_message_id: string
                    selection_type: 'single' | 'multiple'
                    stem: string
                    rendered_text: string
                    options: Json
                    lifecycle?: 'delivered' | 'answered' | 'cancelled' | 'invalidated'
                    answer_message_id?: string | null
                    selected_option_ids?: string[] | null
                    result?: 'pass' | 'fail' | null
                    closed_reason?: string | null
                    feedback_message_id?: string | null
                    created_at?: string
                    answered_at?: string | null
                    closed_at?: string | null
                }
                Update: {
                    id?: string
                    room_id?: string
                    student_id?: string
                    checklist_id?: string
                    item_id?: string
                    tutor_message_id?: string
                    source_student_message_id?: string
                    selection_type?: 'single' | 'multiple'
                    stem?: string
                    rendered_text?: string
                    options?: Json
                    lifecycle?: 'delivered' | 'answered' | 'cancelled' | 'invalidated'
                    answer_message_id?: string | null
                    selected_option_ids?: string[] | null
                    result?: 'pass' | 'fail' | null
                    closed_reason?: string | null
                    feedback_message_id?: string | null
                    created_at?: string
                    answered_at?: string | null
                    closed_at?: string | null
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
                    prompt_config?: any | null
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
                    prompt_config?: any | null
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
                    prompt_config?: any | null
                    system_prompt?: string | null
                    temperature?: number
                    max_tokens?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            ai_assistant_config_logs: {
                Row: {
                    id: string
                    room_id: string
                    changed_by_user_id: string
                    change_reason: string
                    changed_fields: string[]
                    previous_config: any
                    new_config: any
                    changed_at: string
                }
                Insert: {
                    id?: string
                    room_id: string
                    changed_by_user_id: string
                    change_reason?: string
                    changed_fields: string[]
                    previous_config: any
                    new_config: any
                    changed_at?: string
                }
                Update: {
                    id?: string
                    room_id?: string
                    changed_by_user_id?: string
                    change_reason?: string
                    changed_fields?: string[]
                    previous_config?: any
                    new_config?: any
                    changed_at?: string
                }
            }
            session_checklists: {
                Row: {
                    id: string
                    room_id: string
                    template_name: string
                    student_id: string | null
                    progress_policy_version: 'legacy_v1' | 'transfer_v1'
                    session_start: string
                    total_items: number
                    completed_items: number
                    completion_percentage: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    room_id: string
                    template_name: string
                    student_id?: string | null
                    progress_policy_version?: 'legacy_v1' | 'transfer_v1'
                    session_start?: string
                    total_items?: number
                    completed_items?: number
                    completion_percentage?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    room_id?: string
                    template_name?: string
                    student_id?: string | null
                    progress_policy_version?: 'legacy_v1' | 'transfer_v1'
                    session_start?: string
                    total_items?: number
                    completed_items?: number
                    completion_percentage?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            checklist_items: {
                Row: {
                    id: string
                    checklist_id: string
                    area_text: string
                    item_type: 'detection_area' | 'verification_step'
                    priority: 'critical' | 'important' | 'optional'
                    status: 'pending' | 'partially_covered' | 'covered' | 'needs_review'
                    understanding_level: 'none' | 'basic' | 'good' | 'excellent'
                    tutor_notes: string | null
                    last_addressed: string | null
                    attempts_count: number
                    original_template_area: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    checklist_id: string
                    area_text: string
                    item_type: 'detection_area' | 'verification_step'
                    priority: 'critical' | 'important' | 'optional'
                    status?: 'pending' | 'partially_covered' | 'covered' | 'needs_review'
                    understanding_level?: 'none' | 'basic' | 'good' | 'excellent'
                    tutor_notes?: string | null
                    last_addressed?: string | null
                    attempts_count?: number
                    original_template_area?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    checklist_id?: string
                    area_text?: string
                    item_type?: 'detection_area' | 'verification_step'
                    priority?: 'critical' | 'important' | 'optional'
                    status?: 'pending' | 'partially_covered' | 'covered' | 'needs_review'
                    understanding_level?: 'none' | 'basic' | 'good' | 'excellent'
                    tutor_notes?: string | null
                    last_addressed?: string | null
                    attempts_count?: number
                    original_template_area?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            coverage_evidence: {
                Row: {
                    id: string
                    item_id: string
                    evidence_text: string
                    analysis: string
                    confidence_score: number
                    detection_method: 'ai_analysis' | 'tutor_manual' | 'student_self_assessment'
                    message_id: string | null
                    timestamp: string
                }
                Insert: {
                    id?: string
                    item_id: string
                    evidence_text: string
                    analysis: string
                    confidence_score: number
                    detection_method: 'ai_analysis' | 'tutor_manual' | 'student_self_assessment'
                    message_id?: string | null
                    timestamp?: string
                }
                Update: {
                    id?: string
                    item_id?: string
                    evidence_text?: string
                    analysis?: string
                    confidence_score?: number
                    detection_method?: 'ai_analysis' | 'tutor_manual' | 'student_self_assessment'
                    message_id?: string | null
                    timestamp?: string
                }
            }
            checklist_updates: {
                Row: {
                    id: string
                    checklist_id: string
                    item_id: string
                    previous_status: string
                    new_status: string
                    previous_understanding: string
                    new_understanding: string
                    evidence_id: string | null
                    event_id: string | null
                    assessment_id: string | null
                    updated_by: 'ai' | 'tutor' | 'student'
                    created_at: string
                }
                Insert: {
                    id?: string
                    checklist_id: string
                    item_id: string
                    previous_status: string
                    new_status: string
                    previous_understanding: string
                    new_understanding: string
                    evidence_id?: string | null
                    event_id?: string | null
                    assessment_id?: string | null
                    updated_by: 'ai' | 'tutor' | 'student'
                    created_at?: string
                }
                Update: {
                    id?: string
                    checklist_id?: string
                    item_id?: string
                    previous_status?: string
                    new_status?: string
                    previous_understanding?: string
                    new_understanding?: string
                    evidence_id?: string | null
                    event_id?: string | null
                    assessment_id?: string | null
                    updated_by?: 'ai' | 'tutor' | 'student'
                    created_at?: string
                }
            }
            checklist_configs: {
                Row: {
                    room_id: string
                    ai_detection_sensitivity: 'strict' | 'moderate' | 'flexible'
                    auto_coverage_detection: boolean
                    require_tutor_confirmation: boolean
                    completion_threshold: number
                    regression_detection: boolean
                    show_progress_to_students: boolean
                    group_by_priority: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    room_id: string
                    ai_detection_sensitivity?: 'strict' | 'moderate' | 'flexible'
                    auto_coverage_detection?: boolean
                    require_tutor_confirmation?: boolean
                    completion_threshold?: number
                    regression_detection?: boolean
                    show_progress_to_students?: boolean
                    group_by_priority?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    room_id?: string
                    ai_detection_sensitivity?: 'strict' | 'moderate' | 'flexible'
                    auto_coverage_detection?: boolean
                    require_tutor_confirmation?: boolean
                    completion_threshold?: number
                    regression_detection?: boolean
                    show_progress_to_students?: boolean
                    group_by_priority?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            checklist_templates: {
                Row: {
                    id: string
                    name: string
                    description: string
                    created_by_tutor_id: string
                    is_public: boolean
                    usage_count: number
                    average_completion_rate: number | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description: string
                    created_by_tutor_id: string
                    is_public?: boolean
                    usage_count?: number
                    average_completion_rate?: number | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string
                    created_by_tutor_id?: string
                    is_public?: boolean
                    usage_count?: number
                    average_completion_rate?: number | null
                    created_at?: string
                    updated_at?: string
                }
            }
            template_items: {
                Row: {
                    id: string
                    template_id: string
                    item_text: string
                    item_type: 'detection_area' | 'verification_step'
                    priority: 'critical' | 'important' | 'optional'
                    suggested_understanding_threshold: number | null
                    description: string | null
                    teaching_tips: string | null
                    sort_order: number
                }
                Insert: {
                    id?: string
                    template_id: string
                    item_text: string
                    item_type: 'detection_area' | 'verification_step'
                    priority: 'critical' | 'important' | 'optional'
                    suggested_understanding_threshold?: number | null
                    description?: string | null
                    teaching_tips?: string | null
                    sort_order?: number
                }
                Update: {
                    id?: string
                    template_id?: string
                    item_text?: string
                    item_type?: 'detection_area' | 'verification_step'
                    priority?: 'critical' | 'important' | 'optional'
                    suggested_understanding_threshold?: number | null
                    description?: string | null
                    teaching_tips?: string | null
                    sort_order?: number
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            initialize_checklist_from_template: {
                Args: {
                    p_room_id: string
                    p_template_name: string
                }
                Returns: string
            }
            initialize_transfer_checklist_v1: {
                Args: {
                    p_room_id: string
                    p_student_id: string
                    p_template_name: string
                }
                Returns: string
            }
            apply_learning_event_v1: {
                Args: {
                    p_event: Json
                }
                Returns: Json
            }
            update_checklist_progress: {
                Args: {
                    p_checklist_id: string
                }
                Returns: undefined
            }
        }
        Enums: {
            user_role: 'student' | 'tutor' | 'observer'
            user_status: 'active' | 'inactive'
            session_status: 'active' | 'completed' | 'cancelled'
            tutor_response_mode: 'tutoring' | 'guard'
            tutor_turn_mode: 'tutoring' | 'guard' | 'assessment'
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
} 

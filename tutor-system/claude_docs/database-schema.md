# database.ts - Database Schema Definition

Intent: document the generated TypeScript database contract used by the current Supabase schema.

## Purpose
Complete TypeScript interface definitions for the PostgreSQL database schema. Provides full type safety for all database operations through Supabase client integration.

## Architecture Overview

### Type-Safe Database Operations
- **Full schema coverage**: Every table, column, and relationship typed
- **Operation-specific types**: Row, Insert, Update types for each table
- **Enum definitions**: Consistent role and status values
- **Function signatures**: Database function parameters and returns

## Core Tables

### Users Table (Lines 12-43)
**Purpose**: User identity and role management
```typescript
Row: {
    id: string;
    email: string;
    display_name: string | null;
    current_role: 'student' | 'tutor' | 'observer' | null;
    status: 'active' | 'inactive';
    avatar_url: string | null;
    created_at: string;
    updated_at: string;
}
```

**Key Design Features**:
- **Flexible roles**: Users can switch between student/tutor/observer
- **Optional email**: Simplified auth doesn't require email verification
- **Avatar support**: User profile customization
- **Status tracking**: Active/inactive user management

### Rooms Table (Lines 44-99) 
**Purpose**: Virtual learning spaces with rich configuration
```typescript
Row: {
    id: string;
    tutor_id: string;  // Foreign key to users
    title: string;
    description: string | null;
    image_url: string | null;
    is_active: boolean;
    ai_assistant_enabled: boolean;
    ai_assistant_model: string | null;
    ai_assistant_prompt: string | null;
    pre_populated_dialogue: Json | null;  // Template conversations
    op_id: string | null;          // Original Poster for observer access
    op_display_name: string | null;
    op_avatar_url: string | null;
    password: string | null;       // Optional room protection
    active_response_mode: 'tutoring' | 'guard';
    mode_changed_at: string | null;
    mode_change_source: 'reviewed_response' | 'manual_override' | null;
    created_at: string;
    updated_at: string;
}
```

**Educational Features**:
- **Pre-populated dialogue**: JSON array for template conversations
- **AI integration**: Built-in AI assistant configuration storage
- **Observer support**: OP (Original Poster) configuration for external access
- **Password protection**: Optional room access control

### Messages Table (Lines 100-137)
**Purpose**: Real-time conversation storage with role, tutor-turn mode, and model diagnostics
```typescript
Row: {
    id: string;
    room_id: string;               // Foreign key to rooms
    user_id: string;               // Foreign key to users
    content: string;               // Message text
    user_role: 'student' | 'tutor' | 'observer';
    ai_model_used: string | null;  // Model identification
    ai_response_time_ms: number | null; // Performance metrics
    parent_message_id: string | null;   // Conversation threading
    response_mode: 'tutoring' | 'guard' | 'assessment' | 'multiagent' | null;
    created_at: string;
}
```

**AI Integration Features**:
- **Role identity**: `user_role` determines whether context treats a row as a user or assistant turn
- **Tutor-turn identity**: `response_mode` controls tutoring, Guard, assessment, and Multi-agent presentation
- **Model diagnostics**: Model and response time remain available for storage and exports
- **Conversation threading**: Parent-child message relationships
- **Multi-agent identity**: Only tutor rows in `multiagent` mode interpret a valid leading Riley or Tutor tag

Null message mode is presented as ordinary tutoring. Room participation remains limited to `tutoring | guard`; `assessment` and `multiagent` are message-level tutor-turn modes only.

### Guard Mode Persistence and Atomic Send
Migration `supabase/migrations/023_guard_mode.sql` adds the room and message mode fields, extends (or recreates) `ai_suggestion_feedback` with raw/final mode metadata, and defines `send_reviewed_tutor_response`. The RPC inserts the reviewed tutor message and feedback and updates the room mode in one transaction. The same migration adds database triggers that reject checklist progression mutations, deletions, and direct completion-field changes while `rooms.active_response_mode = 'guard'`; ordinary corrective chat remains available.

Migration `supabase/migrations/046_refactor_message_representation.sql` adds `multiagent` to `tutor_turn_mode`, removes the legacy AI-generation column and index, and recreates the affected reviewed-send RPCs against the new message shape. Existing tagged tutoring rows are not backfilled or decoded as Multi-agent messages.

## Educational System Tables

### Session Management (Lines 138-166)
```typescript
sessions: {
    id: string;
    tutor_id: string;
    student_id: string | null;
    room_id: string;
    status: 'active' | 'completed' | 'cancelled';
    started_at: string;
    ended_at: string | null;
}
```

**Purpose**: Track formal learning sessions with timing data

### AI Assistant Configuration (Lines 167-201)
```typescript
ai_assistant_configs: {
    id: string;
    room_id: string;
    model_name: string;           // default and only active value: "qwen3.5-flash"
    system_prompt: string | null; // AI behavior instructions
    temperature: number;          // AI randomness (0.0-2.0)
    max_tokens: number;           // Response length limit
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
```

**AI Behavior Control**:
- **Model selection**: The UI exposes only Qwen3.5 Flash; legacy stored values are migrated/normalized
- **Prompt engineering**: Custom system prompts for educational scenarios
- **Parameter tuning**: Temperature and token limits for response control
- **Version management**: Enable/disable configurations

## Educational Progress Tracking

### Checklist System (Lines 202-286)
**Purpose**: Comprehensive learning objective tracking
```typescript
session_checklists: {
    id: string;
    room_id: string;
    template_name: string;        // Educational scenario template
    total_items: number;
    completed_items: number;
    completion_percentage: number;
    is_active: boolean;
}

checklist_items: {
    id: string;
    checklist_id: string;
    area_text: string;            // Learning objective description
    item_type: 'detection_area' | 'verification_step';
    priority: 'critical' | 'important' | 'optional';
    status: 'pending' | 'partially_covered' | 'covered' | 'needs_review';
    understanding_level: 'none' | 'basic' | 'good' | 'excellent';
    tutor_notes: string | null;
    attempts_count: number;       // Learning attempt tracking
    original_template_area: boolean; // Distinguishes template vs. custom items
}
```

**Educational Assessment Features**:
- **Learning objectives**: Specific skills/knowledge areas to master
- **Progress levels**: Granular understanding assessment (none→excellent)
- **Attempt tracking**: Monitor student learning iterations  
- **Tutor annotations**: Custom notes and guidance
- **Template flexibility**: Mix of standard and custom learning objectives

### Evidence and Assessment (Lines 287-318)
```typescript
coverage_evidence: {
    id: string;
    item_id: string;             // Links to checklist_items
    evidence_text: string;       // Extracted student response
    analysis: string;            // AI/tutor assessment
    confidence_score: number;    // Assessment confidence (0.0-1.0)
    detection_method: 'ai_analysis' | 'tutor_manual' | 'student_self_assessment';
    message_id: string | null;   // Links to originating message
    timestamp: string;
}
```

**Assessment Methodology**:
- **Evidence extraction**: Captures student understanding demonstrations
- **Multi-source assessment**: AI, tutor, and self-assessment options
- **Confidence scoring**: Quantifies assessment reliability
- **Traceability**: Links evidence back to conversation context

### Change Tracking (Lines 319-356)
```typescript
checklist_updates: {
    id: string;
    checklist_id: string;
    item_id: string;
    previous_status: string;     // Audit trail for status changes
    new_status: string;
    previous_understanding: string;
    new_understanding: string;
    evidence_id: string | null;  // Links to supporting evidence
    updated_by: 'ai' | 'tutor' | 'student';
    created_at: string;
}
```

**Audit and Analytics**:
- **Change history**: Complete audit trail of learning progress
- **Source attribution**: Tracks who made assessments (AI vs. human)
- **Evidence linking**: Connects changes to supporting evidence
- **Analytics foundation**: Data for learning effectiveness analysis

## Configuration and Templates

### Checklist Configuration (Lines 357-394)
```typescript
checklist_configs: {
    room_id: string;
    ai_detection_sensitivity: 'strict' | 'moderate' | 'flexible';
    auto_coverage_detection: boolean;
    require_tutor_confirmation: boolean;
    completion_threshold: number;
    regression_detection: boolean;
    show_progress_to_students: boolean;
    group_by_priority: boolean;
}
```

**AI Assessment Tuning**:
- **Sensitivity levels**: Controls how strictly AI evaluates understanding
- **Automation levels**: Balance between AI and human assessment
- **Threshold settings**: Define completion criteria
- **Student visibility**: Control information flow to learners

### Template System (Lines 395-464)
```typescript
checklist_templates: {
    id: string;
    name: string;
    description: string;
    created_by_tutor_id: string;
    is_public: boolean;
    usage_count: number;
    average_completion_rate: number | null;
    created_at: string;
    updated_at: string;
}

template_items: {
    id: string;
    template_id: string;
    item_text: string;
    item_type: 'detection_area' | 'verification_step';
    priority: 'critical' | 'important' | 'optional';
    suggested_understanding_threshold: number | null;
    description: string | null;
    teaching_tips: string | null;
    sort_order: number;
}
```

**Template Management**:
- **Reusable scenarios**: Pre-built educational scenarios
- **Usage analytics**: Track template effectiveness
- **Teaching guidance**: Built-in tips and thresholds
- **Public library**: Shareable template ecosystem

## Database Functions (Lines 470-483)

### Checklist Initialization
```typescript
initialize_checklist_from_template: {
    Args: { p_room_id: string, p_template_name: string }
    Returns: string  // Checklist ID
}
```

### Progress Calculation
```typescript
update_checklist_progress: {
    Args: { p_checklist_id: string }
    Returns: undefined
}
```

**Database-Level Logic**:
- **Atomic operations**: Ensure data consistency
- **Complex calculations**: Server-side progress computation
- **Performance optimization**: Reduce client-server round trips

## Enums Definition (Lines 484-488)
```typescript
Enums: {
    user_role: 'student' | 'tutor' | 'observer';
    user_status: 'active' | 'inactive';
    session_status: 'active' | 'completed' | 'cancelled';
}
```

**Type Safety Benefits**:
- **Compile-time validation**: Prevents invalid enum values
- **IDE support**: Autocomplete and error checking
- **Consistency**: Guaranteed valid values across codebase

## Integration with Supabase

### Type-Safe Client
```typescript
const supabase = createClient<Database>(url, key);
```

**Benefits**:
- **Full IntelliSense**: IDE knows all table structures
- **Compile-time safety**: Prevents typos and wrong types
- **Schema evolution**: TypeScript catches breaking changes

### Operation Types
Each table provides three operation types:
- **Row**: Complete record with all fields (SELECT operations)
- **Insert**: Required and optional fields for creation
- **Update**: All fields optional for partial updates

### Query Building
```typescript
// Type-safe query with full IntelliSense
const { data, error } = await supabase
    .from('checklist_items')
    .select('area_text, priority, understanding_level')
    .eq('status', 'pending')
    .returns<ChecklistItemRow[]>();
```

## Schema Evolution Strategy

### Versioning Considerations
- **Additive changes**: New optional columns don't break existing code
- **Type migrations**: Update TypeScript definitions with schema changes
- **Backward compatibility**: Maintain support for existing client versions

### Performance Implications
- **Index strategy**: Key columns indexed for query performance
- **Relationship efficiency**: Foreign keys properly indexed
- **Query optimization**: Schema designed for common access patterns

This database schema provides a comprehensive foundation for educational applications with sophisticated progress tracking, AI integration, and flexible user management suitable for cybersecurity training scenarios.

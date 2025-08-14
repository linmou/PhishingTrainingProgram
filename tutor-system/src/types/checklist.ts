/**
 * Data structure for the checklist system
 * Based on the behaviors described in BDD feature files
 */

// Core checklist item interface
export interface ChecklistItem {
  id: string;                          // Unique identifier
  area_text: string;                   // The detection area or verification step text
  item_type: 'detection_area' | 'verification_step' | 'understanding' | 'behavior';
  priority?: 'critical' | 'important' | 'optional'; // Optional for simplified workflow
  status: 'pending' | 'partially_covered' | 'covered' | 'needs_review';
  understanding_level?: 'none' | 'basic' | 'good' | 'excellent'; // Optional for simplified workflow
  deleted?: boolean;                   // Soft delete support
  
  // Evidence and tracking
  coverage_evidence: CoverageEvidence[];
  tutor_notes: string;
  last_addressed: Date | null;
  attempts_count: number;
  
  // Metadata
  original_template_area: boolean;     // True if from template, false if custom
  created_at: Date;
  updated_at: Date;
}

// Evidence for why an area was marked as covered
export interface CoverageEvidence {
  id: string;
  evidence_text: string;              // What the student said/did
  analysis: string;                   // AI's analysis of why this shows understanding
  confidence_score: number;           // 0-100, AI's confidence in the assessment
  detection_method: 'ai_analysis' | 'tutor_manual' | 'student_self_assessment';
  timestamp: Date;
  message_id?: string;                // Reference to the message that provided evidence
}

// Session-level checklist
export interface SessionChecklist {
  id: string;
  room_id: string;
  template_name: string;
  session_start: Date;
  
  // Checklist items
  detection_areas: ChecklistItem[];
  verification_steps: ChecklistItem[];
  
  // Progress tracking
  total_items: number;
  completed_items: number;
  completion_percentage: number;
  
  // Session metadata
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

// Updates to checklist items
export interface ChecklistUpdate {
  id: string;
  checklist_id: string;
  item_id: string;
  
  // What changed
  previous_status: ChecklistItem['status'];
  new_status: ChecklistItem['status'];
  previous_understanding: ChecklistItem['understanding_level'];
  new_understanding: ChecklistItem['understanding_level'];
  
  // Why it changed
  evidence: CoverageEvidence;
  updated_by: 'ai' | 'tutor' | 'student';
  
  // When it changed
  created_at: Date;
}

// Configuration for checklist behavior
export interface ChecklistConfig {
  room_id: string;
  
  // AI behavior settings
  ai_detection_sensitivity: 'strict' | 'moderate' | 'flexible';
  auto_coverage_detection: boolean;
  require_tutor_confirmation: boolean;
  
  // Progress settings
  completion_threshold: number;        // What % understanding = "covered"
  regression_detection: boolean;       // Track if students lose understanding
  
  // Display settings
  show_progress_to_students: boolean;
  group_by_priority: boolean;
  
  created_at: Date;
  updated_at: Date;
}

// For real-time UI updates
export interface ChecklistProgress {
  total_areas: number;
  covered_areas: number;
  partially_covered_areas: number;
  pending_areas: number;
  completion_percentage: number;
  
  // Priority breakdown
  critical_pending: number;
  critical_covered: number;
  important_pending: number;
  important_covered: number;
  optional_pending: number;
  optional_covered: number;
}

// For tutor analytics
export interface ChecklistAnalytics {
  session_id: string;
  
  // Time metrics
  average_time_to_coverage: number;    // Minutes per area
  session_duration: number;
  most_difficult_areas: string[];     // Areas that took longest
  quickest_mastery_areas: string[];
  
  // Interaction metrics
  ai_detection_accuracy: number;       // % of AI detections confirmed by tutor
  tutor_overrides_count: number;
  student_engagement_score: number;
  
  // Coverage patterns
  coverage_timeline: CoverageTimelineEntry[];
  learning_velocity: number;           // Areas covered per hour
  
  generated_at: Date;
}

export interface CoverageTimelineEntry {
  timestamp: Date;
  item_id: string;
  item_text: string;
  status_change: string;
  evidence: string;
}

// For template management
export interface ChecklistTemplate {
  id: string;
  name: string;                        // e.g., "Nintendo Switch Deal ($19.99)"
  description: string;
  
  // Template items
  detection_areas: TemplateItem[];
  verification_steps: TemplateItem[];
  
  // Metadata
  created_by_tutor_id: string;
  is_public: boolean;
  usage_count: number;
  average_completion_rate: number;
  
  created_at: Date;
  updated_at: Date;
}

export interface TemplateItem {
  text: string;
  priority: 'critical' | 'important' | 'optional';
  suggested_understanding_threshold: number;
  description?: string;
  teaching_tips?: string;
}

// For AI system prompt generation
export interface ChecklistSystemPromptData {
  uncovered_critical: ChecklistItem[];
  uncovered_important: ChecklistItem[];
  partially_covered: ChecklistItem[];
  well_covered: ChecklistItem[];
  
  // Instructions for AI
  focus_areas: string[];
  avoid_over_explaining: string[];
  reinforce_areas: string[];
}

// API response types
export interface ChecklistUpdateResponse {
  success: boolean;
  updated_items: ChecklistItem[];
  new_completion_percentage: number;
  system_prompt_regenerated: boolean;
  error?: string;
}

export interface CoverageDetectionResult {
  detected_coverage: {
    item_id: string;
    evidence: string;
    confidence: number;
    understanding_level: ChecklistItem['understanding_level'];
  }[];
  analysis_confidence: number;
  requires_tutor_review: boolean;
}

// For multi-student tracking
export interface StudentChecklistProgress {
  student_id: string;
  student_name: string;
  checklist: SessionChecklist;
  progress: ChecklistProgress;
  needs_attention: boolean;
  last_activity: Date;
}
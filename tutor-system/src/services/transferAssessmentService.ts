// Purpose: provide the browser facade for authenticated transfer-assessment operations without exposing private keys.

import { supabase } from './supabase';
import type {
  AssessmentOption,
  AssessmentOptionId,
  AssessmentSelectionType,
  PublicAssessment,
  TutorDecisionV3,
} from '../types/assessment';
import type { TransferProgress } from '../types/learningProgress';

export interface AssessmentApiError {
  code: string;
  message: string;
  retryable: boolean;
}

export type AssessmentApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: AssessmentApiError };

export interface PublicAssessmentDTO {
  id: string;
  selection_type: 'single' | 'multiple';
  stem: string;
  rendered_text: string;
  options: AssessmentOption[];
}

/**
 * Public question lifecycle DTO. The contract permits scope, link, timestamp, and result fields
 * needed by the UI, but never `correct_option_ids` or `transfer_basis`. The field list below is
 * exactly the Edge Function's `publicQuestion` allowlist, so the browser sees what the server
 * chose to send and nothing more.
 */
export interface PublicQuestionDTO extends PublicAssessmentDTO {
  room_id: string;
  student_id: string;
  checklist_id: string | null;
  item_id: string | null;
  tutor_message_id: string | null;
  source_student_message_id: string | null;
  lifecycle: string;
  answer_message_id: string | null;
  selected_option_ids: string[] | null;
  result: Record<string, unknown> | null;
  closed_reason: string | null;
  feedback_message_id: string | null;
}

/** Public stored-message DTO. Contains no private draft or feedback row. */
export interface PublicMessageDTO {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  user_role: string;
  is_ai_generated: boolean;
  parent_message_id: string | null;
  response_mode: string | null;
  created_at: string;
}

/** The exact key set of `PublicQuestionDTO`, mirroring the Edge Function allowlist. */
export const PUBLIC_QUESTION_DTO_KEYS: ReadonlyArray<keyof PublicQuestionDTO> = [
  'id',
  'room_id',
  'student_id',
  'checklist_id',
  'item_id',
  'tutor_message_id',
  'source_student_message_id',
  'selection_type',
  'stem',
  'rendered_text',
  'options',
  'lifecycle',
  'answer_message_id',
  'selected_option_ids',
  'result',
  'closed_reason',
  'feedback_message_id',
];

/** The exact key set of `PublicMessageDTO`, mirroring the Edge Function allowlist. */
export const PUBLIC_MESSAGE_DTO_KEYS: ReadonlyArray<keyof PublicMessageDTO> = [
  'id',
  'room_id',
  'user_id',
  'content',
  'user_role',
  'is_ai_generated',
  'parent_message_id',
  'response_mode',
  'created_at',
];

/** Assessment material that must never appear on a public question or message. */
export const PUBLIC_ASSESSMENT_FORBIDDEN_KEYS: ReadonlyArray<string> = [
  'correct_option_ids',
  'transfer_basis',
  'private_payload',
  'private_payload_hash',
  'public_payload_hash',
  'raw_model_output',
  'reviewed_payload',
  'source_transfer_basis',
  'teacher_confirmation_id',
];

function projectAllowlisted<T>(row: Record<string, unknown>, keys: ReadonlyArray<keyof T>): T {
  const projected: Record<string, unknown> = {};
  keys.forEach((key) => {
    projected[key as string] = row[key as string] ?? null;
  });
  return projected as unknown as T;
}

/**
 * Project a stored question row onto the public DTO. Allowlisted rather than denied, so a new
 * private column cannot reach a learner merely by being added to storage.
 */
export function toPublicQuestionDTO(row: Record<string, unknown>): PublicQuestionDTO {
  return projectAllowlisted<PublicQuestionDTO>(row, PUBLIC_QUESTION_DTO_KEYS);
}

/** Project a stored message row onto the public DTO. */
export function toPublicMessageDTO(row: Record<string, unknown>): PublicMessageDTO {
  return projectAllowlisted<PublicMessageDTO>(row, PUBLIC_MESSAGE_DTO_KEYS);
}

/**
 * Result of `send_reviewed`. Mirrors `send_reviewed_tutor_response_v3`'s four-field return,
 * with the message and question projected through the public allowlists. `feedback_id` is a
 * server-side reference only; it carries no draft or private assessment material.
 */
export interface ReviewedDeliveryDTO {
  message: PublicMessageDTO;
  question: PublicQuestionDTO | null;
  room: Record<string, unknown>;
  feedback_id: string;
}

/**
 * Result of `process_message`. Mirrors `process_assessment_message_v1`'s return. The grading
 * outcome and the learner's own selections are public; the assessment key and transfer basis
 * are not part of this shape and cannot be reached through it.
 */
export interface ProcessedMessageDTO {
  question_id: string;
  result: Record<string, unknown> | null;
  selected_option_ids: string[] | null;
  transition: Record<string, unknown> | null;
  feedback_required: boolean;
}

function projectReviewedDelivery(result: Record<string, unknown>): ReviewedDeliveryDTO {
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    message: toPublicMessageDTO(asRecord(result.message)),
    question: result.question ? toPublicQuestionDTO(asRecord(result.question)) : null,
    // The room row is already the public room shape the room API returns; it carries no
    // assessment material, so it is passed through rather than re-allowlisted here.
    room: asRecord(result.room),
    feedback_id: String(result.feedback_id ?? ''),
  };
}

function projectProcessedMessage(result: Record<string, unknown>): ProcessedMessageDTO {
  return {
    question_id: String(result.question_id ?? ''),
    result: (result.result ?? null) as Record<string, unknown> | null,
    selected_option_ids: (result.selected_option_ids ?? null) as string[] | null,
    transition: (result.transition ?? null) as Record<string, unknown> | null,
    feedback_required: result.feedback_required === true,
  };
}

/**
 * The only private browser DTO name for an assessment draft (reconciliation R05).
 *
 * Returned solely to a verified reviewing teacher and only by draft-review operations. It
 * deliberately carries the private basis a teacher must inspect, which is exactly why it must
 * never be returned by a learner operation or embedded in a public/realtime message payload.
 *
 * Field names are browser names and are not storage names; see
 * `specs/102-transfer-backend/contracts/assessment-api.md`, which owns this allowlist.
 */
export interface TeacherAssessmentDraftDTO {
  draft_id: string;
  revision: number;
  status: 'draft' | 'ignored' | 'sent';
  decision: Record<string, unknown>;
  reason: string | null;
  assessment_basis: Record<string, unknown> | null;
}

/** The exact key set of `TeacherAssessmentDraftDTO`, for boundary and drift assertions. */
export const TEACHER_ASSESSMENT_DRAFT_DTO_KEYS: ReadonlyArray<keyof TeacherAssessmentDraftDTO> = [
  'draft_id',
  'revision',
  'status',
  'decision',
  'reason',
  'assessment_basis',
];

/**
 * The only field names a teacher draft DTO may carry. Anything outside this list is a storage
 * name that leaked through, so this doubles as the deny-by-default boundary for the private row.
 */
export const TEACHER_ASSESSMENT_DRAFT_DTO_FORBIDDEN_STORAGE_NAMES: ReadonlyArray<string> = [
  'id',
  'room_id',
  'student_id',
  'checklist_id',
  'item_id',
  'focus_student_message_id',
  'raw_model_output',
  'reviewed_payload',
  'reviewed_by',
  'created_at',
  'updated_at',
];

/**
 * Project a private draft row onto the browser DTO. Unknown keys are dropped rather than
 * forwarded, so a new private column cannot reach the browser by being added to storage.
 */
export function toTeacherAssessmentDraftDTO(row: Record<string, unknown>): TeacherAssessmentDraftDTO {
  const dto: Record<string, unknown> = {};
  TEACHER_ASSESSMENT_DRAFT_DTO_KEYS.forEach((key) => {
    dto[key] = row[key] ?? null;
  });
  return dto as unknown as TeacherAssessmentDraftDTO;
}

export interface TransferAssessmentApi {
  invoke: (body: Record<string, unknown>) => Promise<{ data: AssessmentApiEnvelope<unknown> | null; error: { message: string } | null }>;
}

export interface TransferAssessmentServiceOptions {
  api?: TransferAssessmentApi;
  requestId?: () => string;
}

export interface TransferAssessmentAnswerInput {
  delivered: boolean;
  answer_message_id: string;
  content: string;
  selection_type: AssessmentSelectionType;
  options: ReadonlyArray<AssessmentOption>;
  correct_option_ids: ReadonlyArray<AssessmentOptionId>;
  current_progress: TransferProgress;
}

export interface UndeliveredAssessmentResult {
  disposition: 'not_delivered';
  progress: TransferProgress;
  feedback_required: false;
}

/**
 * Keep answers for drafts and other unsent questions outside the grading path.
 * Later task slices add delivery, parsing, and persistence branches here.
 */
export function resolveTransferAssessmentAnswer(
  input: TransferAssessmentAnswerInput
): UndeliveredAssessmentResult | null {
  if (input.delivered) return null;
  return {
    disposition: 'not_delivered',
    progress: input.current_progress,
    feedback_required: false,
  };
}

function defaultRequestId(): string {
  const cryptoApi = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  return cryptoApi?.randomUUID ? cryptoApi.randomUUID() : `transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function publicAssessment(value: unknown): PublicAssessmentDTO {
  const assessment = value as PublicAssessment & { id: string; correct_option_ids?: unknown; transfer_basis?: unknown };
  return {
    id: assessment.id,
    selection_type: assessment.selection_type,
    stem: assessment.stem,
    rendered_text: assessment.rendered_text,
    options: assessment.options.map((option) => ({ id: option.id, text: option.text })),
  };
}

function createDefaultApi(): TransferAssessmentApi {
  return {
    invoke: async (body) => {
      const result = await (supabase as any).functions.invoke('assessment-api', { body });
      return result;
    },
  };
}

export class TransferAssessmentService {
  private readonly api: TransferAssessmentApi;
  private readonly requestId: () => string;

  constructor(options: TransferAssessmentServiceOptions = {}) {
    this.api = options.api || createDefaultApi();
    this.requestId = options.requestId || defaultRequestId;
  }

  private async request<T>(operation: string, payload: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.api.invoke({
      operation,
      request_id: this.requestId(),
      ...payload,
    });
    if (error) throw new Error(`Assessment API request failed: ${error.message}`);
    if (!data) throw new Error('Assessment API returned no response');
    if (!data.ok) throw new Error(`${data.error.code}: ${data.error.message}`);
    return data.data as T;
  }

  async initializeChecklist(input: {
    roomId: string;
    studentId: string;
    templateName: string;
  }): Promise<{ checklist_id: string }> {
    return this.request<{ checklist_id: string }>('initialize_checklist', {
      room_id: input.roomId,
      student_id: input.studentId,
      template_name: input.templateName,
    });
  }

  async postMessage(input: {
    roomId: string;
    content: string;
    replyToMessageId?: string;
    assessmentId?: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('post_message', {
      room_id: input.roomId,
      content: input.content,
      parent_message_id: input.replyToMessageId || null,
      assessment_id: input.assessmentId || null,
    });
  }

  async prepareTurn(input: {
    roomId: string;
    focusStudentMessageId: string;
    checklistId: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('prepare_turn', {
      room_id: input.roomId,
      focus_student_message_id: input.focusStudentMessageId,
      checklist_id: input.checklistId,
    });
  }

  async reviewDraft(input: {
    draftId: string;
    expectedRevision: number;
    finalPayload: TutorDecisionV3;
    contentConfirmed: boolean;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('review_draft', {
      draft_id: input.draftId,
      expected_revision: input.expectedRevision,
      final_payload: input.finalPayload,
      content_confirmed: input.contentConfirmed,
    });
  }

  async sendReviewed(input: {
    draftId: string;
    expectedRevision: number;
  }): Promise<ReviewedDeliveryDTO> {
    const result = await this.request<Record<string, unknown>>('send_reviewed', {
      draft_id: input.draftId,
      expected_revision: input.expectedRevision,
    });
    return projectReviewedDelivery(result);
  }

  async processMessage(messageId: string): Promise<ProcessedMessageDTO> {
    const result = await this.request<Record<string, unknown>>('process_message', { message_id: messageId });
    return projectProcessedMessage(result);
  }

  async analyzeMessage(messageId: string, roomId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('analyze_message', {
      message_id: messageId,
      room_id: roomId,
    });
  }

  static toPublicAssessment(value: unknown): PublicAssessmentDTO {
    return publicAssessment(value);
  }
}

export const transferAssessmentService = new TransferAssessmentService();

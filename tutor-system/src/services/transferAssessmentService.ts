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
import type { Room } from '../types';

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

/** Project a stored message row onto the public DTO. */
export function toPublicMessageDTO(row: Record<string, unknown>): PublicMessageDTO {
  return projectAllowlisted<PublicMessageDTO>(row, PUBLIC_MESSAGE_DTO_KEYS);
}

/**
 * Result of `send_reviewed`. Mirrors `send_reviewed_tutor_response_v3`'s return, which is the
 * stored tutor message plus the updated room. There is no question table any more, so the
 * assessment travels on the message itself and no separate question DTO exists.
 */
export interface ReviewedDeliveryDTO {
  message: PublicMessageDTO;
  room: Room;
}

/**
 * Result of `process_message`. Mirrors `process_assessment_message_v1`'s return, which has THREE
 * shapes and is reproduced faithfully rather than collapsed into one:
 *   graded     - `message_id`, `result`, `selected_option_ids`, `transition`, `feedback_required`
 *   unresolved - `message_id`, `code: 'ANSWER_FORMAT_UNRESOLVED'`, `clarification_required: true`
 *   replayed   - `message_id`, `result`, `already_processed: true`
 * The identity key is `message_id`. An earlier version of this shape read `question_id`, which the
 * server never returns, so the assessment identity was the empty string on every learner answer and
 * the clarification signal was unreachable from the UI. The grading outcome and the learner's own
 * selections are public; the assessment key and transfer basis are not part of this shape.
 */
export interface ProcessedMessageDTO {
  message_id: string;
  result: string | null;
  selected_option_ids: string[] | null;
  transition: Record<string, unknown> | null;
  feedback_required: boolean;
  /** Present only when the exact-set parser could not resolve the answer to a selection. */
  code: string | null;
  clarification_required: boolean;
  already_processed: boolean;
}

function projectReviewedDelivery(result: Record<string, unknown>): ReviewedDeliveryDTO {
  const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    message: toPublicMessageDTO(asRecord(result.message)),
    // The room row is already the public room shape the room API returns; it carries no
    // assessment material, so it is passed through rather than re-allowlisted here.
    room: asRecord(result.room) as unknown as Room,
  };
}

function projectProcessedMessage(result: Record<string, unknown>): ProcessedMessageDTO {
  return {
    message_id: String(result.message_id ?? ''),
    result: typeof result.result === 'string' ? result.result : null,
    selected_option_ids: (result.selected_option_ids ?? null) as string[] | null,
    transition: (result.transition ?? null) as Record<string, unknown> | null,
    feedback_required: result.feedback_required === true,
    code: typeof result.code === 'string' ? result.code : null,
    clarification_required: result.clarification_required === true,
    already_processed: result.already_processed === true,
  };
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

  /**
   * Deliver a reviewed assessment or tutoring turn. There is no draft table, so the reviewed
   * payload and the scope it applies to travel on this one call; the tutor message is created
   * and the assessment is stamped onto it atomically.
   */
  async sendReviewed(input: {
    reviewedPayload: TutorDecisionV3;
    roomId: string;
    studentId: string;
    checklistId: string;
    /** Null for a tutoring or Guard turn; an assessment must name its item. */
    itemId: string | null;
    focusStudentMessageId: string;
  }): Promise<ReviewedDeliveryDTO> {
    const result = await this.request<Record<string, unknown>>('send_reviewed', {
      reviewed_payload: input.reviewedPayload,
      room_id: input.roomId,
      student_id: input.studentId,
      checklist_id: input.checklistId,
      item_id: input.itemId,
      focus_student_message_id: input.focusStudentMessageId,
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

// Purpose: expose a typed browser facade for the trusted transfer-assessment API.

import { supabase } from './supabase';
import type { Room } from '../types';
import type { LearningTargetInput } from '../types/checklist';
import type { AssessmentEvent, AssessmentHistoryReadiness, AssessmentOption, AssessmentOptionId, PrivateAssessment, TransferAssessmentDraft } from '../types/assessment';
import { parseAssessmentEvent } from './assessmentRendering';
import {
  PUBLIC_ASSESSMENT_DTO_KEYS,
  type AssessmentApiEnvelope,
  type AssessmentApiError,
  type AssessmentApiOperation,
} from '../types/assessmentApi';

export type { AssessmentApiEnvelope, AssessmentApiError } from '../types/assessmentApi';
export { PUBLIC_ASSESSMENT_DTO_KEYS } from '../types/assessmentApi';

export interface PublicAssessmentDTO {
  id: string;
  student_id: string;
  selection_type: 'single' | 'multiple';
  stem: string;
  options: AssessmentOption[];
}

export interface TutorAssessmentReview {
  student_id?: string;
  history_readiness: AssessmentHistoryReadiness;
  item_label: string;
  assessment: PrivateAssessment;
  resolution?: string;
  attempt_count?: number;
  feedback_required?: boolean;
  lifecycle?: string;
}

export interface PublicMessageDTO {
  assessment_event?: AssessmentEvent | null;
  assessment_id?: string | null;
  assessment_selected_option_ids?: AssessmentOptionId[] | null;
  assessment_lifecycle?: string | null;
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  user_role: string;
  ai_model_used?: string | null;
  ai_response_time_ms?: number | null;
  parent_message_id: string | null;
  response_mode: string | null;
  assessment?: PublicAssessmentDTO | null;
  created_at: string;
}

export const PUBLIC_MESSAGE_DTO_KEYS: ReadonlyArray<keyof PublicMessageDTO> = [
  'id',
  'room_id',
  'user_id',
  'content',
  'user_role',
  'ai_model_used',
  'ai_response_time_ms',
  'parent_message_id',
  'response_mode',
  'assessment',
  'created_at',
  'assessment_lifecycle',
  'assessment_event',
  'assessment_id',
  'assessment_selected_option_ids',
];

export const PUBLIC_ASSESSMENT_FORBIDDEN_KEYS: ReadonlyArray<string> = [
  'rendered_text',
  'correct_option_ids',
  'learner_safe_explanation',
  'transfer_basis',
  'rationale',
  'raw_model_output',
  'raw_provider_output',
  'reviewed_payload',
  'private_payload',
];

export interface ReviewedDeliveryDTO {
  message: PublicMessageDTO;
  room: Room;
}

export type AssessmentProcessingState = 'applied' | 'duplicate' | 'rejected' | 'deferred';
export type AssessmentAnswerOutcome = 'retry' | 'passed' | 'failed';

export interface TerminalFailureFeedbackDTO {
  correct_option_ids: AssessmentOptionId[];
  learner_safe_explanation: string;
}

export interface ProcessedMessageDTO {
  result_message: PublicMessageDTO | null;
  message_id: string;
  assessment_id: string;
  processing_state: AssessmentProcessingState;
  answer_outcome: AssessmentAnswerOutcome | null;
  attempt_number: 1 | 2 | null;
  attempts_used: 0 | 1 | 2;
  attempts_remaining: 0 | 1 | 2;
  selected_option_ids: AssessmentOptionId[] | null;
  terminal: boolean;
  transition: Record<string, unknown> | null;
  feedback_required: boolean;
  code: string | null;
  already_processed: boolean;
  terminal_failure_feedback: TerminalFailureFeedbackDTO | null;
}

export interface TransferAssessmentApi {
  invoke: (
    body: Record<string, unknown>
  ) => Promise<{
    data: AssessmentApiEnvelope<unknown> | null;
    error: { message: string; context?: { json: () => Promise<unknown> } } | null;
  }>;
}

export interface TransferAssessmentServiceOptions {
  api?: TransferAssessmentApi;
  requestId?: () => string;
}

export class AssessmentApiRequestError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(error: AssessmentApiError) {
    super(error.message);
    this.name = 'AssessmentApiRequestError';
    this.code = error.code;
    this.retryable = error.retryable;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, code = 'INVALID_REQUEST'): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function optionIds(value: unknown): AssessmentOptionId[] | null {
  if (!Array.isArray(value)) return null;
  const ids = value.filter((item): item is AssessmentOptionId =>
    item === 'A' || item === 'B' || item === 'C' || item === 'D'
  );
  return ids.length === value.length ? ids : null;
}

function options(value: unknown): AssessmentOption[] {
  if (!Array.isArray(value) || value.length !== 4) throw new Error('ITEM_VALIDATION_FAILED');
  return value.map((candidate) => {
    const option = asRecord(candidate);
    const id = requiredString(option.id, 'ITEM_VALIDATION_FAILED') as AssessmentOptionId;
    if (!['A', 'B', 'C', 'D'].includes(id)) throw new Error('ITEM_VALIDATION_FAILED');
    return { id, text: requiredString(option.text, 'ITEM_VALIDATION_FAILED') };
  });
}

function publicAssessment(value: unknown): PublicAssessmentDTO {
  const source = asRecord(value);
  const selectionType = source.selection_type;
  if (selectionType !== 'single' && selectionType !== 'multiple') {
    throw new Error('ITEM_VALIDATION_FAILED');
  }
  const result: PublicAssessmentDTO = {
    id: requiredString(source.id, 'INVALID_SCOPE'),
    student_id: requiredString(source.student_id, 'INVALID_SCOPE'),
    selection_type: selectionType,
    stem: requiredString(source.stem, 'ITEM_VALIDATION_FAILED'),
    options: options(source.options),
  };
  if (Object.keys(result).some((key, index) => key !== PUBLIC_ASSESSMENT_DTO_KEYS[index])) {
    throw new Error('INVALID_PUBLIC_ASSESSMENT_PROJECTION');
  }
  return result;
}

export function toPublicMessageDTO(value: unknown): PublicMessageDTO {
  const source = asRecord(value);
  const assessmentValue = source.assessment;
  return {
    id: requiredString(source.id),
    room_id: requiredString(source.room_id),
    user_id: requiredString(source.user_id),
    content: requiredString(source.content),
    user_role: requiredString(source.user_role),
    ai_model_used: nullableString(source.ai_model_used),
    ai_response_time_ms: typeof source.ai_response_time_ms === 'number' ? source.ai_response_time_ms : null,
    parent_message_id: nullableString(source.parent_message_id),
    response_mode: nullableString(source.response_mode),
    assessment_lifecycle: nullableString(source.assessment_lifecycle),
    assessment_event: parseAssessmentEvent(source.assessment_event),
    assessment_id: nullableString(source.assessment_id),
    assessment_selected_option_ids: optionIds(source.assessment_selected_option_ids),
    assessment: assessmentValue == null ? null : publicAssessment(assessmentValue),
    created_at: requiredString(source.created_at),
  };
}

function projectReviewedDelivery(value: unknown): ReviewedDeliveryDTO {
  const source = asRecord(value);
  return {
    message: toPublicMessageDTO(source.message),
    room: asRecord(source.room) as unknown as Room,
  };
}

function processingState(value: unknown): AssessmentProcessingState {
  return value === 'duplicate' || value === 'rejected' || value === 'deferred' ? value : 'applied';
}

function outcome(value: unknown): AssessmentAnswerOutcome | null {
  return value === 'retry' || value === 'passed' || value === 'failed' ? value : null;
}

function boundedAttempt(value: unknown, allowZero: boolean): 0 | 1 | 2 {
  if (value === 1 || value === 2 || (allowZero && value === 0)) return value;
  return allowZero ? 0 : 1;
}

function projectProcessedMessage(value: unknown): ProcessedMessageDTO {
  const source = asRecord(value);
  const answerOutcome = outcome(source.answer_outcome);
  const terminal = source.terminal === true;
  const feedbackSource = asRecord(source.terminal_failure_feedback);
  const feedbackIds = optionIds(feedbackSource.correct_option_ids);
  const feedbackExplanation = nullableString(feedbackSource.learner_safe_explanation);
  const feedback = answerOutcome === 'failed' && terminal && source.feedback_required === true &&
      feedbackIds && feedbackExplanation
    ? { correct_option_ids: feedbackIds, learner_safe_explanation: feedbackExplanation }
    : null;
  const rawAttempt = source.attempt_number;
  if (!Object.prototype.hasOwnProperty.call(source,'result_message')) throw new Error('ASSESSMENT_RESULT_UNAVAILABLE');
  const resultMessage = source.result_message == null ? null : toPublicMessageDTO(source.result_message);
  if ((answerOutcome || source.code === 'assisted' || source.code === 'cancelled') && !resultMessage?.assessment_event) {
    throw new Error('ASSESSMENT_RESULT_UNAVAILABLE');
  }
  const event = resultMessage?.assessment_event;
  if (event && (event.assessment_id!==source.assessment_id ||
    (event.kind==='result' && event.answer_message_id!==source.message_id))) throw new Error('INVALID_ASSESSMENT_EVENT');
  return {
    result_message: resultMessage,
    message_id: requiredString(source.message_id),
    assessment_id: requiredString(source.assessment_id),
    processing_state: processingState(source.processing_state),
    answer_outcome: answerOutcome,
    attempt_number: rawAttempt === 1 || rawAttempt === 2 ? rawAttempt : null,
    attempts_used: boundedAttempt(source.attempts_used, true),
    attempts_remaining: boundedAttempt(source.attempts_remaining, true),
    selected_option_ids: optionIds(source.selected_option_ids),
    terminal,
    transition: Object.keys(asRecord(source.transition)).length ? asRecord(source.transition) : null,
    feedback_required: source.feedback_required === true,
    code: nullableString(source.code),
    already_processed: source.already_processed === true,
    terminal_failure_feedback: feedback,
  };
}

function defaultRequestId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  return randomUuid ? randomUuid.call(globalThis.crypto) : `transfer-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function storedApplicationUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const storedUser = window.localStorage.getItem('tutor_system_user');
    const user = storedUser ? asRecord(JSON.parse(storedUser)) : {};
    return nullableString(user.id);
  } catch {
    return null;
  }
}

function createDefaultApi(): TransferAssessmentApi {
  return {
    invoke: async (body) => {
      const userId = storedApplicationUserId();
      return (supabase as any).functions.invoke('assessment-api', {
        body,
        headers: userId ? { 'x-application-user-id': userId } : {},
      });
    },
  };
}

export class TransferAssessmentService {
  private readonly api: TransferAssessmentApi;
  private readonly requestId: () => string;

  constructor(options: TransferAssessmentServiceOptions = {}) {
    this.api = options.api ?? createDefaultApi();
    this.requestId = options.requestId ?? defaultRequestId;
  }

  private async request<T>(operation: AssessmentApiOperation, payload: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.api.invoke({ operation, request_id: this.requestId(), ...payload });
    if (error?.context && typeof error.context.json === 'function') {
      let body: unknown;
      try {
        body = await error.context.json();
      } catch {
        // Non-JSON network errors retain the transport failure below.
      }
      const envelope = asRecord(body);
      const failure = asRecord(envelope.error);
      if (envelope.ok === false && typeof failure.code === 'string' &&
          typeof failure.message === 'string' && typeof failure.retryable === 'boolean') {
        throw new AssessmentApiRequestError({ code: failure.code, message: failure.message, retryable: failure.retryable });
      }
    }
    if (data?.ok === false) throw new AssessmentApiRequestError(data.error);
    if (error) throw new Error(`Assessment API request failed: ${error.message}`);
    if (!data) throw new Error('Assessment API returned no response');
    return data.data as T;
  }

  initializeChecklist(input: { roomId: string; studentId: string; items: LearningTargetInput[] }): Promise<{ checklist_id: string }> {
    return this.request('initialize_checklist', {
      room_id: input.roomId,
      student_id: input.studentId,
      items: input.items,
    });
  }

  joinRoom(roomId: string): Promise<{ room_id: string; learner_id: string | null; room_role: 'student' | 'observer' }> {
    return this.request('join_room', { room_id: roomId });
  }

  readReview(roomId: string, assessmentId: string): Promise<TutorAssessmentReview> {
    return this.request('read_review', { room_id: roomId, assessment_id: assessmentId });
  }

  clearChatHistory(roomId:string):Promise<{success:boolean;title:string;prePopulatedMessagesPreserved:boolean}> {
    return this.request('clear_chat_history',{room_id:roomId});
  }

  editLearningProgress(input: {
    roomId: string;
    itemId: string;
    action?: 'set_status' | 'set_understanding' | 'edit_item' | 'set_priority' | 'add_item' | 'remove_item' | 'update_item';
    updates: Record<string, unknown>;
  }): Promise<Record<string, unknown>> {
    return this.request('edit_learning_progress', {
      room_id: input.roomId,
      item_id: input.itemId,
      action: input.action ?? 'update_item',
      updates: input.updates,
    });
  }

  postMessage(input: {
    roomId: string;
    content: string;
    replyToMessageId?: string;
    assessmentId?: string;
    selectedOptionIds?: ReadonlyArray<AssessmentOptionId>;
  }): Promise<Record<string, unknown>> {
    return this.request('post_message', {
      room_id: input.roomId,
      content: input.content,
      parent_message_id: input.replyToMessageId ?? null,
      assessment_id: input.assessmentId ?? null,
      selected_option_ids: input.selectedOptionIds ? [...input.selectedOptionIds] : null,
    });
  }

  prepareAssessment(input: { roomId: string; focusStudentMessageId: string; checklistId: string }): Promise<Record<string, unknown> | null> {
    return this.request('prepare_turn', {
      room_id: input.roomId,
      focus_student_message_id: input.focusStudentMessageId,
      checklist_id: input.checklistId,
    });
  }

  async sendReviewed(input: {
    reviewedPayload: TransferAssessmentDraft;
    roomId: string;
    studentId: string;
    checklistId: string;
    itemId: string;
    focusStudentMessageId: string;
  }): Promise<ReviewedDeliveryDTO> {
    const result = await this.request('send_reviewed', {
      reviewed_payload: input.reviewedPayload,
      room_id: input.roomId,
      student_id: input.studentId,
      checklist_id: input.checklistId,
      item_id: input.itemId,
      focus_student_message_id: input.focusStudentMessageId,
    });
    return projectReviewedDelivery(result);
  }

  async processMessage(messageId: string, assessmentId?: string, roomId?: string): Promise<ProcessedMessageDTO> {
    const result = await this.request('process_message', {
      message_id: messageId,
      assessment_id: assessmentId ?? null,
      room_id: roomId ?? null,
    });
    return projectProcessedMessage(result);
  }

  analyzeMessage(messageId: string, roomId: string): Promise<Record<string, unknown>> {
    return this.request('analyze_message', { message_id: messageId, room_id: roomId });
  }

  static toPublicAssessment(value: unknown): PublicAssessmentDTO {
    return publicAssessment(value);
  }
}

export const transferAssessmentService = new TransferAssessmentService();

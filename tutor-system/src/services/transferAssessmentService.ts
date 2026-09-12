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
  status: 'draft' | 'rejected' | 'ignored' | 'sent' | 'superseded';
  supersedes_draft_id: string | null;
  progress_snapshot_hash: string | null;
  decision: Record<string, unknown>;
  reason: string | null;
  assessment_basis: Record<string, unknown> | null;
}

/** The exact key set of `TeacherAssessmentDraftDTO`, for boundary and drift assertions. */
export const TEACHER_ASSESSMENT_DRAFT_DTO_KEYS: ReadonlyArray<keyof TeacherAssessmentDraftDTO> = [
  'draft_id',
  'revision',
  'status',
  'supersedes_draft_id',
  'progress_snapshot_hash',
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
  'raw_hash',
  'final_hash',
  'reviewed_payload',
  'reviewed_by',
  'trigger_key',
  'rejected_reason',
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

export interface TransferAssessmentCapabilities {
  enabled: boolean;
  policy_available: boolean;
  can_review_assessment: boolean;
  reason?: string;
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

/**
 * Result of `reject_draft`. `same_trigger_suppressed` is always true on success: the
 * backend records the trigger key so a later generation for the same scope is suppressed
 * instead of producing a second draft.
 */
export interface RejectedAssessmentDraftDTO {
  draft_id: string;
  revision: number;
  status: 'rejected';
  same_trigger_suppressed: true;
  request_id: string;
}

/**
 * Result of `regenerate_draft`. The source is superseded and the replacement starts a new
 * draft lifecycle at revision 1, so callers must use `replacement_draft_id` from here on.
 */
export interface RegeneratedAssessmentDraftDTO {
  source_draft_id: string;
  source_status: 'superseded';
  replacement_draft_id: string;
  replacement_revision: number;
  replacement_status: 'draft';
  request_id: string;
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

  async capabilities(roomId: string): Promise<TransferAssessmentCapabilities> {
    return this.request<TransferAssessmentCapabilities>('capabilities', { room_id: roomId });
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

  async rejectDraft(input: {
    draftId: string;
    expectedRevision: number;
    reason: string;
  }): Promise<RejectedAssessmentDraftDTO> {
    return this.request<RejectedAssessmentDraftDTO>('reject_draft', {
      draft_id: input.draftId,
      expected_revision: input.expectedRevision,
      reason: input.reason,
    });
  }

  /**
   * Replace a rejected or stale draft with a freshly generated one.
   *
   * `providerPayload` must already have been produced by the caller. The provider call
   * deliberately stays outside this request so a provider failure cannot leave the source
   * draft mutated: when generation fails, nothing is sent and the source keeps its status.
   */
  async regenerateDraft(input: {
    sourceDraftId: string;
    expectedRevision: number;
    expectedSnapshotHash: string;
    providerPayload: Record<string, unknown>;
    rawHash: string;
  }): Promise<RegeneratedAssessmentDraftDTO> {
    return this.request<RegeneratedAssessmentDraftDTO>('regenerate_draft', {
      source_draft_id: input.sourceDraftId,
      expected_revision: input.expectedRevision,
      expected_snapshot_hash: input.expectedSnapshotHash,
      provider_payload: input.providerPayload,
      raw_hash: input.rawHash,
    });
  }

  async sendReviewed(input: {
    draftId: string;
    expectedRevision: number;
    expectedHash: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('send_reviewed', {
      draft_id: input.draftId,
      expected_revision: input.expectedRevision,
      expected_hash: input.expectedHash,
    });
  }

  async processMessage(messageId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('process_message', { message_id: messageId });
  }

  async analyzeMessage(messageId: string, roomId: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('analyze_message', {
      message_id: messageId,
      room_id: roomId,
    });
  }

  async cancelQuestion(questionId: string, reason: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('cancel_question', { question_id: questionId, reason });
  }

  async invalidateQuestion(questionId: string, reason: string, expectedSnapshot: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('invalidate_question', {
      question_id: questionId,
      reason,
      expected_snapshot: expectedSnapshot,
    });
  }

  async confirmExternalTransfer(input: {
    itemId: string;
    sourceEvidenceMessageIds: string[];
    transferEvidence: string;
    note: string;
    expectedSnapshot: string;
  }): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('confirm_external_transfer', {
      item_id: input.itemId,
      source_evidence_message_ids: input.sourceEvidenceMessageIds,
      transfer_evidence: input.transferEvidence,
      note: input.note,
      expected_snapshot: input.expectedSnapshot,
    });
  }

  static toPublicAssessment(value: unknown): PublicAssessmentDTO {
    return publicAssessment(value);
  }
}

export const transferAssessmentService = new TransferAssessmentService();

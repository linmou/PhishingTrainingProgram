// Purpose: provide the browser facade for authenticated transfer-assessment operations without exposing private keys.

import { supabase } from './supabase';
import {
  AssessmentOption,
  AssessmentOptionId,
  AssessmentSelectionType,
  PublicAssessment,
  TutorDecisionV3,
} from '../types/assessment';
import { TransferProgress } from '../types/learningProgress';

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

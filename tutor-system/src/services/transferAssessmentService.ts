// Purpose: the transfer-assessment service for the research demo. It runs entirely in the browser
// against the public tables: it initialises the transfer checklist, asks the provider for the next
// tutor turn, delivers the assessment onto the tutor message, and grades the learner's answer with
// the component-101 pure domain. There is no server boundary, no principal verification, and no
// service-role RPC; the research build deliberately trades those away for a runnable demo.

import { supabase } from './supabase';
import { parseAssessmentAnswer } from './assessmentAnswerParser';
import { resolveTransferAnswer } from './transferAssessmentOrchestrator';
import { TRANSFER_V3_SYSTEM_PROMPT } from './prompts/transferV3Prompt';
import type {
  AssessmentOption,
  AssessmentOptionId,
  AssessmentSelectionType,
  PublicAssessment,
  TransferEvidenceDecision,
  TutorDecisionV3,
} from '../types/assessment';
import type { TransferProgress, TransferStatus } from '../types/learningProgress';
import { LEVEL_BY_STATUS } from '../types/learningProgress';
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
  ai_model_used?: string | null;
  ai_response_time_ms?: number | null;
  parent_message_id: string | null;
  response_mode: string | null;
  created_at: string;
}

/** The exact key set of `PublicMessageDTO`, mirroring the former Edge Function allowlist. */
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

/** Result of delivering a reviewed turn: the stored tutor message plus the updated room. */
export interface ReviewedDeliveryDTO {
  message: PublicMessageDTO;
  room: Room;
}

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

const USER_STORAGE_KEY = 'tutor_system_user';

interface StoredUser {
  id?: string;
  current_role?: string;
  role?: string;
}

/** The app's own identity: a self-asserted row in public.users stored in localStorage. */
function currentUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

function requireUserId(): string {
  const user = currentUser();
  const id = user?.id;
  if (!id) throw new Error('NO_IDENTITY: join the room before using transfer assessment');
  return String(id);
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newId(): string {
  const cryptoApi = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto;
  return cryptoApi?.randomUUID ? cryptoApi.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function publicAssessment(value: unknown): PublicAssessmentDTO {
  const assessment = value as PublicAssessment & { id: string };
  return {
    id: assessment.id,
    selection_type: assessment.selection_type,
    stem: assessment.stem,
    rendered_text: assessment.rendered_text,
    options: assessment.options.map((option) => ({ id: option.id, text: option.text })),
  };
}

/** The three concepts a demo checklist starts with. Learner evidence makes them eligible later. */
const DEFAULT_TRANSFER_ITEMS: ReadonlyArray<{ area_text: string; priority: string }> = [
  { area_text: 'A familiar sender or a trusted-looking post is not proof that a message is safe', priority: 'critical' },
  { area_text: 'Pressure language that demands immediate action is a warning sign', priority: 'critical' },
  { area_text: 'Verify through the real app or the known address instead of the message link', priority: 'important' },
];

interface ChecklistItemRow {
  id: string;
  area_text: string;
  priority: string;
  status: string;
  understanding_level: string;
  relevant_evidence_message_ids: string[];
  repair_message_id: string | null;
  attempts_count: number;
}

/** Validate the provider draft the same way the former server boundary did. */
function assertV3DraftShape(
  value: unknown,
  itemIds: Set<string>,
  messageIds: Set<string>,
  existingEligibleItemIds: Set<string>,
  focusMessageId: string,
  assessmentBlocked: boolean
): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI_OUTPUT_INVALID');
  const candidate = value as Record<string, any>;
  if (typeof candidate.reason !== 'string' || !candidate.reason.trim()) throw new Error('AI_OUTPUT_INVALID');
  if (!Array.isArray(candidate.learning_evidence)) throw new Error('AI_OUTPUT_INVALID');
  const seenEvidenceItems = new Set<string>();
  for (const rawEvidence of candidate.learning_evidence) {
    if (!rawEvidence || typeof rawEvidence !== 'object') throw new Error('AI_OUTPUT_INVALID');
    if (!itemIds.has(rawEvidence.item_id) || rawEvidence.evidence_message_id !== focusMessageId ||
        !['initial', 'contradiction', 'spontaneous_transfer'].includes(rawEvidence.signal) ||
        typeof rawEvidence.analysis !== 'string' || !rawEvidence.analysis.trim() ||
        seenEvidenceItems.has(rawEvidence.item_id)) {
      throw new Error('AI_OUTPUT_INVALID');
    }
    seenEvidenceItems.add(rawEvidence.item_id);
  }
  if (!candidate.decision || typeof candidate.decision !== 'object') throw new Error('AI_OUTPUT_INVALID');
  const decision = candidate.decision;
  if (!['tutoring', 'guard', 'assessment'].includes(decision.mode)) throw new Error('AI_OUTPUT_INVALID');
  if (!['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', 'transfer_assess', 'guard'].includes(decision.instruction)) throw new Error('AI_OUTPUT_INVALID');
  if (decision.target_item_id !== null && decision.target_item_id !== undefined && !itemIds.has(decision.target_item_id)) throw new Error('AI_OUTPUT_INVALID');
  if (typeof candidate.response !== 'string' || !candidate.response.trim()) throw new Error('AI_OUTPUT_INVALID');
  if (decision.mode !== 'assessment') {
    if (candidate.assessment !== null || decision.target_item_id != null || decision.instruction === 'transfer_assess') {
      throw new Error('AI_OUTPUT_INVALID');
    }
    return;
  }

  const assessment = candidate.assessment;
  if (decision.instruction !== 'transfer_assess' || !decision.target_item_id || !assessment) throw new Error('AI_OUTPUT_INVALID');
  const currentEvidence = candidate.learning_evidence.find(
    (entry: TransferEvidenceDecision) => entry.item_id === decision.target_item_id && entry.signal === 'initial'
  );
  if (assessmentBlocked || (!existingEligibleItemIds.has(decision.target_item_id) && !currentEvidence)) {
    throw new Error('AI_OUTPUT_INVALID');
  }
  if (!['single', 'multiple'].includes(assessment.selection_type)) throw new Error('AI_OUTPUT_INVALID');
  if (!Array.isArray(assessment.options) || assessment.options.length !== 4) throw new Error('AI_OUTPUT_INVALID');
  if (assessment.options.some((option: any, index: number) => option?.id !== ['A', 'B', 'C', 'D'][index] || typeof option.text !== 'string' || !option.text.trim())) throw new Error('AI_OUTPUT_INVALID');
  if (!Array.isArray(assessment.correct_option_ids) || assessment.correct_option_ids.length === 0) throw new Error('AI_OUTPUT_INVALID');
  if (assessment.correct_option_ids.some((id: unknown) => !['A', 'B', 'C', 'D'].includes(String(id)))) throw new Error('AI_OUTPUT_INVALID');
  const basis = assessment.transfer_basis;
  if (!basis || typeof basis !== 'object' || !basis.concept_rule || !basis.source_context || !basis.changed_context) throw new Error('AI_OUTPUT_INVALID');
  if (!Array.isArray(basis.source_evidence_message_ids) || basis.source_evidence_message_ids.length === 0) throw new Error('AI_OUTPUT_INVALID');
  if (basis.source_evidence_message_ids.some((id: unknown) => !messageIds.has(String(id)))) throw new Error('AI_OUTPUT_INVALID');
}

export class TransferAssessmentService {
  private client(): any {
    return supabase as any;
  }

  /** Create the transfer policy checklist and its demo items for one learner in one room. */
  async initializeChecklist(input: {
    roomId: string;
    studentId: string;
    templateName: string;
  }): Promise<{ checklist_id: string }> {
    const checklistId = newId();
    const { error: checklistError } = await this.client().from('session_checklists').insert({
      id: checklistId,
      room_id: input.roomId,
      student_id: input.studentId,
      template_name: input.templateName,
      progress_policy_version: 'transfer_v1',
      is_active: true,
      total_items: DEFAULT_TRANSFER_ITEMS.length,
      completed_items: 0,
      completion_percentage: 0,
    });
    if (checklistError) throw new Error(`Could not initialise the transfer checklist: ${checklistError.message}`);

    const itemRows = DEFAULT_TRANSFER_ITEMS.map((item) => ({
      id: newId(),
      checklist_id: checklistId,
      area_text: item.area_text,
      priority: item.priority,
      status: 'pending',
      understanding_level: 'none',
    }));
    const { error: itemError } = await this.client().from('checklist_items').insert(itemRows);
    if (itemError) throw new Error(`Could not create the transfer checklist items: ${itemError.message}`);
    return { checklist_id: checklistId };
  }

  async postMessage(input: {
    roomId: string;
    content: string;
    replyToMessageId?: string;
    assessmentId?: string;
  }): Promise<Record<string, unknown>> {
    const userId = requireUserId();
    const role = currentUser()?.current_role || 'student';
    const { data, error } = await this.client().from('messages').insert({
      room_id: input.roomId,
      user_id: userId,
      content: input.content,
      user_role: role,
      parent_message_id: input.replyToMessageId || null,
      response_mode: 'tutoring',
    }).select('*').single();
    if (error) throw new Error(`Could not store the message: ${error.message}`);
    return { message: data };
  }

  /**
   * Ask the provider for the next tutor turn. The context is assembled here and sent straight to the
   * model; the returned candidate is reviewed by the teacher before delivery.
   */
  async prepareTurn(input: {
    roomId: string;
    focusStudentMessageId: string;
    checklistId: string;
  }): Promise<Record<string, unknown>> {
    const client = this.client();
    const { data: checklist, error: checklistError } = await client
      .from('session_checklists')
      .select('id,room_id,student_id,progress_policy_version')
      .eq('id', input.checklistId)
      .eq('room_id', input.roomId)
      .eq('progress_policy_version', 'transfer_v1')
      .eq('is_active', true)
      .maybeSingle();
    if (checklistError || !checklist?.student_id) throw new Error('LEGACY_CHECKLIST: no active transfer checklist');

    const [{ data: focusMessage }, { data: itemRowsRaw }, { data: room }] = await Promise.all([
      client.from('messages').select('id,room_id,user_id,user_role,content').eq('id', input.focusStudentMessageId).maybeSingle(),
      client.from('checklist_items').select('id,area_text,priority,status,understanding_level,attempts_count').eq('checklist_id', checklist.id),
      client.from('rooms').select('active_response_mode').eq('id', input.roomId).maybeSingle(),
    ]);
    if (!focusMessage) throw new Error('INVALID_REQUEST: the focus learner message is unknown');
    if (focusMessage.room_id !== checklist.room_id || focusMessage.user_role !== 'student' ||
        focusMessage.user_id !== checklist.student_id) {
      throw new Error('INVALID_REQUEST: the focus message must belong to the checklist owner');
    }

    const itemRows: ChecklistItemRow[] = (itemRowsRaw || []).map((item: any) => ({
      id: item.id,
      area_text: item.area_text,
      priority: item.priority,
      status: item.status,
      understanding_level: item.understanding_level,
      relevant_evidence_message_ids: [],
      repair_message_id: null,
      attempts_count: Number(item.attempts_count || 0),
    }));
    const itemIds = new Set(itemRows.map((item) => item.id));
    const [{ data: evidenceRowsRaw, error: evidenceError }, { data: roomMessagesRaw, error: roomMessagesError }] = await Promise.all([
      itemRows.length
        ? client.from('coverage_evidence').select('id,item_id,message_id').in('item_id', itemRows.map((item) => item.id))
        : Promise.resolve({ data: [], error: null }),
      client.from('messages')
        .select('id,user_id,user_role,parent_message_id,created_at,response_mode,assessment_id,assessment_item_id,assessment_checklist_id,assessment_options,assessment_selection_type,assessment_lifecycle,assessment_answer_message_id,assessment_result')
        .eq('room_id', input.roomId)
        .order('created_at', { ascending: false }),
    ]);
    if (evidenceError) throw new Error(`Could not read transfer evidence: ${evidenceError.message}`);
    if (roomMessagesError) throw new Error(`Could not read assessment state: ${roomMessagesError.message}`);

    const evidenceRows = evidenceRowsRaw || [];
    for (const item of itemRows) {
      item.relevant_evidence_message_ids = evidenceRows
        .filter((evidence: any) => evidence.item_id === item.id && evidence.message_id)
        .map((evidence: any) => String(evidence.message_id));
    }
    const roomMessages = roomMessagesRaw || [];
    const assessmentRows = roomMessages.filter(
      (message: any) => message.assessment_checklist_id === checklist.id && message.response_mode === 'assessment'
    );
    const unresolvedRow = assessmentRows.find((message: any) => message.assessment_lifecycle === 'delivered') || null;
    const awaitingFeedbackRow = assessmentRows.find((message: any) => {
      if (message.assessment_lifecycle !== 'answered' || !message.assessment_answer_message_id) return false;
      return !roomMessages.some((candidate: any) =>
        candidate.user_role === 'tutor' && candidate.parent_message_id === message.assessment_answer_message_id
      );
    }) || null;
    const assessmentBlocked = Boolean(unresolvedRow || awaitingFeedbackRow);
    const messageIds = new Set<string>([
      focusMessage.id,
      ...evidenceRows.map((evidence: any) => evidence.message_id).filter(Boolean).map(String),
    ]);
    const eligibleItemIds = assessmentBlocked ? [] : itemRows
      .filter((item) => item.status === 'partially_covered' && item.understanding_level === 'basic' &&
        item.relevant_evidence_message_ids.length > 0)
      .map((item) => item.id);
    const progressSnapshotHash = await sha256Hex(
      JSON.stringify({ checklist, itemRows, focus_message_id: focusMessage.id })
    );

    const providerKey = process.env.REACT_APP_OAI_API_KEY;
    const providerBaseUrl = process.env.REACT_APP_OAI_BASE_URL;
    if (!providerKey || !providerBaseUrl) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
    const model = process.env.REACT_APP_OAI_MODEL || 'qwen3.5-flash';
    const promptContext = {
      focus_student_id: checklist.student_id,
      focus_student_message: focusMessage,
      progress_policy_version: checklist.progress_policy_version,
      prior_participation_mode: room?.active_response_mode || 'unknown',
      checklist_items: itemRows,
      eligible_assessment_item_ids: eligibleItemIds,
      assessment_blocked: assessmentBlocked,
      assessment_candidate_item_ids: itemRows
        .filter((item) => item.status !== 'covered')
        .map((item) => item.id),
      unresolved_assessment: unresolvedRow ? {
        id: unresolvedRow.assessment_id || unresolvedRow.id,
        selection_type: unresolvedRow.assessment_selection_type,
        options: unresolvedRow.assessment_options,
      } : null,
      feedback_required: Boolean(awaitingFeedbackRow),
      progress_snapshot_hash: progressSnapshotHash,
    };

    const providerUrl = `${providerBaseUrl.replace(/\/$/, '')}/chat/completions`;
    let candidate: Record<string, any> | null = null;
    let lastValidationError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(providerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: TRANSFER_V3_SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({
              ...promptContext,
              ...(attempt === 1 ? {
                format_repair: 'The previous output was invalid. Return valid JSON. If assessment is blocked or unsupported, return tutoring or guard with learning_evidence and assessment null.',
              } : {}),
            }) },
          ],
          temperature: 0.3,
          max_tokens: 1200,
          enable_thinking: false,
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) throw new Error(`AI_PROVIDER_ERROR: ${response.status}`);
      const payload = await response.json();
      const rawContent = payload?.choices?.[0]?.message?.content;
      try {
        const parsed = JSON.parse(rawContent) as unknown;
        assertV3DraftShape(
          parsed,
          itemIds,
          messageIds,
          new Set(eligibleItemIds),
          focusMessage.id,
          assessmentBlocked
        );
        candidate = parsed;
        break;
      } catch (validationError) {
        lastValidationError = validationError;
      }
    }
    if (!candidate) throw (lastValidationError instanceof Error ? lastValidationError : new Error('AI_OUTPUT_INVALID'));

    for (const evidence of candidate.learning_evidence as TransferEvidenceDecision[]) {
      const item = itemRows.find((row) => row.id === evidence.item_id);
      if (!item) continue;
      const alreadyStored = evidenceRows.some(
        (row: any) => row.item_id === evidence.item_id && row.message_id === evidence.evidence_message_id
      );
      if (alreadyStored) continue;

      const evidenceId = newId();
      const { error: insertEvidenceError } = await client.from('coverage_evidence').insert({
        id: evidenceId,
        item_id: evidence.item_id,
        evidence_text: focusMessage.content,
        analysis: evidence.analysis,
        confidence_score: 100,
        detection_method: 'ai_semantic',
        message_id: evidence.evidence_message_id,
      });
      if (insertEvidenceError) throw new Error(`Could not store transfer evidence: ${insertEvidenceError.message}`);

      const next = evidence.signal === 'spontaneous_transfer'
        ? { status: 'covered', understanding_level: 'good' }
        : evidence.signal === 'contradiction'
          ? { status: 'needs_review', understanding_level: 'basic' }
          : { status: 'partially_covered', understanding_level: 'basic' };
      if (item.status === next.status && item.understanding_level === next.understanding_level) continue;
      const { error: itemUpdateError } = await client.from('checklist_items').update({
        ...next,
        attempts_count: item.attempts_count + 1,
        last_addressed: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', item.id);
      if (itemUpdateError) throw new Error(`Could not update transfer progress: ${itemUpdateError.message}`);
      const { error: historyError } = await client.from('checklist_updates').insert({
        checklist_id: checklist.id,
        item_id: item.id,
        previous_status: item.status,
        new_status: next.status,
        previous_understanding: item.understanding_level,
        new_understanding: next.understanding_level,
        evidence_id: evidenceId,
        updated_by: 'ai',
      });
      if (historyError) throw new Error(`Could not store transfer progress history: ${historyError.message}`);
    }

    return {
      decision: candidate,
      progress_snapshot_hash: progressSnapshotHash,
      room_id: checklist.room_id,
      student_id: checklist.student_id,
      checklist_id: checklist.id,
      item_id: (candidate as any).decision.target_item_id ?? null,
      focus_student_message_id: focusMessage.id,
    };
  }

  /** Deliver the reviewed turn. An assessment is stamped onto the tutor message itself. */
  async sendReviewed(input: {
    reviewedPayload: TutorDecisionV3;
    roomId: string;
    studentId: string;
    checklistId: string;
    itemId: string | null;
    focusStudentMessageId: string;
  }): Promise<ReviewedDeliveryDTO> {
    const client = this.client();
    const userId = requireUserId();
    const decision = input.reviewedPayload as unknown as Record<string, any>;
    const mode = decision?.decision?.mode;
    const assessment = decision?.assessment;
    const content = mode === 'assessment'
      ? String(assessment?.rendered_text || assessment?.stem || decision?.response || '')
      : String(decision?.response || '');

    if (mode === 'assessment') {
      const { data: openRows, error: openError } = await client.from('messages')
        .select('id')
        .eq('assessment_checklist_id', input.checklistId)
        .eq('assessment_lifecycle', 'delivered');
      if (openError) throw new Error(`Could not check open assessments: ${openError.message}`);
      if ((openRows || []).length > 0) throw new Error('ASSESSMENT_ALREADY_OPEN');
    }

    const row: Record<string, unknown> = {
      room_id: input.roomId,
      user_id: userId,
      content,
      user_role: 'tutor',
      parent_message_id: input.focusStudentMessageId,
      response_mode: mode === 'assessment' ? 'assessment' : 'tutoring',
    };
    if (mode === 'assessment' && assessment) {
      row.assessment_id = newId();
      row.assessment_item_id = input.itemId;
      row.assessment_checklist_id = input.checklistId;
      row.assessment_options = assessment.options;
      row.assessment_key = assessment.correct_option_ids;
      row.assessment_selection_type = assessment.selection_type;
      row.assessment_lifecycle = 'delivered';
    }

    const { data: stored, error } = await client.from('messages').insert(row).select('*').single();
    if (error) throw new Error(`Could not deliver the reviewed turn: ${error.message}`);

    // The room stays in tutoring mode; an assessment is an ordinary tutor turn.
    const nextRoomMode = mode === 'guard' ? 'guard' : 'tutoring';
    const { error: roomUpdateError } = await client.from('rooms').update({ active_response_mode: nextRoomMode }).eq('id', input.roomId);
    if (roomUpdateError) throw new Error(`Could not update the room mode: ${roomUpdateError.message}`);
    const { data: room } = await client.from('rooms').select('*').eq('id', input.roomId).maybeSingle();
    return { message: toPublicMessageDTO(stored as Record<string, unknown>), room: room as Room };
  }

  /** Grade the learner's answer locally and apply the single progress transition. */
  async processMessage(messageId: string): Promise<ProcessedMessageDTO> {
    const client = this.client();
    const empty: ProcessedMessageDTO = {
      message_id: messageId,
      result: null,
      selected_option_ids: null,
      transition: null,
      feedback_required: false,
      code: null,
      clarification_required: false,
      already_processed: false,
    };

    const { data: answer } = await client.from('messages').select('*').eq('id', messageId).maybeSingle();
    if (!answer) return empty;
    if (answer.assessment_result) {
      return { ...empty, already_processed: true, result: answer.assessment_result };
    }

    const { data: checklist } = await client
      .from('session_checklists')
      .select('id,room_id,student_id,progress_policy_version')
      .eq('room_id', answer.room_id)
      .eq('student_id', answer.user_id)
      .eq('progress_policy_version', 'transfer_v1')
      .maybeSingle();
    if (!checklist) return empty;

    const { data: assessmentRow } = await client
      .from('messages')
      .select('*')
      .eq('room_id', answer.room_id)
      .eq('assessment_checklist_id', checklist.id)
      .eq('assessment_lifecycle', 'delivered')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!assessmentRow) return empty;
    const assessment = {
      id: String(assessmentRow.assessment_id || assessmentRow.id),
      item_id: String(assessmentRow.assessment_item_id || ''),
      selection_type: assessmentRow.assessment_selection_type as AssessmentSelectionType,
      options: (assessmentRow.assessment_options || []) as AssessmentOption[],
      correct_option_ids: (assessmentRow.assessment_key || []) as AssessmentOptionId[],
      progress_snapshot_hash: '',
    };

    const { data: item } = await client
      .from('checklist_items')
      .select('id,status,understanding_level,checklist_id')
      .eq('id', assessment.item_id)
      .maybeSingle();
    const progressStatus = (item?.status || 'partially_covered') as TransferStatus;
    const progress: TransferProgress = {
      status: progressStatus,
      understanding_level: LEVEL_BY_STATUS[progressStatus],
    } as TransferProgress;
    const { data: itemRows } = await client
      .from('checklist_items')
      .select('id,area_text,priority,status,understanding_level')
      .eq('checklist_id', assessmentRow.assessment_checklist_id);
    const mappedItems = (itemRows || []).map((row: any) => ({
      id: row.id,
      area_text: row.area_text,
      priority: row.priority,
      status: row.status,
      understanding_level: row.understanding_level,
      relevant_evidence_message_ids: [],
      repair_message_id: null,
    }));
    // The delivered assessment remembers the learner turn it answered, so the snapshot hash is
    // rebuilt from the same inputs the prepare step hashed.
    const focusId = String(assessmentRow.parent_message_id || '');
    if (checklist && focusId) {
      assessment.progress_snapshot_hash = await sha256Hex(
        JSON.stringify({ checklist, itemRows: mappedItems, focus_message_id: focusId })
      );
    }

    const resolved = resolveTransferAnswer(
      {
        progress,
        participation_mode: 'tutoring',
        progress_snapshot_hash: assessment.progress_snapshot_hash,
        feedback_required: false,
        eligible_assessment_item_ids: [],
        unresolved_assessment: { ...assessment, transfer_basis: undefined } as unknown as PublicAssessment & { id: string },
        pending_repair_message_id: null,
      },
      {
        delivered: true,
        answer_message_id: messageId,
        content: String(answer.content || ''),
        assessment,
      }
    );

    const clarification = resolved.clarification_code === 'ANSWER_FORMAT_UNRESOLVED';
    if (clarification) {
      return { ...empty, code: 'ANSWER_FORMAT_UNRESOLVED', clarification_required: true };
    }
    if (resolved.disposition === 'assisted') {
      const { error: cancelError } = await client.from('messages').update({
        assessment_lifecycle: 'cancelled',
        assessment_answer_message_id: messageId,
        assessment_closed_at: new Date().toISOString(),
      }).eq('id', assessmentRow.id);
      if (cancelError) throw new Error(`Could not cancel the assisted assessment: ${cancelError.message}`);
      return empty;
    }
    if (resolved.disposition === 'duplicate') {
      return { ...empty, already_processed: true };
    }

    const graded = resolved.disposition === 'passed' ? 'pass' : 'fail';
    const selected = parseAssessmentAnswer(
      String(answer.content || ''),
      assessment.selection_type,
      assessment.options
    );
    const selectedIds = selected.kind === 'selection' ? selected.option_ids : null;

    const { error: answerUpdateError } = await client.from('messages').update({
      assessment_result: graded,
      assessment_selected_option_ids: selectedIds,
    }).eq('id', messageId);
    if (answerUpdateError) throw new Error(`Could not store the assessment answer: ${answerUpdateError.message}`);
    const { error: assessmentUpdateError } = await client.from('messages').update({
      assessment_lifecycle: 'answered',
      assessment_answer_message_id: messageId,
      assessment_result: graded,
      assessment_selected_option_ids: selectedIds,
      assessment_closed_at: new Date().toISOString(),
    }).eq('id', assessmentRow.id);
    if (assessmentUpdateError) throw new Error(`Could not close the assessment: ${assessmentUpdateError.message}`);

    if (item?.id) {
      const evidenceId = newId();
      const assessmentId = String(assessmentRow.assessment_id || assessmentRow.id);
      const nextStatus = graded === 'pass' ? 'covered' : 'needs_review';
      const nextUnderstanding = graded === 'pass' ? 'good' : 'basic';
      const { error: resultEvidenceError } = await client.from('coverage_evidence').insert({
        id: evidenceId,
        item_id: item.id,
        evidence_text: String(answer.content || ''),
        analysis: graded === 'pass'
          ? 'The learner selected the exact correct option set in the transfer assessment.'
          : 'The learner did not select the exact correct option set in the transfer assessment.',
        confidence_score: 100,
        detection_method: 'transfer_assessment',
        message_id: messageId,
        assessment_id: assessmentId,
      });
      if (resultEvidenceError) throw new Error(`Could not store assessment evidence: ${resultEvidenceError.message}`);
      const { error: itemProgressError } = await client.from('checklist_items').update({
        status: nextStatus,
        understanding_level: nextUnderstanding,
      }).eq('id', item.id);
      if (itemProgressError) throw new Error(`Could not update assessment progress: ${itemProgressError.message}`);
      const { error: historyError } = await client.from('checklist_updates').insert({
        checklist_id: checklist.id,
        item_id: item.id,
        previous_status: item.status,
        new_status: nextStatus,
        previous_understanding: item.understanding_level,
        new_understanding: nextUnderstanding,
        evidence_id: evidenceId,
        assessment_id: assessmentId,
        updated_by: 'ai',
      });
      if (historyError) throw new Error(`Could not store assessment progress history: ${historyError.message}`);
    }
    if (checklist?.id) {
      const total = (itemRows || []).length || 1;
      const covered = (itemRows || []).filter((row: any) => row.status === 'covered').length
        + (graded === 'pass' ? 1 : 0);
      const { error: checklistProgressError } = await client.from('session_checklists').update({
        completed_items: covered,
        completion_percentage: Math.round((covered / total) * 100),
        is_active: covered < total,
      }).eq('id', checklist.id);
      if (checklistProgressError) throw new Error(`Could not update checklist completion: ${checklistProgressError.message}`);
    }

    return {
      message_id: messageId,
      result: graded,
      selected_option_ids: selectedIds,
      transition: {
        applied_transition: resolved.applied_transition,
        status: resolved.progress.status,
        understanding_level: resolved.progress.understanding_level,
      },
      feedback_required: resolved.feedback_required,
      code: null,
      clarification_required: false,
      already_processed: false,
    };
  }

  /**
   * Apply learner evidence to the checklist. The demo checklist already carries eligible items, so
   * this is a no-op that preserves the caller's contract.
   */
  async analyzeMessage(messageId: string, roomId: string): Promise<Record<string, unknown>> {
    void roomId;
    return { analyzed_message_id: messageId, applied: [] };
  }

  static toPublicAssessment(value: unknown): PublicAssessmentDTO {
    return publicAssessment(value);
  }
}

export const transferAssessmentService = new TransferAssessmentService();

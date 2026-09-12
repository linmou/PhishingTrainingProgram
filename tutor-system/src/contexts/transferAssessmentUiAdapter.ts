// Purpose: adapt component 102's transfer-assessment responses into React view state without
// retaining private assessment material or inventing operation mapping.

import type { Message, RoomParticipationMode } from '../types';
import type { AssessmentOption, AssessmentSelectionType, TutorDecisionV3 } from '../types/assessment';
import {
  PUBLIC_MESSAGE_DTO_KEYS,
  TransferAssessmentService,
} from '../services/transferAssessmentService';
import type { PublicAssessmentDTO } from '../services/transferAssessmentService';

/** UI-local review status. View state only; never a progress state and never a server record. */
export type ReviewStatus =
  | 'idle'
  | 'preparing'
  | 'ready'
  | 'dirty'
  | 'sending'
  | 'delivered'
  | 'superseded'
  | 'validation'
  | 'unavailable'
  | 'unauthorized'
  | 'retryable';

/** The learner-visible question, rebuilt only from fields that are public. */
export interface PublicQuestionView {
  id: string;
  stem: string;
  options: AssessmentOption[];
  /** Null when the persisted row does not record the selection type. Never inferred from the key. */
  selectionType: AssessmentSelectionType | null;
}

/**
 * Stored message row projected for React state. It carries the public question when the row is a
 * delivered assessment, and carries nothing else the row happened to contain.
 */
export interface RoomMessageView extends Message {
  publicQuestion: PublicQuestionView | null;
}

/** The prepared scope identity from `prepareTurn`. */
export interface ReviewScope {
  roomId: string;
  studentId: string;
  checklistId: string;
  /** Null for a tutoring or Guard turn: only an assessment names a checklist item. */
  itemId: string | null;
  focusStudentMessageId: string;
}

/** The teacher-visible candidate decision plus its local review status. */
export interface TeacherReviewCandidateView {
  scope: ReviewScope;
  decision: TutorDecisionV3;
  status: ReviewStatus;
  message: string | null;
}

/** Result of the local deliverability check. */
export type ReviewCheck = { ok: true } | { ok: false; status: ReviewStatus; message: string };

const OPTION_ORDER: ReadonlyArray<AssessmentOption['id']> = ['A', 'B', 'C', 'D'];
const TURN_MODES: ReadonlyArray<string> = ['tutoring', 'guard', 'assessment'];

/** Display-only message fields that are safe for every role and are not part of the public DTO. */
const DISPLAY_MESSAGE_KEYS = ['ai_model_used', 'ai_response_time_ms', 'display_name', 'avatar_url'];

const ERROR_STATUS: ReadonlyArray<readonly [string, ReviewStatus]> = [
  ['ASSESSMENT_FEATURE_DISABLED', 'unavailable'],
  ['AI_PROVIDER_NOT_CONFIGURED', 'unavailable'],
  ['AUTHORIZATION_NOT_CONFIGURED', 'unavailable'],
  // No transfer checklist in this room: the capability does not apply here at all.
  ['LEGACY_CHECKLIST', 'unavailable'],
  // The learner already has a delivered assessment, so this delivery is superseded.
  ['ASSESSMENT_ALREADY_OPEN', 'superseded'],
  // The prepared focus identity no longer matches the learner: the teacher must prepare again.
  ['WRONG_LEARNER', 'validation'],
  ['ITEM_VALIDATION_FAILED', 'validation'],
  ['AI_OUTPUT_INVALID', 'validation'],
  ['INVALID_SCOPE', 'validation'],
  ['INVALID_REQUEST', 'validation'],
  ['FORBIDDEN', 'unauthorized'],
  ['UNAUTHORIZED', 'unauthorized'],
];

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function orderedOptions(value: unknown): AssessmentOption[] | null {
  if (!Array.isArray(value) || value.length !== OPTION_ORDER.length) return null;
  const byId = new Map<string, string>();
  value.forEach((entry) => {
    const option = asRecord(entry);
    const id = asNonEmptyString(option.id);
    const text = asNonEmptyString(option.text);
    if (id && text && OPTION_ORDER.includes(id as AssessmentOption['id'])) byId.set(id, text);
  });
  if (byId.size !== OPTION_ORDER.length) return null;
  return OPTION_ORDER.map((id) => ({ id, text: byId.get(id) as string }));
}

function isCompletePublicAssessment(value: unknown): value is PublicAssessmentDTO {
  const record = asRecord(value);
  return (
    Boolean(asNonEmptyString(record.id)) &&
    (record.selection_type === 'single' || record.selection_type === 'multiple') &&
    Boolean(asNonEmptyString(record.stem)) &&
    orderedOptions(record.options) !== null
  );
}

/**
 * Build the learner question from a stored message row. Only `content` and `assessment_options`
 * are read, and only when the row records a delivered assessment lifecycle. The selection type is
 * not persisted, so it stays null unless an explicit public projection supplies it.
 */
export function publicQuestionFromStoredRow(
  row: Record<string, unknown>,
  explicit?: PublicAssessmentDTO | null
): PublicQuestionView | null {
  const source = asRecord(row);
  if (source.assessment_lifecycle !== 'delivered' && source.assessment_lifecycle !== 'answered') return null;
  const options = orderedOptions(source.assessment_options);
  const id = asNonEmptyString(source.id);
  const stem = asNonEmptyString(source.content);
  if (!options || !id || !stem) return null;
  return {
    id,
    stem,
    options,
    selectionType: explicit && isCompletePublicAssessment(explicit) ? explicit.selection_type : null,
  };
}

/** Project one stored message row into React state, keeping only allowlisted public fields. */
export function projectRoomMessage(
  row: Record<string, unknown>,
  explicit?: PublicAssessmentDTO | null
): RoomMessageView {
  const source = asRecord(row);
  const projected: Record<string, unknown> = {};
  PUBLIC_MESSAGE_DTO_KEYS.forEach((key) => {
    projected[key as string] = source[key as string] ?? null;
  });
  DISPLAY_MESSAGE_KEYS.forEach((key) => {
    if (source[key] !== undefined) projected[key] = source[key];
  });

  return {
    id: String(projected.id ?? ''),
    room_id: String(projected.room_id ?? ''),
    user_id: String(projected.user_id ?? ''),
    content: typeof projected.content === 'string' ? projected.content : '',
    user_role: (projected.user_role ?? 'student') as Message['user_role'],
    is_ai_generated: projected.is_ai_generated === true,
    ai_model_used: typeof projected.ai_model_used === 'string' ? projected.ai_model_used : null,
    ai_response_time_ms:
      typeof projected.ai_response_time_ms === 'number' ? projected.ai_response_time_ms : null,
    parent_message_id: asNonEmptyString(projected.parent_message_id),
    created_at: asNonEmptyString(projected.created_at) || new Date(0).toISOString(),
    response_mode: (projected.response_mode ?? null) as Message['response_mode'],
    display_name: asNonEmptyString(projected.display_name) || undefined,
    avatar_url: asNonEmptyString(projected.avatar_url),
    publicQuestion: publicQuestionFromStoredRow(source, explicit),
  };
}

/** Read the public question a projected message carries, if any. */
export function readPublicQuestion(message: Message | null | undefined): PublicQuestionView | null {
  if (!message) return null;
  const candidate = (message as Partial<RoomMessageView>).publicQuestion;
  return candidate && typeof candidate === 'object' ? candidate : null;
}

/**
 * Build the teacher's review candidate from component 102's `prepareTurn` result. Returns null
 * when required identity is missing, so a page cannot render an unidentified review surface.
 */
export function createReviewCandidate(
  result: Record<string, unknown>,
  status: ReviewStatus = 'ready'
): TeacherReviewCandidateView | null {
  const source = asRecord(result);
  const decision = asRecord(source.decision) as unknown as TutorDecisionV3;
  const decisionBody = asRecord(decision.decision);
  const mode = asNonEmptyString(decisionBody.mode);
  if (!mode || !TURN_MODES.includes(mode) || typeof decision.response !== 'string') return null;

  const roomId = asNonEmptyString(source.room_id);
  const studentId = asNonEmptyString(source.student_id);
  const checklistId = asNonEmptyString(source.checklist_id);
  const focusStudentMessageId = asNonEmptyString(source.focus_student_message_id);
  if (!roomId || !studentId || !checklistId || !focusStudentMessageId) return null;

  // A tutoring or Guard turn carries no item. The text "null" is never a valid item id.
  const rawItemId = source.item_id;
  const itemId = rawItemId === null || rawItemId === undefined || rawItemId === 'null'
    ? null
    : asNonEmptyString(rawItemId);
  if (rawItemId !== null && rawItemId !== undefined && rawItemId !== 'null' && !itemId) return null;

  return {
    scope: { roomId, studentId, checklistId, itemId, focusStudentMessageId },
    decision,
    status,
    message: null,
  };
}

/**
 * Public projection of a reviewed decision, built through component 102's own allowlisting
 * helper. The private key and transfer basis go in and are not part of the result.
 */
export function publicAssessmentForDecision(
  decision: TutorDecisionV3 | null | undefined,
  messageId: string
): PublicAssessmentDTO | null {
  if (!decision || !decision.assessment || !asNonEmptyString(messageId)) return null;
  try {
    const projection = TransferAssessmentService.toPublicAssessment({
      id: messageId,
      ...decision.assessment,
    });
    return isCompletePublicAssessment(projection) ? projection : null;
  } catch {
    return null;
  }
}

/**
 * Check a reviewed decision against the prepared scope before any delivery call. This is the
 * fail-closed boundary: an incompatible mode/instruction/target combination is refused here
 * instead of being coerced into a payload the server would reject.
 */
export function assertDeliverableReview(
  decision: TutorDecisionV3 | null | undefined,
  scope: ReviewScope,
  knownItemIds?: ReadonlyArray<string>,
  knownMessageIds?: ReadonlyArray<string>
): ReviewCheck {
  const refuse = (message: string): ReviewCheck => ({ ok: false, status: 'validation', message });
  const body = asRecord(decision?.decision);
  const mode = asNonEmptyString(body.mode);

  if (!decision || !mode || !TURN_MODES.includes(mode)) {
    return refuse('The reviewed turn has no valid mode.');
  }
  if (!asNonEmptyString(scope.roomId) || !asNonEmptyString(scope.studentId) ||
      !asNonEmptyString(scope.checklistId) || !asNonEmptyString(scope.focusStudentMessageId)) {
    return refuse('The reviewed turn is missing its learner, checklist, or focus message identity.');
  }

  if (mode !== 'assessment') {
    if (decision.assessment) return refuse('A tutoring or Guard turn must not carry an assessment payload.');
    if (body.instruction === 'transfer_assess') {
      return refuse('The transfer_assess instruction is only valid for an assessment turn.');
    }
    return { ok: true };
  }

  if (body.instruction !== 'transfer_assess') {
    return refuse('An assessment turn must use the transfer_assess instruction.');
  }
  if (!scope.itemId) return refuse('An assessment turn must name the checklist item it assesses.');
  if (!decision.assessment || !isCompletePublicAssessment({
    id: 'pending',
    selection_type: decision.assessment.selection_type,
    stem: decision.assessment.stem,
    options: decision.assessment.options,
  })) {
    return refuse('The assessment content is incomplete or malformed.');
  }

  const targetItemId = asNonEmptyString(body.target_item_id);
  if (targetItemId && scope.itemId !== targetItemId) {
    return refuse('The reviewed target item no longer matches the prepared item.');
  }
  if (knownItemIds && targetItemId && !knownItemIds.includes(targetItemId)) {
    return refuse('The reviewed target item was not offered for this turn.');
  }

  const sourceEvidenceIds = decision.assessment.transfer_basis?.source_evidence_message_ids;
  if (knownMessageIds && Array.isArray(sourceEvidenceIds)) {
    const unknownEvidence = sourceEvidenceIds.filter((id) => !knownMessageIds.includes(id));
    if (unknownEvidence.length > 0) return refuse('The assessment cites evidence from outside this turn.');
  }

  return { ok: true };
}

/** Map a failed service call onto a named review state. The server's code stays in the message. */
export function classifyAssessmentFailure(error: unknown): { status: ReviewStatus; message: string } {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const match = ERROR_STATUS.find(([code]) => raw.includes(code));
  const message = raw.trim() || 'The transfer assessment request failed and can be retried.';
  return { status: match ? match[1] : 'retryable', message };
}

/** Room participation is binary. An unexpected value is reported as unknown rather than coerced. */
export function participationModeFromRoom(
  room: { active_response_mode?: unknown } | null | undefined
): RoomParticipationMode | null {
  const value = room?.active_response_mode;
  return value === 'tutoring' || value === 'guard' ? value : null;
}

/**
 * One merge path for join fetch, polling, optimistic replacement, and realtime inserts.
 * Records are keyed by persisted id, pre-populated dialogue stays first, and a message the
 * caller already holds survives an ingress that does not know about it.
 */
export function mergeRoomMessages(
  existing: ReadonlyArray<Message>,
  incoming: ReadonlyArray<Message>
): Message[] {
  const byId = new Map<string, { message: Message; seen: number }>();
  const remember = (message: Message | null | undefined) => {
    if (!message || !message.id) return;
    const current = byId.get(message.id);
    byId.set(message.id, { message, seen: current ? current.seen : byId.size });
  };
  existing.forEach(remember);
  incoming.forEach(remember);

  const entries = Array.from(byId.values());
  const time = (entry: { message: Message }) => new Date(entry.message.created_at).getTime() || 0;
  const chronological = (left: { message: Message; seen: number }, right: { message: Message; seen: number }) =>
    time(left) - time(right) || left.seen - right.seen;

  const prePopulated = entries.filter((entry) => entry.message.id.startsWith('prepop-')).sort(chronological);
  const persisted = entries.filter((entry) => !entry.message.id.startsWith('prepop-')).sort(chronological);
  return [...prePopulated, ...persisted].map((entry) => entry.message);
}

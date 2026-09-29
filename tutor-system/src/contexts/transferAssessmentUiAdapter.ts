// Purpose: adapt component 102's transfer-assessment responses into React view state without
// retaining private assessment material or inventing operation mapping.

import type { Message, RoomParticipationMode } from '../types';
import type { AssessmentOption, AssessmentOptionId, AssessmentSelectionType, TransferAssessmentDraft } from '../types/assessment';
import { validateAssessmentDraft } from '../services/assessmentValidation';
import {
  PUBLIC_MESSAGE_DTO_KEYS,
  TransferAssessmentService,
} from '../services/transferAssessmentService';
import type {
  AssessmentAnswerOutcome,
  AssessmentProcessingState,
  ProcessedMessageDTO,
  PublicAssessmentDTO,
  TerminalFailureFeedbackDTO,
} from '../services/transferAssessmentService';

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
  studentId: string;
  stem: string;
  options: AssessmentOption[];
  selectionType: AssessmentSelectionType;
}

/**
 * Stored message row projected for React state. It carries the public question when the row is a
 * delivered assessment, and carries nothing else the row happened to contain.
 */
export interface RoomMessageView extends Message {
  publicQuestion: PublicQuestionView | null;
  assessmentId: string | null;
  /** The server's own lifecycle result for a learner answer, when this message is one. */
  answerLifecycle: AnswerLifecycleView | null;
}

/**
 * What the trusted processing path said about one learner answer. It is a projection of the
 * server result, never a local grade: the browser does not decide pass, fail, or format.
 */
export interface AnswerLifecycleView {
  state: 'retry' | 'passed' | 'failed' | 'duplicate' | 'rejected' | 'deferred' | 'unresolved';
  messageId: string;
  assessmentId: string;
  processingState: AssessmentProcessingState;
  answerOutcome: AssessmentAnswerOutcome | null;
  attemptNumber: 1 | 2 | null;
  attemptsUsed: 0 | 1 | 2;
  attemptsRemaining: 0 | 1 | 2;
  selectedOptionIds: AssessmentOptionId[] | null;
  terminal: boolean;
  transition: Record<string, unknown> | null;
  code: string | null;
  feedbackRequired: boolean;
  alreadyProcessed: boolean;
  terminalFailureFeedback: TerminalFailureFeedbackDTO | null;
}

/** The prepared scope identity from `prepareAssessment`. */
export interface ReviewScope {
  roomId: string;
  studentId: string;
  checklistId: string;
  itemId: string;
  focusStudentMessageId: string;
}

/** The teacher-visible candidate decision plus its local review status. */
export interface TeacherReviewCandidateView {
  scope: ReviewScope;
  decision: TransferAssessmentDraft;
  status: ReviewStatus;
  message: string | null;
}

/** Result of the local deliverability check. */
export type ReviewCheck = { ok: true } | { ok: false; status: ReviewStatus; message: string };

const OPTION_ORDER: ReadonlyArray<AssessmentOption['id']> = ['A', 'B', 'C', 'D'];

type ReviewFailureStatus = 'superseded' | 'validation' | 'unavailable' | 'unauthorized' | 'retryable';

/** Display-only message fields that are safe for every role and are not part of the public DTO. */
const DISPLAY_MESSAGE_KEYS = ['ai_model_used', 'ai_response_time_ms', 'display_name', 'avatar_url'];

const ERROR_STATUS: ReadonlyArray<readonly [string, ReviewFailureStatus]> = [
  ['ASSESSMENT_FEATURE_DISABLED', 'unavailable'],
  ['AI_PROVIDER_NOT_CONFIGURED', 'unavailable'],
  ['TARGET_SETUP_REQUIRED', 'unavailable'],
  ['AUTHORIZATION_NOT_CONFIGURED', 'unavailable'],
  // No transfer checklist in this room: the capability does not apply here at all.
  ['LEGACY_CHECKLIST', 'unavailable'],
  ['LEGACY_ASSESSMENT_INCOMPLETE', 'unavailable'],
  ['UNSUPPORTED_ROOM_SCOPE', 'unavailable'],
  // The learner already has a delivered assessment, so this delivery is superseded.
  ['ASSESSMENT_ALREADY_OPEN', 'superseded'],
  ['ASSESSMENT_NOT_ELIGIBLE', 'superseded'],
  ['ASSESSMENT_TERMINAL', 'superseded'],
  // The prepared focus identity no longer matches the learner: prepare the turn again.
  ['WRONG_LEARNER', 'superseded'],
  ['ITEM_VALIDATION_FAILED', 'validation'],
  ['AI_OUTPUT_INVALID', 'validation'],
  ['INVALID_SCOPE', 'validation'],
  ['INVALID_REQUEST', 'validation'],
  ['PROGRESSION_LOCKED', 'validation'],
  ['FORBIDDEN', 'unauthorized'],
  ['UNAUTHORIZED', 'unauthorized'],
  ['AI_PROVIDER_ERROR', 'retryable'],
  ['ANALYSIS_INCOMPLETE', 'retryable'],
  ['AI_OUTPUT_TRUNCATED', 'retryable'],
  ['PERSISTENCE_FAILED', 'retryable'],
];

const FAILURE_MESSAGES: Record<ReviewFailureStatus, string> = {
  superseded: 'This candidate is no longer current. Refresh the room before preparing another.',
  validation: 'The prepared assessment could not be validated.',
  unavailable: 'Transfer assessments are unavailable for this room.',
  unauthorized: 'You are not authorized to deliver this assessment.',
  retryable: 'The transfer request could not be completed. Try again.',
};

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
    Boolean(asNonEmptyString(record.student_id)) &&
    (record.selection_type === 'single' || record.selection_type === 'multiple') &&
    Boolean(asNonEmptyString(record.stem)) &&
    orderedOptions(record.options) !== null
  );
}

/**
 * Build the learner question only from component 102's nested public assessment projection.
 */
export function publicQuestionFromStoredRow(
  row: Record<string, unknown>,
  explicit?: PublicAssessmentDTO | null
): PublicQuestionView | null {
  const source = asRecord(row);
  const assessment = explicit ?? (source.assessment !== undefined
    ? source.assessment
    : {
      id: source.assessment_id,
      student_id: source.assessment_student_id,
      selection_type: source.assessment_selection_type,
      stem: source.content,
      options: source.assessment_options,
    });
  if (!isCompletePublicAssessment(assessment)) return null;
  return {
    id: assessment.id,
    studentId: assessment.student_id,
    stem: assessment.stem,
    options: orderedOptions(assessment.options) as AssessmentOption[],
    selectionType: assessment.selection_type,
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
    assessmentId: asNonEmptyString(source.assessment_id),
    answerLifecycle: null,
  };
}

/**
 * Map component 102's canonical result into component-owned presentation state.
 */
export function answerLifecycleFromProcessed(processed: ProcessedMessageDTO): AnswerLifecycleView {
  let state: AnswerLifecycleView['state'] = 'unresolved';
  if (processed.answer_outcome === 'retry') state = 'retry';
  else if (processed.answer_outcome === 'passed') state = 'passed';
  else if (processed.answer_outcome === 'failed') state = 'failed';
  else if (processed.processing_state === 'duplicate') state = 'duplicate';
  else if (processed.processing_state === 'rejected') state = 'rejected';
  else if (processed.processing_state === 'deferred') state = 'deferred';

  return {
    state,
    messageId: processed.message_id,
    assessmentId: processed.assessment_id,
    processingState: processed.processing_state,
    answerOutcome: processed.answer_outcome,
    attemptNumber: processed.attempt_number,
    attemptsUsed: processed.attempts_used,
    attemptsRemaining: processed.attempts_remaining,
    selectedOptionIds: processed.selected_option_ids,
    terminal: processed.terminal,
    transition: processed.transition,
    code: processed.code,
    feedbackRequired: processed.feedback_required,
    alreadyProcessed: processed.already_processed,
    terminalFailureFeedback:
      processed.answer_outcome === 'failed' && processed.terminal
        ? processed.terminal_failure_feedback
        : null,
  };
}

/** Attach a lifecycle result to a projected message without touching any other field. */
export function withAnswerLifecycle(
  view: RoomMessageView,
  lifecycle: AnswerLifecycleView | null
): RoomMessageView {
  return { ...view, answerLifecycle: lifecycle };
}

/** Read the answer lifecycle a projected message carries, if any. */
export function readAnswerLifecycle(message: Message | null | undefined): AnswerLifecycleView | null {
  if (!message) return null;
  const candidate = (message as Partial<RoomMessageView>).answerLifecycle;
  return candidate && typeof candidate === 'object' ? candidate : null;
}

/** Read the persisted link between an answer message and its assessment. */
export function readAssessmentId(message: Message | null | undefined): string | null {
  return message ? (message as Partial<RoomMessageView>).assessmentId ?? null : null;
}

/** Read the public question a projected message carries, if any. */
export function readPublicQuestion(message: Message | null | undefined): PublicQuestionView | null {
  if (!message) return null;
  const candidate = (message as Partial<RoomMessageView>).publicQuestion;
  return candidate && typeof candidate === 'object' ? candidate : null;
}

/**
 * Build the teacher's review candidate from component 102's `prepareAssessment` result. Returns null
 * when required identity is missing, so a page cannot render an unidentified review surface.
 */
export function createReviewCandidate(
  result: Record<string, unknown>,
  status: ReviewStatus = 'ready'
): TeacherReviewCandidateView | null {
  const source = asRecord(result);
  const decision = asRecord(source.assessment_draft) as unknown as TransferAssessmentDraft;
  if (!asNonEmptyString(decision.reason) || !asNonEmptyString(decision.target_item_id)) return null;

  const roomId = asNonEmptyString(source.room_id);
  const studentId = asNonEmptyString(source.student_id);
  const checklistId = asNonEmptyString(source.checklist_id);
  const focusStudentMessageId = asNonEmptyString(source.focus_student_message_id);
  if (!roomId || !studentId || !checklistId || !focusStudentMessageId) return null;

  const itemId = asNonEmptyString(source.item_id);
  if (!itemId || decision.target_item_id !== itemId) return null;

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
  decision: TransferAssessmentDraft | null | undefined,
  messageId: string,
  studentId: string
): PublicAssessmentDTO | null {
  if (!decision || !decision.assessment || !asNonEmptyString(messageId) || !asNonEmptyString(studentId)) return null;
  try {
    const projection = TransferAssessmentService.toPublicAssessment({
      id: messageId,
      student_id: studentId,
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
  decision: TransferAssessmentDraft | null | undefined,
  scope: ReviewScope,
  knownItemIds?: ReadonlyArray<string>,
  knownMessageIds?: ReadonlyArray<string>
): ReviewCheck {
  const refuse = (message: string): ReviewCheck => ({ ok: false, status: 'validation', message });
  if (!decision) return refuse('The assessment draft is missing.');
  if (!asNonEmptyString(scope.roomId) || !asNonEmptyString(scope.studentId) ||
      !asNonEmptyString(scope.checklistId) || !asNonEmptyString(scope.focusStudentMessageId)) {
    return refuse('The reviewed turn is missing its learner, checklist, or focus message identity.');
  }

  if (!scope.itemId) return refuse('An assessment turn must name the checklist item it assesses.');
  if (!decision.assessment || !isCompletePublicAssessment({
    id: 'pending',
    student_id: scope.studentId,
    selection_type: decision.assessment.selection_type,
    stem: decision.assessment.stem,
    options: decision.assessment.options,
  })) {
    return refuse('The assessment content is incomplete or malformed.');
  }

  const targetItemId = asNonEmptyString(decision.target_item_id);
  if (scope.itemId !== targetItemId) {
    return refuse('The reviewed target item no longer matches the prepared item.');
  }
  if (knownItemIds && !knownItemIds.includes(targetItemId!)) {
    return refuse('The reviewed target item was not offered for this turn.');
  }

  const sourceEvidenceIds = decision.assessment.transfer_basis?.source_evidence_message_ids;
  if (knownMessageIds && Array.isArray(sourceEvidenceIds)) {
    const unknownEvidence = sourceEvidenceIds.filter((id) => !knownMessageIds.includes(id));
    if (unknownEvidence.length > 0) return refuse('The assessment cites evidence from outside this turn.');
  }

  try {
    validateAssessmentDraft(decision, {
      knownItemIds: knownItemIds || [scope.itemId],
      knownMessageIds: knownMessageIds || sourceEvidenceIds || [],
    });
  } catch (error) {
    return refuse(error instanceof Error ? error.message : 'Assessment content is invalid.');
  }

  return { ok: true };
}

/** Map a failed service call onto a named review state. The server's code stays in the message. */
export function classifyAssessmentFailure(error: unknown): { status: ReviewStatus; message: string } {
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const record = asRecord(error);
  const declaredCode = asNonEmptyString(record.code);
  const code = ERROR_STATUS.find(([candidate]) => candidate === declaredCode)?.[0] ??
    ERROR_STATUS.find(([candidate]) => raw === candidate || raw.startsWith(`${candidate}:`))?.[0] ?? null;
  const mappedStatus = code ? ERROR_STATUS.find(([candidate]) => candidate === code)?.[1] : null;
  const status = mappedStatus ?? (record.retryable === false ? 'validation' : 'retryable');
  return {
    status,
    message: code ? `${code}: ${FAILURE_MESSAGES[status]}` : FAILURE_MESSAGES[status],
  };
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
    const currentView = current?.message as Partial<RoomMessageView> | undefined;
    const incomingView = message as Partial<RoomMessageView>;
    const merged = current
      ? {
        ...current.message,
        ...message,
        publicQuestion: incomingView.publicQuestion ?? currentView?.publicQuestion ?? null,
        answerLifecycle: incomingView.answerLifecycle ?? currentView?.answerLifecycle ?? null,
      }
      : message;
    byId.set(message.id, { message: merged, seen: current ? current.seen : byId.size });
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

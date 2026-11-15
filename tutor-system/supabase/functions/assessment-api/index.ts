#!/usr/bin/env -S deno run --allow-env --allow-net
// Purpose: enforce trusted transfer-assessment identity, provider, delivery, and attempt authority.

// deno-lint-ignore-file no-explicit-any
import { buildCombinedLearningAnalysisMessages, selectMajorityLearningEvents } from '../../../src/services/learningAnalysisPrompt.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { resolveTransferAnswer } from '../../../src/services/transferAssessmentOrchestrator.ts';
import {
  buildTransferTutorRequestContextV3,
  buildTransferAssessmentRequest,
} from '../../../src/services/ecologicalTutorCall.ts';
import { validateAssessmentDraft } from '../../../src/services/assessmentValidation.ts';
import { parseAssessmentAnswer } from '../../../src/services/assessmentAnswerParser.ts';
import { parseAssessmentEvent } from '../../../src/services/assessmentRendering.ts';
import { applyLearningEvent, isValidTransferProgress } from '../../../src/services/learningProgressTransitions.ts';
import type { LearningEventKind, TransferProgress } from '../../../src/services/learningProgressTransitions.ts';

const OPERATIONS = new Set([
  'initialize_checklist', 'join_room', 'edit_learning_progress', 'read_learning_evidence', 'post_message', 'analyze_message',
  'prepare_turn', 'send_reviewed', 'read_review', 'process_message', 'clear_chat_history',
]);
const OPTION_IDS = new Set(['A', 'B', 'C', 'D']);
const PROVIDER_MAX_TOKENS = 1200;

const TRANSFER_ASSESSMENT_SYSTEM_PROMPT = [
  'Return exactly one JSON object with only reason, target_item_id, and assessment. Generate assessment content only.',
  'target_item_id must equal target_item.id in the user input. Use only source_evidence_message_ids listed for that target_item.',
  'Shape: {"reason":"brief rationale","target_item_id":"target UUID","assessment":{"selection_type":"single","stem":"question in a new situation","options":[{"id":"A","text":"choice"},{"id":"B","text":"choice"},{"id":"C","text":"choice"},{"id":"D","text":"choice"}],"correct_option_ids":["A"],"learner_safe_explanation":"brief answer explanation","transfer_basis":{"concept_rule":"rule being transferred","source_context":"situation in learner evidence","changed_context":"different situation tested by the question","source_evidence_message_ids":["known learner message UUID"]}}}.',
  'selection_type is exactly single or multiple. Single has one correct option; multiple has two or three. All four option texts must be distinct and nonempty.',
  'Apply the same concept_rule to a materially different changed_context; the stem must test that new situation, not repeat the source scenario.',
  'Keep the stem to at most two sentences and the full question with choices under 80 words. learner_safe_explanation must be concise, age-appropriate, and safe to disclose after terminal failure.',
  'Do not include rendered_text; the server creates it. Never invent IDs. Return JSON only, without markdown or hidden reasoning.',
].join('\n');


export interface VerifiedPrincipal {
  principal_id: string;
  application_user_id: string;
  allowed_room_ids: string[];
  can_review_assessment: boolean;
}

export interface AssessmentPrincipalVerifier {
  verify(request: Request): Promise<VerifiedPrincipal>;
}

interface RpcResult {
  data: any;
  error: { message: string; code?: string } | null;
}

export interface AssessmentApiDependencies {
  featureEnabled: () => Promise<boolean>;
  verifier?: AssessmentPrincipalVerifier;
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  resolveAnswer: (context: any, input: any) => any;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-user-id, x-practice-contract',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const ERROR_STATUS: Record<string, { status: number; retryable: boolean }> = {
  CLIENT_RELOAD_REQUIRED: { status: 409, retryable: false },
  INVALID_REQUEST: { status: 400, retryable: false },
  UNAUTHORIZED: { status: 401, retryable: false },
  FORBIDDEN: { status: 403, retryable: false },
  OBSERVER_READ_ONLY: { status: 403, retryable: false },
  WRONG_LEARNER: { status: 409, retryable: false },
  ITEM_VALIDATION_FAILED: { status: 409, retryable: false },
  INVALID_SCOPE: { status: 409, retryable: false },
  LEGACY_CHECKLIST: { status: 409, retryable: false },
  LEGACY_ASSESSMENT_INCOMPLETE: { status: 409, retryable: false },
  ASSESSMENT_ALREADY_OPEN: { status: 409, retryable: false },
  ASSESSMENT_TERMINAL: { status: 409, retryable: false },
  ASSESSMENT_RESULT_UNAVAILABLE: { status: 503, retryable: true },
  INVALID_ASSESSMENT_EVENT: { status: 500, retryable: false },
  AUTHORIZATION_NOT_CONFIGURED: { status: 503, retryable: false },
  ASSESSMENT_FEATURE_DISABLED: { status: 503, retryable: false },
  ASSESSMENT_CONFIGURATION_UNAVAILABLE: { status: 503, retryable: true },
  AI_PROVIDER_NOT_CONFIGURED: { status: 503, retryable: true },
  AI_PROVIDER_ERROR: { status: 502, retryable: true },
  AI_OUTPUT_TRUNCATED: { status: 502, retryable: true },
  AI_OUTPUT_INVALID: { status: 502, retryable: false },
  TARGET_SETUP_REQUIRED: { status: 409, retryable: false },
  ANALYSIS_INCOMPLETE: { status: 503, retryable: true },
  ASSESSMENT_NOT_ELIGIBLE: { status: 409, retryable: false },
  PERSISTENCE_FAILED: { status: 500, retryable: true },
};

function fail(code: string, message = code): Response {
  const config = ERROR_STATUS[code] ?? ERROR_STATUS.PERSISTENCE_FAILED;
  return response({ ok: false, error: { code, message, retryable: config.retryable } }, config.status);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, any>
    : {};
}

function requiredString(value: unknown, code = 'INVALID_REQUEST'): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

function assertRoom(principal: VerifiedPrincipal, roomId: unknown): string {
  const room = requiredString(roomId);
  if (!principal.allowed_room_ids.includes(room)) throw new Error('FORBIDDEN');
  return room;
}

function assertTeacher(principal: VerifiedPrincipal): void {
  if (!principal.can_review_assessment) throw new Error('FORBIDDEN');
}

function selectedIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('ITEM_VALIDATION_FAILED');
  const ids = [...new Set(value.map((item) => String(item).toUpperCase()))].sort();
  if (ids.some((id) => !OPTION_IDS.has(id))) throw new Error('ITEM_VALIDATION_FAILED');
  return ids;
}

function projectAssessment(value: unknown): Record<string, unknown> {
  const source = asRecord(value);
  const studentId = requiredString(source.student_id, 'INVALID_SCOPE');
  if (source.selection_type !== 'single' && source.selection_type !== 'multiple') {
    throw new Error('ITEM_VALIDATION_FAILED');
  }
  if (!Array.isArray(source.options) || source.options.length !== 4) {
    throw new Error('ITEM_VALIDATION_FAILED');
  }
  return {
    id: requiredString(source.id, 'INVALID_SCOPE'),
    student_id: studentId,
    selection_type: source.selection_type,
    stem: requiredString(source.stem, 'ITEM_VALIDATION_FAILED'),
    options: source.options.map((item: unknown) => {
      const option = asRecord(item);
      return { id: requiredString(option.id), text: requiredString(option.text) };
    }),
  };
}

function projectMessage(value: unknown): Record<string, unknown> {
  const source = asRecord(value);
  return {
    id: source.id,
    room_id: source.room_id,
    user_id: source.user_id,
    content: source.content,
    user_role: source.user_role,
    ai_model_used: source.ai_model_used ?? null,
    ai_response_time_ms: source.ai_response_time_ms ?? null,
    parent_message_id: source.parent_message_id ?? null,
    response_mode: source.response_mode ?? null,
    assessment_lifecycle: source.assessment_lifecycle ?? null,
    assessment_event: parseAssessmentEvent(source.assessment_event),
    assessment_id: source.assessment_id ?? null,
    assessment_selected_option_ids: source.assessment_selected_option_ids ?? null,
    assessment: source.assessment == null ? null : projectAssessment(source.assessment),
    created_at: source.created_at,
  };
}

function projectDelivery(value: unknown): Record<string, unknown> {
  const source = asRecord(value);
  return { message: projectMessage(source.message), room: source.room };
}

function projectProcessed(value: unknown): Record<string, unknown> {
  const source = asRecord(value);
  if ((source.answer_outcome || source.code === 'assisted' || source.code === 'cancelled') && !source.result_message) {
    throw new Error('ASSESSMENT_RESULT_UNAVAILABLE');
  }
  const resultMessage = source.result_message == null ? null : projectMessage(source.result_message);
  const event = resultMessage?.assessment_event as ReturnType<typeof parseAssessmentEvent>;
  if (resultMessage && (!event || event.assessment_id!==source.assessment_id ||
    (event.kind==='result' && event.answer_message_id!==source.message_id))) throw new Error('INVALID_ASSESSMENT_EVENT');
  const failed = source.answer_outcome === 'failed' && source.terminal === true && source.feedback_required === true;
  const feedback = failed ? asRecord(source.terminal_failure_feedback) : {};
  return {
    message_id: source.message_id,
    assessment_id: source.assessment_id,
    processing_state: source.processing_state,
    answer_outcome: source.answer_outcome ?? null,
    attempt_number: source.attempt_number ?? null,
    attempts_used: source.attempts_used,
    attempts_remaining: source.attempts_remaining,
    selected_option_ids: source.selected_option_ids ?? null,
    terminal: source.terminal === true,
    transition: source.transition ?? null,
    feedback_required: source.feedback_required === true,
    code: source.code ?? null,
    already_processed: source.already_processed === true,
    result_message: resultMessage,
    terminal_failure_feedback: failed ? {
      correct_option_ids: feedback.correct_option_ids,
      learner_safe_explanation: feedback.learner_safe_explanation,
    } : null,
  };
}

async function rpc(deps: AssessmentApiDependencies, name: string, args: Record<string, unknown>): Promise<any> {
  const result = await deps.rpc(name, args);
  if (result.error) {
    const known = Object.keys(ERROR_STATUS).find((code) => result.error?.message.includes(code));
    throw new Error(known ?? 'PERSISTENCE_FAILED');
  }
  return result.data;
}

function assertReviewedCandidate(value: unknown, itemId: string): void {
  try {
    const assessment = asRecord(asRecord(value).assessment);
    const basis = asRecord(assessment.transfer_basis);
    validateAssessmentDraft(value, {
      knownItemIds: [itemId],
      knownMessageIds: Array.isArray(basis.source_evidence_message_ids)
        ? basis.source_evidence_message_ids : [],
    });
  } catch {
    throw new Error('ITEM_VALIDATION_FAILED');
  }
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function recordProviderAttempt(
  deps: AssessmentApiDependencies,
  scope: Record<string, any>,
  requestId: string,
  ordinal: number,
  provider: { baseUrl: string; model: string },
  requestPayload: Record<string, unknown>,
  rawResponse: unknown,
  finishReason: string | null,
  outcome: string,
  errorCode: string | null,
): Promise<void> {
  await rpc(deps, 'record_transfer_provider_attempt_v1', {
    p_request_id: requestId,
    p_room_id: scope.room_id,
    p_student_id: scope.student_id,
    p_checklist_id: scope.checklist_id,
    p_focus_student_message_id: scope.focus_student_message_id,
    p_attempt_ordinal: ordinal,
    p_provider_base_url: provider.baseUrl,
    p_provider_model: provider.model,
    p_max_tokens: PROVIDER_MAX_TOKENS,
    p_request_hash: await sha256(JSON.stringify(requestPayload)),
    p_request_payload: requestPayload,
    p_raw_response: rawResponse,
    p_finish_reason: finishReason,
    p_validation_outcome: outcome,
    p_error_code: errorCode,
  });
}

function providerConfig(deps: AssessmentApiDependencies): { key: string; baseUrl: string; model: string } {
  const key = deps.env('OAI_API_KEY');
  const baseUrl = deps.env('OAI_BASE_URL');
  const model = deps.env('OAI_MODEL')?.trim();
  if (!key || !baseUrl || !model) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
  return { key, baseUrl: baseUrl.replace(/\/$/, ''), model };
}


async function analyzeMessage(
  deps: AssessmentApiDependencies,
  body: Record<string, any>,
  principal: VerifiedPrincipal,
  requestId: string,
): Promise<Record<string, unknown>> {
  const roomId = assertRoom(principal, body.room_id);
  const messageId = requiredString(body.message_id);
  const scope = asRecord(await rpc(deps, 'get_transfer_message_analysis_context_v1', {
    p_room_id: roomId, p_message_id: messageId, p_actor_id: principal.application_user_id,
  }));
  if (scope.analysis_complete === true) return { applied: [], already_processed: true };
  if (scope.analysis_deferred === true) {
    return asRecord(await rpc(deps, 'apply_transfer_message_analysis_v1', {
      p_room_id: roomId, p_message_id: messageId,
      p_actor_id: principal.application_user_id,
      p_request_id: requestId, p_analysis: {},
    }));
  }
  const message = asRecord(scope.message);
  const items = scope.items;
  const history = scope.dialogue_history;
  const focusIndex = Array.isArray(history)
    ? history.findIndex((turn: unknown) => asRecord(turn).id === messageId)
    : -1;
  if (message.id !== messageId || message.room_id !== roomId || message.user_role !== 'student' ||
      message.user_id !== scope.student_id || !Array.isArray(items) || !items.length ||
      focusIndex < 0 || asRecord(history[focusIndex]).user_id !== scope.student_id ||
      asRecord(history[focusIndex]).user_role !== 'student' ||
      asRecord(history[focusIndex]).content !== message.content) {
    throw new Error('INVALID_SCOPE');
  }
  const provider = providerConfig(deps);
  const allowedKinds = new Set(['initial_signal', 'demonstrated_understanding', 'post_repair_signal', 'spontaneous_transfer', 'contradiction']);
  const allowedEvidenceTypes = new Set(['action', 'recognition', 'explanation']);
  const outcomes = await Promise.allSettled(Array.from({ length: 3 }, async () => {

    const auditRequestId = crypto.randomUUID();
    const attemptLimit = 2;
    let previousAttemptResponse: unknown = null;
    for (let ordinal = 1; ordinal <= attemptLimit; ordinal += 1) {
    const requestPayload = {
          model: provider.model,
          messages: buildCombinedLearningAnalysisMessages({
            focus_student_id: scope.student_id,
            evidence_message_id: messageId,
            ...(scope.practice_type === 'cyberbullying' ? { practice_type: scope.practice_type, scenario: scope.scenario } : {}),
            message,
            items: items.map((item: any) => ({ ...item, eligible_event_kinds: [...allowedKinds].filter(kind =>
              applyLearningEvent(item, kind as LearningEventKind).disposition === 'apply') })),
            dialogue_history: history.slice(0, focusIndex + 1),
            eligible_event_kinds: [],
          }, ordinal > 1 ? { previous_response: previousAttemptResponse } : undefined),
          temperature: 0,
          max_tokens: 2400,
          enable_thinking: false,
          response_format: { type: 'json_object' },
        };
    let rawResponse: unknown = null;
    let finishReason: string | null = null;
    let errorCode: string | null = null;
    try {
    let providerResponse: Response;
    try {
      providerResponse = await deps.fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify(requestPayload),
      });
    } catch {
      throw new Error('AI_PROVIDER_ERROR');
    }
    const payload = asRecord(await providerResponse.json().catch(() => ({})));
    rawResponse = payload;
    if (!providerResponse.ok) throw new Error('AI_PROVIDER_ERROR');
    const choice = asRecord(payload.choices?.[0]);
    finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
    if (choice.finish_reason === 'length') throw new Error('AI_OUTPUT_TRUNCATED');
    let analysis: Record<string, any>;
    try {
      analysis = asRecord(JSON.parse(requiredString(asRecord(choice.message).content, 'AI_OUTPUT_INVALID')));
    } catch {
      throw new Error('AI_OUTPUT_INVALID');
    }
    if (!Array.isArray(analysis.events) || analysis.events.length > items.length || new Set(analysis.events.map((event: any) => event.item_id)).size !== analysis.events.length || analysis.events.some((event: unknown) => {
      const evidence = asRecord(event);
      const item = items.find((candidate: any) => candidate.id === evidence.item_id);
      return !item || !allowedKinds.has(evidence.kind) ||
        !allowedEvidenceTypes.has(evidence.evidence_type) ||
        !isValidTransferProgress(item) ||
        evidence.evidence_message_id !== messageId ||
        typeof evidence.evidence_quote !== 'string' || !evidence.evidence_quote.trim() ||
        typeof message.content !== 'string' || !message.content.includes(evidence.evidence_quote) ||
        typeof evidence.explanation !== 'string' || !evidence.explanation.trim();
    }) ||
        typeof analysis.explanation !== 'string' || !analysis.explanation.trim()) {
      throw new Error('AI_OUTPUT_INVALID');
    }
    const rejected = analysis.events.filter((event: any) => applyLearningEvent(
      items.find((item: any) => item.id === event.item_id), event.kind).disposition !== 'apply');
    return {
      events: analysis.events.filter((event: any) => !rejected.includes(event)),
      rejected_events: rejected.map((event: any) => ({ ...event, rejection_reason: 'INELIGIBLE_TRANSITION' })),
      explanation: analysis.explanation,
    };
    } catch (error) {
      errorCode = error instanceof Error ? error.message : 'AI_PROVIDER_ERROR';
      if (errorCode === 'AI_OUTPUT_INVALID' && ordinal < attemptLimit) {
        previousAttemptResponse = rawResponse;
        continue;
      }
      throw error;
    } finally {
      if (scope.practice_type === 'cyberbullying') {
        await rpc(deps, 'record_transfer_provider_attempt_v1', {
          p_request_id: auditRequestId, p_room_id: roomId, p_student_id: scope.student_id,
          p_checklist_id: scope.checklist_id, p_focus_student_message_id: messageId,
          p_attempt_ordinal: ordinal, p_provider_base_url: provider.baseUrl, p_provider_model: provider.model,
          p_max_tokens: 2400, p_request_hash: await sha256(JSON.stringify(requestPayload)),
          p_request_payload: { operation: 'analyze_message', analysis_request_id: requestId, provider_request: requestPayload },
          p_raw_response: rawResponse, p_finish_reason: finishReason,
          p_validation_outcome: errorCode ? 'invalid' : 'valid', p_error_code: errorCode,
        });
      }
    }
    }
    throw new Error('AI_OUTPUT_INVALID');
  }));
  const failed = outcomes.find((outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected');
  if (failed) throw failed.reason;
  const analyses = outcomes.map(outcome => (outcome as PromiseFulfilledResult<{
    events: any[]; rejected_events: any[]; explanation: string;
  }>).value);

  const analysis = {
    events: selectMajorityLearningEvents(analyses),
    rejected_events: analyses.flatMap((result) => result.rejected_events),
    explanation: analyses.map((result) => result.explanation).join(' '),
  };
  return asRecord(await rpc(deps, 'apply_transfer_message_analysis_v1', {
    p_room_id: roomId,
    p_message_id: messageId,
    p_actor_id: principal.application_user_id,
    p_request_id: requestId,
    p_analysis: analysis,
  }));
}

async function prepareAssessment(
  deps: AssessmentApiDependencies,
  body: Record<string, any>,
  principal: VerifiedPrincipal,
  requestId: string,
): Promise<Record<string, unknown> | null> {
  assertTeacher(principal);
  const roomId = assertRoom(principal, body.room_id);
  const focusMessageId = requiredString(body.focus_student_message_id);
  await analyzeMessage(deps, { room_id: roomId, message_id: focusMessageId }, principal, requestId);
  const scope = asRecord(await rpc(deps, 'prepare_transfer_assessment_context_v1', {
    p_room_id: roomId,
    p_focus_student_message_id: focusMessageId,
    p_checklist_id: requiredString(body.checklist_id),
    p_actor_id: principal.application_user_id,
    p_request_id: requestId,
  }));
  if (scope.no_assessment_due === true) return null;
  const targetItemId = requiredString(scope.selected_target_item_id, 'ANALYSIS_INCOMPLETE');
  const rawContext = asRecord(scope.context ?? scope);
  const context = buildTransferTutorRequestContextV3(rawContext as any);
  const userMessage = buildTransferAssessmentRequest(context, targetItemId);
  const provider = providerConfig(deps);
  let formatError = '';

  for (let ordinal = 1; ordinal <= 2; ordinal += 1) {
    const requestPayload = {
      model: provider.model,
      messages: [
        { role: 'system', content: TRANSFER_ASSESSMENT_SYSTEM_PROMPT },
        { role: 'user', content: ordinal === 1 ? userMessage : `${userMessage}\nReturn valid JSON matching the same contract.\n${JSON.stringify({ format_repair: { validation_error: formatError } })}` },
      ],
      temperature: 0.3,
      max_tokens: PROVIDER_MAX_TOKENS,
      enable_thinking: false,
      response_format: { type: 'json_object' },
    };
    let providerResponse: Response;
    try {
      providerResponse = await deps.fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
        body: JSON.stringify(requestPayload),
      });
    } catch (error) {
      await recordProviderAttempt(deps, scope, requestId, ordinal, provider, requestPayload,
        { transport_error: String(error) }, null, 'network_error', 'AI_PROVIDER_ERROR');
      throw new Error('AI_PROVIDER_ERROR');
    }
    const payload = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      await recordProviderAttempt(deps, scope, requestId, ordinal, provider, requestPayload,
        payload, null, 'http_error', 'AI_PROVIDER_ERROR');
      throw new Error('AI_PROVIDER_ERROR');
    }
    const choice = asRecord(asRecord(payload).choices?.[0]);
    const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : null;
    if (finishReason === 'length') {
      await recordProviderAttempt(deps, scope, requestId, ordinal, provider, requestPayload,
        payload, finishReason, 'truncated', 'AI_OUTPUT_TRUNCATED');
      throw new Error('AI_OUTPUT_TRUNCATED');
    }
    let candidate: ReturnType<typeof validateAssessmentDraft>;
    try {
      const content = requiredString(asRecord(choice.message).content, 'AI_OUTPUT_INVALID');
      candidate = validateAssessmentDraft(JSON.parse(content), {
        knownItemIds: [targetItemId],
        knownMessageIds: context.checklist_items.find(item => item.id === targetItemId)?.relevant_evidence_message_ids || [],
      });
    } catch (error) {
      formatError = error instanceof Error ? error.message : 'Invalid assessment format';
      await recordProviderAttempt(deps, scope, requestId, ordinal, provider, requestPayload,
        payload, finishReason, 'invalid', 'AI_OUTPUT_INVALID');
      if (ordinal === 2) throw new Error('AI_OUTPUT_INVALID');
      continue;
    }
    await recordProviderAttempt(deps, scope, requestId, ordinal, provider, requestPayload,
      payload, finishReason, 'valid', null);
    return { ...scope, item_id: targetItemId, assessment_draft: candidate };
  }
  throw new Error('AI_OUTPUT_INVALID');
}

async function processMessage(
  deps: AssessmentApiDependencies,
  body: Record<string, any>,
  principal: VerifiedPrincipal,
  requestId: string,
): Promise<Record<string, unknown>> {
  const assessmentId = requiredString(body.assessment_id);
  const messageId = requiredString(body.message_id);
  for (let retry = 0; retry < 3; retry += 1) {
    const stored = asRecord(await rpc(deps, 'get_transfer_assessment_processing_context_v1', {
      p_assessment_id: assessmentId,
      p_message_id: messageId,
      p_actor_id: principal.application_user_id,
    }));
    const context = asRecord(stored.context);
    const assessment = asRecord(stored.assessment);
    const answer = asRecord(stored.answer);
    const snapshot = asRecord(context.attempt_snapshot);
    if (stored.lifecycle === 'cancelled' && stored.authoritative_result) {
      return projectProcessed({ ...asRecord(stored.authoritative_result), processing_state: 'duplicate', already_processed: true });
    }
    if (stored.authoritative_result && !asRecord(stored.authoritative_result).answer_outcome) {
      return projectProcessed({...asRecord(stored.authoritative_result),already_processed:true});
    }
    const content = answer.selected_option_ids == null
      ? requiredString(answer.content)
      : selectedIds(answer.selected_option_ids).join(',');
    const result = deps.resolveAnswer(context, {
      delivered: true,
      answer_message_id: messageId,
      content,
      assessment,
      references_message_id: answer.references_message_id ?? null,
    });

    if (result.disposition === 'duplicate' && stored.authoritative_result) {
      return projectProcessed({ ...asRecord(stored.authoritative_result), processing_state: 'duplicate', already_processed: true });
    }
    if (result.disposition === 'assisted') {
      const cancelled = asRecord(await rpc(deps, 'cancel_transfer_assessment_v1', {
        p_assessment_id: assessmentId,
        p_message_id: messageId,
        p_actor_id: principal.application_user_id,
        p_request_id: requestId,
      }));
      if (cancelled.code === 'CONCURRENT_MODIFICATION') continue;
      return projectProcessed(cancelled);
    }
    const answerOutcome = result.disposition === 'retryable'
      ? 'retry'
      : result.disposition === 'passed' || result.disposition === 'failed'
        ? result.disposition
        : null;
    if (!answerOutcome) {
      const recorded=asRecord(await rpc(deps,'record_transfer_assessment_processing_v1',{
        p_assessment_id:assessmentId,p_message_id:messageId,p_actor_id:principal.application_user_id,
        p_request_id:requestId,p_expected_attempt_count:snapshot.accepted_attempt_count,
        p_expected_resolution:snapshot.resolution,p_code:result.clarification_code ?? result.disposition,
      }));
      if (recorded.code==='CONCURRENT_MODIFICATION') continue;
      return projectProcessed(recorded);
    }
    const parsed = answer.selected_option_ids == null
      ? parseAssessmentAnswer(content, assessment.selection_type, assessment.options)
      : { kind: 'selection' as const, option_ids: selectedIds(answer.selected_option_ids) };
    if (parsed.kind !== 'selection') throw new Error('ITEM_VALIDATION_FAILED');
    const committed = asRecord(await rpc(deps, 'process_assessment_message_v2', {
      p_assessment_id: assessmentId,
      p_message_id: messageId,
      p_actor_id: principal.application_user_id,
      p_request_id: requestId,
      p_expected_attempt_count: snapshot.accepted_attempt_count,
      p_expected_resolution: snapshot.resolution,
      p_answer_outcome: answerOutcome,
      p_selected_option_ids: parsed.option_ids,
      p_next_progress: result.progress,
      p_applied_transition: result.applied_transition,
    }));
    if (committed.code === 'CONCURRENT_MODIFICATION') continue;
    return projectProcessed(committed);
  }
  throw new Error('PERSISTENCE_FAILED');
}

export function createAssessmentApiHandler(deps: AssessmentApiDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return fail('INVALID_REQUEST');
    if (request.headers.get('x-practice-contract') !== 'cyberbullying-v2') {
      return fail('CLIENT_RELOAD_REQUIRED', 'Reload this page before continuing.');
    }
    let body: Record<string, any>;
    try {
      body = asRecord(await request.json());
    } catch {
      return fail('INVALID_REQUEST');
    }
    if (!OPERATIONS.has(body.operation) || typeof body.request_id !== 'string' || !body.request_id) {
      return fail('INVALID_REQUEST');
    }
    if (!deps.verifier) return fail('AUTHORIZATION_NOT_CONFIGURED');
    let principal: VerifiedPrincipal;
    try {
      principal = await deps.verifier.verify(request);
    } catch (error) {
      return fail(String(error).includes('AUTHORIZATION_NOT_CONFIGURED')
        ? 'AUTHORIZATION_NOT_CONFIGURED' : 'UNAUTHORIZED');
    }
    if (body.operation !== 'clear_chat_history') {
      try {
        if (!await deps.featureEnabled()) return fail('ASSESSMENT_FEATURE_DISABLED');
      } catch {
        return fail('ASSESSMENT_CONFIGURATION_UNAVAILABLE');
      }
    }

    try {
      let data: unknown;
      switch (body.operation) {
        case 'read_learning_evidence':
          data = await rpc(deps, 'read_learning_evidence_v1', {
            p_room_id: assertRoom(principal, body.room_id),
            p_checklist_id: requiredString(body.checklist_id),
            p_actor_id: principal.application_user_id,
          });
          break;
        case 'read_review': {
          assertTeacher(principal);
          const args={
            p_room_id: assertRoom(principal, body.room_id),
            p_assessment_id: requiredString(body.assessment_id),
            p_actor_id: principal.application_user_id,
          };
          let review=asRecord(await rpc(deps,'get_transfer_assessment_review_v1',args));
          const pending=asRecord(review.history_readiness).pending_answers;
          if (Array.isArray(pending) && pending.length) {
            const studentId=requiredString(review.student_id,'ASSESSMENT_RESULT_UNAVAILABLE');
            for (const candidate of pending) {
              const answer=asRecord(candidate);
              if (!answer.assessment_id) continue;
              await processMessage(deps,{assessment_id:requiredString(answer.assessment_id),message_id:requiredString(answer.message_id)},
                {...principal,application_user_id:studentId},crypto.randomUUID());
            }
            review=asRecord(await rpc(deps,'get_transfer_assessment_review_v1',args));
          }
          data=review;
          break;
        }
        case 'clear_chat_history':
          assertTeacher(principal);
          data=await rpc(deps,'clear_room_chat_history_v1',{
            p_room_id:assertRoom(principal,body.room_id),p_actor_id:principal.application_user_id,
          });
          break;
        case 'join_room':
          data = await rpc(deps, 'join_room_v1', {
            p_room_id: requiredString(body.room_id),
            p_student_id: principal.application_user_id,
          });
          if (body.visit_key !== undefined && asRecord(data).room_role === 'student') {
            await rpc(deps, 'start_learner_visit_v1', {
              p_room_id: requiredString(body.room_id),
              p_student_id: principal.application_user_id,
              p_visit_key: requiredString(body.visit_key),
            });
          }
          break;
        case 'initialize_checklist':
          assertTeacher(principal);
          if (!Array.isArray(body.items) || body.items.length === 0 || body.items.some((value: unknown) => {
            const item = asRecord(value);
            return typeof item.area_text !== 'string' || !item.area_text.trim() ||
              !['detection_area', 'verification_step', 'understanding', 'behavior'].includes(item.item_type) ||
              !['critical', 'important', 'optional'].includes(item.priority) ||
              Object.keys(item).some(key => !['area_text', 'item_type', 'priority'].includes(key));
          })) throw new Error('ITEM_VALIDATION_FAILED');
          data = await rpc(deps, 'initialize_transfer_checklist_v1', {
            p_room_id: assertRoom(principal, body.room_id),
            p_student_id: requiredString(body.student_id),
            p_items: body.items,
            p_actor_id: principal.application_user_id,
          });
          break;
        case 'edit_learning_progress':
          assertTeacher(principal);
          data = await rpc(deps, 'edit_room_checklist_v1', {
            p_room_id: assertRoom(principal, body.room_id),
            p_actor_id: principal.application_user_id,
            p_request_id: requiredString(body.request_id),
            p_action: requiredString(body.action, 'ITEM_VALIDATION_FAILED'),
            p_item_id: requiredString(body.item_id, 'ITEM_VALIDATION_FAILED'),
            p_payload: asRecord(body.updates),
          });
          break;
        case 'post_message': {
          const roomId = assertRoom(principal, body.room_id);
          const roomEntry = asRecord(await rpc(deps, 'join_room_v1', {
            p_room_id: roomId,
            p_student_id: principal.application_user_id,
          }));
          if (roomEntry.room_role === 'observer') throw new Error('OBSERVER_READ_ONLY');
          data = await rpc(deps, 'post_assessment_message_v2', {
            p_room_id: roomId,
            p_content: requiredString(body.content),
            p_parent_message_id: body.parent_message_id ?? null,
            p_assessment_id: body.assessment_id ?? null,
            p_selected_option_ids: body.assessment_id && body.selected_option_ids != null ? selectedIds(body.selected_option_ids) : null,
            p_actor_id: principal.application_user_id,
            p_request_id: body.request_id,
          });
          break;
        }
        case 'analyze_message':
          data = await analyzeMessage(deps, body, principal, body.request_id);
          break;
        case 'prepare_turn':
          data = await prepareAssessment(deps, body, principal, body.request_id);
          break;
        case 'send_reviewed': {
          assertTeacher(principal);
          const roomId = assertRoom(principal, body.room_id);
          const itemId = requiredString(body.item_id, 'ITEM_VALIDATION_FAILED');
          const focusMessageId = requiredString(body.focus_student_message_id);
          assertReviewedCandidate(body.reviewed_payload, itemId);
          data = projectDelivery(await rpc(deps, 'send_reviewed_transfer_assessment_v1', {
            p_reviewed_payload: body.reviewed_payload,
            p_room_id: roomId,
            p_student_id: requiredString(body.student_id),
            p_checklist_id: requiredString(body.checklist_id),
            p_item_id: itemId,
            p_focus_student_message_id: focusMessageId,
            p_actor_id: principal.application_user_id,
            p_request_id: body.request_id,
          }));
          break;
        }
        case 'process_message':
          if (body.room_id != null) {
            const roomId = assertRoom(principal, body.room_id);
            const roomEntry = asRecord(await rpc(deps, 'join_room_v1', {
              p_room_id: roomId,
              p_student_id: principal.application_user_id,
            }));
            if (roomEntry.room_role === 'observer') throw new Error('OBSERVER_READ_ONLY');
          }
          data = await processMessage(deps, body, principal, body.request_id);
          break;
      }
      return response({ ok: true, data });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      const code = Object.keys(ERROR_STATUS).find((candidate) => text.includes(candidate)) ?? 'PERSISTENCE_FAILED';
      return fail(code);
    }
  };
}

export function createDefaultDependencies(): AssessmentApiDependencies {
  const env = (name: string) => Deno.env.get(name);
  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return {
      featureEnabled: async () => false,
      verifier: undefined,
      rpc: async () => ({ data: null, error: { message: 'AUTHORIZATION_NOT_CONFIGURED' } }),
      env,
      fetch,
      resolveAnswer: resolveTransferAnswer,
    };
  }
  const admin = createClient(url, serviceKey, { global: { headers: { 'x-practice-contract': 'cyberbullying-v2' } }, auth: { autoRefreshToken: false, persistSession: false } });
  const verifier: AssessmentPrincipalVerifier = {
    verify: async (request) => {
      const userId = request.headers.get('x-application-user-id')?.trim();
      if (!userId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error('UNAUTHORIZED');
      }
      const [{ data: profile }, { data: sessions }, { data: rooms }] = await Promise.all([
        admin.from('users').select('current_role, status').eq('id', userId).maybeSingle(),
        admin.from('sessions').select('room_id').eq('status', 'active').or(`student_id.eq.${userId},tutor_id.eq.${userId}`),
        admin.from('rooms').select('id').eq('tutor_id', userId),
      ]);
      if (!profile || profile.status !== 'active') throw new Error('FORBIDDEN');
      const roomIds = new Set<string>();
      (sessions ?? []).forEach((entry: any) => roomIds.add(entry.room_id));
      (rooms ?? []).forEach((entry: any) => roomIds.add(entry.id));
      return {
        principal_id: userId,
        application_user_id: userId,
        allowed_room_ids: [...roomIds],
        can_review_assessment: profile.current_role === 'tutor',
      };
    },
  };
  return {
    featureEnabled: async () => {
      const { data, error } = await admin.from('feature_flags').select('enabled')
        .eq('name', 'TRANSFER_ASSESSMENT_ENABLED').single();
      if (error || typeof data?.enabled !== 'boolean') {
        throw new Error('ASSESSMENT_CONFIGURATION_UNAVAILABLE');
      }
      return data.enabled;
    },
    verifier,
    rpc: async (name, args) => {
      const result = await admin.rpc(name, args);
      return { data: result.data, error: result.error };
    },
    env,
    fetch,
    resolveAnswer: resolveTransferAnswer,
  };
}

if (import.meta.main) Deno.serve(createAssessmentApiHandler(createDefaultDependencies()));

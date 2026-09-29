#!/usr/bin/env -S deno run --allow-env --allow-net
// Purpose: enforce trusted transfer-assessment identity, provider, delivery, and attempt authority.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { resolveTransferAnswer } from '../../../src/services/transferAssessmentOrchestrator.ts';
import {
  buildTransferTutorRequestContextV3,
  buildTransferAssessmentRequest,
} from '../../../src/services/ecologicalTutorCall.ts';
import { validateAssessmentDraft } from '../../../src/services/assessmentValidation.ts';

const OPERATIONS = new Set([
  'initialize_checklist', 'post_message', 'analyze_message',
  'prepare_turn', 'send_reviewed', 'process_message',
]);
const OPTION_IDS = new Set(['A', 'B', 'C', 'D']);
const PROVIDER_MODEL = 'qwen3.5-flash';
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

const TRANSFER_ANALYSIS_SYSTEM_PROMPT = [
  'Classify this persisted learner message against only the listed room learning targets.',
  'Return JSON with events, requires_protection, requires_correction, and explanation.',
  'Each event has item_id, kind, and explanation. Kind is initial_signal, post_repair_signal, spontaneous_transfer, or contradiction.',
  'Include every supported target, but omit unsupported claims. Do not treat tutor statements as learner evidence.',
  'Set requires_protection or requires_correction when the learner message needs an immediate safety or factual response.',
  'Never invent target IDs. Return JSON only.',
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
  featureEnabled: boolean;
  verifier?: AssessmentPrincipalVerifier;
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  resolveAnswer: (context: any, input: any) => any;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-user-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const ERROR_STATUS: Record<string, { status: number; retryable: boolean }> = {
  INVALID_REQUEST: { status: 400, retryable: false },
  UNAUTHORIZED: { status: 401, retryable: false },
  FORBIDDEN: { status: 403, retryable: false },
  WRONG_LEARNER: { status: 409, retryable: false },
  ITEM_VALIDATION_FAILED: { status: 409, retryable: false },
  INVALID_SCOPE: { status: 409, retryable: false },
  LEGACY_CHECKLIST: { status: 409, retryable: false },
  LEGACY_ASSESSMENT_INCOMPLETE: { status: 409, retryable: false },
  ASSESSMENT_ALREADY_OPEN: { status: 409, retryable: false },
  ASSESSMENT_TERMINAL: { status: 409, retryable: false },
  AUTHORIZATION_NOT_CONFIGURED: { status: 503, retryable: false },
  ASSESSMENT_FEATURE_DISABLED: { status: 503, retryable: false },
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
  const key = deps.env('REACT_APP_OAI_API_KEY');
  const baseUrl = deps.env('REACT_APP_OAI_BASE_URL');
  const model = deps.env('OAI_MODEL');
  if (!key || !baseUrl || model !== PROVIDER_MODEL) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
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
  if (message.id !== messageId || message.room_id !== roomId || message.user_role !== 'student' ||
      message.user_id !== scope.student_id || !Array.isArray(items) || !items.length) {
    throw new Error('INVALID_SCOPE');
  }
  const provider = providerConfig(deps);
  let providerResponse: Response;
  try {
    providerResponse = await deps.fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${provider.key}` },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: TRANSFER_ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify({ message, items }) },
        ],
        temperature: 0,
        max_tokens: 600,
        enable_thinking: false,
        response_format: { type: 'json_object' },
      }),
    });
  } catch {
    throw new Error('AI_PROVIDER_ERROR');
  }
  if (!providerResponse.ok) throw new Error('AI_PROVIDER_ERROR');
  const payload = asRecord(await providerResponse.json().catch(() => ({})));
  const choice = asRecord(payload.choices?.[0]);
  if (choice.finish_reason === 'length') throw new Error('AI_OUTPUT_TRUNCATED');
  let analysis: Record<string, any>;
  try {
    analysis = asRecord(JSON.parse(requiredString(asRecord(choice.message).content, 'AI_OUTPUT_INVALID')));
  } catch {
    throw new Error('AI_OUTPUT_INVALID');
  }
  const knownIds = new Set(items.map((item: any) => item.id));
  const allowedKinds = new Set(['initial_signal', 'post_repair_signal', 'spontaneous_transfer', 'contradiction']);
  if (!Array.isArray(analysis.events) || analysis.events.some((event: unknown) => {
    const evidence = asRecord(event);
    return !knownIds.has(evidence.item_id) || !allowedKinds.has(evidence.kind) ||
      typeof evidence.explanation !== 'string' || !evidence.explanation.trim();
  }) || typeof analysis.requires_protection !== 'boolean' ||
      typeof analysis.requires_correction !== 'boolean') {
    throw new Error('AI_OUTPUT_INVALID');
  }
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

  for (let ordinal = 1; ordinal <= 2; ordinal += 1) {
    const requestPayload = {
      model: provider.model,
      messages: [
        { role: 'system', content: TRANSFER_ASSESSMENT_SYSTEM_PROMPT },
        { role: 'user', content: ordinal === 1 ? userMessage : `${userMessage}\nReturn valid JSON matching the same contract.` },
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
    } catch {
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
    const result = deps.resolveAnswer(context, {
      delivered: true,
      answer_message_id: messageId,
      content: selectedIds(answer.selected_option_ids).join(','),
      assessment,
      references_message_id: answer.references_message_id ?? null,
    });

    if (result.disposition === 'duplicate' && stored.authoritative_result) {
      return projectProcessed({ ...asRecord(stored.authoritative_result), processing_state: 'duplicate', already_processed: true });
    }
    const answerOutcome = result.disposition === 'retryable'
      ? 'retry'
      : result.disposition === 'passed' || result.disposition === 'failed'
        ? result.disposition
        : null;
    if (!answerOutcome) {
      return projectProcessed({
        message_id: messageId, assessment_id: assessmentId, processing_state: 'rejected',
        answer_outcome: null, attempt_number: null,
        attempts_used: snapshot.accepted_attempt_count ?? 0,
        attempts_remaining: snapshot.resolution === 'open' ? 2 - (snapshot.accepted_attempt_count ?? 0) : 0,
        selected_option_ids: null, terminal: snapshot.resolution !== 'open', transition: null,
        feedback_required: false, code: result.clarification_code ?? result.disposition,
        already_processed: result.disposition === 'duplicate', terminal_failure_feedback: null,
      });
    }
    const committed = asRecord(await rpc(deps, 'process_assessment_message_v2', {
      p_assessment_id: assessmentId,
      p_message_id: messageId,
      p_actor_id: principal.application_user_id,
      p_request_id: requestId,
      p_expected_attempt_count: snapshot.accepted_attempt_count,
      p_expected_resolution: snapshot.resolution,
      p_answer_outcome: answerOutcome,
      p_selected_option_ids: selectedIds(answer.selected_option_ids),
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
    if (!deps.featureEnabled) return fail('ASSESSMENT_FEATURE_DISABLED');

    try {
      let data: unknown;
      switch (body.operation) {
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
        case 'post_message': {
          const roomId = assertRoom(principal, body.room_id);
          data = await rpc(deps, 'post_assessment_message_v2', {
            p_room_id: roomId,
            p_content: requiredString(body.content),
            p_parent_message_id: body.parent_message_id ?? null,
            p_assessment_id: body.assessment_id ?? null,
            p_selected_option_ids: body.assessment_id ? selectedIds(body.selected_option_ids) : null,
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
          if (body.room_id != null) assertRoom(principal, body.room_id);
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

function createDefaultDependencies(): AssessmentApiDependencies {
  const env = (name: string) => Deno.env.get(name);
  const url = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    return {
      featureEnabled: false,
      verifier: undefined,
      rpc: async () => ({ data: null, error: { message: 'AUTHORIZATION_NOT_CONFIGURED' } }),
      env,
      fetch,
      resolveAnswer: resolveTransferAnswer,
    };
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const verifier: AssessmentPrincipalVerifier = {
    verify: async (request) => {
      const userId = request.headers.get('x-application-user-id')?.trim();
      if (!userId || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) {
        throw new Error('UNAUTHORIZED');
      }
      const [{ data: profile }, { data: sessions }, { data: rooms }] = await Promise.all([
        admin.from('users').select('current_role').eq('id', userId).maybeSingle(),
        admin.from('sessions').select('room_id').or(`student_id.eq.${userId},tutor_id.eq.${userId}`),
        admin.from('rooms').select('id').eq('tutor_id', userId),
      ]);
      if (!profile) throw new Error('FORBIDDEN');
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
    featureEnabled: (env('TRANSFER_ASSESSMENT_ENABLED') ?? 'true') === 'true',
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

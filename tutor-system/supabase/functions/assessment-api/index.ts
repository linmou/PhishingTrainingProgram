#!/usr/bin/env -S deno run --allow-env --allow-net
// Purpose: expose the trusted transfer-assessment boundary while keeping private keys server-side.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

type Operation =
  | 'initialize_checklist'
  | 'post_message'
  | 'analyze_message'
  | 'prepare_turn'
  | 'send_reviewed'
  | 'process_message';

interface VerifiedPrincipal {
  principal_id: string;
  application_user_id: string;
  allowed_room_ids: string[];
  can_review_assessment: boolean;
}

interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function errorResponse(code: string, message: string, status: number, retryable = false): Response {
  const error: ApiError = { code, message, retryable };
  return jsonResponse({ ok: false, error }, status);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

function adminClient(): SupabaseClient {
  return createClient(requiredEnv('SUPABASE_URL'), requiredEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function verifyAssessmentPrincipal(request: Request): Promise<VerifiedPrincipal> {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) throw new Error('UNAUTHORIZED');

  let admin: SupabaseClient;
  try {
    admin = adminClient();
  } catch {
    throw new Error('AUTHORIZATION_NOT_CONFIGURED');
  }

  const token = authorization.slice('Bearer '.length).trim();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) throw new Error('UNAUTHORIZED');

  const applicationUserId = authData.user.id;
  const { data: profile, error: profileError } = await admin
    .from('users')
    .select('id,current_role')
    .eq('id', applicationUserId)
    .maybeSingle();
  if (profileError || !profile) throw new Error('FORBIDDEN');

  const allowedRoomIds = new Set<string>();
  if (profile.current_role === 'tutor') {
    const { data: tutorRooms } = await admin.from('rooms').select('id').eq('tutor_id', applicationUserId);
    (tutorRooms || []).forEach((room) => allowedRoomIds.add(room.id));
  }
  const { data: sessions } = await admin
    .from('sessions')
    .select('room_id')
    .or(`student_id.eq.${applicationUserId},tutor_id.eq.${applicationUserId}`);
  (sessions || []).forEach((session) => allowedRoomIds.add(session.room_id));

  return {
    principal_id: authData.user.id,
    application_user_id: applicationUserId,
    allowed_room_ids: Array.from(allowedRoomIds),
    can_review_assessment: profile.current_role === 'tutor',
  };
}

function assertRoomAccess(principal: VerifiedPrincipal, roomId: unknown): asserts roomId is string {
  if (typeof roomId !== 'string' || !principal.allowed_room_ids.includes(roomId)) throw new Error('FORBIDDEN');
}

function assertTutor(principal: VerifiedPrincipal): void {
  if (!principal.can_review_assessment) throw new Error('FORBIDDEN');
}

/**
 * The one response projection. A stored message is the only row shape the RPCs hand back, so the
 * allowlist below is the whole public surface; `assessment_key` and every other private column
 * are simply not listed.
 */
function publicMessage(value: Record<string, unknown>): Record<string, unknown> {
  return {
    id: value.id,
    room_id: value.room_id,
    user_id: value.user_id,
    content: value.content,
    user_role: value.user_role,
    is_ai_generated: value.is_ai_generated,
    parent_message_id: value.parent_message_id,
    response_mode: value.response_mode,
    created_at: value.created_at,
  };
}

function safeOperationData(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  if (record.message) return { ...record, message: publicMessage(record.message as Record<string, unknown>) };
  return value;
}

const TRANSFER_V3_SYSTEM_PROMPT = [
  'Return exactly one JSON object with keys reason, decision, response, assessment in that order.',
  'reason is concise observable evidence and purpose, at most 40 words.',
  'decision.mode is tutoring, guard, or assessment. decision.instruction is protective_instruction, correction, scaffolding, explanation, consolidation, transfer_assess, or guard.',
  'Use assessment only with instruction transfer_assess and a known target item. Use tutoring with a teaching instruction and no assessment. Use guard with guard or a teaching instruction and no assessment.',
  'For an assessment, preserve the concept while changing the meaningful situation. Include exactly options A, B, C, D, a single or multiple selection_type, a correct_option_ids key, and transfer_basis with source evidence IDs from the supplied context.',
  'Never invent learner, organization, item, or message IDs. Do not emit hidden chain-of-thought, markdown, or text outside JSON.',
].join('\n');

const TRANSFER_EVIDENCE_SYSTEM_PROMPT = [
  'Return exactly one JSON object with an events array.',
  'Each event must use one known item ID and one of initial_signal, post_repair_signal, contradiction, or spontaneous_transfer.',
  'Use only evidence in the supplied learner message/history. Do not infer a target from a bare ambiguous acknowledgment.',
  'For every event include concise evidence_text and source_evidence_message_ids from the supplied messages.',
  'Return an empty events array when no item is clearly supported. Never emit assessment_pass or assessment_fail.',
].join('\n');

async function hashText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function assertV3DraftShape(value: unknown, itemIds: Set<string>, messageIds: Set<string>): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('AI_OUTPUT_INVALID');
  const candidate = value as Record<string, any>;
  if (typeof candidate.reason !== 'string' || !candidate.reason.trim()) throw new Error('AI_OUTPUT_INVALID');
  if (!candidate.decision || typeof candidate.decision !== 'object') throw new Error('AI_OUTPUT_INVALID');
  const decision = candidate.decision;
  if (!['tutoring', 'guard', 'assessment'].includes(decision.mode)) throw new Error('AI_OUTPUT_INVALID');
  if (!['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', 'transfer_assess', 'guard'].includes(decision.instruction)) throw new Error('AI_OUTPUT_INVALID');
  if (decision.target_item_id !== null && !itemIds.has(decision.target_item_id)) throw new Error('AI_OUTPUT_INVALID');
  if (typeof candidate.response !== 'string' || !candidate.response.trim()) throw new Error('AI_OUTPUT_INVALID');
  if (decision.mode !== 'assessment') {
    if (candidate.assessment !== null || decision.target_item_id !== null || decision.instruction === 'transfer_assess' || decision.instruction === 'guard' && decision.mode !== 'guard') throw new Error('AI_OUTPUT_INVALID');
    return;
  }
  const assessment = candidate.assessment;
  if (decision.instruction !== 'transfer_assess' || !decision.target_item_id || !assessment || !['single', 'multiple'].includes(assessment.selection_type)) throw new Error('AI_OUTPUT_INVALID');
  if (!Array.isArray(assessment.options) || assessment.options.length !== 4 || assessment.options.some((option: any, index: number) => option?.id !== ['A', 'B', 'C', 'D'][index] || typeof option.text !== 'string' || !option.text.trim())) throw new Error('AI_OUTPUT_INVALID');
  if (!Array.isArray(assessment.correct_option_ids) || new Set(assessment.correct_option_ids).size !== assessment.correct_option_ids.length || assessment.correct_option_ids.some((id: unknown) => !['A', 'B', 'C', 'D'].includes(String(id)))) throw new Error('AI_OUTPUT_INVALID');
  if (assessment.selection_type === 'single' && assessment.correct_option_ids.length !== 1) throw new Error('AI_OUTPUT_INVALID');
  if (assessment.selection_type === 'multiple' && (assessment.correct_option_ids.length < 2 || assessment.correct_option_ids.length > 3)) throw new Error('AI_OUTPUT_INVALID');
  const basis = assessment.transfer_basis;
  if (!basis || typeof basis !== 'object' || !basis.concept_rule || !basis.source_context || !basis.changed_context || !Array.isArray(basis.source_evidence_message_ids) || basis.source_evidence_message_ids.length === 0 || basis.source_evidence_message_ids.some((id: unknown) => !messageIds.has(String(id)))) throw new Error('AI_OUTPUT_INVALID');
}

async function prepareTransferTurn(
  body: Record<string, unknown>,
  principal: VerifiedPrincipal,
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  assertTutor(principal);
  assertRoomAccess(principal, body.room_id);
  if (typeof body.focus_student_message_id !== 'string' || typeof body.checklist_id !== 'string') throw new Error('INVALID_REQUEST');

  const { data: checklist, error: checklistError } = await admin
    .from('session_checklists')
    .select('id,room_id,student_id,progress_policy_version')
    .eq('id', body.checklist_id)
    .eq('room_id', body.room_id)
    .eq('progress_policy_version', 'transfer_v1')
    .eq('is_active', true)
    .single();
  if (checklistError || !checklist?.student_id) throw new Error('LEGACY_CHECKLIST');

  const [{ data: focusMessage }, { data: items }, { data: room }] = await Promise.all([
    admin.from('messages').select('id,room_id,user_id,user_role,content').eq('id', body.focus_student_message_id).eq('room_id', body.room_id).single(),
    admin.from('checklist_items').select('id,area_text,priority,status,understanding_level,coverage_evidence(message_id)').eq('checklist_id', checklist.id),
    admin.from('rooms').select('active_response_mode').eq('id', body.room_id).single(),
  ]);
  if (!focusMessage || focusMessage.user_id !== checklist.student_id || focusMessage.user_role !== 'student') throw new Error('WRONG_LEARNER');

  // The open-assessment check moved onto public.messages.assessment_lifecycle when the
  // assessment_questions table was dropped.
  const { data: openAssessment } = await admin
    .from('messages')
    .select('id')
    .eq('room_id', body.room_id)
    .eq('user_id', checklist.student_id)
    .eq('assessment_lifecycle', 'delivered')
    .maybeSingle();
  if (openAssessment) throw new Error('ASSESSMENT_ALREADY_OPEN');

  const itemRows = (items || []).map((item: any) => ({
    id: item.id,
    area_text: item.area_text,
    priority: item.priority,
    status: item.status,
    understanding_level: item.understanding_level,
    relevant_evidence_message_ids: (item.coverage_evidence || []).map((evidence: any) => evidence.message_id).filter(Boolean),
    repair_message_id: null,
  }));
  const itemIds = new Set(itemRows.map((item) => item.id));
  const messageIds = new Set(itemRows.flatMap((item) => item.relevant_evidence_message_ids));
  messageIds.add(focusMessage.id);
  const eligibleItemIds = itemRows
    .filter((item) => item.status === 'partially_covered' && item.understanding_level === 'basic')
    .map((item) => item.id);
  const snapshot = JSON.stringify({ checklist, itemRows, focus_message_id: focusMessage.id });
  const progressSnapshotHash = await hashText(snapshot);

  const providerKey = Deno.env.get('REACT_APP_OAI_API_KEY');
  const providerBaseUrl = Deno.env.get('REACT_APP_OAI_BASE_URL');
  if (!providerKey || !providerBaseUrl || providerKey === 'your_dashscope_api_key_here') throw new Error('AI_PROVIDER_NOT_CONFIGURED');
  const model = Deno.env.get('REACT_APP_OAI_MODEL') || 'qwen3.5-flash';
  const promptContext = {
    focus_student_id: checklist.student_id,
    focus_student_message: focusMessage,
    progress_policy_version: checklist.progress_policy_version,
    prior_participation_mode: room?.active_response_mode || 'unknown',
    checklist_items: itemRows,
    eligible_assessment_item_ids: eligibleItemIds,
    unresolved_assessment: null,
    feedback_required: false,
    progress_snapshot_hash: progressSnapshotHash,
  };
  const providerResponse = await fetch(`${providerBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: TRANSFER_V3_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(promptContext) },
      ],
      temperature: 0.3,
      max_tokens: 1200,
      enable_thinking: false,
      response_format: { type: 'json_object' },
    }),
  });
  if (!providerResponse.ok) throw new Error('AI_PROVIDER_ERROR');
  const providerPayload = await providerResponse.json();
  const rawContent = providerPayload?.choices?.[0]?.message?.content;
  let candidate: unknown;
  try {
    candidate = JSON.parse(rawContent);
  } catch {
    throw new Error('AI_OUTPUT_INVALID');
  }
  assertV3DraftShape(candidate, itemIds, messageIds);
  if (candidate.decision.mode === 'assessment' && !eligibleItemIds.includes(candidate.decision.target_item_id)) throw new Error('AI_OUTPUT_INVALID');

  // No draft table exists. The generated candidate is returned to the caller, which reviews
  // it and passes it back to send_reviewed. Nothing is persisted until delivery.
  return {
    decision: candidate,
    progress_snapshot_hash: progressSnapshotHash,
    room_id: checklist.room_id,
    student_id: checklist.student_id,
    checklist_id: checklist.id,
    item_id: candidate.decision.target_item_id,
    focus_student_message_id: focusMessage.id,
  };
}

async function analyzeTransferMessage(
  body: Record<string, unknown>,
  principal: VerifiedPrincipal,
  admin: SupabaseClient,
): Promise<Record<string, unknown>> {
  if (typeof body.room_id !== 'string' || typeof body.message_id !== 'string') throw new Error('INVALID_REQUEST');
  assertRoomAccess(principal, body.room_id);

  const [{ data: message, error: messageError }, { data: checklist, error: checklistError }] = await Promise.all([
    admin.from('messages').select('id,room_id,user_id,user_role,content').eq('id', body.message_id).eq('room_id', body.room_id).single(),
    admin.from('session_checklists').select('id,room_id,student_id,progress_policy_version').eq('room_id', body.room_id).eq('student_id', principal.application_user_id).eq('progress_policy_version', 'transfer_v1').eq('is_active', true).maybeSingle(),
  ]);
  if (messageError || !message || message.user_id !== principal.application_user_id || message.user_role !== 'student') throw new Error('FORBIDDEN');
  if (checklistError || !checklist) return { skipped: 'no_transfer_checklist' };

  // Open-assessment check moved onto public.messages.assessment_lifecycle.
  const { data: openAssessment } = await admin
    .from('messages')
    .select('id')
    .eq('room_id', body.room_id)
    .eq('user_id', principal.application_user_id)
    .eq('assessment_lifecycle', 'delivered')
    .maybeSingle();
  if (openAssessment) return { skipped: 'assessment_open' };

  const [{ data: items, error: itemsError }, { data: history, error: historyError }] = await Promise.all([
    admin.from('checklist_items').select('id,area_text,priority,status,understanding_level,coverage_evidence(message_id)').eq('checklist_id', checklist.id),
    admin.from('messages').select('id,user_role,content').eq('room_id', body.room_id).order('created_at', { ascending: false }).limit(10),
  ]);
  if (itemsError || historyError) throw new Error('PERSISTENCE_FAILED');

  const itemRows = (items || []).map((item: any) => ({
    id: item.id,
    area_text: item.area_text,
    priority: item.priority,
    status: item.status,
    understanding_level: item.understanding_level,
    source_evidence_message_ids: (item.coverage_evidence || []).map((evidence: any) => evidence.message_id).filter(Boolean),
  }));
  const messageIds = new Set((history || []).map((entry: any) => entry.id));
  const itemIds = new Set(itemRows.map((item) => item.id));
  const providerKey = Deno.env.get('REACT_APP_OAI_API_KEY');
  const providerBaseUrl = Deno.env.get('REACT_APP_OAI_BASE_URL');
  if (!providerKey || !providerBaseUrl || providerKey === 'your_dashscope_api_key_here') throw new Error('AI_PROVIDER_NOT_CONFIGURED');

  const providerResponse = await fetch(`${providerBaseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${providerKey}` },
    body: JSON.stringify({
      model: Deno.env.get('REACT_APP_OAI_MODEL') || 'qwen3.5-flash',
      messages: [
        { role: 'system', content: TRANSFER_EVIDENCE_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify({ message, history, checklist_items: itemRows }) },
      ],
      temperature: 0.1,
      max_tokens: 600,
      enable_thinking: false,
      response_format: { type: 'json_object' },
    }),
  });
  if (!providerResponse.ok) throw new Error('AI_PROVIDER_ERROR');

  let payload: any;
  try {
    const raw = (await providerResponse.json())?.choices?.[0]?.message?.content;
    payload = JSON.parse(raw);
  } catch {
    throw new Error('AI_OUTPUT_INVALID');
  }
  if (!payload || !Array.isArray(payload.events)) throw new Error('AI_OUTPUT_INVALID');

  const applied: unknown[] = [];
  for (const event of payload.events.slice(0, 3)) {
    if (!event || !itemIds.has(event.item_id) || !['initial_signal', 'post_repair_signal', 'contradiction', 'spontaneous_transfer'].includes(event.kind)) continue;
    if (typeof event.evidence_text !== 'string' || !event.evidence_text.trim() || !Array.isArray(event.source_evidence_message_ids) || event.source_evidence_message_ids.length === 0) continue;
    if (event.source_evidence_message_ids.some((id: unknown) => !messageIds.has(String(id)))) continue;
    const { data, error } = await admin.rpc('apply_learning_event_v1', {
      p_event: {
        event_id: crypto.randomUUID(),
        dedupe_key: `message:${message.id}:item:${event.item_id}:${event.kind}`,
        room_id: body.room_id,
        student_id: principal.application_user_id,
        checklist_id: checklist.id,
        item_id: event.item_id,
        source_message_id: message.id,
        kind: event.kind,
        evidence_text: event.evidence_text.trim().slice(0, 1000),
        source_evidence_message_ids: event.source_evidence_message_ids,
        classified_by: 'model',
      },
    });
    if (error) throw new Error(error.message);
    applied.push(data);
  }
  return { analyzed_message_id: message.id, applied };
}

async function dispatch(operation: Operation, body: Record<string, unknown>, principal: VerifiedPrincipal, admin: SupabaseClient): Promise<unknown> {
  if (Deno.env.get('TRANSFER_ASSESSMENT_ENABLED') !== 'true') throw new Error('ASSESSMENT_FEATURE_DISABLED');

  if (operation === 'prepare_turn') return prepareTransferTurn(body, principal, admin);
  if (operation === 'analyze_message') {
    if (!principal.allowed_room_ids.includes(String(body.room_id))) throw new Error('FORBIDDEN');
    return analyzeTransferMessage(body, principal, admin);
  }

  const roomId = body.room_id;
  if (roomId !== undefined) assertRoomAccess(principal, roomId);
  if (['initialize_checklist', 'prepare_turn', 'send_reviewed'].includes(operation)) assertTutor(principal);

  const rpcArgs: Record<string, unknown> = {
    p_actor_id: principal.application_user_id,
    p_request_id: body.request_id,
  };
  const rpcName: Record<Operation, string> = {
    initialize_checklist: 'initialize_transfer_checklist_v1',
    post_message: 'post_assessment_message_v1',
    analyze_message: 'apply_learning_event_v1',
    prepare_turn: 'prepare_transfer_turn_v1',
    send_reviewed: 'send_reviewed_tutor_response_v3',
    process_message: 'process_assessment_message_v1',
  };
  switch (operation) {
    case 'initialize_checklist':
      rpcArgs.p_room_id = body.room_id;
      rpcArgs.p_student_id = body.student_id;
      rpcArgs.p_template_name = body.template_name;
      break;
    case 'post_message':
      rpcArgs.p_room_id = body.room_id;
      rpcArgs.p_content = body.content;
      rpcArgs.p_parent_message_id = body.parent_message_id;
      rpcArgs.p_assessment_id = body.assessment_id;
      break;
    case 'analyze_message':
      throw new Error('INVALID_REQUEST');
    case 'prepare_turn':
      rpcArgs.p_room_id = body.room_id;
      rpcArgs.p_focus_student_message_id = body.focus_student_message_id;
      rpcArgs.p_checklist_id = body.checklist_id;
      break;
    case 'send_reviewed':
      // No draft table exists, so the reviewed payload and its scope arrive on the request.
      rpcArgs.p_reviewed_payload = body.reviewed_payload;
      rpcArgs.p_room_id = body.room_id;
      rpcArgs.p_student_id = body.student_id;
      rpcArgs.p_checklist_id = body.checklist_id;
      rpcArgs.p_item_id = body.item_id;
      rpcArgs.p_focus_student_message_id = body.focus_student_message_id;
      break;
    case 'process_message':
      rpcArgs.p_message_id = body.message_id;
      break;
    default:
      throw new Error('INVALID_REQUEST');
  }
  const { data, error } = await admin.rpc(rpcName[operation], rpcArgs);
  if (error) {
    const status = error.code === '42501' ? 403 : error.code === 'P0001' ? 409 : 500;
    throw Object.assign(new Error(error.message), { status, code: error.code || 'PERSISTENCE_FAILED' });
  }
  return safeOperationData(data);
}

export async function handleAssessmentRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST is required', 405);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_REQUEST', 'Request body must be JSON', 400);
  }
  const operation = body.operation;
  if (typeof operation !== 'string') return errorResponse('INVALID_REQUEST', 'operation is required', 400);
  const knownOperations: Operation[] = [
    'initialize_checklist', 'post_message', 'analyze_message', 'prepare_turn',
    'send_reviewed', 'process_message'
  ];
  if (!knownOperations.includes(operation as Operation)) return errorResponse('INVALID_REQUEST', 'unsupported operation', 400);
  if (typeof body.request_id !== 'string' || !body.request_id.trim()) return errorResponse('INVALID_REQUEST', 'request_id is required', 400);

  try {
    const principal = await verifyAssessmentPrincipal(request);
    const data = await dispatch(operation as Operation, body, principal, adminClient());
    return jsonResponse({ ok: true, data });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'PERSISTENCE_FAILED';
    if (code === 'AUTHORIZATION_NOT_CONFIGURED') return errorResponse(code, 'Trusted authentication is not configured', 503);
    if (code === 'UNAUTHORIZED') return errorResponse(code, 'Authenticated session required', 401);
    if (code === 'FORBIDDEN') return errorResponse(code, 'Principal is not authorized for this room or operation', 403);
    if (code === 'ASSESSMENT_FEATURE_DISABLED') return errorResponse(code, 'Transfer assessment is disabled', 503);
    if (code === 'AI_PROVIDER_NOT_CONFIGURED') return errorResponse(code, 'Trusted AI provider is not configured', 503);
    if (code === 'AI_PROVIDER_ERROR') return errorResponse(code, 'Trusted AI provider request failed', 502, true);
    if (code === 'AI_OUTPUT_INVALID') return errorResponse(code, 'Trusted AI provider returned an invalid tutor decision', 502, true);
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: number }).status) : 500;
    const errorCode = typeof error === 'object' && error && 'code' in error ? String((error as { code: string }).code) : code;
    return errorResponse(errorCode, code, status || 500, status === 500);
  }
}

if (import.meta.main) {
  Deno.serve(handleAssessmentRequest);
}

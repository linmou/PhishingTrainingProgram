#!/usr/bin/env -S deno run --allow-env --allow-net
// Purpose: proxy application LLM requests with server-only provider credentials.

import { DEFAULT_AI_MODEL } from '../../../src/services/aiModels.ts';
import { cyberbullyingMessages, parseCyberbullyingResponse, CYBERBULLYING_PROMPT_VERSION, CYBERBULLYING_SOURCE_COMMIT } from './cyberbullying.ts';

type ChatRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' };
  enable_thinking?: boolean;
}

export interface AiApiDependencies {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-user-id, x-practice-contract',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 50_000;
const MAX_TOTAL_CONTENT_LENGTH = 50_000;
const MAX_TOKENS = 2_000;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(code: string, status: number): Response {
  return response({ error: { code } }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChatRole(value: unknown): value is ChatRole {
  return value === 'system' || value === 'user' || value === 'assistant';
}

function parseChatRequest(value: unknown): ChatRequest {
  if (!isRecord(value) || !Array.isArray(value.messages) || value.messages.length === 0 || value.messages.length > MAX_MESSAGES) {
    throw new Error('INVALID_REQUEST');
  }

  let totalLength = 0;
  const messages = value.messages.map((message) => {
    if (!isRecord(message) || !isChatRole(message.role) || typeof message.content !== 'string') {
      throw new Error('INVALID_REQUEST');
    }
    const content = message.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) throw new Error('INVALID_REQUEST');
    totalLength += content.length;
    return { role: message.role, content };
  });
  if (totalLength > MAX_TOTAL_CONTENT_LENGTH) throw new Error('INVALID_REQUEST');

  const temperature = value.temperature === undefined ? 0.3 : value.temperature;
  const maxTokens = value.max_tokens === undefined ? 100 : value.max_tokens;
  if (typeof temperature !== 'number' || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    throw new Error('INVALID_REQUEST');
  }
  if (typeof maxTokens !== 'number' || !Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > MAX_TOKENS) {
    throw new Error('INVALID_REQUEST');
  }

  let responseFormat: { type: 'json_object' } | undefined;
  if (value.response_format !== undefined) {
    if (!isRecord(value.response_format) || value.response_format.type !== 'json_object' || Object.keys(value.response_format).some((key) => key !== 'type')) {
      throw new Error('INVALID_REQUEST');
    }
    responseFormat = { type: 'json_object' };
  }

  if (value.enable_thinking !== undefined && typeof value.enable_thinking !== 'boolean') {
    throw new Error('INVALID_REQUEST');
  }

  return {
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: responseFormat,
    enable_thinking: value.enable_thinking === undefined ? false : value.enable_thinking,
  };
}

function providerConfig(deps: AiApiDependencies): { key: string; baseUrl: string; model: string } {
  const key = deps.env('OAI_API_KEY');
  const baseUrl = deps.env('OAI_BASE_URL');
  if (!key || !baseUrl) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
  return { key, baseUrl: baseUrl.replace(/\/$/, ''), model: DEFAULT_AI_MODEL };
}

function providerPayload(request: ChatRequest, model: string): Record<string, unknown> {
  return {
    model,
    messages: request.messages,
    temperature: request.temperature,
    max_tokens: request.max_tokens,
    ...(request.response_format ? { response_format: request.response_format } : {}),
    enable_thinking: request.enable_thinking,
  };
}

async function generateChat(deps: AiApiDependencies, request: ChatRequest): Promise<Record<string, unknown>> {
  const provider = providerConfig(deps);
  let providerResponse: Response;
  try {
    providerResponse = await deps.fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify(providerPayload(request, provider.model)),
    });
  } catch {
    throw new Error('AI_PROVIDER_ERROR');
  }
  if (!providerResponse.ok) throw new Error('AI_PROVIDER_ERROR');

  const payload = await providerResponse.json().catch(() => null);
  const choice = isRecord(payload) && Array.isArray(payload.choices) ? payload.choices[0] : null;
  const message = isRecord(choice) ? choice.message : null;
  const content = isRecord(message) ? message.content : null;
  if (!isRecord(choice) || typeof content !== 'string') throw new Error('AI_OUTPUT_INVALID');
  return {
    content,
    model: provider.model,
    finish_reason: typeof choice.finish_reason === 'string' ? choice.finish_reason : null,
  };
}

async function practiceRpc(deps: AiApiDependencies, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!deps.rpc) throw new Error('APPLICATION_DATA_NOT_CONFIGURED');
  const result = await deps.rpc(name, args);
  if (result.error) {
    const code = ['FORBIDDEN', 'INVALID_REQUEST', 'INVALID_CHARACTER', 'LEARNER_MESSAGE_REQUIRED', 'PROPOSAL_NOT_FOUND',
      'PROPOSAL_CONFLICT', 'STALE_PROPOSAL', 'REQUEST_CONFLICT', 'AI_OUTPUT_INVALID']
      .find(value => result.error!.message.includes(value));
    throw new Error(code ?? 'PERSISTENCE_FAILED');
  }
  if (!isRecord(result.data)) throw new Error('PERSISTENCE_FAILED');
  if (typeof result.data.error_code === 'string') throw new Error(result.data.error_code);
  return result.data;
}

function uuid(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)) throw new Error('INVALID_REQUEST');
  return value;
}

async function cyberbullyingOperation(deps: AiApiDependencies, request: Request, body: Record<string, unknown>) {
  if (body.operation !== 'cyberbullying_suggest' && body.operation !== 'cyberbullying_review') throw new Error('INVALID_REQUEST');
  const actor = request.headers.get('x-application-user-id');
  if (!actor) throw new Error('UNAUTHORIZED');
  const common = { p_room_id: uuid(body.room_id), p_actor_id: uuid(actor) };
  if (body.operation === 'cyberbullying_review') {
    if (typeof body.reject !== 'boolean') throw new Error('INVALID_REQUEST');
    return practiceRpc(deps, 'review_cyberbullying_suggestion_v1', {
      ...common, p_suggestion_id: uuid(body.suggestion_id), p_reject: body.reject,
    });
  }
  providerConfig(deps);
  if (body.character !== undefined && body.character !== null && typeof body.character !== 'string') throw new Error('INVALID_CHARACTER');
  const suggestion = await practiceRpc(deps, 'begin_cyberbullying_suggestion_v1', {
    ...common, p_request_id: uuid(body.request_id),
    p_previous_suggestion_id: body.previous_suggestion_id == null ? null : uuid(body.previous_suggestion_id),
    p_character: body.character ?? null,
  });
  if (suggestion.status !== 'generating') return suggestion;
  if (!isRecord(suggestion.input_context)) throw new Error('PERSISTENCE_FAILED');
  const character = typeof suggestion.requested_character === 'string' ? suggestion.requested_character : null;
  const messages = cyberbullyingMessages(suggestion.input_context, character);
  const attempts: Array<Record<string, unknown>> = [];
  const provenance = () => ({
    model: DEFAULT_AI_MODEL,
    prompt_version: CYBERBULLYING_PROMPT_VERSION,
    source_commit: CYBERBULLYING_SOURCE_COMMIT,
    attempts,
  });
  let prepared: ChatRequest;
  try {
    prepared = parseChatRequest({ messages, temperature: 0.7, max_tokens: 2000, response_format: { type: 'json_object' }, enable_thinking: false });
  } catch {
    await practiceRpc(deps, 'finish_cyberbullying_suggestion_v1', {
      ...common, p_suggestion_id: suggestion.id, p_result: null,
      p_provenance: { ...provenance(), error: 'CONTEXT_TOO_LARGE' },
    });
    throw new Error('CONTEXT_TOO_LARGE');
  }
  let parsed: ReturnType<typeof parseCyberbullyingResponse> | undefined;
  let generationError = 'AI_OUTPUT_INVALID';
  for (let ordinal = 1; ordinal <= 2; ordinal += 1) {
    const call = ordinal === 1 ? prepared : {
      ...prepared,
      messages: [...prepared.messages, { role: 'system' as const, content: 'Return a complete JSON object with student_role, response_in_role and final_response, using the categories and selected character specified above.' }],
    };
    try {
      // Repeat the length check for the repair request; every attempt retains the full history.
      parseChatRequest(call);
      const output = await generateChat(deps, call);
      attempts.push({ ordinal, request: providerPayload(call, DEFAULT_AI_MODEL), output });
      if (output.finish_reason === 'length') throw new Error('AI_OUTPUT_TRUNCATED');
      parsed = parseCyberbullyingResponse(String(output.content), character);
      break;
    } catch (error) {
      generationError = error instanceof Error ? error.message : 'AI_PROVIDER_ERROR';
      if (attempts.length < ordinal) attempts.push({ ordinal, request: providerPayload(call, DEFAULT_AI_MODEL), error: generationError });
      if (generationError !== 'AI_OUTPUT_INVALID') break;
    }
  }
  const saved = await practiceRpc(deps, 'finish_cyberbullying_suggestion_v1', {
    ...common, p_suggestion_id: suggestion.id, p_result: parsed ?? null,
    p_provenance: { ...provenance(), ...(parsed ? {} : { error: generationError }) },
  });
  if (!parsed) throw new Error(generationError);
  return saved;
}

export function createAiApiHandler(deps: AiApiDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return fail('INVALID_REQUEST', 400);
    if (request.headers.get('x-practice-contract') !== 'cyberbullying-v1') return fail('CLIENT_RELOAD_REQUIRED', 409);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail('INVALID_REQUEST', 400);
    }

    try {
      if (isRecord(body) && body.operation !== undefined) {
        return response({ ok: true, data: await cyberbullyingOperation(deps, request, body) });
      }
      const chatRequest = parseChatRequest(body);
      return response({ ok: true, data: await generateChat(deps, chatRequest) });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'AI_PROVIDER_ERROR';
      if (code === 'INVALID_REQUEST') return fail(code, 400);
      if (code === 'AI_PROVIDER_NOT_CONFIGURED') return fail(code, 503);
      if (code === 'AI_OUTPUT_INVALID') return fail(code, 502);
      if (code === 'AI_OUTPUT_TRUNCATED') return fail(code, 502);
      if (code === 'CONTEXT_TOO_LARGE') return fail(code, 413);
      if (code === 'FORBIDDEN' || code === 'UNAUTHORIZED') return fail(code, 403);
      if (['PROPOSAL_CONFLICT', 'STALE_PROPOSAL', 'REQUEST_CONFLICT', 'GENERATION_IN_PROGRESS'].includes(code)) return fail(code, 409);
      if (['INVALID_CHARACTER', 'LEARNER_MESSAGE_REQUIRED', 'PROPOSAL_NOT_FOUND'].includes(code)) return fail(code, 400);
      if (code === 'PERSISTENCE_FAILED' || code === 'APPLICATION_DATA_NOT_CONFIGURED') return fail(code, 503);
      return fail('AI_PROVIDER_ERROR', 502);
    }
  };
}

function createDefaultDependencies(): AiApiDependencies {
  const env = (name: string) => Deno.env.get(name);
  return {
    env, fetch,
    rpc: async (name, args) => {
      const url = env('SUPABASE_URL');
      const key = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) throw new Error('APPLICATION_DATA_NOT_CONFIGURED');
      const result = await fetch(url + '/rest/v1/rpc/' + name, {
        method: 'POST',
        headers: { 'x-practice-contract': 'cyberbullying-v1', apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      const data = await result.json();
      return result.ok ? { data, error: null } : { data: null, error: { message: isRecord(data) && typeof data.message === 'string' ? data.message : 'PERSISTENCE_FAILED' } };
    },
  };
}

if (import.meta.main) Deno.serve(createAiApiHandler(createDefaultDependencies()));

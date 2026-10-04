#!/usr/bin/env -S deno run --allow-env --allow-net
// Purpose: proxy application LLM requests with server-only provider credentials.

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
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  const model = deps.env('OAI_MODEL');
  if (!key || !baseUrl || !model) throw new Error('AI_PROVIDER_NOT_CONFIGURED');
  return { key, baseUrl: baseUrl.replace(/\/$/, ''), model };
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

export function createAiApiHandler(deps: AiApiDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST') return fail('INVALID_REQUEST', 400);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail('INVALID_REQUEST', 400);
    }

    try {
      const chatRequest = parseChatRequest(body);
      return response({ ok: true, data: await generateChat(deps, chatRequest) });
    } catch (error) {
      const code = error instanceof Error ? error.message : 'AI_PROVIDER_ERROR';
      if (code === 'INVALID_REQUEST') return fail(code, 400);
      if (code === 'AI_PROVIDER_NOT_CONFIGURED') return fail(code, 503);
      if (code === 'AI_OUTPUT_INVALID') return fail(code, 502);
      return fail('AI_PROVIDER_ERROR', 502);
    }
  };
}

function createDefaultDependencies(): AiApiDependencies {
  const env = (name: string) => Deno.env.get(name);
  return { env, fetch };
}

if (import.meta.main) Deno.serve(createAiApiHandler(createDefaultDependencies()));

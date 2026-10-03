#!/usr/bin/env -S deno test --allow-env --allow-net
// Test responsibility: verify the offline-client LLM boundary, provider configuration, and response projection.

import { createAiApiHandler, type AiApiDependencies } from './index.ts';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`expected ${right}, received ${left}`);
}

function request(body: Record<string, unknown>, authorization = 'Bearer test-token'): Request {
  return new Request('http://localhost/ai-api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<AiApiDependencies> = {}): AiApiDependencies {
  return {
    env: () => undefined,
    fetch: globalThis.fetch,
    ...overrides,
  };
}

const validBody = {
  messages: [
    { role: 'system', content: 'Be concise.' },
    { role: 'user', content: 'How do I verify this link?' },
  ],
  temperature: 0.2,
  max_tokens: 800,
  response_format: { type: 'json_object' },
  enable_thinking: false,
};

type ProviderRequest = { url: string; body: Record<string, unknown>; authorization: string };

Deno.test('accepts offline requests without a Supabase Auth token', async () => {
  let providerCalls = 0;
  const env = (name: string) => ({
    OAI_API_KEY: 'server-secret',
    OAI_BASE_URL: 'https://provider.invalid/v1',
    OAI_MODEL: 'qwen3.5-flash',
  } as Record<string, string>)[name];
  const handler = createAiApiHandler(dependencies({
    env,
    fetch: async () => {
      providerCalls += 1;
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: 'ok' } }],
      }));
    },
  }));

  const response = await handler(request(validBody, ''));
  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.data.content, 'ok');
  assertEquals(providerCalls, 1);
});

Deno.test('handles preflight and rejects non-POST requests', async () => {
  const handler = createAiApiHandler(dependencies());
  const preflight = await handler(new Request('http://localhost/ai-api', { method: 'OPTIONS' }));
  assertEquals(preflight.status, 204);
  const method = await handler(new Request('http://localhost/ai-api', { method: 'GET' }));
  assertEquals(method.status, 400);
  assertEquals((await method.json()).error.code, 'INVALID_REQUEST');
});

Deno.test('fails closed when server provider settings are missing', async () => {
  let providerCalls = 0;
  const handler = createAiApiHandler(dependencies({
    fetch: async () => { providerCalls += 1; return new Response('{}'); },
  }));

  const response = await handler(request(validBody));
  const payload = await response.json();
  assertEquals(response.status, 503);
  assertEquals(payload.error.code, 'AI_PROVIDER_NOT_CONFIGURED');
  assertEquals(providerCalls, 0);
});

Deno.test('uses server configuration and projects the provider response', async () => {
  let providerRequest: ProviderRequest | null = null;
  const handler = createAiApiHandler(dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret',
      OAI_BASE_URL: 'https://provider.invalid/v1',
      OAI_MODEL: 'qwen3.5-flash',
    } as Record<string, string>)[name],
    fetch: async (input, init) => {
      providerRequest = {
        url: String(input),
        body: JSON.parse(String(init?.body)),
        authorization: String(new Headers(init?.headers).get('authorization')),
      };
      return new Response(JSON.stringify({
        choices: [{ finish_reason: 'stop', message: { content: '{"ok":true}' } }],
      }), { status: 200 });
    },
  }));

  const response = await handler(request({ ...validBody, model: 'attacker-selected-model' }));
  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.data, { content: '{"ok":true}', model: 'qwen3.5-flash', finish_reason: 'stop' });
  assert(providerRequest);
  const capturedProviderRequest = providerRequest as ProviderRequest;
  assertEquals(capturedProviderRequest.url, 'https://provider.invalid/v1/chat/completions');
  assertEquals(capturedProviderRequest.authorization, 'Bearer server-secret');
  assertEquals(capturedProviderRequest.body.model, 'qwen3.5-flash');
  assertEquals(capturedProviderRequest.body.messages, validBody.messages);
  assertEquals(capturedProviderRequest.body.temperature, 0.2);
  assertEquals(capturedProviderRequest.body.max_tokens, 800);
  assertEquals(capturedProviderRequest.body.response_format, { type: 'json_object' });
  assertEquals(capturedProviderRequest.body.enable_thinking, false);
  assert(!JSON.stringify(payload).includes('server-secret'));
});

Deno.test('rejects invalid generation parameters without contacting the provider', async () => {
  let providerCalls = 0;
  const handler = createAiApiHandler(dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret',
      OAI_BASE_URL: 'https://provider.invalid/v1',
      OAI_MODEL: 'qwen3.5-flash',
    } as Record<string, string>)[name],
    fetch: async () => { providerCalls += 1; return new Response('{}'); },
  }));

  const response = await handler(request({ ...validBody, temperature: 9 }));
  const payload = await response.json();
  assertEquals(response.status, 400);
  assertEquals(payload.error.code, 'INVALID_REQUEST');
  assertEquals(providerCalls, 0);
});

Deno.test('rejects malformed messages and excessive token budgets', async () => {
  let providerCalls = 0;
  const handler = createAiApiHandler(dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret',
      OAI_BASE_URL: 'https://provider.invalid/v1',
      OAI_MODEL: 'qwen3.5-flash',
    } as Record<string, string>)[name],
    fetch: async () => { providerCalls += 1; return new Response('{}'); },
  }));

  const malformed = await handler(request({ ...validBody, messages: [{ role: 'tool', content: 'invalid' }] }));
  assertEquals(malformed.status, 400);
  const excessive = await handler(request({ ...validBody, max_tokens: 5000 }));
  assertEquals(excessive.status, 400);
  assertEquals(providerCalls, 0);
});

Deno.test('maps provider HTTP and network failures without exposing provider details', async () => {
  const env = (name: string) => ({
    OAI_API_KEY: 'server-secret',
    OAI_BASE_URL: 'https://provider.invalid/v1',
    OAI_MODEL: 'qwen3.5-flash',
  } as Record<string, string>)[name];
  const httpHandler = createAiApiHandler(dependencies({
    env,
    fetch: async () => new Response('provider-secret-error', { status: 500 }),
  }));
  const httpResponse = await httpHandler(request(validBody));
  assertEquals(httpResponse.status, 502);
  assert(!JSON.stringify(await httpResponse.json()).includes('provider-secret-error'));

  const networkHandler = createAiApiHandler(dependencies({
    env,
    fetch: async () => { throw new Error('provider-secret-network-error'); },
  }));
  const networkResponse = await networkHandler(request(validBody));
  assertEquals(networkResponse.status, 502);
  assert(!JSON.stringify(await networkResponse.json()).includes('provider-secret-network-error'));
});

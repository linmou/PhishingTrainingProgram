#!/usr/bin/env -S deno test --allow-env --allow-net
// Test responsibility: verify ai-api/index.ts provider boundary, authorized browser drafts and recoverable generation failures.

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
    headers: { 'content-type': 'application/json', authorization, 'x-practice-contract': 'cyberbullying-v2' },
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

const practiceIds = {
  room: '10000000-0000-0000-0000-000000000001',
  tutor: '10000000-0000-0000-0000-000000000002',
  parent: '10000000-0000-0000-0000-000000000003',
};

function practiceRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/ai-api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-application-user-id': practiceIds.tutor, 'x-practice-contract': 'cyberbullying-v2' },
    body: JSON.stringify({ operation: 'cyberbullying_suggest', room_id: practiceIds.room, parent_message_id: practiceIds.parent, ...body }),
  });
}

function practiceDependencies(overrides: Partial<AiApiDependencies> = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const providerBodies: Array<Record<string, any>> = [];
  const context = {
    practice_type: 'cyberbullying', scenario: { id: 'pinned-scenario' }, guard_mode: false, parent_message_id: practiceIds.parent,
    dialogue: Array.from({ length: 61 }, (_, index) => ({ id: 'message-' + index, content: 'saved comment ' + index, user_role: 'student' })),
  };
  const deps = dependencies({
    env: name => ({ OAI_API_KEY: 'secret', OAI_BASE_URL: 'https://provider.invalid/v1' } as Record<string, string>)[name],
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: context, error: null };
    },
    fetch: async (_input, init) => {
      providerBodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        student_role: 'Constructive upstanders', response_in_role: 'same_age_peer', final_response: 'A complete role reply.',
      }) } }] }));
    },
    ...overrides,
  });
  return { deps, calls, context, providerBodies };
}

// Covers ai-api/index.ts: stale clients cannot create proposals or spend provider calls.
Deno.test('rejects missing and outdated client contracts before proposal side effects', async () => {
  const fixture = practiceDependencies();
  for (const contract of [null, 'outdated']) {
    const stale = practiceRequest({});
    if (contract === null) stale.headers.delete('x-practice-contract');
    else stale.headers.set('x-practice-contract', contract);
    const result = await createAiApiHandler(fixture.deps)(stale);
    assertEquals(result.status, 409);
    assertEquals((await result.json()).error.code, 'CLIENT_RELOAD_REQUIRED');
  }
  assertEquals(fixture.calls.length, 0);
  assertEquals(fixture.providerBodies.length, 0);
});

Deno.test('cyberbullying reads full context and returns a browser draft for each role without persistence writes', async () => {
  for (const character of ['same_age_peer', 'older_peer', 'victim', 'bully', 'educator']) {
    const fixture = practiceDependencies();
    fixture.deps.fetch = async (_input, init) => {
      fixture.providerBodies.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        student_role: 'Constructive upstanders', response_in_role: character, final_response: 'A complete role reply.',
      }) } }] }));
    };
    const result = await createAiApiHandler(fixture.deps)(practiceRequest({
      character, messages: [{ role: 'system', content: 'client replacement' }], practice_type: 'phishing',
    }));
    assertEquals(result.status, 200);
    const draft = (await result.json()).data;
    assertEquals(draft.raw_character, character);
    assertEquals(draft.parent_message_id, practiceIds.parent);
    assertEquals(draft.raw_guard_mode, false);
    assertEquals(draft.context_messages, fixture.context.dialogue.map(message => JSON.stringify(message)));
    assertEquals(draft.id, undefined);
    assertEquals(draft.status, undefined);
    assertEquals(fixture.calls.map(call => call.name), ['get_cyberbullying_context_v1']);
    assertEquals(fixture.calls[0].args.p_actor_id, practiceIds.tutor);
    assertEquals(fixture.calls[0].args.p_parent_message_id, practiceIds.parent);
    const provider = fixture.providerBodies[0];
    assertEquals(JSON.parse(provider.messages[2].content).dialogue, fixture.context.dialogue);
    const provenance = draft.generation_provenance;
    assertEquals(provenance.attempts.length, 1);
    assertEquals(provenance.model, 'qwen3.8-flash');
    assert(!JSON.stringify(provenance).includes('secret'));
  }
});

Deno.test('cyberbullying rejects missing identity and ownership before contacting the provider', async () => {
  const fixture = practiceDependencies({
    rpc: async () => ({ data: null, error: { message: 'FORBIDDEN' } }),
  });
  const handler = createAiApiHandler(fixture.deps);
  const missingIdentity = await handler(request({ operation: 'cyberbullying_suggest' }));
  assertEquals(missingIdentity.status, 403);
  const wrongOwner = await handler(practiceRequest({}));
  assertEquals(wrongOwner.status, 403);
  assertEquals(fixture.providerBodies.length, 0);
});

Deno.test('cyberbullying retries malformed role output and records both attempts without publishing', async () => {
  let calls = 0;
  const fixture = practiceDependencies({
    fetch: async () => {
      calls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }));
    },
  });
  const result = await createAiApiHandler(fixture.deps)(practiceRequest({}));
  assertEquals(result.status, 502);
  assertEquals((await result.json()).error.code, 'AI_OUTPUT_INVALID');
  assertEquals(calls, 2);
  assertEquals(fixture.calls.map(call => call.name), ['get_cyberbullying_context_v1']);
});

Deno.test('cyberbullying surfaces truncated and oversized-context failures without saving drafts', async () => {
  const truncated = practiceDependencies({
    fetch: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })),
  });
  const first = await createAiApiHandler(truncated.deps)(practiceRequest({}));
  assertEquals(first.status, 502);
  assertEquals((await first.json()).error.code, 'AI_OUTPUT_TRUNCATED');
  assertEquals(truncated.calls.length, 1);

  const oversized = practiceDependencies();
  oversized.context.dialogue[0].content = 'x'.repeat(51_000);
  const second = await createAiApiHandler(oversized.deps)(practiceRequest({}));
  assertEquals(second.status, 413);
  assertEquals(oversized.providerBodies.length, 0);
  assertEquals(oversized.calls.length, 1);
});

Deno.test('retired proposal review operation and invalid characters cannot call the provider', async () => {
  const review = practiceDependencies();
  const rejected = await createAiApiHandler(review.deps)(practiceRequest({
    operation: 'cyberbullying_review', reject: true,
  }));
  assertEquals(rejected.status, 400);
  assertEquals(review.calls.length, 0);
  const invalid = await createAiApiHandler(review.deps)(practiceRequest({ character: 'invented' }));
  assertEquals(invalid.status, 400);
  assertEquals(review.providerBodies.length, 0);
});

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

Deno.test('uses the shared model despite a stale model secret or client override and projects the provider response', async () => {
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
  assertEquals(payload.data, { content: '{"ok":true}', model: 'qwen3.8-flash', finish_reason: 'stop' });
  assert(providerRequest);
  const capturedProviderRequest = providerRequest as ProviderRequest;
  assertEquals(capturedProviderRequest.url, 'https://provider.invalid/v1/chat/completions');
  assertEquals(capturedProviderRequest.authorization, 'Bearer server-secret');
  assertEquals(capturedProviderRequest.body.model, 'qwen3.8-flash');
  assertEquals(capturedProviderRequest.body.messages, validBody.messages);
  assertEquals(capturedProviderRequest.body.temperature, 0.2);
  assertEquals(capturedProviderRequest.body.max_tokens, 800);
  assertEquals(capturedProviderRequest.body.response_format, { type: 'json_object' });
  assertEquals(capturedProviderRequest.body.enable_thinking, false);
  assert(!JSON.stringify(payload).includes('server-secret'));
});

Deno.test('forwards a full tutor prompt while rejecting requests above the total content limit', async () => {
  const providerMessages: Array<{ role: string; content: string }> = [];
  let providerCalls = 0;
  const handler = createAiApiHandler(dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret',
      OAI_BASE_URL: 'https://provider.invalid/v1',
      OAI_MODEL: 'qwen3.5-flash',
    } as Record<string, string>)[name],
    fetch: async (_input, init) => {
      providerCalls += 1;
      providerMessages.push(...JSON.parse(String(init?.body)).messages);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: 'Ready' } }] }));
    },
  }));

  const tutorPrompt = 'T'.repeat(23_637);
  const accepted = await handler(request({
    ...validBody,
    messages: [{ role: 'system', content: tutorPrompt }, { role: 'user', content: 'Respond to the learner.' }],
  }, ''));
  assertEquals(accepted.status, 200);
  assertEquals((await accepted.json()).data.content, 'Ready');
  assertEquals(providerMessages[0], { role: 'system', content: tutorPrompt });
  assertEquals(providerCalls, 1);

  const oversized = await handler(request({
    ...validBody,
    messages: Array.from({ length: 5 }, (_, index) => ({
      role: index === 0 ? 'system' : 'user',
      content: 'T'.repeat(10_001),
    })),
  }, ''));
  assertEquals(oversized.status, 400);
  assertEquals((await oversized.json()).error.code, 'INVALID_REQUEST');
  assertEquals(providerCalls, 1);
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

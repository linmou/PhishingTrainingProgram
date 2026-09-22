#!/usr/bin/env -S deno test --allow-env --allow-net
// Test responsibility: verify the trusted handler's authorization, projection, provider, and CAS boundaries.

import { createAssessmentApiHandler, type AssessmentApiDependencies } from './index.ts';

function assert(condition: unknown, message = 'assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals(actual: unknown, expected: unknown): void {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) throw new Error(`expected ${right}, received ${left}`);
}

function request(operation: string, body: Record<string, unknown> = {}): Request {
  return new Request('http://localhost/assessment-api', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
    body: JSON.stringify({ operation, request_id: '00000000-0000-4000-8000-000000000001', ...body }),
  });
}

function dependencies(overrides: Partial<AssessmentApiDependencies> = {}): AssessmentApiDependencies {
  return {
    featureEnabled: true,
    verifier: { verify: async () => ({
      principal_id: 'principal-1', application_user_id: 'teacher-1',
      allowed_room_ids: ['room-1'], can_review_assessment: true,
    }) },
    rpc: async () => ({ data: {}, error: null }),
    env: () => undefined,
    fetch: globalThis.fetch,
    resolveAnswer: () => ({ disposition: 'retryable' } as never),
    ...overrides,
  };
}

function providerScope(): Record<string, unknown> {
  return {
    room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
    focus_student_message_id: 'focus-1',
    context: {
      room_id: 'room-1', checklist_id: 'checklist-1', focus_student_id: 'learner-1',
      focus_student_message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content: 'It looked familiar.' },
      prior_participation_mode: 'tutoring',
      checklist_items: [{
        id: 'item-1', area_text: 'Verify independently', priority: 'critical',
        status: 'partially_covered', understanding_level: 'basic',
        relevant_evidence_message_ids: ['focus-1'], repair_message_id: null,
      }],
      eligible_assessment_item_ids: ['item-1'], unresolved_assessment: null,
      feedback_required: false, progress_snapshot_hash: 'snapshot-1',
    },
  };
}

function validProviderPayload(): Record<string, unknown> {
  return {
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      reason: 'Assess transfer.',
      learning_evidence: [],
      decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: 'item-1' },
      response: 'Which action is safest?',
      assessment: {
        selection_type: 'single', stem: 'Which action is safest?', rendered_text: 'Which action is safest?',
        options: [{ id: 'A', text: 'Click' }, { id: 'B', text: 'Verify' }, { id: 'C', text: 'Reply' }, { id: 'D', text: 'Forward' }],
        correct_option_ids: ['B'], learner_safe_explanation: 'Verify through the official app.',
        transfer_basis: { concept_rule: 'verify', source_context: 'x', changed_context: 'y', source_evidence_message_ids: ['focus-1'] },
      },
    }) } }],
  };
}

Deno.test('fails closed before data access when no principal verifier is wired', async () => {
  let calls = 0;
  const handler = createAssessmentApiHandler(dependencies({
    verifier: undefined,
    rpc: async () => { calls += 1; return { data: {}, error: null }; },
  }));
  const response = await handler(request('initialize_checklist', {
    room_id: 'room-1', student_id: 'learner-1', template_name: 'Transfer',
  }));
  const payload = await response.json();
  assertEquals(response.status, 503);
  assertEquals(payload.error.code, 'AUTHORIZATION_NOT_CONFIGURED');
  assertEquals(calls, 0);
});

Deno.test('returns the exact public assessment target and strips private fields', async () => {
  const handler = createAssessmentApiHandler(dependencies({
    rpc: async (name) => {
      assertEquals(name, 'send_reviewed_tutor_response_v4');
      return { data: {
        message: {
          id: 'question-1', room_id: 'room-1', user_id: 'teacher-1', content: 'Safest action?',
          user_role: 'tutor', parent_message_id: 'focus-1', response_mode: 'assessment',
          created_at: '2026-09-22T00:00:00Z',
          assessment: {
            id: 'assessment-1', student_id: 'learner-1', selection_type: 'single', stem: 'Safest action?',
            options: [{ id: 'A', text: 'Click' }], rendered_text: 'private',
            correct_option_ids: ['B'], learner_safe_explanation: 'private',
          },
        }, room: { id: 'room-1' },
      }, error: null };
    },
  }));
  const response = await handler(request('send_reviewed', {
    room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
    item_id: 'item-1', focus_student_message_id: 'focus-1',
    reviewed_payload: {
      decision: { mode: 'assessment', instruction: 'transfer_assess', target_item_id: 'item-1' },
      response: 'Safest action?', assessment: {
        selection_type: 'single', stem: 'Safest action?', rendered_text: 'Safest action?',
        options: [{ id: 'A', text: 'Click' }, { id: 'B', text: 'Verify' }, { id: 'C', text: 'Reply' }, { id: 'D', text: 'Forward' }],
        correct_option_ids: ['B'], learner_safe_explanation: 'Verify independently.',
        transfer_basis: { concept_rule: 'verify', source_context: 'x', changed_context: 'y', source_evidence_message_ids: ['focus-1'] },
      },
    },
  }));
  const payload = await response.json();
  assertEquals(Object.keys(payload.data.message.assessment), ['id', 'student_id', 'selection_type', 'stem', 'options']);
  assert(!JSON.stringify(payload).includes('rendered_text'));
  assert(!JSON.stringify(payload).includes('learner_safe_explanation'));
});

Deno.test('requires every server-only provider setting with no model fallback', async () => {
  const handler = createAssessmentApiHandler(dependencies({
    rpc: async (name) => name === 'prepare_transfer_turn_v1'
      ? { data: { room_id: 'room-1', student_id: 'learner-1' }, error: null }
      : { data: {}, error: null },
  }));
  const response = await handler(request('prepare_turn', {
    room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
  }));
  const payload = await response.json();
  assertEquals(response.status, 503);
  assertEquals(payload.error.code, 'AI_PROVIDER_NOT_CONFIGURED');
});

Deno.test('uses the configured qwen request, 1200-token budget, JSON mode, and private audit', async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const audits: Record<string, unknown>[] = [];
  const handler = createAssessmentApiHandler(dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.5-flash',
    } as Record<string, string>)[name],
    rpc: async (name, args) => {
      if (name === 'prepare_transfer_turn_v1') return { data: providerScope(), error: null };
      if (name === 'record_transfer_provider_attempt_v1') audits.push(args);
      return { data: 'audit-1', error: null };
    },
    fetch: async (input, init) => {
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify(validProviderPayload()), { status: 200 });
    },
  }));
  const response = await handler(request('prepare_turn', {
    room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
  }));
  const payload = await response.json();
  assertEquals(payload.ok, true);
  assertEquals(requests[0].url, 'https://provider.invalid/v1/chat/completions');
  assertEquals(requests[0].body.model, 'qwen3.5-flash');
  assertEquals(requests[0].body.max_tokens, 1200);
  assertEquals(requests[0].body.response_format, { type: 'json_object' });
  assert(JSON.stringify(requests[0].body).includes('learner_safe_explanation'));
  assert(!JSON.stringify(audits[0]).includes('server-secret'));
  assertEquals(audits[0].p_validation_outcome, 'valid');
});

Deno.test('performs one format-only repair and rejects a second invalid result', async () => {
  let providerCalls = 0;
  const audits: Record<string, unknown>[] = [];
  const handler = createAssessmentApiHandler(dependencies({
    env: (name) => ({ OAI_API_KEY: 'key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.5-flash' } as Record<string, string>)[name],
    rpc: async (name, args) => {
      if (name === 'prepare_transfer_turn_v1') return { data: providerScope(), error: null };
      if (name === 'record_transfer_provider_attempt_v1') audits.push(args);
      return { data: 'audit', error: null };
    },
    fetch: async () => {
      providerCalls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{invalid' } }] }), { status: 200 });
    },
  }));
  const response = await handler(request('prepare_turn', {
    room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
  }));
  const payload = await response.json();
  assertEquals(payload.error.code, 'AI_OUTPUT_INVALID');
  assertEquals(providerCalls, 2);
  assertEquals(audits.map((entry) => entry.p_attempt_ordinal), [1, 2]);
});

Deno.test('does not repair truncation, HTTP failure, or network failure', async () => {
  for (const scenario of ['truncated', 'http', 'network']) {
    let providerCalls = 0;
    const handler = createAssessmentApiHandler(dependencies({
      env: (name) => ({ OAI_API_KEY: 'key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.5-flash' } as Record<string, string>)[name],
      rpc: async (name) => name === 'prepare_transfer_turn_v1'
        ? { data: providerScope(), error: null }
        : { data: 'audit', error: null },
      fetch: async () => {
        providerCalls += 1;
        if (scenario === 'network') throw new Error('offline');
        if (scenario === 'http') return new Response('{}', { status: 500 });
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }), { status: 200 });
      },
    }));
    const response = await handler(request('prepare_turn', {
      room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
    }));
    const payload = await response.json();
    assertEquals(payload.error.code, scenario === 'truncated' ? 'AI_OUTPUT_TRUNCATED' : 'AI_PROVIDER_ERROR');
    assertEquals(providerCalls, 1);
  }
});

Deno.test('retries a stale CAS snapshot and returns the committed authoritative result', async () => {
  let contextReads = 0;
  let commits = 0;
  const handler = createAssessmentApiHandler(dependencies({
    verifier: { verify: async () => ({
      principal_id: 'principal-1', application_user_id: 'learner-1',
      allowed_room_ids: ['room-1'], can_review_assessment: false,
    }) },
    rpc: async (name) => {
      if (name === 'get_transfer_assessment_processing_context_v1') {
        contextReads += 1;
        return { data: {
          assessment: { id: 'assessment-1', item_id: 'item-1', selection_type: 'single', options: [{ id: 'A', text: 'x' }], correct_option_ids: ['B'], learner_safe_explanation: 'why', progress_snapshot_hash: 'hash' },
          answer: { message_id: 'answer-1', selected_option_ids: ['A'], references_message_id: 'question-1' },
          context: { attempt_snapshot: { assessment_id: 'assessment-1', accepted_attempt_count: contextReads - 1, resolution: 'open', processed_answer_message_ids: contextReads === 1 ? [] : ['other-answer'] } },
        }, error: null };
      }
      commits += 1;
      if (commits === 1) return { data: { internal_state: 'conflict', code: 'CONCURRENT_MODIFICATION' }, error: null };
      return { data: {
        message_id: 'answer-1', assessment_id: 'assessment-1', processing_state: 'applied',
        answer_outcome: 'passed', attempt_number: 2, attempts_used: 2, attempts_remaining: 0,
        selected_option_ids: ['A'], terminal: true, transition: {}, feedback_required: true,
        code: null, already_processed: false, terminal_failure_feedback: null,
      }, error: null };
    },
    resolveAnswer: (context) => ({
      disposition: context.attempt_snapshot.accepted_attempt_count === 0 ? 'retryable' : 'passed',
      progress: { status: 'covered', understanding_level: 'good' },
      applied_transition: context.attempt_snapshot.accepted_attempt_count === 0 ? null : 'assessment_pass',
      attempt_snapshot: context.attempt_snapshot,
    } as never),
  }));
  const response = await handler(request('process_message', {
    room_id: 'room-1', assessment_id: 'assessment-1', message_id: 'answer-1',
  }));
  const payload = await response.json();
  assertEquals(payload.data.answer_outcome, 'passed');
  assertEquals(contextReads, 2);
  assertEquals(commits, 2);
});

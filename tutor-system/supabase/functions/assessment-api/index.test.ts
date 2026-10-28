#!/usr/bin/env -S deno test --allow-env --allow-net
// Test responsibility: verify the trusted handler's authorization, projection, provider, and CAS boundaries.

import { createAssessmentApiHandler, createDefaultDependencies, type AssessmentApiDependencies } from './index.ts';
import { resolveTransferAnswer } from '../../../src/services/transferAssessmentOrchestrator.ts';

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
    headers: { 'content-type': 'application/json', authorization: 'Bearer test', 'x-practice-contract': 'cyberbullying-v2' },
    body: JSON.stringify({ operation, request_id: '00000000-0000-4000-8000-000000000001', ...body }),
  });
}

function dependencies(overrides: Partial<AssessmentApiDependencies> = {}): AssessmentApiDependencies {
  const suppliedRpc = overrides.rpc ?? (async () => ({ data: {}, error: null }));
  return {
    featureEnabled: async () => true,
    verifier: { verify: async () => ({
      principal_id: 'principal-1', application_user_id: 'teacher-1',
      allowed_room_ids: ['room-1'], can_review_assessment: true,
    }) },
    env: () => undefined,
    fetch: globalThis.fetch,
    resolveAnswer: () => ({ disposition: 'retryable' } as never),
    ...overrides,
    rpc: async (name, args) => {
      if (name === 'get_transfer_message_analysis_context_v1') {
        return { data: { analysis_complete: true }, error: null };
      }
      if (name === 'prepare_transfer_assessment_context_v1') {
        return { data: { ...providerScope(), selected_target_item_id: 'item-1' }, error: null };
      }
      const result = await suppliedRpc(name, args);
      const data = result.data as Record<string,any>;
      const processed = data?.authoritative_result ?? data;
      if (processed && (processed.answer_outcome || processed.code==='assisted' || processed.code==='cancelled') &&
        !Object.prototype.hasOwnProperty.call(processed,'result_message')) {
        const closure = !processed.answer_outcome;
        const attempt = processed.attempt_number ?? processed.attempts_used ?? 1;
        processed.result_message={id:`result-${processed.message_id}`,room_id:'room-1',user_id:'teacher-1',user_role:'tutor',
          content:closure ? 'Assessment cancelled.' : 'Recorded grade.',parent_message_id:processed.message_id,
          response_mode:null,assessment:null,created_at:'2026-10-17T00:00:00Z',assessment_event:{
            event_key:closure ? 'assessment-closure:q' : `assessment-result:${processed.message_id}`,
            kind:closure ? 'closure' : 'result',assessment_id:processed.assessment_id,question_message_id:'q',student_id:'learner-1',
            answer_message_id:processed.message_id,attempt_number:closure ? null : attempt,outcome:processed.answer_outcome ?? null,
            attempts_used:closure ? processed.attempts_used : attempt,attempts_remaining:processed.answer_outcome==='retry' ? 1 : 0,
            terminal:processed.answer_outcome!=='retry',lifecycle:closure ? 'cancelled' : processed.answer_outcome==='retry' ? 'open' : processed.answer_outcome,
            progress_deferred:processed.processing_state==='deferred',closure_reason:closure ? 'assisted' : null,
          }};
      }
      return result;
    },
  };
}

// Covers assessment-api/index.ts: stale clients must fail before identity, database or provider access.
Deno.test('rejects missing and outdated client contracts before assessment side effects', async () => {
  let touched = false;
  const handler = createAssessmentApiHandler(dependencies({
    verifier: { verify: async () => { touched = true; throw new Error('unexpected identity call'); } },
    rpc: async () => { touched = true; throw new Error('unexpected database call'); },
    fetch: async () => { touched = true; throw new Error('unexpected provider call'); },
  }));
  for (const contract of [null, 'outdated']) {
    const stale = request('join_room', { room_id: 'room-1' });
    if (contract === null) stale.headers.delete('x-practice-contract');
    else stale.headers.set('x-practice-contract', contract);
    const result = await handler(stale);
    assertEquals(result.status, 409);
    assertEquals((await result.json()).error.code, 'CLIENT_RELOAD_REQUIRED');
  }
  assertEquals(touched, false);
});

function providerScope(): Record<string, unknown> {
  return {
    room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
    focus_student_message_id: 'focus-1',
    context: {
      room_id: 'room-1', checklist_id: 'checklist-1', focus_student_id: 'learner-1',
      focus_student_message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content: 'It looked familiar.' },
      prior_guard_mode: false,
      checklist_items: [{
        id: 'item-1', area_text: 'Verify independently', priority: 'critical',
        status: 'covered', understanding_level: 'good',
        relevant_evidence_message_ids: ['focus-1'], repair_message_id: null,
      }],
      eligible_assessment_item_ids: ['item-1'], unresolved_assessment: null,
      feedback_required: false, progress_snapshot_hash: 'snapshot-1',
    },
  };
}

for (const content of ['B or D', 'Can you explain how to choose?', 'B?']) {
  Deno.test(`raw assessment answer lifecycle: ${content}`, async () => {
    const writes: Array<{ name: string; args: Record<string, unknown> }> = [];
    const handler = createAssessmentApiHandler(dependencies({
      resolveAnswer: resolveTransferAnswer,
      rpc: async (name, args) => {
        if (name === 'get_transfer_assessment_processing_context_v1') return { data: {
          context: { progress: { status: 'covered', understanding_level: 'good' },
            guard_mode: false, progress_snapshot_hash: 'h', feedback_required: false,
            eligible_assessment_item_ids: ['item-1'], unresolved_assessment: { id: 'a' },
            pending_repair_message_id: null,
            attempt_snapshot: { assessment_id: 'a', accepted_attempt_count: 0, resolution: 'open', processed_answer_message_ids: [] } },
          assessment: { id: 'a', item_id: 'item-1', selection_type: 'single', progress_snapshot_hash: 'h',
            options: ['A', 'B', 'C', 'D'].map(id => ({ id, text: `Option ${id}` })),
            correct_option_ids: ['B'], learner_safe_explanation: 'Use an independent channel.' },
          answer: { content, selected_option_ids: null, references_message_id: 'q' },
        }, error: null };
        writes.push({ name, args });
        if (name==='record_transfer_assessment_processing_v1') return {data:{
          message_id:'m',assessment_id:'a',processing_state:'rejected',answer_outcome:null,attempt_number:null,
          attempts_used:0,attempts_remaining:2,terminal:false,code:args.p_code,result_message:null,
        },error:null};
        return { data: { message_id: 'm', assessment_id: 'a', processing_state: 'applied',
          answer_outcome: name === 'cancel_transfer_assessment_v1' ? null : 'passed',
          terminal: true, code: name === 'cancel_transfer_assessment_v1' ? 'assisted' : null,
          attempts_used: name === 'cancel_transfer_assessment_v1' ? 0 : 1, attempts_remaining: 0 }, error: null };
      },
    }));
    const response = await handler(request('process_message', { assessment_id: 'a', message_id: 'm' }));
    const payload = await response.json();
    assertEquals(response.status, 200);
    if (content === 'B or D') {
      assertEquals(writes[0].name,'record_transfer_assessment_processing_v1');
      assertEquals(payload.data.code, 'AMBIGUOUS_SELECTION');
      assertEquals(payload.data.attempts_used, 0);
      assertEquals(payload.data.terminal, false);
    } else if (content === 'B?') {
      assertEquals(writes[0].name, 'process_assessment_message_v2');
      assertEquals(writes[0].args.p_selected_option_ids, ['B']);
    } else {
      assertEquals(writes[0].name, 'cancel_transfer_assessment_v1');
      assertEquals(payload.data.code, 'assisted');
      assertEquals(payload.data.attempts_used, 0);
      assertEquals(payload.data.terminal, true);
      assertEquals(payload.data.answer_outcome, null);
    }
    assertEquals(payload.data.terminal_failure_feedback, null);
  });
}

Deno.test('cancelled assessment replay bypasses grading and writes', async () => {
  const handler = createAssessmentApiHandler(dependencies({
    resolveAnswer: () => { throw new Error('must not grade cancelled question'); },
    rpc: async name => {
      assertEquals(name, 'get_transfer_assessment_processing_context_v1');
      return { data: { lifecycle: 'cancelled', authoritative_result: { message_id: 'm', assessment_id: 'a',
        processing_state: 'duplicate', terminal: true, code: 'assisted', attempts_used: 0, attempts_remaining: 0,
        already_processed: true } }, error: null };
    },
  }));
  const response = await handler(request('process_message', { assessment_id: 'a', message_id: 'm' }));
  const payload = await response.json();
  assertEquals(payload.data.code, 'assisted');
  assertEquals(payload.data.terminal, true);
  assertEquals(payload.data.already_processed, true);
});


 // Covers Cyberbullying analysis: independent targets, attributed evidence, durable provider attempts and atomic retry.
Deno.test('Cyberbullying settles all five target analyses before applying progress and records failed attempts', async () => {
  const providerInputs: Record<string, any>[] = [];
  const audits: Record<string, any>[] = [];
  let failOne = true;
  let applications = 0;
  const content = 'I will support Dylan privately.';
  const character = { id: 'role-1', user_id: 'teacher-1', user_role: 'tutor', character: 'victim', persona_id: 'copilot:dylan', content: 'A character reply.' };
  const scope = {
    practice_type: 'cyberbullying', scenario: { id: 'copilot-1' },
    room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
    message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content },
    items: Array.from({ length: 5 }, (_, index) => ({ id: 'item-' + index, area_text: 'Target ' + index, status: 'pending', understanding_level: 'none' })),
    dialogue_history: [character, { id: 'focus-1', user_id: 'learner-1', user_role: 'student', content }],
  };
  const deps = dependencies({
    env: name => ({ OAI_API_KEY: 'test', OAI_BASE_URL: 'https://provider.invalid/v1' } as Record<string, string>)[name],
    fetch: async (_input, init) => {
      const input = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
      providerInputs.push(input);
      if (failOne && input.items[0].id === 'item-2') return new Response('{}', { status: 503 });
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        events: [{ item_id: input.items[0].id, kind: 'initial_signal', evidence_type: 'action',
          evidence_message_id: 'focus-1', evidence_quote: content, explanation: 'Current learner evidence.' }],
        explanation: 'Recorded target analysis.',
      }) } }] }));
    },
  });
  deps.rpc = async (name, args) => {
    if (name === 'get_transfer_message_analysis_context_v1') return { data: scope, error: null };
    if (name === 'record_transfer_provider_attempt_v1') { audits.push(args); return { data: 'audit-id', error: null }; }
    if (name === 'apply_transfer_message_analysis_v1') {
      applications += 1;
      assertEquals((args.p_analysis as Record<string, any>).events.length, 5);
      return { data: { applied: scope.items }, error: null };
    }
    throw new Error('Unexpected RPC ' + name);
  };
  const handler = createAssessmentApiHandler(deps);
  const first = await handler(request('analyze_message', { room_id: 'room-1', message_id: 'focus-1' }));
  assert(first.status >= 400);
  assertEquals(applications, 0);
  assertEquals(providerInputs.length, 5);
  assertEquals(audits.length, 5);
  assertEquals(audits.filter(audit => audit.p_error_code !== null).length, 1);
  for (const input of providerInputs) {
    assertEquals(input.practice_type, 'cyberbullying');
    assertEquals(input.focus_student_id, 'learner-1');
    assertEquals(input.dialogue_history[0], character);
    assertEquals(input.scenario, scope.scenario);
  }
  failOne = false;
  const retry = await handler(request('analyze_message', { room_id: 'room-1', message_id: 'focus-1' }));
  assertEquals(retry.status, 200);
  assertEquals(applications, 1);
  assertEquals(audits.length, 10);
  assert(audits.every(audit => audit.p_max_tokens === 600 && audit.p_request_payload.operation === 'analyze_message'));
});

// Covers analyzer format repair: invalid evidence is never applied and both attempts retain their audit identity.
for (const practiceType of ['cyberbullying', 'phishing']) {
for (const repairFails of [false, true]) {
Deno.test(`${practiceType} bounds evidence quote repair and applies only valid progress: repairFails=${repairFails}`, async () => {
  const audits: Record<string, any>[] = [];
  const requests: Record<string, any>[] = [];
  let providerCalls = 0;
  let applications = 0;
  const content = 'First sentence. Second sentence. Third sentence.';
  const message = { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content };
  const handler = createAssessmentApiHandler({
    ...dependencies(), env: name => ({ OAI_API_KEY: 'test', OAI_BASE_URL: 'https://provider.invalid/v1' } as Record<string, string>)[name],
    fetch: async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)));
      providerCalls += 1;
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        events: [{ item_id: 'item-1', kind: 'initial_signal', evidence_type: 'action', evidence_message_id: 'focus-1',
          evidence_quote: providerCalls === 1 || repairFails ? 'First sentence. Third sentence.' : 'First sentence.', explanation: 'Controlled event.' }],
        explanation: 'Controlled analysis.',
      }) } }] }));
    },
    rpc: async (name, args) => {
      if (name === 'get_transfer_message_analysis_context_v1') return { data: {
        practice_type: practiceType, room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
        message, dialogue_history: [message], items: [{ id: 'item-1', area_text: 'Fixture target', status: 'pending', understanding_level: 'none' }],
      }, error: null };
      if (name === 'record_transfer_provider_attempt_v1') { audits.push(args); return { data: 'audit', error: null }; }
      if (name === 'apply_transfer_message_analysis_v1') { applications += 1; return { data: args.p_analysis, error: null }; }
      throw new Error('Unexpected RPC ' + name);
    },
  });
  const response = await handler(request('analyze_message', { room_id: 'room-1', message_id: 'focus-1' }));
  assertEquals(response.status, repairFails ? 502 : 200);
  assertEquals(providerCalls, 2);
  assertEquals(applications, repairFails ? 0 : 1);
  if (practiceType === 'cyberbullying') {
    assertEquals(audits.map(audit => [audit.p_attempt_ordinal, audit.p_validation_outcome]), [[1, 'invalid'], [2, repairFails ? 'invalid' : 'valid']]);
    assertEquals(audits[0].p_request_id, audits[1].p_request_id);
    assertEquals(audits[0].p_error_code, 'AI_OUTPUT_INVALID');
  }
  const repair = JSON.parse(requests[1].messages.filter((message: { role: string }) => message.role === 'user').at(-1).content);
  assertEquals(requests.map(providerRequest => providerRequest.model), ['qwen3.8-flash', 'qwen3.8-flash']);
  assertEquals(JSON.parse(repair.previous_response.choices[0].message.content).events[0].evidence_quote, 'First sentence. Third sentence.');
  assertEquals(repair.evidence_message, message);
});
}
}

Deno.test('missing saved result refuses duplicate processing before any provider call',async () => {
  let providerCalls=0;
  const handler=createAssessmentApiHandler(dependencies({
    resolveAnswer:()=>({disposition:'duplicate'}),
    fetch:async ()=>{providerCalls+=1;throw new Error('unexpected provider');},
    rpc:async ()=>({data:{lifecycle:'passed',context:{attempt_snapshot:{}},assessment:{},answer:{content:'B'},
      authoritative_result:{message_id:'m',assessment_id:'a',answer_outcome:'passed',terminal:true,result_message:null}},error:null}),
  }));
  const response=await handler(request('process_message',{assessment_id:'a',message_id:'m'}));
  assertEquals(response.status,503);
  assertEquals((await response.json()).error.code,'ASSESSMENT_RESULT_UNAVAILABLE');
  assertEquals(providerCalls,0);
});

for (const scenario of ['ambiguity_then_pass','guard_then_clear','ordered_retry_then_pass']) {
  Deno.test(`trusted review recovery: ${scenario}`,async ()=>{
    let guard=scenario==='guard_then_clear'; let used=0; let resolution='open'; let providerCalls=0;
    const ids=scenario==='guard_then_clear' ? ['first'] : ['first','second'];
    const stored=new Map<string,Record<string,any>>(); const processedOrder:string[]=[];
    const acceptedRequestIds=new Set<string>();
    const handler=createAssessmentApiHandler(dependencies({resolveAnswer:resolveTransferAnswer,
      fetch:async ()=>{providerCalls+=1;throw new Error('unexpected provider');},
      rpc:async (name,args)=>{
        const id=String(args.p_message_id);
        if (name==='get_transfer_assessment_review_v1') {
          const pending=ids.filter(answer=>!stored.has(answer) || (stored.get(answer)?.code==='guard_deferred' && !guard));
          return {data:{student_id:'learner-1',history_readiness:{ready:pending.length===0,
            pending_answers:pending.map(message_id=>({message_id,assessment_id:'a'})),
            handled_answer_message_ids:ids.filter(answer=>stored.has(answer)&&!stored.get(answer)?.answer_outcome),
            result_message_ids:[],pending_answer_message_ids:pending,unavailable_assessment_ids:[]}},error:null};
        }
        if (name==='get_transfer_assessment_processing_context_v1') {
          const previous=stored.get(id);
          return {data:{lifecycle:resolution,context:{progress:{status:'covered',understanding_level:'good'},
            guard_mode:guard,progress_snapshot_hash:'h',feedback_required:resolution!=='open',
            eligible_assessment_item_ids:['item-1'],unresolved_assessment:resolution==='open' ? {id:'a'}:null,
            pending_repair_message_id:null,attempt_snapshot:{assessment_id:'a',accepted_attempt_count:used,resolution,
              processed_answer_message_ids:ids.filter(answer=>stored.get(answer)?.answer_outcome)}},
            assessment:{id:'a',item_id:'item-1',selection_type:'single',progress_snapshot_hash:'h',
              options:['A','B','C','D'].map(id=>({id,text:`Option ${id}`})),correct_option_ids:['B'],learner_safe_explanation:'Reviewed explanation.'},
            answer:{content:id==='first'&&scenario==='ambiguity_then_pass' ? 'A or B':id==='first'&&scenario==='ordered_retry_then_pass' ? 'A':'B',
              selected_option_ids:null,references_message_id:'q'},
            authoritative_result:previous?.code==='guard_deferred'&&!guard ? null:previous ?? null},error:null};
        }
        processedOrder.push(id);
        let result:Record<string,any>;
        if (name==='record_transfer_assessment_processing_v1') {
          result={message_id:id,assessment_id:'a',processing_state:guard ? 'deferred':'rejected',answer_outcome:null,
            attempt_number:null,attempts_used:used,attempts_remaining:2-used,terminal:false,code:args.p_code,result_message:null};
        } else {
          assertEquals(name,'process_assessment_message_v2');
          const requestId=String(args.p_request_id);
          assertEquals(acceptedRequestIds.has(requestId),false);
          acceptedRequestIds.add(requestId); used+=1;
          resolution=args.p_answer_outcome==='retry' ? 'open':String(args.p_answer_outcome);
          result={message_id:id,assessment_id:'a',processing_state:'applied',answer_outcome:args.p_answer_outcome,
            attempt_number:used,attempts_used:used,attempts_remaining:resolution==='open' ? 1:0,terminal:resolution!=='open'};
        }
        stored.set(id,result); return {data:result,error:null};
      },
    }));
    let response=await handler(request('read_review',{room_id:'room-1',assessment_id:'a'}));
    assertEquals(response.status,200); assertEquals((await response.json()).data.history_readiness.ready,true);
    if (scenario==='guard_then_clear') {
      assertEquals(used,0); guard=false;
      response=await handler(request('read_review',{room_id:'room-1',assessment_id:'a'}));
      assertEquals(response.status,200); assertEquals((await response.json()).data.history_readiness.ready,true);
      assertEquals(used,1); assertEquals(processedOrder,['first','first']);
    } else {
      assertEquals(used,scenario==='ambiguity_then_pass' ? 1:2);
      assertEquals(processedOrder,['first','second']);
      if (scenario==='ordered_retry_then_pass') assertEquals(acceptedRequestIds.size,2);
    }
    assertEquals(providerCalls,0);
  });
}

Deno.test('accepted retry replay after cancellation keeps its grade and marks it duplicate', async () => {
  const handler = createAssessmentApiHandler(dependencies({
    resolveAnswer: () => { throw new Error('must not grade a replay'); },
    rpc: async name => {
      assertEquals(name, 'get_transfer_assessment_processing_context_v1');
      return { data: { lifecycle: 'cancelled', authoritative_result: {
        message_id: 'first-answer', assessment_id: 'a', processing_state: 'applied',
        answer_outcome: 'retry', attempt_number: 1, attempts_used: 1, attempts_remaining: 1,
        selected_option_ids: ['A'], terminal: false, code: null, already_processed: false,
      } }, error: null };
    },
  }));
  const response = await handler(request('process_message', { assessment_id: 'a', message_id: 'first-answer' }));
  const payload = await response.json();
  assertEquals(payload.data.processing_state, 'duplicate');
  assertEquals(payload.data.already_processed, true);
  assertEquals(payload.data.answer_outcome, 'retry');
  assertEquals(payload.data.attempt_number, 1);
  assertEquals(payload.data.attempts_used, 1);
  assertEquals(payload.data.attempts_remaining, 1);
  assertEquals(payload.data.selected_option_ids, ['A']);
  assertEquals(payload.data.terminal, false);
  assertEquals(payload.data.terminal_failure_feedback, null);
});

Deno.test('private review reads require a tutor and the authorized room', async () => {
  for (const canReview of [false, true]) {
    let calls = 0;
    const handler = createAssessmentApiHandler(dependencies({
      verifier: { verify: async () => ({ principal_id: 'p', application_user_id: 'actor',
        allowed_room_ids: ['room-1'], can_review_assessment: canReview }) },
      rpc: async () => { calls += 1; return { data: {}, error: null }; },
    }));
    const result = await handler(request('read_review', { room_id: canReview ? 'other-room' : 'room-1', assessment_id: 'assessment-1' }));
    assert(result.status >= 400);
    assertEquals(calls, 0);
  }
});

Deno.test('private review reads pass verified actor and scope to the private RPC', async () => {
  const calls: unknown[] = [];
  const handler = createAssessmentApiHandler(dependencies({ rpc: async (name, args) => {
    calls.push({ name, args });
    return { data: { item_label: 'Target', assessment: { correct_option_ids: ['B'] } }, error: null };
  } }));
  const result = await handler(request('read_review', { room_id: 'room-1', assessment_id: 'assessment-1', actor_id: 'spoofed' }));
  assertEquals(result.status, 200);
  assertEquals(calls, [{ name: 'get_transfer_assessment_review_v1', args: {
    p_room_id: 'room-1', p_assessment_id: 'assessment-1', p_actor_id: 'teacher-1',
  } }]);
});

function validProviderPayload(): Record<string, unknown> {
  return {
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      reason: 'Assess transfer.',
      target_item_id: 'item-1',
      assessment: {
        selection_type: 'single', stem: 'Which action is safest?', rendered_text: 'Which action is safest?',
        options: [{ id: 'A', text: 'Click' }, { id: 'B', text: 'Verify' }, { id: 'C', text: 'Reply' }, { id: 'D', text: 'Forward' }],
        correct_option_ids: ['B'], learner_safe_explanation: 'Verify through the official app.',
        transfer_basis: { concept_rule: 'verify', source_context: 'x', changed_context: 'y', source_evidence_message_ids: ['focus-1'] },
      },
    }) } }],
  };
}

Deno.test('room entry grants the first student the learner seat and returns observer access afterward', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const handler = createAssessmentApiHandler(dependencies({
    verifier: { verify: async () => ({
      principal_id: 'principal-student', application_user_id: 'student-2',
      allowed_room_ids: ['room-1'], can_review_assessment: false,
    }) },
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { room_id: 'room-1', learner_id: 'student-1', room_role: 'observer' }, error: null };
    },
  }));

  const response = await handler(request('join_room', { room_id: 'room-1' }));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).data.room_role, 'observer');
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, 'join_room_v1');
  assertEquals(calls[0].args.p_student_id, 'student-2');
});

Deno.test('tutor status judgment is submitted under the verified actor identity', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const handler = createAssessmentApiHandler(dependencies({
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: { item_id: 'item-1', status: 'needs_review' }, error: null };
    },
  }));

  const response = await handler(request('edit_learning_progress', {
    room_id: 'room-1', item_id: 'item-1', action: 'set_status', updates: { status: 'needs_review' },
  }));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).data.status, 'needs_review');
  assertEquals(calls.length, 1);
  assertEquals(calls[0].args.p_actor_id, 'teacher-1');
  assertEquals(calls[0].args.p_action, 'set_status');
  assertEquals(calls[0].args.p_payload, { status: 'needs_review' });
});

Deno.test('observer cannot post a message or answer through the trusted API', async () => {
  const calls: string[] = [];
  const handler = createAssessmentApiHandler(dependencies({
    verifier: { verify: async () => ({
      principal_id: 'observer-principal', application_user_id: 'student-2',
      allowed_room_ids: ['room-1'], can_review_assessment: false,
    }) },
    rpc: async (name) => {
      calls.push(name);
      if (name === 'join_room_v1') return { data: { room_role: 'observer' }, error: null };
      return { data: {}, error: null };
    },
  }));
  const response = await handler(request('post_message', { room_id: 'room-1', content: 'observer write' }));
  assertEquals(response.status, 403);
  assertEquals((await response.json()).error.code, 'OBSERVER_READ_ONLY');
  const answer = await handler(request('process_message', {
    room_id: 'room-1', assessment_id: 'assessment-1', message_id: 'answer-1',
  }));
  assertEquals(answer.status, 403);
  assertEquals((await answer.json()).error.code, 'OBSERVER_READ_ONLY');
  assertEquals(calls, ['join_room_v1', 'join_room_v1']);
});

Deno.test('two simultaneous first joins are arbitrated by the trusted room boundary', async () => {
  let arrivals = 0;
  let release!: () => void;
  const bothArrived = new Promise<void>((resolve) => { release = resolve; });
  let learnerSeat: string | null = null;
  const handler = createAssessmentApiHandler(dependencies({
    verifier: { verify: async () => ({
      principal_id: 'principal-student', application_user_id: `student-${arrivals + 1}`,
      allowed_room_ids: ['room-1'], can_review_assessment: false,
    }) },
    rpc: async (name) => {
      assertEquals(name, 'join_room_v1');
      arrivals += 1;
      if (arrivals === 2) release();
      await bothArrived;
      const result = learnerSeat
        ? { room_id: 'room-1', learner_id: learnerSeat, room_role: 'observer' }
        : (learnerSeat = 'student-1', { room_id: 'room-1', learner_id: learnerSeat, room_role: 'student' });
      return { data: result, error: null };
    },
  }));

  const [first, second] = await Promise.all([
    handler(request('join_room', { room_id: 'room-1' })),
    handler(request('join_room', { room_id: 'room-1' })),
  ]);
  assertEquals(first.status, 200);
  assertEquals(second.status, 200);
  const roles = await Promise.all([
    first.json().then(body => body.data.room_role),
    second.json().then(body => body.data.room_role),
  ]);
  assertEquals(roles.sort(), ['observer', 'student']);
  assertEquals(learnerSeat, 'student-1');
});

Deno.test('approved custom target flows through evidence, assessment delivery, and answer processing', async () => {
  const operations: string[] = [];
  let approved = false;
  let evidenceApplied = false;
  let delivered = false;
  let providerCalls = 0;
  let analysisInput: Record<string, unknown> = {};
  const scope = providerScope();
  const dialogueHistory = [
    { id: 'prepop-room-1-0', source: 'room_setup', user_id: null, user_role: 'tutor', speaker_name: 'Tutor', content: 'Check the sender first.' },
    { id: 'prepop-room-1-1', source: 'room_setup', user_id: null, user_role: 'student', speaker_name: 'Scenario learner', content: 'The sender name looks real.' },
    { id: 'earlier-focus-1', source: 'message', user_id: 'learner-1', user_role: 'student', speaker_name: null, content: 'I am unsure about this link.' },
    { id: 'earlier-1', source: 'message', user_id: 'other-learner', user_role: 'student', speaker_name: null, content: 'I clicked the link.' },
    { id: 'repair-1', source: 'message', user_id: 'teacher-1', user_role: 'tutor', speaker_name: null, content: 'Use the official app instead.' },
    { id: 'focus-1', source: 'message', user_id: 'learner-1', user_role: 'student', speaker_name: null, content: 'I would verify through the official app.' },
    { id: 'later-1', source: 'message', user_id: 'teacher-1', user_role: 'tutor', speaker_name: null, content: 'Feedback posted after the learner answer.' },
  ];
  const deps: AssessmentApiDependencies = {
    ...dependencies(),
    env: (name) => ({
      OAI_API_KEY: 'test-key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
    } as Record<string, string>)[name],
    rpc: async (name, args) => {
      operations.push(name);
      if (name === 'join_room_v1') return { data: { room_role: 'student' }, error: null };
      if (name === 'initialize_transfer_checklist_v1') {
        assertEquals(args.p_items, [{ area_text: 'Verify independently', item_type: 'verification_step', priority: 'critical' }]);
        approved = true;
        return { data: { checklist_id: 'checklist-1' }, error: null };
      }
      if (name === 'get_transfer_message_analysis_context_v1') {
        assert(approved);
        return { data: {
          analysis_complete: evidenceApplied,
          room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
          message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content: 'I would verify through the official app.' },
          items: [{ id: 'item-1', area_text: 'Verify independently', item_type: 'verification_step', priority: 'critical', status: 'partially_covered', understanding_level: 'basic' }],
          dialogue_history: dialogueHistory,
        }, error: null };
      }
      if (name === 'apply_transfer_message_analysis_v1') {
        const analysis = args.p_analysis as { events: Array<{ item_id: string; kind: string }> };
        assertEquals(analysis.events[0].item_id, 'item-1');
        assertEquals(analysis.events[0].kind, 'demonstrated_understanding');
        evidenceApplied = true;
        return { data: { applied: [{ status: 'covered', understanding_level: 'good' }] }, error: null };
      }
      if (name === 'prepare_transfer_assessment_context_v1') {
        assert(evidenceApplied);
        return { data: { ...scope, selected_target_item_id: 'item-1' }, error: null };
      }
      if (name === 'record_transfer_provider_attempt_v1') return { data: {}, error: null };
      if (name === 'send_reviewed_transfer_assessment_v1') {
        assert(evidenceApplied);
        assertEquals((args.p_reviewed_payload as { target_item_id: string }).target_item_id, 'item-1');
        delivered = true;
        return { data: { message: {
          id: 'question-1', room_id: 'room-1', user_id: 'teacher-1', user_role: 'tutor',
          content: 'Which action is safest?', parent_message_id: 'focus-1', response_mode: 'assessment',
          created_at: '2026-09-29T00:00:00Z',
          assessment: { id: 'question-1', student_id: 'learner-1', selection_type: 'single',
            stem: 'Which action is safest?', options: [
              { id: 'A', text: 'Click' }, { id: 'B', text: 'Verify' },
              { id: 'C', text: 'Reply' }, { id: 'D', text: 'Forward' },
            ], correct_option_ids: ['B'] },
        }, room: { id: 'room-1' } }, error: null };
      }
      if (name === 'get_transfer_assessment_processing_context_v1') {
        assert(delivered);
        return { data: { context: { attempt_snapshot: { accepted_attempt_count: 0, resolution: 'open' } },
          assessment: { id: 'question-1' }, answer: { selected_option_ids: ['B'], references_message_id: 'question-1' } }, error: null };
      }
      if (name === 'process_assessment_message_v2') {
        assertEquals(args.p_answer_outcome, 'passed');
        return { data: { message_id: 'answer-1', assessment_id: 'question-1', processing_state: 'applied',
          result_message:{id:'saved-result',room_id:'room-1',user_id:'teacher-1',user_role:'tutor',content:'Correct.',
            response_mode:null,parent_message_id:'answer-1',created_at:'2026-10-17T00:00:00Z',assessment_event:{
              event_key:'assessment-result:answer-1',kind:'result',assessment_id:'question-1',question_message_id:'question-1',
              student_id:'learner-1',answer_message_id:'answer-1',attempt_number:1,outcome:'passed',attempts_used:1,
              attempts_remaining:0,terminal:true,lifecycle:'passed',progress_deferred:false,closure_reason:null}},
          answer_outcome: 'passed', attempt_number: 1, attempts_used: 1, attempts_remaining: 0,
          selected_option_ids: ['B'], terminal: true, feedback_required: true }, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    },
    fetch: async (_input, init) => {
      providerCalls += 1;
      const prompt = JSON.stringify(JSON.parse(String(init?.body)));
      if (providerCalls === 1) {
        analysisInput = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
        assert(prompt.includes('Verify independently'));
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
          events: [{ item_id: 'item-1', kind: 'demonstrated_understanding', evidence_type: 'action', evidence_message_id: 'focus-1',
            evidence_quote: 'verify through the official app', explanation: 'Uses an independent source.' }],
          explanation: 'Initial understanding.',
        }) } }] }), { status: 200 });
      }
      assert(prompt.includes('item-1'));
      return new Response(JSON.stringify(validProviderPayload()), { status: 200 });
    },
    resolveAnswer: () => ({ disposition: 'passed', progress: { status: 'covered', understanding_level: 'good' }, applied_transition: { kind: 'assessment_pass' } }),
  };
  const handler = createAssessmentApiHandler(deps);
  const init = await (await handler(request('initialize_checklist', { room_id: 'room-1', student_id: 'learner-1',
    items: [{ area_text: 'Verify independently', item_type: 'verification_step', priority: 'critical' }] }))).json();
  assertEquals(init.data.checklist_id, 'checklist-1');
  const analysis = await (await handler(request('analyze_message', { room_id: 'room-1', message_id: 'focus-1' }))).json();
  assertEquals(analysis.data.applied[0].status, 'covered');
  assertEquals(analysisInput.focus_student_id, 'learner-1');
  assertEquals(analysisInput.evidence_message_id, 'focus-1');
  assertEquals(analysisInput.dialogue_history, dialogueHistory.slice(0, -1));
  assertEquals((analysisInput.message as Record<string, unknown>).id, 'focus-1');
  const prepared = await (await handler(request('prepare_turn', { room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1' }))).json();
  assertEquals(prepared.data.assessment_draft.target_item_id, 'item-1');
  const sent = await (await handler(request('send_reviewed', { room_id: 'room-1', student_id: 'learner-1',
    checklist_id: 'checklist-1', item_id: 'item-1', focus_student_message_id: 'focus-1',
    reviewed_payload: prepared.data.assessment_draft }))).json();
  assertEquals(sent.data.message.response_mode, 'assessment');
  assert(!JSON.stringify(sent.data).includes('correct_option_ids'));
  const processed = await (await handler(request('process_message', { room_id: 'room-1', assessment_id: 'question-1', message_id: 'answer-1' }))).json();
  assertEquals(processed.data.answer_outcome, 'passed');
  assertEquals(providerCalls, 2);
  assert(operations.indexOf('apply_transfer_message_analysis_v1') < operations.indexOf('prepare_transfer_assessment_context_v1'));
});

// Test responsible for assessment-api/index.ts: accept direct understanding with current-message evidence.
Deno.test('accepts direct understanding evidence for the current learner message', async () => {
  let stored: Record<string, unknown> | null = null;
  const deps = dependencies({
    env: (name) => ({
      OAI_API_KEY: 'test-key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
    } as Record<string, string>)[name],
    fetch: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      events: [{ item_id: 'item-1', kind: 'demonstrated_understanding', evidence_type: 'action', evidence_message_id: 'focus-1',
        evidence_quote: 'I will open the real app', explanation: 'The learner names the independent action and why the link is unsafe.' }],
      explanation: 'Complete target evidence.',
    }) } }] }), { status: 200 }),
  });
  deps.rpc = async (name, args) => {
    if (name === 'get_transfer_message_analysis_context_v1') return { data: {
      room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
      message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student',
        content: 'I will open the real app to check my account instead of using the warning link.' },
      items: [{ id: 'item-1', area_text: 'Verify a warning in the official app',
        status: 'pending', understanding_level: 'none' }],
      dialogue_history: [{ id: 'focus-1', source: 'message', user_id: 'learner-1',
        user_role: 'student', content: 'I will open the real app to check my account instead of using the warning link.' }],
    }, error: null };
    if (name === 'apply_transfer_message_analysis_v1') {
      stored = args.p_analysis as Record<string, unknown>;
      return { data: { applied: [{ status: 'covered', understanding_level: 'good' }] }, error: null };
    }
    throw new Error(`unexpected RPC ${name}`);
  };
  const response = await createAssessmentApiHandler(deps)(request('analyze_message', {
    room_id: 'room-1', message_id: 'focus-1',
  }));
  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.data.applied[0].status, 'covered');
  assertEquals((stored as unknown as { events: Array<{ kind: string }> }).events[0].kind, 'demonstrated_understanding');
  assertEquals(Object.keys(stored!).sort(), ['events', 'explanation', 'rejected_events']);
});


// Test responsible for assessment-api/index.ts: classify overlapping targets independently before applying events.
Deno.test('keeps one target evidence from advancing a related target', async () => {
  const analyzedIds: string[] = [];
  let applied: Record<string, unknown> | null = null;
  const deps = dependencies({
    env: (name) => ({ OAI_API_KEY: 'test-key', OAI_BASE_URL: 'https://provider.invalid/v1',
      OAI_MODEL: 'qwen3.8-flash' } as Record<string, string>)[name],
    fetch: async (_input, init) => {
      const input = JSON.parse(JSON.parse(String(init?.body)).messages[1].content);
      assertEquals(input.items.length, 1);
      const itemId = input.items[0].id;
      analyzedIds.push(itemId);
      return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        events: itemId === 'action-1' ? [{ item_id: itemId, kind: 'demonstrated_understanding',
          evidence_type: 'action', evidence_message_id: 'focus-1', evidence_quote: 'I will open the app',
          explanation: 'The learner states the action.' }] : [],
        explanation: 'Target evaluated.',
      }) } }] }), { status: 200 });
    },
  });
  deps.rpc = async (name, args) => {
    if (name === 'get_transfer_message_analysis_context_v1') return { data: {
      room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
      message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student',
        content: 'I will open the app instead of using this link.' },
      items: [
        { id: 'action-1', area_text: 'Check the app', item_type: 'detection_area', status: 'pending', understanding_level: 'none' },
        { id: 'reason-1', area_text: 'Explain the scam', item_type: 'detection_area',
          status: 'pending', understanding_level: 'none' },
      ],
      dialogue_history: [{ id: 'focus-1', source: 'message', user_id: 'learner-1',
        user_role: 'student', content: 'I will open the app instead of using this link.' }],
    }, error: null };
    if (name === 'apply_transfer_message_analysis_v1') {
      applied = args.p_analysis as Record<string, unknown>;
      return { data: { applied: [{ status: 'covered', understanding_level: 'good' }] }, error: null };
    }
    throw new Error(`unexpected RPC ${name}`);
  };
  const response = await createAssessmentApiHandler(deps)(request('analyze_message', {
    room_id: 'room-1', message_id: 'focus-1',
  }));
  assertEquals(response.status, 200);
  assertEquals(analyzedIds, ['action-1', 'reason-1']);
  assertEquals((applied as unknown as { events: Array<{ item_id: string }> }).events.map(event => event.item_id), ['action-1']);
  assertEquals((applied as unknown as { rejected_events: Array<{ item_id: string; rejection_reason: string }> }).rejected_events,
    []);
});

// Test responsible for assessment-api/index.ts: unified targets accept relevant action evidence.
Deno.test('accepts action evidence for a detection-area target', async () => {
  let stored: Record<string, any> | null = null;
  const deps = dependencies({
    env: (name) => ({ OAI_API_KEY: 'test-key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash' } as Record<string, string>)[name],
    fetch: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      events: [{ item_id: 'item-1', kind: 'demonstrated_understanding', evidence_type: 'action', evidence_message_id: 'focus-1',
        evidence_quote: 'I will open the official app', explanation: 'The learner chooses a safe action.' }],
      explanation: 'Action evidence only.',
    }) } }] }), { status: 200 }),
  });
  deps.rpc = async (name, args) => {
    if (name === 'get_transfer_message_analysis_context_v1') return { data: {
      room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
      message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content: 'I will open the official app.' },
      items: [{ id: 'item-1', area_text: 'Open the official app independently', item_type: 'detection_area', status: 'pending', understanding_level: 'none' }],
      dialogue_history: [{ id: 'focus-1', source: 'message', user_id: 'learner-1', user_role: 'student', content: 'I will open the official app.' }],
    }, error: null };
    stored = args.p_analysis as Record<string, any>;
    return { data: { applied: [] }, error: null };
  };
  const response = await createAssessmentApiHandler(deps)(request('analyze_message', { room_id: 'room-1', message_id: 'focus-1' }));
  assertEquals(response.status, 200);
  assertEquals((stored as unknown as { events: Array<{ evidence_type: string }> }).events[0].evidence_type, 'action');
  assertEquals((stored as unknown as { rejected_events: unknown[] }).rejected_events, []);
});

// Test responsible for assessment-api/index.ts: preserve valid analysis while recording unsupported proposals.
Deno.test('records and omits ineligible transitions for unified targets', async () => {
  for (const [status, level, kind, itemType] of [
    ['partially_covered', 'basic', 'initial_signal', 'detection_area'],
    ['pending', 'none', 'post_repair_signal', 'detection_area'],
  ]) {
    let applyCalls = 0;
    let stored: Record<string, any> | null = null;
    const deps = dependencies({
      env: (name) => ({ OAI_API_KEY: 'test-key', OAI_BASE_URL: 'https://provider.invalid/v1',
        OAI_MODEL: 'qwen3.8-flash' } as Record<string, string>)[name],
      fetch: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        events: [{ item_id: 'item-1', kind, evidence_type: 'action', evidence_message_id: 'focus-1',
          evidence_quote: 'I will check the app', explanation: 'The learner describes a check.' }],
        explanation: 'Evidence evaluated.',
      }) } }] }), { status: 200 }),
    });
    deps.rpc = async (name, args) => {
      if (name === 'get_transfer_message_analysis_context_v1') return { data: {
          room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
          message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student',
            content: 'I will check the app.' },
          items: [{ id: 'item-1', area_text: 'Check the app', item_type: itemType,
            status, understanding_level: level }],
          dialogue_history: [{ id: 'focus-1', source: 'message', user_id: 'learner-1',
            user_role: 'student', content: 'I will check the app.' }],
      }, error: null };
      applyCalls += 1;
      stored = args.p_analysis as Record<string, any>;
      return { data: { applied: [] }, error: null };
    };
    const response = await createAssessmentApiHandler(deps)(request('analyze_message', {
      room_id: 'room-1', message_id: 'focus-1',
    }));
    assertEquals(response.status, 200);
    assertEquals((stored as unknown as { events: unknown[] }).events, []);
    assertEquals((stored as unknown as { rejected_events: unknown[] }).rejected_events.length, 1);
    assertEquals((stored as unknown as { rejected_events: Array<{ rejection_reason: string }> }).rejected_events[0].rejection_reason,
      'INELIGIBLE_TRANSITION');
    assertEquals(applyCalls, 1);
  }
});

// Test responsible for assessment-api/index.ts: reject a status event grounded in another learner's historical words.
Deno.test('rejects historical speaker evidence before updating learner status', async () => {
  for (const evidenceMessageId of ['earlier-1', 'focus-1']) {
    let applyCalls = 0;
    const deps = dependencies({
      env: (name) => ({
        OAI_API_KEY: 'test-key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
      } as Record<string, string>)[name],
      fetch: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        events: [{ item_id: 'item-1', kind: 'initial_signal', evidence_type: 'action', evidence_message_id: evidenceMessageId,
          evidence_quote: 'I clicked the link.', explanation: 'The learner clicked the link.' }],
        explanation: 'Evidence from history.',
      }) } }] }), { status: 200 }),
    });
    deps.rpc = async (name) => {
      if (name === 'get_transfer_message_analysis_context_v1') return { data: {
        room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
        message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content: 'I would verify through the official app.' },
        items: [{ id: 'item-1', area_text: 'Verify independently', status: 'pending' }],
        dialogue_history: [
          { id: 'earlier-1', source: 'message', user_id: 'other-learner', user_role: 'student', speaker_name: null, content: 'I clicked the link.' },
          { id: 'focus-1', source: 'message', user_id: 'learner-1', user_role: 'student', speaker_name: null, content: 'I would verify through the official app.' },
        ],
      }, error: null };
      if (name === 'apply_transfer_message_analysis_v1') {
        applyCalls += 1;
        return { data: { applied: [] }, error: null };
      }
      throw new Error(`unexpected RPC ${name}`);
    };

    const response = await createAssessmentApiHandler(deps)(request('analyze_message', {
      room_id: 'room-1', message_id: 'focus-1',
    }));
    const payload = await response.json();
    assertEquals(response.status, 502);
    assertEquals(payload.error.code, 'AI_OUTPUT_INVALID');
    assertEquals(applyCalls, 0);
  }
});

// Test responsibility: verify that the production Edge module passes Deno's type checker.
Deno.test('default RPC adapter type-checks without remote fetches', async () => {
  const checked = await new Deno.Command(Deno.execPath(), {
    args: ['check', '--cached-only', '--unstable-sloppy-imports', new URL('./index.ts', import.meta.url).pathname],
  }).output();
  assert(checked.success, new TextDecoder().decode(checked.stderr));
});

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

// Covers index.ts: disabled configuration must prevent assessment side effects.
Deno.test('disabled feature makes no assessment storage call', async () => {
  let calls = 0;
  const handler = createAssessmentApiHandler(dependencies({
    featureEnabled: async () => false,
    rpc: async () => { calls += 1; return { data: {}, error: null }; },
  }));
  const response = await handler(request('post_message', { room_id: 'room-1', content: 'Hello' }));
  const payload = await response.json();
  assertEquals(response.status, 503);
  assertEquals(payload.error.code, 'ASSESSMENT_FEATURE_DISABLED');
  assertEquals(calls, 0);
});

Deno.test('owner clear remains available with assessment feature disabled and passes only verified identity',async ()=>{
  const calls:unknown[]=[];
  const handler=createAssessmentApiHandler(dependencies({featureEnabled:async()=>false,rpc:async(name,args)=>{
    calls.push({name,args});return {data:{success:true,title:'Room',prePopulatedMessagesPreserved:true},error:null};
  }}));
  const response=await handler(request('clear_chat_history',{room_id:'room-1',actor_id:'forged'}));
  assertEquals(response.status,200);
  assertEquals(calls,[{name:'clear_room_chat_history_v1',args:{p_room_id:'room-1',p_actor_id:'teacher-1'}}]);
});

// Covers index.ts: the same warm handler must observe administrator flag changes.
Deno.test('reads current feature configuration for every assessment request', async () => {
  let enabled = true;
  let reads = 0;
  let writes = 0;
  const handler = createAssessmentApiHandler(dependencies({
    featureEnabled: async () => { reads += 1; return enabled; },
    rpc: async (name) => {
      if (name === 'post_assessment_message_v2') writes += 1;
      return { data: {}, error: null };
    },
  }));
  const post = () => request('post_message', { room_id: 'room-1', content: 'Hello' });
  assertEquals((await handler(post())).status, 200);
  enabled = false;
  const disabled = await handler(post());
  assertEquals((await disabled.json()).error.code, 'ASSESSMENT_FEATURE_DISABLED');
  assertEquals(writes, 1);
  enabled = true;
  assertEquals((await handler(post())).status, 200);
  assertEquals(reads, 3);
  assertEquals(writes, 2);
});

// Covers index.ts: unavailable configuration must fail closed without exposing private errors.
Deno.test('configuration read failure returns retryable error without assessment side effects', async () => {
  let writes = 0;
  const handler = createAssessmentApiHandler(dependencies({
    featureEnabled: async () => { throw new Error('private database diagnostic'); },
    rpc: async () => { writes += 1; return { data: {}, error: null }; },
  }));
  const result = await handler(request('post_message', { room_id: 'room-1', content: 'Hello' }));
  assertEquals(result.status, 503);
  const payload = await result.json();
  assertEquals(payload.error.code, 'ASSESSMENT_CONFIGURATION_UNAVAILABLE');
  assertEquals(payload.error.retryable, true);
  assertEquals(JSON.stringify(payload).includes('private database diagnostic'), false);
  assertEquals(writes, 0);
});

// Covers index.ts: owner clear must remain available during a configuration outage.
Deno.test('owner clear does not read feature configuration', async () => {
  const handler = createAssessmentApiHandler(dependencies({
    featureEnabled: async () => { throw new Error('configuration unavailable'); },
    rpc: async () => ({ data: { success: true }, error: null }),
  }));
  assertEquals((await handler(request('clear_chat_history', { room_id: 'room-1' }))).status, 200);
});

// Covers index.ts: the production adapter reads the public table and rejects absent or malformed values.
Deno.test('default feature reader uses public configuration instead of the environment secret', async () => {
  const originalFetch = globalThis.fetch;
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TRANSFER_ASSESSMENT_ENABLED'];
  const originalEnv = names.map(name => Deno.env.get(name));
  try {
    Deno.env.set('SUPABASE_URL', 'https://configuration-test.supabase.co');
    Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
    Deno.env.set('TRANSFER_ASSESSMENT_ENABLED', 'false');
    for (const enabled of [true, false, null, 'true', undefined]) {
      globalThis.fetch = async (input) => {
        const url = new URL(String(input));
        assertEquals(url.pathname, '/rest/v1/feature_flags');
        assertEquals(url.searchParams.get('name'), 'eq.TRANSFER_ASSESSMENT_ENABLED');
        assertEquals(url.searchParams.get('select'), 'enabled');
        return new Response(JSON.stringify(enabled === undefined ? {} : { enabled }), {
          headers: { 'content-type': 'application/json' },
        });
      };
      let result: boolean | string;
      try { result = await createDefaultDependencies().featureEnabled(); }
      catch (error) { result = (error as Error).message; }
      assertEquals(result, typeof enabled === 'boolean' ? enabled : 'ASSESSMENT_CONFIGURATION_UNAVAILABLE');
    }
    globalThis.fetch = async () => new Response(JSON.stringify({ message: 'unavailable' }), {
      status: 503, headers: { 'content-type': 'application/json' },
    });
    let failed = false;
    try { await createDefaultDependencies().featureEnabled(); } catch { failed = true; }
    assertEquals(failed, true);
  } finally {
    globalThis.fetch = originalFetch;
    names.forEach((name, index) => {
      if (originalEnv[index] === undefined) Deno.env.delete(name);
      else Deno.env.set(name, originalEnv[index]!);
    });
  }
});

Deno.test('projects the approved checklist UUID into the browser initialization contract', async () => {
  const handler = createAssessmentApiHandler(dependencies({
    rpc: async (name, args) => {
      assertEquals(name, 'initialize_transfer_checklist_v1');
      assertEquals(args.p_actor_id, 'teacher-1');
      assertEquals(args.p_items, [{ area_text: 'Verify independently', item_type: 'detection_area', priority: 'critical' }]);
      return { data: { checklist_id: 'checklist-1' }, error: null };
    },
  }));
  const response = await handler(request('initialize_checklist', {
    room_id: 'room-1', student_id: 'learner-1',
    items: [{ area_text: 'Verify independently', item_type: 'detection_area', priority: 'critical' }],
  }));
  assertEquals(response.status, 200);
  assertEquals((await response.json()).data, { checklist_id: 'checklist-1' });
});

Deno.test('forged actor and cross-room request cannot bypass verified scope', async () => {
  const calls: Record<string, unknown>[] = [];
  const handler = createAssessmentApiHandler(dependencies({
    rpc: async (_name, args) => {
      calls.push(args);
      return { data: { message: { id: 'message-1' } }, error: null };
    },
  }));
  const forged = await handler(request('post_message', {
    room_id: 'room-1', content: 'Hello', actor_id: 'other-user',
  }));
  assertEquals(forged.status, 200);
  assertEquals(calls[0].p_student_id, 'teacher-1');
  assertEquals(calls[1].p_actor_id, 'teacher-1');
  const crossRoom = await handler(request('post_message', {
    room_id: 'other-room', content: 'Hello', actor_id: 'teacher-1',
  }));
  assertEquals(crossRoom.status, 403);
  assertEquals(calls.length, 2);
});

Deno.test('returns the exact public assessment target and strips private fields', async () => {
  const handler = createAssessmentApiHandler(dependencies({
    rpc: async (name) => {
      assertEquals(name, 'send_reviewed_transfer_assessment_v1');
      return { data: {
        message: {
          id: 'question-1', room_id: 'room-1', user_id: 'teacher-1', content: 'Safest action?',
          user_role: 'tutor', parent_message_id: 'focus-1', response_mode: 'assessment',
          created_at: '2026-09-22T00:00:00Z',
          assessment: {
            id: 'assessment-1', student_id: 'learner-1', selection_type: 'single', stem: 'Safest action?',
            options: [
              { id: 'A', text: 'Click' }, { id: 'B', text: 'Verify' },
              { id: 'C', text: 'Reply' }, { id: 'D', text: 'Forward' },
            ], rendered_text: 'private',
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
      reason: 'Check transfer.', target_item_id: 'item-1', assessment: {
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

Deno.test('requires provider credentials before any provider or audit call', async () => {
  const configured = {
    OAI_API_KEY: 'server-secret', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
  };
  for (const missing of ['OAI_API_KEY', 'OAI_BASE_URL']) {
    let providerCalls = 0;
    let auditCalls = 0;
    const settings = { ...configured } as Record<string, string | undefined>;
    settings[missing] = undefined;
    const handler = createAssessmentApiHandler(dependencies({
      env: (name) => settings[name],
      rpc: async (name) => {
        if (name === 'prepare_transfer_turn_v1') return { data: providerScope(), error: null };
        auditCalls += 1;
        return { data: {}, error: null };
      },
      fetch: async () => {
        providerCalls += 1;
        return new Response('{}', { status: 200 });
      },
    }));
    const response = await handler(request('prepare_turn', {
      room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
    }));
    const payload = await response.json();
    assertEquals(response.status, 503);
    assertEquals(payload.error.code, 'AI_PROVIDER_NOT_CONFIGURED');
    assertEquals(providerCalls, 0);
    assertEquals(auditCalls, 0);
  }
});

Deno.test('preserves the assessment model despite a different model secret, 1200-token budget, JSON mode, and private audit', async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const audits: Record<string, unknown>[] = [];
  const handler = createAssessmentApiHandler(dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
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
  assertEquals(payload.data.item_id, 'item-1');
  assertEquals(payload.data.context.progress_snapshot_hash, 'snapshot-1');
  assertEquals(requests[0].url, 'https://provider.invalid/v1/chat/completions');
  assertEquals(requests[0].body.model, 'qwen3.5-flash');
  assertEquals(requests[0].body.max_tokens, 1200);
  assertEquals(requests[0].body.response_format, { type: 'json_object' });
  assert(JSON.stringify(requests[0].body).includes('learner_safe_explanation'));
  assert(!JSON.stringify(audits[0]).includes('server-secret'));
  assert(!JSON.stringify(payload).includes('server-secret'));
  assert(!JSON.stringify(payload).includes('raw_response'));
  assertEquals(audits[0].p_validation_outcome, 'valid');
});

Deno.test('returns a valid second response after one format repair', async () => {
  const audits: Record<string, unknown>[] = [];
  const requests: Record<string, unknown>[] = [];
  const handler = createAssessmentApiHandler(dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
    } as Record<string, string>)[name],
    rpc: async (name, args) => {
      if (name === 'prepare_transfer_turn_v1') return { data: providerScope(), error: null };
      if (name === 'record_transfer_provider_attempt_v1') audits.push(args);
      return { data: 'audit', error: null };
    },
    fetch: async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(requests.length === 1
        ? { choices: [{ finish_reason: 'stop', message: { content: '{invalid' } }] }
        : validProviderPayload()), { status: 200 });
    },
  }));
  const response = await handler(request('prepare_turn', {
    room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
  }));
  const payload = await response.json();
  assertEquals(response.status, 200);
  assertEquals(payload.data.assessment_draft.assessment.learner_safe_explanation, 'Verify through the official app.');
  assertEquals(audits.map((entry) => entry.p_validation_outcome), ['invalid', 'valid']);
  assertEquals(audits.map((entry) => entry.p_attempt_ordinal), [1, 2]);
  assertEquals(requests.length, 2);
  assert(JSON.stringify(requests[1]).includes('Return valid JSON matching the same contract.'));
  assert(!JSON.stringify(audits).includes('server-secret'));
  assert(!JSON.stringify(payload).includes('server-secret'));
  assert(!JSON.stringify(payload).includes('raw_response'));
});

// Test responsibility: assessment-api/index.ts supplies validator feedback to the single format repair attempt.
Deno.test('format repair forwards a rendering violation without accepting the invalid draft', async () => {
  const requests: Array<{ messages: Array<{ content: string }> }> = [];
  const audits: Record<string, unknown>[] = [];
  const invalid = validProviderPayload() as { choices: Array<{ message: { content: string } }> };
  const draft = JSON.parse(invalid.choices[0].message.content);
  draft.assessment.stem = 'There is a new warning. It asks for a response. What should you do?';
  invalid.choices[0].message.content = JSON.stringify(draft);
  const handler = createAssessmentApiHandler(dependencies({
    env: name => ({ OAI_API_KEY: 'key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash' } as Record<string,string>)[name],
    rpc: async (name, args) => {
      if (name === 'prepare_transfer_turn_v1') return { data: providerScope(), error: null };
      if (name === 'record_transfer_provider_attempt_v1') audits.push(args);
      return { data: 'audit', error: null };
    },
    fetch: async (_input, init) => {
      requests.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(requests.length === 1 ? invalid : validProviderPayload()), { status: 200 });
    }
  }));
  const response = await handler(request('prepare_turn', {
    room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1'
  }));
  assertEquals(response.status, 200);
  assertEquals(requests.length, 2);
  const repair = JSON.parse(requests[1].messages[1].content.split('\n').at(-1)!);
  assert(typeof repair.format_repair.validation_error === 'string' && repair.format_repair.validation_error.length > 0);
  assertEquals(audits.map(entry => entry.p_validation_outcome), ['invalid','valid']);
});

Deno.test('performs one format-only repair and rejects a second invalid result', async () => {
  let providerCalls = 0;
  const audits: Record<string, unknown>[] = [];
  const handler = createAssessmentApiHandler(dependencies({
    env: (name) => ({ OAI_API_KEY: 'key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash' } as Record<string, string>)[name],
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
      env: (name) => ({ OAI_API_KEY: 'key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash' } as Record<string, string>)[name],
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

Deno.test('fails preparation without retry when provider audit persistence fails', async () => {
  let providerCalls = 0;
  const handler = createAssessmentApiHandler(dependencies({
    env: (name) => ({ OAI_API_KEY: 'key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash' } as Record<string, string>)[name],
    rpc: async (name) => {
      if (name === 'prepare_transfer_turn_v1') return { data: providerScope(), error: null };
      return { data: null, error: { message: 'audit insert failed' } };
    },
    fetch: async () => {
      providerCalls += 1;
      return new Response(JSON.stringify(validProviderPayload()), { status: 200 });
    },
  }));
  const response = await handler(request('prepare_turn', {
    room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
  }));
  const payload = await response.json();
  assertEquals(payload.error.code, 'PERSISTENCE_FAILED');
  assertEquals(providerCalls, 1);
});

Deno.test('analyzes persisted learner evidence before mandatory assessment preparation', async () => {
  let analyzed = false;
  let analysisCalls = 0;
  let assessmentCalls = 0;
  const base = dependencies({
    env: (name) => ({
      OAI_API_KEY: 'server-secret', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
    } as Record<string, string>)[name],
    fetch: async (_input, init) => {
      const body = JSON.parse(String(init?.body));
      if (JSON.parse(body.messages[1].content).dialogue_history !== undefined) {
        assertEquals(body.model, 'qwen3.8-flash');
        assertEquals(body.temperature, 0);
        assertEquals(body.max_tokens, 600);
        assertEquals(body.enable_thinking, false);
        assertEquals(body.response_format, { type: 'json_object' });
        analysisCalls += 1;
        return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
          events: [{ item_id: 'item-1', kind: 'demonstrated_understanding', evidence_type: 'action', evidence_message_id: 'focus-1',
            evidence_quote: 'verify through the official app', explanation: 'Learner verifies independently.' }],
          explanation: 'Relevant evidence.',
        }) } }] }), { status: 200 });
      }
      assessmentCalls += 1;
      assertEquals(body.model, 'qwen3.5-flash');
      return new Response(JSON.stringify(validProviderPayload()), { status: 200 });
    },
  });
  base.rpc = async (name, args) => {
    if (name === 'get_transfer_message_analysis_context_v1') return { data: {
      analysis_complete: analyzed, room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
      message: { id: 'focus-1', room_id: 'room-1', user_id: 'learner-1', user_role: 'student', content: 'I would verify through the official app.' },
      items: [{ id: 'item-1', area_text: 'Verify independently', status: analyzed ? 'covered' : 'partially_covered',
        understanding_level: analyzed ? 'good' : 'basic' }],
      dialogue_history: [
        { id: 'focus-1', source: 'message', user_id: 'learner-1', user_role: 'student', speaker_name: null, content: 'I would verify through the official app.' },
      ],
    }, error: null };
    if (name === 'apply_transfer_message_analysis_v1') {
      assertEquals((args.p_analysis as Record<string, unknown>).events, [
        { item_id: 'item-1', kind: 'demonstrated_understanding', evidence_type: 'action', evidence_message_id: 'focus-1',
          evidence_quote: 'verify through the official app', explanation: 'Learner verifies independently.' },
      ]);
      analyzed = true;
      return { data: { applied: [{ status: 'covered' }] }, error: null };
    }
    if (name === 'prepare_transfer_assessment_context_v1') {
      assert(analyzed, 'preparation used stale progress');
      return { data: { ...providerScope(), selected_target_item_id: 'item-1' }, error: null };
    }
    return { data: {}, error: null };
  };
  const response = await createAssessmentApiHandler(base)(request('prepare_turn', {
    room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1',
  }));
  const payload = await response.json();
  assertEquals(payload.ok, true);
  assertEquals(payload.data.assessment_draft.target_item_id, 'item-1');
  assertEquals(analysisCalls, 1);
  assertEquals(assessmentCalls, 1);
});

Deno.test('explicit no-assessment result avoids the provider, while an eligible provider failure is an error', async () => {
  let calls = 0;
  const noDue = dependencies({
    rpc: async () => ({ data: {}, error: null }),
    fetch: async () => { calls += 1; throw new Error('provider should not run'); },
  });
  noDue.rpc = async (name) => name === 'prepare_transfer_assessment_context_v1'
    ? { data: { no_assessment_due: true }, error: null }
    : { data: { analysis_complete: true }, error: null };
  const body = { room_id: 'room-1', checklist_id: 'checklist-1', focus_student_message_id: 'focus-1' };
  const none = await createAssessmentApiHandler(noDue)(request('prepare_turn', body));
  assertEquals((await none.json()).data, null);
  assertEquals(calls, 0);

  const failing = dependencies({
    env: (name) => ({
      OAI_API_KEY: 'key', OAI_BASE_URL: 'https://provider.invalid/v1', OAI_MODEL: 'qwen3.8-flash',
    } as Record<string, string>)[name],
    fetch: async () => { calls += 1; throw new Error('offline'); },
  });
  const failed = await createAssessmentApiHandler(failing)(request('prepare_turn', body));
  assertEquals((await failed.json()).error.code, 'AI_PROVIDER_ERROR');
  assertEquals(calls, 1);
});

Deno.test('preserves the trusted ordinary-message branch and rejects tutoring through assessment delivery', async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const handler = createAssessmentApiHandler(dependencies({
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === 'post_assessment_message_v2') return { data: { message: { id: 'message-1' } }, error: null };
      return { data: {
        message: {
          id: 'tutor-1', room_id: 'room-1', user_id: 'teacher-1', content: 'Let us review.',
          user_role: 'tutor', parent_message_id: 'focus-1', response_mode: 'tutoring',
          assessment: null, created_at: '2026-09-22T00:00:00Z',
        }, room: { id: 'room-1' },
      }, error: null };
    },
  }));
  const ordinary = await handler(request('post_message', { room_id: 'room-1', content: 'Hello' }));
  assertEquals((await ordinary.json()).ok, true);
  const reviewed = await handler(request('send_reviewed', {
    room_id: 'room-1', student_id: 'learner-1', checklist_id: 'checklist-1',
    item_id: null, focus_student_message_id: 'focus-1',
    reviewed_payload: {
      reason: 'Teach before assessing.',
      decision: { mode: 'tutoring', instruction: 'explanation', target_item_id: null },
      response: 'Let us review.', assessment: null,
    },
  }));
  const payload = await reviewed.json();
  assertEquals(payload.error.code, 'ITEM_VALIDATION_FAILED');
  assertEquals(calls[0].name, 'join_room_v1');
  assertEquals(calls[1].name, 'post_assessment_message_v2');
  assertEquals(calls[1].args.p_assessment_id, null);
  assertEquals(calls.length, 2);
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
      if (name === 'join_room_v1') return { data: { room_role: 'student' }, error: null };
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

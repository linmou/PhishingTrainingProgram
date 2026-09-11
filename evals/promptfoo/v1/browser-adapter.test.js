#!/usr/bin/env node
// Test responsible for runner.js and browser-adapter.js delegating the same raw v2 generation to one canonical evaluator with identical results and judge evidence.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { evaluateOfflineOutput } = require('./runner');
const {
  evaluateBrowserCapture,
  appendPersistenceEvidence,
  appendProductFailure,
  roomContentVisible,
  behaviorChecksComplete,
  productChecksComplete,
  REQUIRED_PRODUCT_CHECK_IDS,
  selectFinalProductionDecision
} = require('./browser-adapter');

const caseDefinition = {
  id: 'adapter-parity-case',
  source_type: 'ecological',
  role: 'peer',
  input: {
    scenario_context: 'Account alert with a suspicious link.',
    conversation_history: 'Tutor/AI: What would you do?\nParticipant: Student: I would click it quickly.',
    student_message: 'I would click it quickly.',
    prior_mode: null
  },
  inventory: {
    detection_areas: ['Suspicious URL'],
    verification_steps: ['Open the real app']
  },
  expected: {
    mode: 'tutoring',
    instruction: 'protective_instruction',
    knowledge_required: true,
    checks: [
      'contract_validity',
      'mode_selection',
      'instruction_selection',
      'response_length',
      'contextual_knowledge_quality'
    ]
  },
  partitions: ['imminent_protection'],
  legacy: [{
    id: 'v0:response_length',
    type: 'javascript',
    metric: 'response_length'
  }]
};

const rawOutput = JSON.stringify({
  reason: 'The learner intends to click an unsafe link, so immediate protection is required.',
  decision: { mode: 'tutoring', instruction: 'protective_instruction' },
  response: 'Do not click that link. Open the real app and check the alert there.'
});
const parsedOutput = JSON.parse(rawOutput);

const settings = {
  model: 'judge-model',
  judge_temperature: 0,
  judge_max_tokens: 8000,
  judge_enable_thinking: true,
  transport_attempts: 1
};

function makeJudgeCall() {
  return async (messages, kind, callSettings) => {
    assert.equal(kind, 'judge');
    const body = JSON.parse(messages[1].content);
    const metric = Object.keys(body.checks)[0];
    assert.equal(metric, 'contextual_knowledge_quality');
    return {
      request: {
        model: callSettings.model,
        messages,
        temperature: callSettings.judge_temperature,
        max_tokens: callSettings.judge_max_tokens,
        enable_thinking: callSettings.judge_enable_thinking
      },
      attempts: [{ status: 200, raw: 'preserved judge transport body' }],
      text: JSON.stringify({
        [metric]: {
          applicable: true,
          pass: true,
          score: 1,
          accuracy_pass: true,
          reason: 'The safe action is correct and scenario-grounded.'
        }
      })
    };
  };
}

test('offline and browser adapters return identical canonical evaluation outcomes', async () => {
  const offline = await evaluateOfflineOutput({
    caseDefinition,
    rawOutput,
    contractVersion: 'v2',
    settings,
    judgeCall: makeJudgeCall(),
    replayEvidence: null
  });
  const browser = await evaluateBrowserCapture({
    caseDefinition,
    capture: {
      case_id: caseDefinition.id,
      request_equivalent: true,
      product_input: {
        scenario_context: caseDefinition.input.scenario_context,
        conversation_history: caseDefinition.input.conversation_history,
        student_message: caseDefinition.input.student_message,
        configured_role: caseDefinition.role,
        detection_areas: caseDefinition.inventory.detection_areas,
        verification_steps: caseDefinition.inventory.verification_steps,
        prior_mode: 'unknown'
      },
      target_attempts: [
        { sequence: 1, raw_output: '{"reason":', parser_status: 'rejected' },
        { sequence: 2, raw_output: rawOutput, parser_status: 'accepted', parsed_decision: parsedOutput }
      ],
      displayed_suggestion: JSON.parse(rawOutput).response,
      displayed_mode: 'tutoring'
    },
    contractVersion: 'v2',
    settings,
    judgeCall: makeJudgeCall(),
    replayEvidence: null
  });

  const outcome = (evaluation) => evaluation.results.map((result) => ({
    metric: result.metric,
    method: result.method,
    status: result.status,
    pass: result.pass,
    score: result.score,
    applicable: result.applicable
  }));

  assert.deepEqual(outcome(browser.behavior_checks), outcome(offline));
  assert.deepEqual(browser.behavior_checks.judge, offline.judge);
  assert.deepEqual(offline.results.map((result) => result.metric), [
    'contract_validity',
    'mode_selection',
    'instruction_selection',
    'response_length',
    'v0:response_length',
    'contextual_knowledge_quality'
  ]);
  assert.equal(offline.judge.length, 1);
  assert.equal(offline.judge[0].calls.length, 1);
  assert.equal(offline.judge[0].calls[0].attempts[0].raw, 'preserved judge transport body');
  const preservedJudgeCall = offline.judge[0].calls[0];
  const preservedJudgeRequest = JSON.parse(preservedJudgeCall.request.messages[1].content);
  assert.deepEqual(Object.keys(preservedJudgeRequest.checks), ['contextual_knowledge_quality']);
  assert.deepEqual(JSON.parse(preservedJudgeCall.text), {
    contextual_knowledge_quality: {
      applicable: true,
      pass: true,
      score: 1,
      accuracy_pass: true,
      reason: 'The safe action is correct and scenario-grounded.'
    }
  });
  assert.deepEqual(browser.target_attempts, browser.capture.target_attempts);
  assert.equal(browser.target_attempts.length, 2);
  assert.equal(browser.target_attempts[0].raw_output, '{"reason":');
  assert.equal(browser.final_raw_output, rawOutput);
  assert.equal(browser.product_checks.find((check) => check.id === 'input_equivalence').status, 'pass');
  assert.equal(browser.product_checks.find((check) => check.id === 'display_matches_response').status, 'pass');
  assert.equal(browser.product_checks.find((check) => check.id === 'mode_controls_ui').status, 'pass');
});

test('browser mismatches fail their product checks and input mismatch blocks behavior evaluation', async () => {
  const exactInput = {
    scenario_context: caseDefinition.input.scenario_context,
    conversation_history: caseDefinition.input.conversation_history,
    student_message: caseDefinition.input.student_message,
    configured_role: caseDefinition.role,
    detection_areas: caseDefinition.inventory.detection_areas,
    verification_steps: caseDefinition.inventory.verification_steps,
    prior_mode: 'unknown'
  };
  const baseCapture = {
    case_id: caseDefinition.id,
    request_equivalent: true,
    product_input: exactInput,
    target_attempts: [{ sequence: 1, raw_output: rawOutput, parser_status: 'accepted', parsed_decision: parsedOutput }],
    displayed_suggestion: JSON.parse(rawOutput).response,
    displayed_mode: 'tutoring'
  };
  const inputMismatch = await evaluateBrowserCapture({
    caseDefinition,
    capture: {
      ...baseCapture,
      product_input: { ...exactInput, student_message: 'A different learner message.' }
    },
    contractVersion: 'v2',
    settings,
    judgeCall: async () => assert.fail('input mismatch must block judge calls'),
    replayEvidence: null
  });
  assert.equal(inputMismatch.product_checks.find((check) => check.id === 'input_equivalence').status, 'fail');
  assert.equal(inputMismatch.behavior_checks, null);

  const requestMismatch = await evaluateBrowserCapture({
    caseDefinition,
    capture: { ...baseCapture, request_equivalent: false },
    contractVersion: 'v2',
    settings,
    judgeCall: async () => assert.fail('captured request mismatch must block judge calls'),
    replayEvidence: null
  });
  assert.equal(requestMismatch.product_checks.find((check) => check.id === 'production_request_equivalence').status, 'fail');
  assert.equal(requestMismatch.behavior_checks, null);

  const displayMismatch = await evaluateBrowserCapture({
    caseDefinition,
    capture: { ...baseCapture, displayed_suggestion: 'Different text shown in the UI.' },
    contractVersion: 'v2',
    settings,
    judgeCall: makeJudgeCall(),
    replayEvidence: null
  });
  assert.equal(displayMismatch.product_checks.find((check) => check.id === 'display_matches_response').status, 'fail');

  const modeMismatch = await evaluateBrowserCapture({
    caseDefinition,
    capture: { ...baseCapture, displayed_mode: 'guard' },
    contractVersion: 'v2',
    settings,
    judgeCall: makeJudgeCall(),
    replayEvidence: null
  });
  assert.equal(modeMismatch.product_checks.find((check) => check.id === 'mode_controls_ui').status, 'fail');
});

test('browser artifacts omit transport secrets and block evaluation when a configured secret reaches a body', async () => {
  const configuredSecret = 'configured-secret-value';
  let judgeCalls = 0;
  const result = await evaluateBrowserCapture({
    caseDefinition,
    capture: {
      case_id: caseDefinition.id,
      request_equivalent: true,
      product_input: {
        scenario_context: caseDefinition.input.scenario_context,
        conversation_history: caseDefinition.input.conversation_history,
        student_message: caseDefinition.input.student_message,
        configured_role: caseDefinition.role,
        detection_areas: caseDefinition.inventory.detection_areas,
        verification_steps: caseDefinition.inventory.verification_steps,
        prior_mode: 'unknown'
      },
      request_headers: { authorization: `Bearer ${configuredSecret}` },
      cookies: [{ value: configuredSecret }],
      browser_storage: { apiKey: configuredSecret },
      target_attempts: [{
        sequence: 1,
        request_body: { [configuredSecret]: 'secret-key-name', messages: [{ role: 'user', content: configuredSecret }] },
        response_body: { choices: [] },
        raw_output: rawOutput,
        parser_status: 'accepted',
        parsed_decision: parsedOutput
      }],
      displayed_suggestion: JSON.parse(rawOutput).response,
      displayed_mode: 'tutoring'
    },
    contractVersion: 'v2',
    settings,
    judgeCall: async () => {
      judgeCalls += 1;
      throw new Error('secret-leaking capture must not be judged');
    },
    replayEvidence: null,
    configuredSecrets: [configuredSecret]
  });

  const artifact = JSON.stringify(result);
  assert.equal(artifact.includes(configuredSecret), false);
  assert.equal(Object.hasOwn(result.capture, 'request_headers'), false);
  assert.equal(Object.hasOwn(result.capture, 'cookies'), false);
  assert.equal(Object.hasOwn(result.capture, 'browser_storage'), false);
  assert.equal(result.target_attempts[0].request_body.messages[0].content, '[REDACTED]');
  assert.equal(result.product_checks.find((check) => check.id === 'no_prohibited_secret_data').status, 'fail');
  assert.equal(result.behavior_checks, null);
  assert.equal(judgeCalls, 0);

  const withPersistence = appendPersistenceEvidence(
    result,
    { [configuredSecret]: 'secret-key-name', ai_suggestion: configuredSecret },
    [configuredSecret]
  );
  assert.equal(JSON.stringify(withPersistence).includes(configuredSecret), false);
  assert.equal(withPersistence.behavior_checks, null);
  assert.equal(withPersistence.product_checks.find((check) => check.id === 'no_prohibited_secret_data').status, 'fail');

  const failedAfterCapture = appendProductFailure(
    {
      ...result,
      behavior_checks: { results: [{ metric: 'contract_validity', status: 'pass' }] }
    },
    new Error(`Persistence failed near ${configuredSecret}`),
    { failure: 'screenshots/failure.png' },
    [configuredSecret]
  );
  assert.equal(failedAfterCapture.target_attempts.length, 1);
  assert.equal(failedAfterCapture.behavior_checks.results[0].metric, 'contract_validity');
  assert.equal(failedAfterCapture.product_checks.find((check) => check.id === 'post_capture_product_path').status, 'fail');
  assert.equal(JSON.stringify(failedAfterCapture).includes(configuredSecret), false);
});

test('room visibility requires scenario and every seeded conversation line', () => {
  const required = ['Scenario context', 'Tutor: First prompt', 'Student: Latest answer'];
  assert.equal(roomContentVisible(required.join('\n'), required), true);
  assert.equal(roomContentVisible('Scenario context\nStudent: Latest answer', required), false);
});

test('behavior completeness requires every canonical and applicable legacy result', () => {
  const complete = {
    results: [
      ...caseDefinition.expected.checks.map((metric) => ({ metric, status: 'pass' })),
      { metric: 'v0:response_length', status: 'pass' }
    ]
  };
  assert.equal(behaviorChecksComplete(complete, caseDefinition), true);
  assert.equal(behaviorChecksComplete({ results: complete.results.slice(1) }, caseDefinition), false);
  assert.equal(behaviorChecksComplete({ results: complete.results.slice(0, -1) }, caseDefinition), false);
  assert.equal(behaviorChecksComplete({ results: [{ metric: 'contract_validity', status: 'error' }] }, caseDefinition), false);
});

test('browser adapter uses the production parser normalization for display verification', async () => {
  const rawWithWhitespace = JSON.stringify({
    reason: '  Concise observable reason.  ',
    decision: { mode: 'tutoring', instruction: 'protective_instruction' },
    response: '  Do not click it. Open the real app.  '
  });
  const normalizedByProductionParser = {
    reason: 'Concise observable reason.',
    decision: { mode: 'tutoring', instruction: 'protective_instruction' },
    response: 'Do not click it. Open the real app.'
  };
  const result = await evaluateBrowserCapture({
    caseDefinition,
    capture: {
      case_id: caseDefinition.id,
      request_equivalent: true,
      product_input: {
        scenario_context: caseDefinition.input.scenario_context,
        conversation_history: caseDefinition.input.conversation_history,
        student_message: caseDefinition.input.student_message,
        configured_role: caseDefinition.role,
        detection_areas: caseDefinition.inventory.detection_areas,
        verification_steps: caseDefinition.inventory.verification_steps,
        prior_mode: 'unknown'
      },
      target_attempts: [{
        sequence: 1,
        raw_output: rawWithWhitespace,
        parser_status: 'accepted',
        parsed_decision: normalizedByProductionParser
      }],
      displayed_suggestion: normalizedByProductionParser.response,
      displayed_mode: 'tutoring'
    },
    contractVersion: 'v2',
    settings,
    judgeCall: makeJudgeCall(),
    replayEvidence: null
  });

  assert.deepEqual(result.parsed_decision, normalizedByProductionParser);
  assert.equal(result.product_checks.find((check) => check.id === 'display_matches_response').status, 'pass');
});

test('final decision selection returns the exact last production-parser result', () => {
  const firstParsed = { reason: 'first', decision: { mode: 'guard', instruction: null }, response: 'first' };
  const finalParsed = { reason: 'final', decision: { mode: 'tutoring', instruction: 'correction' }, response: 'final' };
  const firstAttempt = { sequence: 1, parser_status: 'accepted', parsed_decision: firstParsed };
  const rejectedAttempt = { sequence: 2, parser_status: 'rejected', parsed_decision: null };
  const finalAttempt = { sequence: 3, parser_status: 'accepted', parsed_decision: finalParsed };

  const selected = selectFinalProductionDecision([firstAttempt, rejectedAttempt, finalAttempt]);
  assert.equal(selected.finalAttempt, finalAttempt);
  assert.equal(selected.parsed, finalParsed);
});

test('product completeness requires each canonical product check exactly once and passing', () => {
  const expectedIds = [
    'case_id',
    'input_equivalence',
    'production_request_equivalence',
    'provider_response_captured',
    'parser_accepted',
    'display_matches_response',
    'mode_controls_ui',
    'repair_attempts_preserved',
    'no_prohibited_secret_data',
    'correct_template',
    'seeded_room_visible',
    'production_request_fields',
    'evaluator_labels_absent',
    'review_reached_persistence',
    'persisted_decision_matches'
  ];
  assert.deepEqual(REQUIRED_PRODUCT_CHECK_IDS, expectedIds);
  const complete = expectedIds.map((id) => ({ id, status: 'pass' }));
  assert.equal(productChecksComplete(complete), true);
  assert.equal(productChecksComplete(complete.slice(1)), false);
  assert.equal(productChecksComplete([...complete, complete[0]]), false);
  assert.equal(productChecksComplete(complete.map((item, index) =>
    index === 0 ? { ...item, status: 'fail' } : item
  )), false);
});

test('target-request label detection catches serialized expectations without matching ordinary prose', () => {
  const browserScript = require(path.resolve(
    __dirname,
    '../../../tutor-system/scripts/browser-demo-tutor-behavior.js'
  ));
  assert.equal(browserScript.containsEvaluatorLabels([{
    request_body: { messages: [{ role: 'user', content: '{"expected":{"mode":"guard"}}' }] }
  }]), true);
  assert.equal(browserScript.containsEvaluatorLabels([{
    request_body: { messages: [{ role: 'user', content: '{"expected":{"instruction":null}}' }] }
  }]), true);
  assert.equal(browserScript.containsEvaluatorLabels([{
    request_body: { messages: [{ role: 'system', content: 'A serious response is expected.' }] }
  }]), false);
});

test('browser teardown converts close rejection into fatal evidence without replacing an earlier fatal error', async () => {
  const browserScript = require(path.resolve(
    __dirname,
    '../../../tutor-system/scripts/browser-demo-tutor-behavior.js'
  ));
  const closeError = new Error('browser close failed');
  const browser = { close: async () => { throw closeError; } };

  assert.equal(await browserScript.closeBrowserPreservingFatal(browser, null), closeError);

  const earlierError = new Error('room execution failed');
  assert.equal(await browserScript.closeBrowserPreservingFatal(browser, earlierError), earlierError);
  assert.equal(await browserScript.closeBrowserPreservingFatal(null, earlierError), earlierError);
});

test('failure screenshot helper records only a successfully written case artifact', async () => {
  const browserScript = require(path.resolve(
    __dirname,
    '../../../tutor-system/scripts/browser-demo-tutor-behavior.js'
  ));
  const calls = [];
  const page = { screenshot: async (options) => { calls.push(options); } };

  const saved = await browserScript.captureFailureScreenshot(
    page,
    '/tmp/web-run/screenshots',
    'case-one'
  );
  assert.equal(saved, 'screenshots/case-one-failure.png');
  assert.deepEqual(calls, [{ path: '/tmp/web-run/screenshots/case-one-failure.png', fullPage: true }]);

  const unavailable = await browserScript.captureFailureScreenshot(
    { screenshot: async () => { throw new Error('page closed'); } },
    '/tmp/web-run/screenshots',
    'case-two'
  );
  assert.equal(unavailable, null);
});

test('browser orchestration preserves production-parser order, cleanup, complete metrics, and untracked tree evidence', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../../tutor-system/scripts/browser-demo-tutor-behavior.js'),
    'utf8'
  );

  assert.match(source, /parseTutorDecision/);
  assert.match(source, /const parsedDecision = parseTutorDecision\(rawOutput\);[\s\S]*?Object\.assign\(attempt, \{ parser_status: 'accepted', parsed_decision: parsedDecision \}\)/);
  assert.match(source, /let sequence = [^;]+;[\s\S]*?await response\.text\(\)/);
  assert.match(source, /sequence \+= 1[\s\S]*?sequence,[\s\S]*?try \{[\s\S]*?parseTutorDecision\(rawOutput\)[\s\S]*?parser_status: 'accepted'[\s\S]*?catch[\s\S]*?parser_status: 'rejected'/);
  assert.match(source, /try \{[\s\S]*?generateSuggestion\(page\)[\s\S]*?\} finally \{[\s\S]*?stopCapture\(\)/);
  assert.match(source, /request_equivalent: exactRequestMatches\(attempts, seed, derivedInput\)/);
  assert.match(source, /async function readSeededRoom\(page, seed\)/);
  assert.match(source, /await page\.locator\('\.room-post'\)\.waitFor\(\{ state: 'visible', timeout: TIMEOUT \}\)/);
  assert.match(source, /await page\.locator\('\.comments-list'\)\.waitFor\(\{ state: 'visible', timeout: TIMEOUT \}\)/);
  assert.match(source, /const \{ visible: roomVisible \} = await readSeededRoom\(page, seed\)/);
  assert.match(source, /if \(generationError\) \{\s*const failureScreenshot = await captureFailureScreenshot\(page, screenshotDir, caseDefinition\.id\);[\s\S]*?appendProductFailure\([\s\S]*?generationError,\s*failureScreenshot \? \{ failure: failureScreenshot \} : \{\},\s*secrets\)/);
  assert.match(source, /appendProductFailure\(evaluated,/);
  assert.match(source, /behaviorComplete = records\.every\([^;]+behaviorChecksComplete\(record\.behavior_checks, byId\.get\(ids\[index\]\)\)/);
  assert.match(source, /\['ls-files', '--others', '--exclude-standard'\]/);
  assert.match(source, /untracked[\s\S]*?readFileSync/);
  assert.match(source, /dirty_tree_hash: sha\(`\$\{gitStatus\}\\n\$\{gitDiff\}\\n\$\{untrackedContents\}`\)/);
  assert.match(source, /fatal_error/);
  assert.match(source, /finally \{\s*fatalError = await closeBrowserPreservingFatal\(browser, fatalError\);\s*\}/);
  assert.match(source, /const report = \{[\s\S]*?fatal_error: safeFatalError[\s\S]*?\};[\s\S]*?const verdict = \{[\s\S]*?fatal_error: safeFatalError[\s\S]*?\};[\s\S]*?writeNew\(path\.join\(runDir, 'report\.json'\), report\)[\s\S]*?writeNew\(path\.join\(runDir, 'verdict\.json'\), verdict\)/);
  assert.match(source, /const productComplete = !fatalError\s*&& records\.length === 7/);
  assert.match(source, /records\.every\(\(record\) => productChecksComplete\(record\.product_checks\)\)/);
  assert.doesNotMatch(source, /behavior_evaluation/);

  const adapterSource = fs.readFileSync(path.resolve(__dirname, 'browser-adapter.js'), 'utf8');
  assert.match(adapterSource, /const \{ finalAttempt, parsed \} = selectFinalProductionDecision\(targetAttempts\);/);
});

#!/usr/bin/env node
// Purpose: validate preserved browser-product evidence and delegate its final parser-accepted raw tutor output to the canonical evaluator.
'use strict';

const { evaluateGeneratedOutput } = require('./evaluator');

const REQUIRED_PRODUCT_CHECK_IDS = [
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

function normalizedPriorMode(value) {
  return value === null || value === undefined || value === 'unknown' ? 'unknown' : value;
}

function expectedProductInput(caseDefinition) {
  return {
    scenario_context: caseDefinition.input.scenario_context,
    conversation_history: caseDefinition.input.conversation_history,
    student_message: caseDefinition.input.student_message,
    configured_role: caseDefinition.role,
    detection_areas: caseDefinition.inventory.detection_areas,
    verification_steps: caseDefinition.inventory.verification_steps,
    prior_mode: normalizedPriorMode(caseDefinition.input.prior_mode)
  };
}

function comparableProductInput(value) {
  return {
    scenario_context: value?.scenario_context,
    conversation_history: value?.conversation_history,
    student_message: value?.student_message,
    configured_role: value?.configured_role,
    detection_areas: value?.detection_areas,
    verification_steps: value?.verification_steps,
    prior_mode: normalizedPriorMode(value?.prior_mode)
  };
}

function check(id, passed, reason) {
  return {
    id,
    method: 'product_verification',
    status: passed ? 'pass' : 'fail',
    pass: passed,
    reason
  };
}

function redactSecrets(value, configuredSecrets) {
  if (typeof value === 'string') {
    return configuredSecrets.reduce(
      (text, secret) => secret ? text.split(secret).join('[REDACTED]') : text,
      value
    );
  }
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, configuredSecrets));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(
      ([key, item]) => [redactSecrets(key, configuredSecrets), redactSecrets(item, configuredSecrets)]
    ));
  }
  return value;
}

function sanitizeCapture(capture, configuredSecrets) {
  const secrets = configuredSecrets.filter((secret) => typeof secret === 'string' && secret.length > 0);
  const prohibitedSecretFound = secrets.some((secret) => JSON.stringify(capture).includes(secret));
  const projected = {
    case_id: capture.case_id,
    template_id: capture.template_id,
    room_id: capture.room_id,
    request_equivalent: capture.request_equivalent,
    product_input: capture.product_input,
    target_attempts: Array.isArray(capture.target_attempts)
      ? capture.target_attempts.map((attempt) => ({
        sequence: attempt.sequence,
        request_body: attempt.request_body,
        response_body: attempt.response_body,
        raw_output: attempt.raw_output,
        parser_status: attempt.parser_status,
        parsed_decision: attempt.parsed_decision
      }))
      : [],
    displayed_suggestion: capture.displayed_suggestion,
    displayed_mode: capture.displayed_mode,
    screenshots: capture.screenshots
  };
  return {
    capture: redactSecrets(projected, secrets),
    prohibitedSecretFound
  };
}

function sanitizeArtifact(value, configuredSecrets) {
  const secrets = configuredSecrets.filter((secret) => typeof secret === 'string' && secret.length > 0);
  return {
    value: redactSecrets(value, secrets),
    prohibitedSecretFound: secrets.some((secret) => JSON.stringify(value).includes(secret))
  };
}

function markSecretFailure(artifact) {
  const checkResult = artifact.product_checks.find((entry) => entry.id === 'no_prohibited_secret_data');
  if (checkResult) {
    Object.assign(checkResult, {
      status: 'fail',
      pass: false,
      reason: 'A configured secret was removed from artifact evidence.'
    });
  }
  return artifact;
}

function appendPersistenceEvidence(evaluation, persistenceEvidence, configuredSecrets = []) {
  const sanitized = sanitizeArtifact({ ...evaluation, persistence_evidence: persistenceEvidence }, configuredSecrets);
  return sanitized.prohibitedSecretFound ? markSecretFailure(sanitized.value) : sanitized.value;
}

function appendProductFailure(evaluation, error, screenshots = {}, configuredSecrets = []) {
  const failed = {
    ...evaluation,
    capture: {
      ...(evaluation.capture || {}),
      screenshots: { ...(evaluation.capture?.screenshots || {}), ...screenshots }
    },
    product_checks: [
      ...(evaluation.product_checks || []),
      check('post_capture_product_path', false, error instanceof Error ? error.message : String(error))
    ],
    error: error instanceof Error ? error.message : String(error)
  };
  const sanitized = sanitizeArtifact(failed, configuredSecrets);
  return sanitized.prohibitedSecretFound ? markSecretFailure(sanitized.value) : sanitized.value;
}

function roomContentVisible(body, requiredStrings) {
  return requiredStrings.every((value) => typeof value === 'string' && value.length > 0 && body.includes(value));
}

function behaviorChecksComplete(evaluation, caseDefinition) {
  if (!evaluation || !Array.isArray(evaluation.results)) return false;
  const results = new Map(evaluation.results.map((result) => [result.metric, result]));
  const required = [
    ...caseDefinition.expected.checks,
    ...(caseDefinition.legacy || []).map((entry) => entry.id)
  ];
  return required.every((metric) => {
    const result = results.get(metric);
    return result && !['missing', 'error'].includes(result.status);
  });
}

function productChecksComplete(checks) {
  if (!Array.isArray(checks)) return false;
  const ids = checks.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) return false;
  return checks.every((entry) => entry.status === 'pass')
    && REQUIRED_PRODUCT_CHECK_IDS.every((id) => ids.includes(id));
}

function selectFinalProductionDecision(targetAttempts) {
  const finalAttempt = targetAttempts.filter((attempt) =>
    attempt.parser_status === 'accepted' && attempt.parsed_decision
  ).at(-1) || null;
  return { finalAttempt, parsed: finalAttempt?.parsed_decision || null };
}

async function evaluateBrowserCapture({
  caseDefinition,
  capture,
  contractVersion,
  settings,
  judgeCall,
  replayEvidence,
  configuredSecrets = []
}) {
  const sanitized = sanitizeCapture(capture, configuredSecrets);
  const safeCapture = sanitized.capture;
  const targetAttempts = safeCapture.target_attempts;
  const { finalAttempt, parsed } = selectFinalProductionDecision(targetAttempts);
  const expectedInput = expectedProductInput(caseDefinition);
  const actualInput = comparableProductInput(safeCapture.product_input);
  const inputMatches = JSON.stringify(actualInput) === JSON.stringify(expectedInput);
  const requestEquivalent = safeCapture.request_equivalent === true;
  const productChecks = [
    check(
      'case_id',
      safeCapture.case_id === caseDefinition.id,
      safeCapture.case_id === caseDefinition.id ? 'Stable case_id matches.' : 'Captured case_id differs.'
    ),
    check(
      'input_equivalence',
      inputMatches,
      inputMatches ? 'Captured product input matches the frozen case.' : 'Captured product input differs from the frozen case.'
    ),
    check(
      'production_request_equivalence',
      requestEquivalent,
      requestEquivalent ? 'Captured production request matches its frozen product input.' : 'Captured production request differs from its frozen product input.'
    ),
    check(
      'provider_response_captured',
      targetAttempts.length > 0,
      targetAttempts.length > 0 ? 'Provider attempts are preserved.' : 'No provider response was captured.'
    ),
    check(
      'parser_accepted',
      Boolean(parsed),
      parsed ? 'A final valid v2 output was accepted.' : 'No final valid v2 output was accepted.'
    ),
    check(
      'display_matches_response',
      Boolean(parsed && safeCapture.displayed_suggestion === parsed.response),
      parsed && safeCapture.displayed_suggestion === parsed.response
        ? 'Displayed suggestion exactly matches parsed response.'
        : 'Displayed suggestion differs from parsed response.'
    ),
    check(
      'mode_controls_ui',
      Boolean(parsed && safeCapture.displayed_mode === parsed.decision.mode),
      parsed && safeCapture.displayed_mode === parsed.decision.mode
        ? 'Guard UI state matches the parsed mode.'
        : 'Guard UI state differs from the parsed mode.'
    ),
    check(
      'repair_attempts_preserved',
      targetAttempts.every((attempt, index) => attempt.sequence === index + 1),
      'Captured attempts retain provider order.'
    ),
    check(
      'no_prohibited_secret_data',
      !sanitized.prohibitedSecretFound,
      sanitized.prohibitedSecretFound
        ? 'A configured secret was removed from capture evidence.'
        : 'Capture evidence contains no configured secret.'
    )
  ];

  let behaviorChecks = null;
  if (inputMatches && requestEquivalent && finalAttempt && !sanitized.prohibitedSecretFound) {
    behaviorChecks = await evaluateGeneratedOutput({
      caseDefinition,
      rawOutput: finalAttempt.raw_output,
      contractVersion,
      settings,
      judgeCall,
      replayEvidence
    });
  }

  return {
    capture: safeCapture,
    target_attempts: targetAttempts,
    final_raw_output: finalAttempt?.raw_output || null,
    parsed_decision: parsed,
    product_checks: productChecks,
    behavior_checks: behaviorChecks
  };
}

module.exports = {
  normalizedPriorMode,
  expectedProductInput,
  comparableProductInput,
  REQUIRED_PRODUCT_CHECK_IDS,
  productChecksComplete,
  selectFinalProductionDecision,
  redactSecrets,
  sanitizeCapture,
  sanitizeArtifact,
  appendPersistenceEvidence,
  appendProductFailure,
  roomContentVisible,
  behaviorChecksComplete,
  evaluateBrowserCapture
};

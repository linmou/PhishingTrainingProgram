#!/usr/bin/env node
// Purpose: score explicit v1 tutor decisions independently from schema validity and semantic response quality.

'use strict';

const MODES = ['tutoring', 'guard'];
const INSTRUCTIONS = [
  'protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', null
];

function result(metric, status, reason, expected, actual) {
  return {
    metric, method: 'deterministic', status,
    pass: status === 'pass', score: status === 'pass' ? 1 : 0,
    reason, expected: expected === undefined ? null : expected, actual: actual === undefined ? null : actual
  };
}

function parse(output) {
  if (output === undefined || output === null || output === '') {
    return { status: 'missing', reason: 'Target output is missing.' };
  }
  if (typeof output !== 'string') {
    return { status: 'error', reason: 'Expected preserved raw JSON text.' };
  }
  try {
    const value = JSON.parse(output);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { status: 'error', reason: 'Target output must be a JSON object.' };
    }
    return { value };
  } catch {
    return { status: 'error', reason: 'Target output is not valid JSON.' };
  }
}

function compare(output, context, metric, expectedKey, allowed, select) {
  const parsed = parse(output);
  if (!parsed.value) return result(metric, parsed.status, parsed.reason, undefined, undefined);
  const actual = select(parsed.value);
  const expected = context?.vars?.[expectedKey];
  if (!allowed.includes(actual)) {
    return result(metric, 'error', 'Decision field is missing or has an invalid type/value.', expected, actual);
  }
  if (expected === undefined) {
    return result(metric, 'missing', `Missing reviewed ${expectedKey} label/set.`, expected, actual);
  }
  const accepted = Array.isArray(expected) ? expected : [expected];
  if (!accepted.length || accepted.some(value => !allowed.includes(value))) {
    return result(metric, 'error', `Invalid ${expectedKey} label/set.`, expected, actual);
  }
  const passed = accepted.includes(actual);
  return result(metric, passed ? 'pass' : 'fail',
    passed ? 'Decision belongs to the reviewed allowed set.' : 'Valid decision is outside the reviewed allowed set.',
    accepted, actual);
}

function modeSelection(output, context) {
  return compare(output, context, 'mode_selection', 'expected_mode', MODES, value => value.mode);
}

function modeSelectionV2(output, context) {
  return compare(output, context, 'mode_selection', 'expected_mode', MODES,
    value => value.decision && !Array.isArray(value.decision) && typeof value.decision === 'object'
      ? value.decision.mode : undefined);
}

function instructionSelection(output, context) {
  return compare(output, context, 'instruction_selection', 'expected_instruction', INSTRUCTIONS,
    value => value.decision && !Array.isArray(value.decision) && typeof value.decision === 'object'
      ? value.decision.instruction : undefined);
}

function instructionSelectionV2(output, context) {
  return compare(output, context, 'instruction_selection', 'expected_instruction', INSTRUCTIONS,
    value => value.decision && !Array.isArray(value.decision) && typeof value.decision === 'object'
      ? value.decision.instruction : undefined);
}

function contractValidity(output) {
  const parsed = parse(output);
  if (!parsed.value) return result('contract_validity', parsed.status, parsed.reason, 'v1 contract', undefined);
  const value = parsed.value;
  const issues = [];
  for (const field of ['reasoning', 'mode_reason', 'suggested_response']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) issues.push(`${field} must be a non-empty string`);
  }
  // Inspect serialized order, not Object.keys ordering of numeric extra properties.
  const first = output.match(/^\s*\{\s*("(?:[^"\\]|\\.)*")\s*:/);
  if (!first || JSON.parse(first[1]) !== 'reasoning') issues.push('reasoning must be serialized first');
  if (!MODES.includes(value.mode)) issues.push('mode must be tutoring or guard');
  const decision = value.decision;
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    issues.push('decision must be an object');
  } else if (!INSTRUCTIONS.includes(decision.instruction)) {
    issues.push('decision.instruction is missing or invalid');
  } else if (decision.instruction === null && value.mode !== 'guard') {
    issues.push('null instruction is allowed only in Guard');
  }
  return result('contract_validity', issues.length ? 'error' : 'pass',
    issues.length ? issues.join('; ') : 'Valid v1 object; semantic correctness is checked separately.',
    'v1 contract', value);
}

function contractValidityV2(output) {
  const parsed = parse(output);
  if (!parsed.value) return result('contract_validity', parsed.status, parsed.reason, 'v2 contract', undefined);
  const value = parsed.value;
  const issues = [];
  for (const field of ['reason', 'response']) {
    if (typeof value[field] !== 'string' || !value[field].trim()) issues.push(`${field} must be a non-empty string`);
  }
  const first = output.match(/^\s*\{\s*("(?:[^"\\]|\\.)*")\s*:/);
  if (!first || JSON.parse(first[1]) !== 'reason') issues.push('reason must be serialized first');
  if ('mode' in value || 'mode_reason' in value) issues.push('mode and mode_reason must be nested under decision');
  const decision = value.decision;
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    issues.push('decision must be an object');
  } else {
    if (!MODES.includes(decision.mode)) issues.push('decision.mode must be tutoring or guard');
    if (!INSTRUCTIONS.includes(decision.instruction)) issues.push('decision.instruction is missing or invalid');
    if (INSTRUCTIONS.includes(decision.instruction) && decision.instruction === null && decision.mode !== 'guard') {
      issues.push('null instruction is allowed only in Guard');
    }
  }
  return result('contract_validity', issues.length ? 'error' : 'pass',
    issues.length ? issues.join('; ') : 'Valid v2 object; semantic correctness is checked separately.',
    'v2 contract', value);
}

module.exports = { modeSelection, instructionSelection, contractValidity, modeSelectionV2, instructionSelectionV2, contractValidityV2 };

#!/usr/bin/env node
// Purpose: case-schema.js validates the frozen transfer case contract: required fields, enum membership, evaluator-label isolation from the target input, pair cardinality, holdout exposure, and transition step completeness.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const schema = require('./case-schema.json');

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;

function error(path_, code, detail = {}) {
  return { path: path_, error: code, status: 'error', ...detail };
}

function walkForbiddenKeys(value, forbidden, prefix) {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...walkForbiddenKeys(item, forbidden, `${prefix}[${index}]`)));
    return found;
  }
  if (!isPlainObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (forbidden.includes(key)) found.push(error(childPath, 'forbidden_metadata'));
    found.push(...walkForbiddenKeys(child, forbidden, childPath));
  }
  return found;
}

function validateInput(input) {
  const errors = [];
  if (!isPlainObject(input)) return [error('input', 'missing_field')];
  for (const field of schema.input.required_fields) {
    if (input[field] === undefined || input[field] === null && field !== 'unresolved_assessment') {
      errors.push(error(`input.${field}`, 'missing_field'));
    }
  }
  if (isPlainObject(input.focus_student_message)) {
    for (const field of schema.input.focus_student_message_required_fields) {
      if (input.focus_student_message[field] === undefined) errors.push(error(`input.focus_student_message.${field}`, 'missing_field'));
    }
    if (input.focus_student_message.user_role !== 'student') errors.push(error('input.focus_student_message.user_role', 'invalid_role'));
  }
  if (input.prior_participation_mode !== undefined && !schema.input.prior_participation_modes.includes(input.prior_participation_mode)) {
    errors.push(error('input.prior_participation_mode', 'invalid_enum'));
  }
  return [...errors, ...walkForbiddenKeys(input, schema.input.forbidden_keys, 'input')];
}

function validateEvaluator(evaluator) {
  if (!isPlainObject(evaluator)) return [error('evaluator', 'missing_field')];
  return schema.evaluator.required_fields
    .filter(field => {
      const value = evaluator[field];
      if (value === undefined || value === null) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      return Array.isArray(value) && value.length === 0;
    })
    .map(field => error(`evaluator.${field}`, 'missing_field'));
}

function validateTransition(transition) {
  const errors = [];
  if (!isPlainObject(transition)) return [error('transition', 'missing_field')];
  for (const field of schema.transition.required_fields) {
    if (transition[field] === undefined) errors.push(error(`transition.${field}`, 'missing_field'));
  }
  if (Array.isArray(transition.steps)) {
    if (transition.steps.length === 0) errors.push(error('transition.steps', 'empty_sequence'));
    transition.steps.forEach((step, index) => {
      for (const field of schema.transition.step_required_fields) {
        if (!isPlainObject(step) || step[field] === undefined) errors.push(error(`transition.steps[${index}].${field}`, 'missing_field'));
      }
    });
  }
  return errors;
}

function validateHoldout(holdout) {
  if (!isPlainObject(holdout)) return [error('holdout_eligibility', 'missing_field')];
  const errors = schema.holdout_eligibility.required_fields
    .filter(field => holdout[field] === undefined)
    .map(field => error(`holdout_eligibility.${field}`, 'missing_field'));
  if (holdout.eligible === true) {
    for (const field of ['prompt_exposure', 'development_exposure']) {
      if (holdout[field] !== false) errors.push(error(`holdout_eligibility.${field}`, 'exposed_holdout'));
    }
    if (holdout.author_independent !== true) errors.push(error('holdout_eligibility.author_independent', 'exposed_holdout'));
  }
  return errors;
}

function validatePair(pair) {
  if (pair === null || pair === undefined) return [];
  if (!isPlainObject(pair)) return [error('pair', 'invalid_pair')];
  const errors = [];
  for (const field of schema.pair.required_fields) {
    if (!isNonEmptyString(pair[field])) errors.push(error(`pair.${field}`, 'missing_field'));
  }
  if (pair.member !== undefined && !schema.pair.member_values.includes(pair.member)) errors.push(error('pair.member', 'invalid_enum'));
  return errors;
}

function validateCase(definition) {
  if (!isPlainObject(definition)) return [error('case', 'missing_field')];
  const errors = [];
  for (const field of schema.required_fields) {
    if (definition[field] === undefined) errors.push(error(field, 'missing_field'));
  }
  if (definition.case_id !== undefined && !isNonEmptyString(definition.case_id)) errors.push(error('case_id', 'invalid_identity'));
  if (definition.case_version !== undefined && !Number.isInteger(definition.case_version)) errors.push(error('case_version', 'invalid_version'));
  if (definition.source_type !== undefined && !schema.source_types.includes(definition.source_type)) errors.push(error('source_type', 'invalid_enum'));
  if (definition.case_role !== undefined && !schema.case_roles.includes(definition.case_role)) errors.push(error('case_role', 'invalid_enum'));
  if (definition.partition !== undefined && !schema.partitions.includes(definition.partition)) errors.push(error('partition', 'invalid_enum'));
  if (definition.source_provenance !== undefined) {
    if (!isPlainObject(definition.source_provenance)) errors.push(error('source_provenance', 'missing_field'));
    else {
      for (const field of ['source_record_id', 'revision', 'author', 'changed_field_rationale', 'redaction_status', 'prompt_exposure', 'development_exposure']) {
        if (definition.source_provenance[field] === undefined) errors.push(error(`source_provenance.${field}`, 'missing_field'));
      }
    }
  }
  return [
    ...errors,
    ...validateInput(definition.input),
    ...validateEvaluator(definition.evaluator),
    ...validatePair(definition.pair),
    ...(definition.transition === null || definition.transition === undefined ? [] : validateTransition(definition.transition)),
    ...validateHoldout(definition.holdout_eligibility)
  ];
}

function validateCases(cases) {
  const errors = [];
  const seen = new Set();
  for (const definition of cases) {
    for (const item of validateCase(definition)) errors.push({ ...item, case_id: definition.case_id });
    if (seen.has(definition.case_id)) errors.push(error('case_id', 'duplicate_case', { case_id: definition.case_id, status: 'error' }));
    seen.add(definition.case_id);
  }
  const pairs = new Map();
  for (const definition of cases) {
    if (!definition.pair || !isPlainObject(definition.pair)) continue;
    if (!pairs.has(definition.pair.pair_id)) pairs.set(definition.pair.pair_id, []);
    pairs.get(definition.pair.pair_id).push(definition);
  }
  for (const [pairId, members] of pairs) {
    if (members.length !== schema.pair.members_per_pair) {
      errors.push(error(`pair[${pairId}].members`, 'invalid_pair_cardinality', { expected: schema.pair.members_per_pair, actual: members.length, status: 'error' }));
      continue;
    }
    const factors = new Set(members.map(member => member.pair.changed_factor));
    if (factors.size < members.length) errors.push(error(`pair[${pairId}].changed_factor`, 'pair_factor_identity', { actual: [...factors] }));
    const contrasts = new Set(members.map(member => member.pair.expected_contrast));
    if (contrasts.size < 2) errors.push(error(`pair[${pairId}].expected_contrast`, 'pair_contrast_identity', { actual: [...contrasts] }));
  }
  return errors;
}

function loadCases(file) {
  return JSON.parse(fs.readFileSync(file || path.join(__dirname, 'cases.json'), 'utf8'));
}

module.exports = { validateCase, validateCases, loadCases, walkForbiddenKeys };

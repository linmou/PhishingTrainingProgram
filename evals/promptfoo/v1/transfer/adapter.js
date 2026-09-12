#!/usr/bin/env node
// Purpose: adapter.js is the thin transfer target adapter: it projects only target-visible case fields into the component-102-owned v3 builder, refuses evaluator-only metadata, and declares its own budget and thinking flag from the frozen manifest instead of inheriting legacy v1 settings.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { loadSharedRequestContract, transferTargetSettings } = require('./shared-request-contract');
const caseSchema = require('./case-schema.json');

const EVALUATOR_ONLY_KEYS = [...new Set([
  ...caseSchema.input.forbidden_keys,
  'evaluator',
  'source_provenance',
  'holdout_eligibility',
  'transition'
])];

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function findForbiddenKeys(value, prefix) {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...findForbiddenKeys(item, `${prefix}[${index}]`)));
    return found;
  }
  if (!isPlainObject(value)) return found;
  for (const [key, child] of Object.entries(value)) {
    const childPath = prefix ? `${prefix}.${key}` : key;
    if (EVALUATOR_ONLY_KEYS.includes(key)) found.push(childPath);
    found.push(...findForbiddenKeys(child, childPath));
  }
  return found;
}

function projectContextInput(definition) {
  if (!isPlainObject(definition)) throw new Error('adapter: a case definition is required');
  if (!isPlainObject(definition.input)) throw new Error('adapter: the case has no target input projection');
  for (const key of ['evaluator', 'expected', 'rubric_annotations', 'gate_thresholds', 'metric_ids', 'prohibited']) {
    if (definition.input[key] !== undefined) throw new Error(`adapter: evaluator-only metadata ${key} must not appear in the target input`);
  }
  const leaked = findForbiddenKeys(definition.input, 'input');
  if (leaked.length) throw new Error(`adapter: refusing to project evaluator-only metadata at ${leaked[0]}`);
  const input = definition.input;
  for (const field of caseSchema.input.required_fields) {
    if (input[field] === undefined) throw new Error(`adapter: target input is missing ${field}`);
  }
  return {
    room_id: input.room_id,
    checklist_id: input.checklist_id,
    focus_student_id: input.focus_student_id,
    focus_student_message: { ...input.focus_student_message },
    prior_participation_mode: input.prior_participation_mode,
    checklist_items: input.checklist_items.map(item => ({ ...item })),
    eligible_assessment_item_ids: [...input.eligible_assessment_item_ids],
    unresolved_assessment: input.unresolved_assessment ? { ...input.unresolved_assessment, options: input.unresolved_assessment.options.map(option => ({ ...option })) } : null,
    feedback_required: input.feedback_required,
    progress_snapshot_hash: input.progress_snapshot_hash
  };
}

const projectCase = projectContextInput;

function buildTransferTargetRequest(definition, manifest) {
  const declared = manifest && manifest.shared_request_contract ? manifest.shared_request_contract : null;
  if (!declared) throw new Error('adapter: the frozen manifest is missing shared_request_contract');
  if (!declared.builder_source_sha256) throw new Error('adapter: the frozen manifest is missing the shared builder hash');
  const settings = transferTargetSettings();
  if (declared.evaluation_effective_completion_token_budget !== settings.source_max_tokens) {
    throw new Error(`adapter: declared evaluation budget ${declared.evaluation_effective_completion_token_budget} does not match the production source budget ${settings.source_max_tokens}`);
  }
  if (declared.evaluation_enable_thinking !== settings.source_enable_thinking) {
    throw new Error(`adapter: declared evaluation thinking flag ${declared.evaluation_enable_thinking} does not match the production source flag ${settings.source_enable_thinking}`);
  }
  const shared = loadSharedRequestContract();
  const context = shared.builders.buildTransferTutorRequestContextV3(projectContextInput(definition));
  const request = shared.builders.buildTransferTutorRequestV3(context);
  return {
    request,
    user_message: shared.builders.buildTransferTutorUserMessageV3(request),
    declared_target_max_tokens: declared.evaluation_effective_completion_token_budget,
    declared_target_enable_thinking: declared.evaluation_enable_thinking,
    inherited_from_legacy_v1: settings.inherited_from_legacy_v1,
    builder_source_sha256: declared.builder_source_sha256,
    production_prompt_reference: declared.production_prompt_reference
  };
}

/** Registered with the shared v1 evaluator as contract version `v3`. */
function transferEvaluatorExtension() {
  return {
    id: 'v3',
    contract_version: 'v3',
    deterministic_checks: ['t09_contract_and_progress', 'assessment_followup'],
    buildTargetRequest: buildTransferTargetRequest,
    projectCase,
    adapter_source_sha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'adapter.js'))).digest('hex')
  };
}

module.exports = { projectCase, projectContextInput, buildTransferTargetRequest, transferEvaluatorExtension, EVALUATOR_ONLY_KEYS };

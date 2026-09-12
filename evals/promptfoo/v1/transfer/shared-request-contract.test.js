#!/usr/bin/env node
// Purpose: shared-request-contract.test.js proves the evaluation adapter consumes the real component-102 v3 builder across the TypeScript boundary and that budget and thinking parity are asserted against the production source, not a local constant.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  loadSharedRequestContract,
  sourceIdentity,
  transferTargetSettings,
  extractTransferCallSettings,
  PRODUCTION_SOURCE,
  PRODUCTION_PROMPT_SOURCE,
  ORIGINAL_PLAN
} = require('./shared-request-contract');

const root = path.resolve(__dirname, '../../../..');
const sha256 = value => require('node:crypto').createHash('sha256').update(value).digest('hex');

test('the shared builder is the real production module and exposes the declared exports', () => {
  const shared = loadSharedRequestContract();
  const identity = sourceIdentity();
  assert.equal(identity.path, PRODUCTION_SOURCE);
  assert.equal(identity.sha256, sha256(fs.readFileSync(path.join(root, PRODUCTION_SOURCE))));
  assert.deepEqual(identity.exports.sort(), ['buildTransferTutorRequestContextV3', 'buildTransferTutorRequestV3', 'buildTransferTutorUserMessageV3']);
  for (const name of identity.exports) assert.equal(typeof shared.builders[name], 'function', `${name} must be callable`);
  assert.equal(shared.context_contract_version, 'transfer_tutor_context_v3');
  assert.equal(shared.request_contract_version, 'transfer_tutor_request_v3');
});

test('the frozen original implementation plan keeps its preserved hash', () => {
  const planPath = path.resolve(root, ORIGINAL_PLAN);
  assert.equal(sha256(fs.readFileSync(planPath)), '33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2');
});

test('equivalent inputs produce byte-equal requests through the shared builder', () => {
  const { builders } = loadSharedRequestContract();
  const { base_input: base } = require('./fixtures/contract-fixtures.json');
  const ordered = builders.buildTransferTutorRequestV3(builders.buildTransferTutorRequestContextV3(base));
  const permuted = builders.buildTransferTutorRequestV3(builders.buildTransferTutorRequestContextV3({
    ...base,
    checklist_items: [...base.checklist_items].reverse(),
    eligible_assessment_item_ids: [...base.eligible_assessment_item_ids, ...base.eligible_assessment_item_ids],
    focus_student_message: { ...base.focus_student_message, content: `  ${base.focus_student_message.content.trim()}  ` }
  }));
  assert.equal(builders.buildTransferTutorUserMessageV3(ordered), builders.buildTransferTutorUserMessageV3(permuted));
  const request = JSON.parse(builders.buildTransferTutorUserMessageV3(ordered));
  assert.equal(request.contract_version, 'transfer_tutor_request_v3');
  assert.equal(request.context.contract_version, 'transfer_tutor_context_v3');
  assert.deepEqual(request.context.checklist_items.map(item => item.id), ['item-1', 'item-2']);
  assert.deepEqual(request.context.focus_student_message.content, base.focus_student_message.content.trim());
  assert.deepEqual(request.context.checklist_items[1].relevant_evidence_message_ids, ['msg-evidence-1', 'msg-evidence-2']);
});

test('the production transfer call site declares the frozen 1200 budget and disabled thinking', () => {
  const source = fs.readFileSync(path.join(root, PRODUCTION_PROMPT_SOURCE), 'utf8');
  const extracted = extractTransferCallSettings(source);
  assert.equal(extracted.max_tokens, 1200);
  assert.equal(extracted.enable_thinking, false);
  assert.equal(extracted.temperature, 0.3);
  assert.ok(extracted.callsite.includes('TRANSFER_V3_SYSTEM_PROMPT'));
  // The call site moved into the browser service for the research build, where it is the only
  // provider call, so there is no unrelated budget call left to exclude.
  assert.deepEqual(extracted.other_max_tokens, [], 'the browser transfer call site is the only provider call');
});

test('the transfer target settings declare their own budget and thinking flag and never inherit the legacy v1 values', () => {
  const settings = transferTargetSettings();
  assert.equal(settings.target_max_tokens, 1200);
  assert.equal(settings.target_enable_thinking, false);
  assert.equal(settings.inherited_from_legacy_v1, false);
  assert.equal(settings.source_max_tokens, 1200);
  assert.equal(settings.source_enable_thinking, false);
  const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings.json'), 'utf8'));
  assert.equal(legacy.target_max_tokens, 8000);
  assert.equal(legacy.target_enable_thinking, true);
  assert.notEqual(settings.target_max_tokens, legacy.target_max_tokens);
});

test('a drifted budget or a drifted thinking flag on either side fails the parity assertion', () => {
  const source = fs.readFileSync(path.join(root, PRODUCTION_PROMPT_SOURCE), 'utf8');
  const drifted = source.replace('max_tokens: 1200', 'max_tokens: 8000');
  assert.notEqual(drifted, source);
  assert.notEqual(extractTransferCallSettings(drifted).max_tokens, transferTargetSettings().target_max_tokens);
  const thinkingDrift = source.replace('enable_thinking: false', 'enable_thinking: true');
  assert.notEqual(extractTransferCallSettings(thinkingDrift).enable_thinking, transferTargetSettings().target_enable_thinking);
});

test('the evaluation side resolves the production prompt without copying its text', () => {
  const shared = loadSharedRequestContract();
  assert.equal(shared.production_prompt.reference, `${PRODUCTION_PROMPT_SOURCE}#TRANSFER_V3_SYSTEM_PROMPT`);
  assert.equal(shared.production_prompt.sha256, sha256(fs.readFileSync(path.join(root, PRODUCTION_PROMPT_SOURCE))));
  assert.equal(shared.production_prompt.text, undefined);
  const promptSource = 'tutor-system/src/services/prompts/transferV3Prompt.ts';
  const promptFile = fs.readFileSync(path.join(root, promptSource), 'utf8');
  const promptBody = promptFile.slice(promptFile.indexOf('export const TRANSFER_V3_SYSTEM_PROMPT'), promptFile.indexOf('].join'));
  const promptLines = promptBody.split('\n').map(line => line.trim().replace(/^'|',?$|^\+ |^\]$/g, '').trim()).filter(line => line.length > 40);
  assert.ok(promptLines.length > 0);
  for (const name of fs.readdirSync(__dirname).filter(item => item.endsWith('.js'))) {
    const body = fs.readFileSync(path.join(__dirname, name), 'utf8');
    for (const line of promptLines) assert.ok(!body.includes(line), `${name} must not copy production prompt text`);
  }
});

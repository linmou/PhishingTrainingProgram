#!/usr/bin/env node
// Purpose: integration-owned E04 handoff test (102 -> 104). This file covers the PRODUCTION side
// of the edge: it reads the real Edge Function source and asserts the sampling parameters of the
// transfer request that the evaluation is required to match. R14 records why this check exists:
// `evals/promptfoo/v1/settings.json` declares target_max_tokens 8000 and target_enable_thinking
// true, while production sends 1200 and false, so a parity check that compares only prompt and
// builder hashes would pass while the evaluation measured a different request than the one that
// ships. The CONSUMER half - driving real 102 builder output through 104's adapter - is added once
// component 104's adapter exists; until then this file covers the production side only, and that
// limit is stated here rather than implied by the filename.
//
// Run with: node --test tests/integration/transfer-backend-evaluation.test.mjs

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');

const require = createRequire(import.meta.url);

// Component 104's real adapter, driven against component 102's real builder. `adapter.js` calls
// `loadSharedRequestContract()`, which `require`s the actual `ecologicalTutorCall.ts`, so these
// assertions consume the upstream artifact itself rather than a hand-authored stand-in.
const adapter = require(path.join(repoRoot, 'evals/promptfoo/v1/transfer/adapter.js'));
const frozenCases = require(path.join(repoRoot, 'evals/promptfoo/v1/transfer/cases.json'));
const frozenManifest = require(path.join(repoRoot, 'evals/promptfoo/v1/transfer/manifest.json'));

const CASE = frozenCases.cases[0];

const EDGE_SOURCE_PATH = 'tutor-system/supabase/functions/assessment-api/index.ts';

const edgeSource = readFileSync(path.join(repoRoot, EDGE_SOURCE_PATH), 'utf8');

/**
 * The body of `prepareTransferTurn`. Scoped deliberately: the Edge Function also contains a
 * legacy ecological call with a different budget, so asserting against the whole file would
 * accept the wrong literal.
 */
function transferRequestCallSite() {
  const start = edgeSource.indexOf('async function prepareTransferTurn');
  assert.notStrictEqual(start, -1, `${EDGE_SOURCE_PATH} must define prepareTransferTurn`);
  const next = edgeSource.indexOf('\nasync function ', start + 1);
  return edgeSource.slice(start, next === -1 ? edgeSource.length : next);
}

test('E04: the production transfer request declares the sampling parameters the evaluation must match', () => {
  const callSite = transferRequestCallSite();

  assert.match(
    callSite,
    /max_tokens:\s*1200\b/,
    'production caps the transfer turn at 1200 completion tokens; R14 records that settings.json declares 8000 and that the transfer path must not inherit it',
  );
  assert.match(
    callSite,
    /enable_thinking:\s*false\b/,
    'production disables thinking on the transfer turn; R14 records that settings.json declares true',
  );
  assert.match(
    callSite,
    /temperature:\s*0\.3\b/,
    'production transfer temperature is 0.3, which is the one sampling value that already matches settings.json target_temperature',
  );
  assert.match(
    callSite,
    /response_format:\s*\{\s*type:\s*'json_object'\s*\}/,
    'the transfer turn requests a JSON object response, which the evaluation target must also request',
  );
});

test('E04: the production transfer model is resolved from configuration with a declared default', () => {
  const callSite = transferRequestCallSite();

  assert.match(callSite, /REACT_APP_OAI_MODEL/, 'the transfer model must be configuration-driven, not hardcoded');
  assert.match(
    callSite,
    /'qwen3\.5-flash'/,
    'the declared fallback model must match the target model recorded in the evaluation manifest',
  );
});

test('E04: the production transfer system prompt is the shared v3 prompt, not an evaluation-local copy', () => {
  const callSite = transferRequestCallSite();

  assert.match(
    callSite,
    /TRANSFER_V3_SYSTEM_PROMPT/,
    'the transfer turn must use the shared v3 system prompt constant so prompt identity is comparable by reference',
  );
  assert.match(
    callSite,
    /JSON\.stringify\(promptContext\)/,
    'the v3 context must be serialized as the user message, which is the shape the evaluation adapter has to reproduce',
  );
});

// ---------------------------------------------------------------------------------------------
// Consumer half of E04. These tests obtain the request through component 104's real adapter, which
// in turn calls component 102's real builder, so the edge is exercised in one run rather than
// reconstructed on either side.
// ---------------------------------------------------------------------------------------------

test('E04: the evaluation adapter consumes the real component-102 builder output', () => {
  const built = adapter.buildTransferTargetRequest(CASE, frozenManifest);

  assert.equal(
    built.request.contract_version,
    'transfer_tutor_request_v3',
    'the request must be produced by the real buildTransferTutorRequestV3',
  );
  assert.equal(built.request.context.contract_version, 'transfer_tutor_context_v3');
  assert.equal(built.request.context.progress_policy_version, 'transfer_v1');
  assert.equal(
    built.request.context.contract_version,
    frozenManifest.shared_request_contract.contract_version,
    'the identity the manifest pins must be the identity the real builder produced, or the parity claim is about a different contract',
  );
  assert.ok(
    typeof built.user_message === 'string' && built.user_message.length > 0,
    'the adapter must produce the serialized target message the builder defines',
  );
});

test('E04: reordered and duplicated upstream input still yields a byte-identical target request', () => {
  const base = adapter.buildTransferTargetRequest(CASE, frozenManifest);

  const scrambled = structuredClone(CASE);
  scrambled.input.checklist_items.reverse();
  if (scrambled.input.checklist_items[0]) {
    scrambled.input.checklist_items[0].relevant_evidence_message_ids = [
      ...(scrambled.input.checklist_items[0].relevant_evidence_message_ids || []),
      ...(scrambled.input.checklist_items[0].relevant_evidence_message_ids || []),
    ].reverse();
  }

  const again = adapter.buildTransferTargetRequest(scrambled, frozenManifest);

  assert.equal(
    again.user_message,
    base.user_message,
    'the documented canonicalisation is what makes product and evaluation comparable; if order leaks through, two runs of the same case are not the same request',
  );
  assert.deepEqual(again.request, base.request);
});

test('E04: evaluator-only metadata never enters the target request, and its presence is refused', () => {
  const built = adapter.buildTransferTargetRequest(CASE, frozenManifest);
  const serialized = `${JSON.stringify(built.request)}${built.user_message}`;

  for (const key of ['evaluator', 'expected', 'rubric_annotations', 'gate_thresholds', 'metric_ids', 'source_provenance']) {
    assert.ok(
      !serialized.includes(`"${key}"`),
      `the target request leaked evaluator-only metadata: ${key}`,
    );
  }

  const tampered = structuredClone(CASE);
  tampered.input.evaluator = { expected: ['B'] };
  assert.throws(
    () => adapter.buildTransferTargetRequest(tampered, frozenManifest),
    /evaluator-only/,
    'a case carrying evaluator labels in its target input must be refused rather than projected',
  );
});

test('E04: the adapter refuses a manifest whose sampling differs from the production source', () => {
  const wrongBudget = structuredClone(frozenManifest);
  wrongBudget.shared_request_contract.evaluation_effective_completion_token_budget = 8000;
  assert.throws(
    () => adapter.buildTransferTargetRequest(CASE, wrongBudget),
    /does not match the production source budget/,
    'R14: the evaluation budget must be the production budget, and the adapter has to fail closed when it is not',
  );

  const wrongThinking = structuredClone(frozenManifest);
  wrongThinking.shared_request_contract.evaluation_enable_thinking = true;
  assert.throws(
    () => adapter.buildTransferTargetRequest(CASE, wrongThinking),
    /does not match the production source flag/,
    'R14: the thinking flag must match production too, or the evaluation measures a different request',
  );
});

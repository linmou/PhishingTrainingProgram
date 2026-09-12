#!/usr/bin/env node
// Purpose: shared-request-contract.js consumes the component-102-owned v3 request/context builder across the repository's TypeScript boundary and reads the production transfer call site so budget and thinking parity are asserted against the production source rather than a local constant.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../../../..');
const PRODUCTION_SOURCE = 'tutor-system/src/services/ecologicalTutorCall.ts';
const PRODUCTION_PROMPT_SOURCE = 'tutor-system/supabase/functions/assessment-api/index.ts';
/**
 * The normative plan lives outside every worktree: `plan/` is git-excluded and exists only in the
 * main checkout (specs/104-transfer-evaluation/research.md Decision 7). Resolve the main working
 * tree from git so the check works in any worktree, and allow an explicit override.
 */
function mainCheckout() {
  try {
    const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd: __dirname, encoding: 'utf8' }).trim();
    return path.dirname(commonDir);
  } catch {
    return root;
  }
}

function findOriginalPlan() {
  const explicit = process.env.TRANSFER_ORIGINAL_PLAN;
  if (explicit) return explicit;
  return path.join(mainCheckout(), 'plan/transfer_assessment_implementation_plan.md');
}

const ORIGINAL_PLAN = findOriginalPlan();
const PROMPT_CONSTANT = 'TRANSFER_V3_SYSTEM_PROMPT';
const TRANSFER_CALL_MARKER = `${PROMPT_CONSTANT}`;

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

// The repository's established TypeScript boundary hook (see evals/promptfoo/v1/prepare.js).
// `typescript` is resolved from tutor-system/node_modules, where it is a DECLARED dependency
// (`tutor-system/package.json` -> "typescript": "^4.9.5"), so any worktree that has installed the
// application dependencies can run this. Resolving it bare from the worktree root worked only
// because of an undeclared `npm install --no-save` in one developer's checkout, which meant the
// suite passed there and failed in integration with `Cannot find module 'typescript'`.
require.extensions['.ts'] = (module, file) => {
  const ts = require(path.join(root, 'tutor-system', 'node_modules', 'typescript'));
  module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
    fileName: file
  }).outputText, file);
};

function sourceIdentity() {
  const absolute = path.join(root, PRODUCTION_SOURCE);
  const bytes = fs.readFileSync(absolute);
  const text = bytes.toString('utf8');
  const exportsFound = ['buildTransferTutorRequestContextV3', 'buildTransferTutorRequestV3', 'buildTransferTutorUserMessageV3']
    .filter(name => text.includes(`export function ${name}`));
  return {
    path: PRODUCTION_SOURCE,
    sha256: sha256(bytes),
    git_reference: '7f5e979:' + PRODUCTION_SOURCE,
    exports: exportsFound,
    canonicalisation: ['sortedUnique', 'optionOrder', 'checklist id sort']
  };
}

/**
 * Extract the transfer call site's sampling settings. The Edge Function contains a second,
 * unrelated `max_tokens: 600` call; the transfer call is identified by the
 * TRANSFER_V3_SYSTEM_PROMPT marker so a whole-file match can never stand in for parity.
 */
function extractTransferCallSettings(source) {
  const calls = source.split('await fetch(');
  const callsite = calls.find(chunk => chunk.includes(TRANSFER_CALL_MARKER) && chunk.includes('max_tokens'));
  if (!callsite) throw new Error('Transfer v3 call site with the production prompt marker was not found.');
  const number = key => {
    const match = callsite.match(new RegExp(`${key}:\\s*(\\d+(?:\\.\\d+)?)`));
    return match ? Number(match[1]) : null;
  };
  const flag = key => {
    const match = callsite.match(new RegExp(`${key}:\\s*(true|false)`));
    return match ? match[1] === 'true' : null;
  };
  const others = [];
  for (const chunk of calls) {
    const match = chunk.match(/max_tokens:\s*(\d+)/);
    if (match && !chunk.includes(TRANSFER_CALL_MARKER)) others.push(Number(match[1]));
  }
  return {
    max_tokens: number('max_tokens'),
    enable_thinking: flag('enable_thinking'),
    temperature: number('temperature'),
    model_expression: /model,/.test(callsite) || /model:\s*\w+/.test(callsite),
    callsite,
    other_max_tokens: others
  };
}

function productionCallSettings() {
  const source = fs.readFileSync(path.join(root, PRODUCTION_PROMPT_SOURCE), 'utf8');
  return extractTransferCallSettings(source);
}

function transferTargetSettings() {
  const sourceSettings = productionCallSettings();
  const manifestPath = path.join(__dirname, 'manifest.json');
  const declared = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).shared_request_contract
    : null;
  return {
    target_max_tokens: declared ? declared.evaluation_effective_completion_token_budget : sourceSettings.max_tokens,
    target_enable_thinking: declared ? declared.evaluation_enable_thinking : sourceSettings.enable_thinking,
    source_max_tokens: sourceSettings.max_tokens,
    source_enable_thinking: sourceSettings.enable_thinking,
    source_temperature: sourceSettings.temperature,
    inherited_from_legacy_v1: false
  };
}

let cached = null;

function loadSharedRequestContract() {
  if (cached) return cached;
  const modulePath = path.join(root, PRODUCTION_SOURCE);
  const builders = require(modulePath);
  const required = ['buildTransferTutorRequestContextV3', 'buildTransferTutorRequestV3', 'buildTransferTutorUserMessageV3'];
  for (const name of required) {
    if (typeof builders[name] !== 'function') throw new Error(`Shared v3 builder export ${name} is missing from ${PRODUCTION_SOURCE}.`);
  }
  const identity = sourceIdentity();
  for (const name of required) {
    if (!identity.exports.includes(name)) throw new Error(`Shared v3 builder export ${name} is not declared in ${PRODUCTION_SOURCE}.`);
  }
  cached = {
    builders,
    context_contract_version: 'transfer_tutor_context_v3',
    request_contract_version: 'transfer_tutor_request_v3',
    source: identity,
    production_prompt: {
      reference: `${PRODUCTION_PROMPT_SOURCE}#${PROMPT_CONSTANT}`,
      sha256: sha256(fs.readFileSync(path.join(root, PRODUCTION_PROMPT_SOURCE))),
      path: PRODUCTION_PROMPT_SOURCE
    },
    production_call: productionCallSettings()
  };
  return cached;
}

module.exports = {
  loadSharedRequestContract,
  sourceIdentity,
  transferTargetSettings,
  extractTransferCallSettings,
  productionCallSettings,
  sha256,
  root,
  PRODUCTION_SOURCE,
  PRODUCTION_PROMPT_SOURCE,
  ORIGINAL_PLAN
};

#!/usr/bin/env node
// Purpose: execute the dedicated wave-105 browser workflow and write privacy, attack, activation, and rollback evidence.

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const release = require('./transfer-assessment-release');

const LANE_IDS = ['activation', 'attacks', 'browser', 'privacy', 'rollback'];
const SCENARIO_IDS = [
  'US1-S1', 'US1-S2', 'US1-S3', 'US1-S4', 'US1-S5', 'US1-S6',
  'US2-S1', 'US2-S2', 'US2-S3', 'US3-S1', 'US3-S2',
];
const ATTACK_IDS = [
  'forged_identity', 'cross_learner', 'cross_room', 'stale_question', 'direct_write', 'legacy_rpc',
];
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function now() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function safeRunId(runId) {
  if (!runId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error('run id must be a safe non-empty identifier');
  return runId;
}

function evidenceRef(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return [{ path: path.resolve(filePath), sha256: sha256File(filePath) }];
}

function unique(values) {
  return [...new Set(values)];
}

function validatePreflight({ config, env = process.env, browserAvailable = true, workflowAvailable } = {}) {
  const blockers = [];
  const environment = config?.environment;
  if (environment?.isolated !== true) blockers.push('isolated migrated target is required');
  for (const role of ['teacher', 'learner']) {
    const principal = config?.principals?.[role];
    if (!principal?.application_user_id) blockers.push(`${role} application user id is missing`);
    if (!principal?.credential_env || !env[principal.credential_env]) blockers.push(`${role} credential is missing`);
  }
  if (!config?.browser?.workflow) blockers.push('browser workflow is missing');
  if (workflowAvailable === false) blockers.push('browser workflow is unavailable');
  if (browserAvailable === false) blockers.push('browser runtime is unavailable');
  for (const [name, value] of [['app_origin', environment?.app_origin], ['supabase_origin', environment?.supabase_origin]]) {
    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) blockers.push(`${name} must use http or https`);
    } catch {
      blockers.push(`${name} is invalid`);
    }
  }
  return { ok: blockers.length === 0, blockers: unique(blockers) };
}

function privateEvidence(value) {
  return release.redactEvidence(value, { scope: 'learner' });
}

function redactLearnerEvidence(value) {
  return privateEvidence(value);
}

function scanLearnerEvidence(value) {
  return release.scanForPrivateMaterial(value);
}

function matchesExpectedAttack(expected, observed) {
  if (expected === 'rejected_or_idempotent') return observed === 'rejected' || observed === 'idempotent';
  return expected === observed;
}

function evaluateAttackResult({ attackId, expected, observed, protectedStateBefore, protectedStateAfter, evidence = [], principalContext = `release-browser:attack:${attackId}` }) {
  const stateUnchanged = protectedStateBefore === protectedStateAfter;
  const outcomeMatches = matchesExpectedAttack(expected, observed);
  const evidenceValid = evidence.every((entry) => entry && typeof entry.path === 'string' && /^[0-9a-f]{64}$/.test(entry.sha256));
  const status = outcomeMatches && stateUnchanged && evidenceValid ? 'pass' : 'fail';
  const reasons = [];
  if (!outcomeMatches) reasons.push(`expected ${expected}, observed ${observed}`);
  if (!stateUnchanged) reasons.push('protected state changed');
  if (!evidenceValid) reasons.push('attack evidence reference is invalid');
  return {
    attack_id: attackId,
    status,
    expected,
    observed,
    protected_state_before: protectedStateBefore,
    protected_state_after: protectedStateAfter,
    protected_state_unchanged: stateUnchanged,
    principal_context: principalContext,
    evidence,
    verified_at: now(),
    reason: reasons.join('; ') || 'expected rejection and unchanged protected state observed',
  };
}

function blockedScenario(scenarioId, reason, evidence) {
  return {
    scenario_id: scenarioId,
    status: 'blocked',
    observed: null,
    error: reason,
    reason,
    verified_at: now(),
    principal_context: `release-browser:scenario:${scenarioId}`,
    evidence: evidence || [],
  };
}

function blockedLane(laneId, reason, evidence) {
  return {
    lane_id: laneId,
    status: 'blocked',
    reason,
    verified_at: now(),
    principal_context: `release-browser:${laneId}`,
    evidence: evidence || [],
  };
}

function buildBlockedEvidence({ runId, blockers = [], evidence = [] }) {
  const reason = blockers.length > 0 ? blockers.join('; ') : 'browser release prerequisites are unavailable';
  const references = Array.isArray(evidence) ? evidence : (evidence ? [evidence] : []);
  const scenarioResults = Object.fromEntries(SCENARIO_IDS.map((id) => [id, blockedScenario(id, reason, references)]));
  const lanes = Object.fromEntries(LANE_IDS.map((id) => [id, blockedLane(id, reason, references)]));
  return {
    browser: {
      schema: 1,
      run_id: runId,
      status: 'blocked',
      blockers,
      scenario_results: scenarioResults,
      lane_result: lanes.browser,
      evidence: references,
    },
    privacy: { schema: 1, run_id: runId, lane_id: 'privacy', status: 'blocked', reason, evidence: references },
    attacks: { schema: 1, run_id: runId, lane_id: 'attacks', status: 'blocked', attack_results: [], evidence: references },
    activation: {
      schema: 1,
      run_id: runId,
      lane_id: 'activation',
      status: 'blocked',
      enabled: false,
      capability_state: 'disabled',
      evidence: references,
    },
    rollback: {
      schema: 1,
      run_id: runId,
      lane_id: 'rollback',
      status: 'blocked',
      destructive: false,
      protected_state_before: null,
      protected_state_after: null,
      reason,
      evidence: references,
    },
    lanes,
  };
}

function referenceProblems(reference) {
  const problems = [];
  if (!reference || typeof reference.path !== 'string') return [{ reason: 'invalid_evidence_reference' }];
  if (!fs.existsSync(reference.path)) return [{ path: reference.path, reason: 'artifact_missing' }];
  if (!/^[0-9a-f]{64}$/.test(reference.sha256 || '')) return [{ path: reference.path, reason: 'invalid_artifact_hash' }];
  if (sha256File(reference.path) !== reference.sha256) return [{ path: reference.path, reason: 'artifact_hash_mismatch' }];
  return problems;
}

function validateRow(row, kind, allowEmptyEvidence = false) {
  const problems = [];
  if (!row || typeof row !== 'object') return [{ reason: `missing_${kind}_row` }];
  if (!release.RELEASE_STATUSES.includes(row.status)) problems.push({ reason: 'invalid_release_status', status: row.status });
  if (!row.principal_context || typeof row.principal_context !== 'string') problems.push({ reason: 'missing_principal_context' });
  if (!ISO_8601.test(row.verified_at || '')) problems.push({ reason: 'invalid_verified_at' });
  if (!Array.isArray(row.evidence) || (!allowEmptyEvidence && row.evidence.length === 0)) problems.push({ reason: 'missing_evidence_reference' });
  for (const reference of row.evidence || []) problems.push(...referenceProblems(reference));
  return problems;
}

function validateEvidenceBundle(bundle) {
  const problems = [];
  if (!bundle || typeof bundle !== 'object') return { ok: false, problems: [{ reason: 'bundle_not_object' }] };
  const lanes = bundle.lanes || {};
  if (JSON.stringify(Object.keys(lanes).sort()) !== JSON.stringify(LANE_IDS.slice().sort())) problems.push({ reason: 'lane_set_mismatch' });
  for (const laneId of LANE_IDS) problems.push(...validateRow(lanes[laneId], `lane:${laneId}`, lanes[laneId]?.status === 'blocked'));
  const scenarios = bundle.browser?.scenario_results || {};
  if (JSON.stringify(Object.keys(scenarios).sort()) !== JSON.stringify(SCENARIO_IDS.slice().sort())) problems.push({ reason: 'scenario_set_mismatch' });
  for (const scenarioId of SCENARIO_IDS) problems.push(...validateRow(scenarios[scenarioId], `scenario:${scenarioId}`, scenarios[scenarioId]?.status === 'blocked'));
  for (const document of [bundle.browser, bundle.privacy, bundle.attacks, bundle.activation, bundle.rollback]) {
    if (document) {
      for (const reference of document.evidence || []) problems.push(...referenceProblems(reference));
    }
  }
  if (bundle.rollback && bundle.rollback.destructive !== false) problems.push({ reason: 'rollback_is_destructive' });
  if (bundle.rollback?.status === 'pass' && bundle.rollback.protected_state_before !== bundle.rollback.protected_state_after) {
    problems.push({ reason: 'rollback_changed_protected_state' });
  }
  return { ok: problems.length === 0, problems };
}

function runDirectory(outputDir, runId) {
  const root = path.resolve(outputDir);
  fs.mkdirSync(root, { recursive: true });
  const dir = path.join(root, safeRunId(runId));
  fs.mkdirSync(dir, { recursive: false });
  return dir;
}

function writeBundle(runDir, bundle) {
  const documents = {
    'browser.json': { ...bundle.browser, lane_result: bundle.lanes?.browser || bundle.browser?.lane_result },
    'privacy.json': { ...bundle.privacy, ...(bundle.lanes?.privacy || {}) },
    'attacks.json': { ...bundle.attacks, ...(bundle.lanes?.attacks || {}) },
    'activation.json': { ...bundle.activation, ...(bundle.lanes?.activation || {}) },
    'rollback.json': { ...bundle.rollback, ...(bundle.lanes?.rollback || {}) },
  };
  for (const [name, value] of Object.entries(documents)) fs.writeFileSync(path.join(runDir, name), jsonText(value), { flag: 'wx' });
  return Object.fromEntries(Object.keys(documents).map((name) => [name, path.join(runDir, name)]));
}

function readBundle(runDir) {
  const documents = {};
  for (const name of ['browser', 'privacy', 'attacks', 'activation', 'rollback']) {
    const filePath = path.join(runDir, `${name}.json`);
    if (!fs.existsSync(filePath)) throw new Error(`missing browser evidence artifact: ${filePath}`);
    documents[name] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  documents.lanes = Object.fromEntries(LANE_IDS.map((laneId) => [laneId,
    laneId === 'browser' ? documents.browser.lane_result : { ...documents[laneId], lane_id: laneId }]));
  return documents;
}

function verifyEvidenceBundle(runDir) {
  const problems = [];
  let bundle;
  try {
    bundle = readBundle(path.resolve(runDir));
  } catch (error) {
    return { ok: false, problems: [{ reason: error.message }] };
  }
  return validateEvidenceBundle(bundle);
}

function browserAvailable() {
  try {
    require.resolve('playwright');
    return true;
  } catch {
    return false;
  }
}

function workflowAvailable(config, browserAdapter) {
  if (browserAdapter) return true;
  const modulePath = config?.browser?.workflow_module;
  return Boolean(modulePath && fs.existsSync(path.resolve(config.__baseDir || process.cwd(), modulePath)));
}

async function createPlaywrightAdapter({ config, env, runDir }) {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (error) {
    throw new Error(`browser runtime is unavailable: ${error.message}`);
  }
  const workflowPath = path.resolve(config.__baseDir || process.cwd(), config.browser.workflow_module);
  if (!fs.existsSync(workflowPath)) throw new Error(`browser workflow module is unavailable: ${workflowPath}`);
  const workflow = require(workflowPath);
  if (!workflow || typeof workflow.run !== 'function') throw new Error('browser workflow module must export run');
  const browser = await playwright.chromium.launch({
    headless: env.TRANSFER_RELEASE_HEADLESS !== 'false',
    ...(env.TRANSFER_RELEASE_BROWSER_CHANNEL ? { channel: env.TRANSFER_RELEASE_BROWSER_CHANNEL } : {}),
  });
  const events = { requests: [], responses: [], console: [], errors: [] };
  const makeContext = async (role) => {
    const context = await browser.newContext({ baseURL: config.environment.app_origin });
    const page = await context.newPage();
    page.on('request', (request) => events.requests.push({ role, url: request.url(), method: request.method() }));
    page.on('response', (response) => events.responses.push({ role, url: response.url(), status: response.status() }));
    page.on('console', (message) => events.console.push({ role, type: message.type(), text: message.text() }));
    page.on('pageerror', (error) => events.errors.push({ role, message: error.message }));
    await page.goto(config.environment.app_origin, { waitUntil: 'domcontentloaded' });
    return { context, page };
  };
  try {
    const teacher = await makeContext('teacher');
    const learner = await makeContext('learner');
    const result = await workflow.run({ teacherPage: teacher.page, learnerPage: learner.page, teacherContext: teacher.context, learnerContext: learner.context, config, env, events, runDir });
    const bundle = result && result.bundle ? result.bundle : result;
    if (!bundle || typeof bundle !== 'object') throw new Error('browser workflow returned no evidence bundle');
    const learnerEvidence = privateEvidence({ ...bundle.privacy, network: events.requests, responses: events.responses, console: events.console, errors: events.errors });
    const privacyFindings = scanLearnerEvidence(learnerEvidence.value);
    bundle.privacy = {
      ...bundle.privacy,
      status: privacyFindings.length === 0 ? bundle.privacy.status : 'fail',
      reason: privacyFindings.length === 0 ? bundle.privacy.reason : 'private material observed in learner-scoped browser evidence',
      inspected: learnerEvidence.value,
      redactions: learnerEvidence.applied,
      findings: privacyFindings,
    };
    return bundle;
  } finally {
    await browser.close();
  }
}

async function runBrowserEvidence({ config, env = process.env, outputDir, runId = `transfer-browser-${Date.now()}`, browserAdapter, browserAvailable: browserReady, workflowAvailable: workflowReady } = {}) {
  const id = safeRunId(runId);
  const runDir = runDirectory(outputDir || config?.browser?.evidence_root || path.join(process.cwd(), 'evals/transfer-assessment/release/browser'), id);
  const available = browserReady === undefined ? (browserAdapter ? true : browserAvailable()) : browserReady;
  const workflow = workflowReady === undefined ? workflowAvailable(config, browserAdapter) : workflowReady;
  const preflight = validatePreflight({ config, env, browserAvailable: available, workflowAvailable: workflow });
  if (!preflight.ok) {
    const bundle = buildBlockedEvidence({ runId: id, blockers: preflight.blockers });
    writeBundle(runDir, bundle);
    return { dir: runDir, runId: id, bundle, preflight, exitCode: 1 };
  }
  let bundle;
  try {
    if (browserAdapter) bundle = await browserAdapter.run({ config, env, runId: id, runDir });
    else bundle = await createPlaywrightAdapter({ config, env, runDir });
  } catch (error) {
    bundle = buildBlockedEvidence({ runId: id, blockers: [error instanceof Error ? error.message : String(error)] });
  }
  const validation = validateEvidenceBundle(bundle);
  if (!validation.ok) {
    const failure = buildBlockedEvidence({ runId: id, blockers: validation.problems.map((problem) => problem.reason) });
    writeBundle(runDir, failure);
    return { dir: runDir, runId: id, bundle: failure, validation, exitCode: 1 };
  }
  writeBundle(runDir, bundle);
  return { dir: runDir, runId: id, bundle, validation, exitCode: bundle.browser.status === 'pass' ? 0 : 1 };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const name = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (['config', 'output', 'runId'].includes(name)) args[name] = argv[++index];
    else throw new Error(`unknown argument: ${token}`);
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (!args.config) throw new Error('--config is required');
  const config = release.loadConfig(args.config);
  const result = await runBrowserEvidence({
    config,
    env: process.env,
    outputDir: args.output || config.browser?.evidence_root,
    runId: args.runId,
  });
  process.stdout.write(`${JSON.stringify({ run_id: result.runId, status: result.bundle.browser.status, output: result.dir }, null, 2)}\n`);
  return result.exitCode;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  });
}

module.exports = {
  ATTACK_IDS,
  LANE_IDS,
  SCENARIO_IDS,
  buildBlockedEvidence,
  evaluateAttackResult,
  redactLearnerEvidence,
  runBrowserEvidence,
  scanLearnerEvidence,
  validateEvidenceBundle,
  validatePreflight,
  verifyEvidenceBundle,
};

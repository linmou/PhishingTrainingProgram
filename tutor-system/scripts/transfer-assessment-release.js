#!/usr/bin/env node
// Purpose: reconcile transfer-assessment release evidence into an immutable, auditable verdict.

'use strict';

const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RELEASE_STATUSES = ['pass', 'fail', 'blocked', 'missing', 'error', 'not_applicable'];
const LANE_IDS = ['activation', 'attacks', 'browser', 'privacy', 'rollback'];
const PRIVATE_FIELD_NAMES = new Set([
  'assessment_key',
  'correct_option_ids',
  'transfer_basis',
  'raw_model_output',
  'reviewed_payload',
  'private_rationale',
  'provider_api_key',
  'api_key',
  'access_token',
  'refresh_token',
  'password',
]);
const PRIVATE_VALUE_PATTERNS = [
  /a familiar sender is not proof of safety\.?/gi,
  /transfer basis/gi,
  /raw model output/gi,
  /private rationale/gi,
  /(?:sk|pk)-[A-Za-z0-9_-]{12,}/g,
];

function repoRoot() {
  return path.resolve(__dirname, '..', '..');
}

function defaultOutputRoot() {
  return path.join(repoRoot(), 'evals', 'transfer-assessment', 'release');
}

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

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolvePath(value, baseDir) {
  return path.isAbsolute(value) ? value : path.resolve(baseDir, value);
}

function requireString(value, name, errors) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(name);
}

function loadConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  let config;
  try {
    config = readJson(absolutePath);
  } catch (error) {
    throw new Error(`cannot read config ${absolutePath}: ${error.message}`);
  }
  const errors = [];
  if (!config || typeof config !== 'object' || Array.isArray(config)) errors.push('config object');
  if (!config || config.schema !== 1) errors.push('schema=1');
  const environment = config && config.environment;
  requireString(environment && environment.app_origin, 'environment.app_origin', errors);
  requireString(environment && environment.supabase_origin, 'environment.supabase_origin', errors);
  const principals = config && config.principals;
  for (const role of ['teacher', 'learner']) {
    requireString(principals && principals[role] && principals[role].application_user_id, `principals.${role}.application_user_id`, errors);
    requireString(principals && principals[role] && principals[role].credential_env, `principals.${role}.credential_env`, errors);
  }
  if (!config || !config.capability || typeof config.capability !== 'object') {
    errors.push('capability');
  } else {
    requireString(config.capability.flag, 'capability.flag', errors);
    if (config.capability.expected_state !== 'disabled') errors.push('capability.expected_state=disabled');
  }
  if (!Array.isArray(config && config.upstream_evidence) || config.upstream_evidence.length === 0) {
    errors.push('upstream_evidence');
  } else {
    config.upstream_evidence.forEach((entry, index) => {
      requireString(entry && entry.gate_id, `upstream_evidence[${index}].gate_id`, errors);
      requireString(entry && entry.path, `upstream_evidence[${index}].path`, errors);
    });
  }
  if (!config || !config.scenarios || typeof config.scenarios !== 'object') errors.push('scenarios');
  else requireString(config.scenarios.manifest, 'scenarios.manifest', errors);
  if (errors.length > 0) throw new Error(`invalid release configuration: ${errors.join(', ')}`);

  const baseDir = path.dirname(absolutePath);
  return {
    ...config,
    __path: absolutePath,
    output_root: config.output_root ? resolvePath(config.output_root, baseDir) : defaultOutputRoot(),
    __baseDir: baseDir,
  };
}

function assertReleaseStatus(status) {
  if (!RELEASE_STATUSES.includes(status)) {
    throw new Error(`invalid release status: ${status}`);
  }
  return status;
}

function gitText(repo, args) {
  try {
    return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  } catch (error) {
    return '';
  }
}

function gitState(repo) {
  const status = (() => {
    try {
      return execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
    } catch (error) {
      return '';
    }
  })();
  const changedFiles = status
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .filter(Boolean);
  return {
    startCommit: gitText(repo, ['rev-parse', 'HEAD']) || 'unknown',
    branch: gitText(repo, ['symbolic-ref', '--short', '-q', 'HEAD']) || 'detached',
    status,
    changedFiles,
    dirtyTreeHash: sha256(status),
  };
}

function sourceRuns(record) {
  if (!record || typeof record !== 'object') return [];
  const values = Array.isArray(record.run_ids) ? record.run_ids : [record.run_id];
  return values.filter((value) => typeof value === 'string' && value.trim()).map(String);
}

function evidenceRef(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return [{ path: path.resolve(filePath), sha256: sha256File(filePath) }];
}

function normalizeUpstreamGate({ gate_id, required = true, record, evidencePath = null }) {
  const verifiedAt = now();
  if (!record) {
    return {
      gate_id,
      required,
      status: 'missing',
      source_status: null,
      source_status_reason: 'no upstream evidence record was available',
      blocking_reason: 'required upstream evidence is absent',
      linked_runs: [],
      verified_at: verifiedAt,
      principal_context: `release-verifier:${gate_id}`,
      evidence: evidenceRef(evidencePath),
    };
  }
  const sourceStatus = typeof record.status === 'string' ? record.status : 'error';
  let status = sourceStatus;
  if (sourceStatus === 'pending' || sourceStatus === 'partial') status = 'blocked';
  if (!RELEASE_STATUSES.includes(status)) status = 'error';
  const reason = typeof record.reason === 'string' && record.reason.trim()
    ? record.reason.trim()
    : `upstream record reported ${sourceStatus}`;
  return {
    gate_id,
    required,
    status: assertReleaseStatus(status),
    source_status: sourceStatus,
    source_status_reason: reason,
    blocking_reason: status === 'pass' ? null : `upstream ${sourceStatus}: ${reason}`,
    linked_runs: sourceRuns(record),
    verified_at: verifiedAt,
    principal_context: `release-verifier:${gate_id}`,
    evidence: evidenceRef(evidencePath),
  };
}

function buildScenarioRecords({ inventory, results = {}, defaultStatus = 'blocked', defaultReason = 'scenario driver did not run' }) {
  if (!RELEASE_STATUSES.includes(defaultStatus) || defaultStatus === 'pass') {
    throw new Error('default scenario status must be a non-pass release status');
  }
  return inventory.map((scenario) => {
    const id = scenario.id || scenario.scenario_id;
    const result = results[id];
    if (result) {
      return {
        scenario_id: id,
        title: scenario.title || result.title || id,
        requirement: scenario.requirement || result.requirement || null,
        status: assertReleaseStatus(result.status),
        observed: result.observed || null,
        error: result.error || null,
        reason: result.reason || null,
        verified_at: result.verified_at || now(),
        principal_context: result.principal_context || `release-verifier:scenario:${id}`,
        evidence: result.evidence || [],
      };
    }
    const missingResultStatus = Object.keys(results).length > 0 ? 'missing' : defaultStatus;
    return {
      scenario_id: id,
      title: scenario.title || id,
      requirement: scenario.requirement || null,
      status: missingResultStatus,
      observed: null,
      error: missingResultStatus === 'missing' ? 'no result was recorded for this declared scenario' : defaultReason,
      reason: defaultReason,
      verified_at: now(),
      principal_context: `release-verifier:scenario:${id}`,
      evidence: [],
    };
  });
}

function buildVerdict({ gateRows, scenarioRecords, lanes }) {
  const laneById = new Map((lanes || []).map((lane) => [lane.lane_id, lane]));
  const incompleteLanes = LANE_IDS.filter((laneId) => {
    const lane = laneById.get(laneId);
    return !lane || lane.status !== 'pass';
  });
  const blockingGates = gateRows
    .filter((row) => (row.required !== false && row.status !== 'pass')
      || (row.status === 'not_applicable' && !String(row.not_applicable_reason || '').trim()))
    .map((row) => row.gate_id);
  const incompleteScenarios = scenarioRecords.filter((row) => row.status !== 'pass').map((row) => row.scenario_id);
  const decision = blockingGates.length === 0 && incompleteLanes.length === 0 && incompleteScenarios.length === 0
    ? 'release_approved'
    : 'release_not_approved';
  return {
    schema: 1,
    decision,
    activation_eligible: decision === 'release_approved',
    blocking_gates: blockingGates,
    incomplete_scenarios: incompleteScenarios,
    incomplete_lanes: incompleteLanes,
    gate_rows: gateRows,
    lane_rows: LANE_IDS.map((laneId) => laneById.get(laneId) || {
      lane_id: laneId,
      status: 'missing',
      reason: 'required lane result was not recorded',
    }),
  };
}

function createRunDirectory({ outputRoot, runId }) {
  if (!runId || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId)) throw new Error('run id must be a safe non-empty identifier');
  const root = path.resolve(outputRoot);
  fs.mkdirSync(root, { recursive: true });
  const dir = path.join(root, runId);
  fs.mkdirSync(dir, { recursive: false });
  return dir;
}

function writeArtifactExclusive(runDir, name, value) {
  if (path.basename(name) !== name || !name.endsWith('.json')) throw new Error(`invalid artifact name: ${name}`);
  const filePath = path.join(runDir, name);
  const bytes = Buffer.from(jsonText(value));
  fs.writeFileSync(filePath, bytes, { flag: 'wx' });
  return { path: filePath, sha256: sha256(bytes) };
}

function redactEvidence(value, { scope }) {
  if (scope === 'teacher') return { scope, value, applied: [] };
  if (scope !== 'learner') throw new Error(`unsupported evidence scope: ${scope}`);
  const privateValues = new Set();
  const applied = [];
  const collectStrings = (node) => {
    if (Array.isArray(node)) return node.forEach(collectStrings);
    if (node && typeof node === 'object') return Object.values(node).forEach(collectStrings);
    if (typeof node === 'string' && node.trim()) privateValues.add(node);
  };
  const collect = (node, key = '') => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach((entry) => collect(entry, key));
    Object.entries(node).forEach(([name, entry]) => {
      if (PRIVATE_FIELD_NAMES.has(name)) {
        applied.push(name);
        collectStrings(entry);
        return;
      }
      collect(entry, name);
    });
  };
  collect(value);
  const replace = (node) => {
    if (Array.isArray(node)) return node.map(replace);
    if (node && typeof node === 'object') {
      const result = {};
      Object.entries(node).forEach(([name, entry]) => {
        if (PRIVATE_FIELD_NAMES.has(name)) return;
        result[name] = replace(entry);
      });
      return result;
    }
    if (typeof node === 'string') {
      let text = node;
      for (const privateValue of privateValues) {
        if (!privateValue) continue;
        const escaped = privateValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const before = text;
        text = text.replace(new RegExp(escaped, 'g'), '[REDACTED]');
        if (text !== before) applied.push(`value:${privateValue}`);
      }
      return text;
    }
    return node;
  };
  return { scope, value: replace(value), applied: [...new Set(applied)] };
}

function scanForPrivateMaterial(value) {
  const findings = [];
  const walk = (node, currentPath) => {
    if (Array.isArray(node)) return node.forEach((entry, index) => walk(entry, `${currentPath}[${index}]`));
    if (!node || typeof node !== 'object') {
      if (typeof node === 'string') {
        for (const pattern of PRIVATE_VALUE_PATTERNS) {
          pattern.lastIndex = 0;
          if (pattern.test(node)) findings.push({ path: currentPath, field: currentPath.split('.').pop(), reason: 'private value pattern' });
        }
      }
      return;
    }
    Object.entries(node).forEach(([key, entry]) => {
      const entryPath = currentPath ? `${currentPath}.${key}` : key;
      if (PRIVATE_FIELD_NAMES.has(key)) findings.push({ path: entryPath, field: key, reason: 'private field name' });
      walk(entry, entryPath);
    });
  };
  walk(value, '');
  return findings;
}

function readScenarioManifest(config) {
  const manifestPath = resolvePath(config.scenarios.manifest, config.__baseDir);
  try {
    const manifest = readJson(manifestPath);
    if (!Array.isArray(manifest.scenarios)) throw new Error(`scenario manifest has no scenarios array: ${manifestPath}`);
    return { manifest, manifestPath, error: null };
  } catch (error) {
    return {
      manifest: { schema: 1, scenarios: [] },
      manifestPath,
      error: `scenario manifest is unavailable: ${error.message}`,
    };
  }
}

function resolveEvidencePath(config, evidenceDir, configuredPath) {
  const candidates = [
    resolvePath(configuredPath, evidenceDir),
    resolvePath(configuredPath, path.dirname(evidenceDir)),
    resolvePath(configuredPath, config.__baseDir),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function credentialSnapshot(config, env) {
  const result = {};
  for (const role of ['teacher', 'learner']) {
    const principal = config.principals[role];
    result[role] = {
      application_user_id: principal.application_user_id,
      credential_env: principal.credential_env,
      credential_present: Boolean(env[principal.credential_env]),
    };
  }
  return result;
}

function browserEvidenceReferenceProblems(reference, baseDir, location) {
  if (!reference || typeof reference !== 'object' || typeof reference.path !== 'string') {
    return [`${location}: invalid evidence reference`];
  }
  if (!/^[0-9a-f]{64}$/.test(reference.sha256 || '')) {
    return [`${location}: invalid evidence hash`];
  }
  const filePath = path.isAbsolute(reference.path)
    ? reference.path
    : path.resolve(baseDir, reference.path);
  if (!fs.existsSync(filePath)) return [`${location}: evidence file is missing`];
  try {
    if (sha256File(filePath) !== reference.sha256) return [`${location}: evidence hash mismatch`];
  } catch (error) {
    return [`${location}: evidence file is unreadable: ${error.message}`];
  }
  return [];
}

function browserEvidenceReferenceProblemsIn(value, baseDir, location) {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => browserEvidenceReferenceProblemsIn(entry, baseDir, `${location}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  const problems = [];
  if (Object.prototype.hasOwnProperty.call(value, 'evidence')) {
    const evidence = value.evidence;
    if (!Array.isArray(evidence)) problems.push(`${location}.evidence: expected an array`);
    else evidence.forEach((reference, index) => {
      problems.push(...browserEvidenceReferenceProblems(reference, baseDir, `${location}.evidence[${index}]`));
    });
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'evidence') problems.push(...browserEvidenceReferenceProblemsIn(child, baseDir, `${location}.${key}`));
  }
  return problems;
}

function validateBrowserEvidenceDocuments(documents, evidenceDir) {
  const problems = [];
  for (const name of ['browser', 'privacy', 'attacks', 'activation', 'rollback']) {
    if (!documents[name] || typeof documents[name] !== 'object' || Array.isArray(documents[name])) {
      problems.push(`${name}: evidence document is not an object`);
      continue;
    }
    problems.push(...browserEvidenceReferenceProblemsIn(documents[name], evidenceDir, name));
  }
  const browser = documents.browser;
  if (browser && (typeof browser.scenario_results !== 'object' || browser.scenario_results === null || Array.isArray(browser.scenario_results))) {
    problems.push('browser.scenario_results: expected an object');
  }
  return problems;
}

function artifactEntries(paths) {
  return paths.filter((filePath) => filePath && fs.existsSync(filePath)).map((filePath) => ({
    path: path.resolve(filePath),
    sha256: sha256File(filePath),
  }));
}

function readBrowserEvidence(evidenceDir) {
  if (!evidenceDir) return null;
  const dir = path.resolve(evidenceDir);
  const names = ['browser', 'privacy', 'attacks', 'activation', 'rollback'];
  const paths = Object.fromEntries(names.map((name) => [name, path.join(dir, `${name}.json`)]));
  const missing = names.filter((name) => !fs.existsSync(paths[name]));
  if (missing.length > 0) {
    return {
      error: `browser evidence is incomplete; missing ${missing.join(', ')}`,
      scenarios: {},
      lanes: {},
      artifactPaths: Object.values(paths),
    };
  }
  try {
    const documents = Object.fromEntries(names.map((name) => [name, readJson(paths[name])]));
    const validationProblems = validateBrowserEvidenceDocuments(documents, dir);
    if (validationProblems.length > 0) {
      return {
        error: `browser evidence validation failed: ${validationProblems.join('; ')}`,
        scenarios: {},
        lanes: {},
        artifactPaths: Object.values(paths),
      };
    }
    const lanes = {};
    for (const laneId of LANE_IDS) {
      const source = laneId === 'browser'
        ? documents.browser.lane_result || documents.browser.lane || documents.browser
        : documents[laneId];
      lanes[laneId] = {
        ...source,
        lane_id: laneId,
        principal_context: source.principal_context || `release-verifier:${laneId}`,
        evidence: Array.isArray(source.evidence) ? source.evidence : [],
      };
    }
    return {
      error: null,
      runId: documents.browser.run_id || null,
      scenarios: documents.browser.scenario_results || {},
      lanes,
      rollback: documents.rollback,
      artifactPaths: Object.values(paths),
    };
  } catch (error) {
    return {
      error: `browser evidence is unreadable: ${error.message}`,
      scenarios: {},
      lanes: {},
      artifactPaths: Object.values(paths),
    };
  }
}

function reconcileBrowserEvidence({ evidenceDir, inventory }) {
  const evidence = readBrowserEvidence(evidenceDir);
  if (!evidence) throw new Error('browser evidence directory is required');
  const scenarios = buildScenarioRecords({
    inventory,
    results: evidence.scenarios,
    defaultStatus: evidence.error ? 'blocked' : 'missing',
    defaultReason: evidence.error || 'declared scenario did not produce a result',
  });
  const lanes = LANE_IDS.map((laneId) => evidence.lanes[laneId] || {
    lane_id: laneId,
    status: evidence.error ? 'blocked' : 'missing',
    reason: evidence.error || 'required browser lane did not produce a result',
    verified_at: now(),
    principal_context: `release-verifier:${laneId}`,
    evidence: [],
  });
  return { scenarios, lanes, rollback: evidence.rollback || null, error: evidence.error, artifactPaths: evidence.artifactPaths };
}

function laneRows({ evidencePath, reason }) {
  return LANE_IDS.map((laneId) => ({
    lane_id: laneId,
    status: 'blocked',
    reason,
    verified_at: now(),
    principal_context: `release-verifier:${laneId}`,
    evidence: evidenceRef(evidencePath),
  }));
}

function runRelease(options) {
  const config = loadConfig(options.configPath);
  const evidenceDir = path.resolve(options.evidenceDir || path.join(config.__baseDir, 'evidence'));
  const outputRoot = path.resolve(options.outputRoot || config.output_root);
  const runId = options.runId || `transfer-release-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;
  const runDir = createRunDirectory({ outputRoot, runId });
  const env = options.env || process.env;
  const state = gitState(options.repoRoot || repoRoot());
  const { manifest, manifestPath, error: manifestError } = readScenarioManifest(config);
  const browserEvidenceDir = options.browserEvidenceDir
    || config.browser_evidence_dir
    || config.browser?.evidence_root
    || null;
  const browserEvidence = browserEvidenceDir ? readBrowserEvidence(browserEvidenceDir) : null;
  const upstreamPaths = config.upstream_evidence.map((entry) => resolveEvidencePath(config, evidenceDir, entry.path));
  const gateRows = config.upstream_evidence.map((entry, index) => {
    const filePath = upstreamPaths[index];
    let record = null;
    try {
      if (fs.existsSync(filePath)) record = readJson(filePath);
    } catch (error) {
      record = { status: 'error', reason: `cannot read upstream evidence: ${error.message}` };
    }
    return normalizeUpstreamGate({
      gate_id: entry.gate_id,
      required: entry.required !== false,
      record,
      evidencePath: filePath,
    });
  });
  gateRows.forEach((row) => {
    if (row.evidence.length === 0) row.evidence = evidenceRef(config.__path);
  });
  const configEvidencePath = config.__path;
  const lanes = browserEvidence && !browserEvidence.error
    ? LANE_IDS.map((laneId) => browserEvidence.lanes[laneId] || {
      lane_id: laneId,
      status: 'missing',
      reason: 'required browser release lane did not produce a result',
      verified_at: now(),
      principal_context: `release-verifier:${laneId}`,
      evidence: evidenceRef(configEvidencePath),
    })
    : laneRows({
      evidencePath: configEvidencePath,
      reason: browserEvidence?.error || 'live release lane driver is unavailable in this build; no browser, privacy, attack, activation, or rollback result was substituted',
    });
  const scenarioRecords = buildScenarioRecords({
    inventory: manifest.scenarios,
    results: browserEvidence && !browserEvidence.error ? browserEvidence.scenarios : {},
    defaultStatus: browserEvidence ? (browserEvidence.error ? 'blocked' : 'missing') : 'blocked',
    defaultReason: browserEvidence?.error || 'dedicated browser scenario driver did not run',
  }).map((record) => ({ ...record, evidence: evidenceRef(configEvidencePath) }));
  if (browserEvidence && !browserEvidence.error) {
    const scenarioResults = browserEvidence.scenarios || {};
    for (const record of scenarioRecords) {
      const source = scenarioResults[record.scenario_id];
      if (source && Array.isArray(source.evidence)) record.evidence = source.evidence;
      if (source && source.principal_context) record.principal_context = source.principal_context;
    }
  }
  if (manifestError && config.scenarios.required !== false) {
    scenarioRecords.push({
      scenario_id: '__scenario_manifest__',
      title: 'declared scenario manifest',
      requirement: 'FR-008',
      status: 'missing',
      observed: null,
      error: manifestError,
      reason: manifestError,
      verified_at: now(),
      principal_context: 'release-verifier:scenario-manifest',
      evidence: evidenceRef(configEvidencePath),
    });
  }
  const verdict = buildVerdict({ gateRows, scenarioRecords, lanes });
  const linkedRuns = [...new Set(gateRows.flatMap((row) => row.linked_runs))].sort();
  const migrationStatus = {
    authored: { status: 'not_applicable', reason: 'migration authorship is an upstream component responsibility' },
    exercised: { status: 'not_applicable', reason: 'hosted migration exercise is recorded by the backend gate' },
    deployed: { status: 'not_applicable', reason: 'deployment state is recorded by the hosted backend evidence' },
  };
  const snapshot = {
    schema: 1,
    run_id: runId,
    branch: state.branch,
    start_commit: state.startCommit,
    dirty_tree_hash: state.dirtyTreeHash,
    config_sha256: sha256File(config.__path),
    application_origin: config.environment.app_origin,
    supabase_origin: config.environment.supabase_origin,
    isolated: config.environment.isolated === true,
    verified_principals: credentialSnapshot(config, env),
    feature_flag_state: {
      flag: config.capability.flag,
      state: 'disabled',
      authorization_source: 'backend',
      enabled_by_runner: false,
      expected_state: config.capability.expected_state,
    },
    linked_ai_run_ids: linkedRuns,
    artifact_hashes: artifactEntries([manifestPath, ...upstreamPaths, ...(browserEvidence?.artifactPaths || [])]),
  };
  const startedAt = now();
  const browserFlag = browserEvidenceDir ? ` --browser-evidence ${path.resolve(browserEvidenceDir)}` : '';
  const command = `node tutor-system/scripts/transfer-assessment-release.js --config ${config.__path} --evidence ${evidenceDir} --output ${outputRoot} --run-id ${runId}${browserFlag}`;
  const record = {
    schema: 1,
    run_id: runId,
    started_at: startedAt,
    completed_at: now(),
    scenario_results: scenarioRecords,
    lane_results: lanes,
    upstream_gate_rows: gateRows,
    completion: verdict.decision === 'release_approved' ? 'complete' : 'incomplete',
  };
  const report = {
    schema: 1,
    run_id: runId,
    start_commit: state.startCommit,
    end_commit: gitState(options.repoRoot || repoRoot()).startCommit,
    branch: state.branch,
    changed_files: state.changedFiles,
    migration_status: migrationStatus,
    verified_principals: snapshot.verified_principals,
    key_protection: {
      status: lanes.find((lane) => lane.lane_id === 'privacy')?.status || 'blocked',
      reason: lanes.find((lane) => lane.lane_id === 'privacy')?.reason || 'dedicated learner privacy lane did not run',
    },
    commands: [{ command, exit_status: verdict.decision === 'release_approved' ? 0 : 1, verified_at: now() }],
    linked_runs: linkedRuns,
    feature_flag_state: snapshot.feature_flag_state,
    capability: {
      flag: config.capability.flag,
      state: 'disabled',
      enabled_by_runner: false,
      authorization_source: 'backend',
    },
    rollback_path: {
      status: browserEvidence?.rollback?.status || 'blocked',
      destructive: browserEvidence?.rollback?.destructive === true,
      protected_state_before: browserEvidence?.rollback?.protected_state_before || null,
      protected_state_after: browserEvidence?.rollback?.protected_state_after || null,
      steps: [
        'disable the backend-controlled transfer capability',
        'verify existing assessment tables, evidence, and history remain present',
        'record delivered-question resolution without deleting evidence',
      ],
      reason: browserEvidence?.rollback?.reason || 'rollback driver did not run',
    },
    lane_results: lanes,
    remaining_gaps: [
      ...scenarioRecords.filter((row) => row.status !== 'pass').map((row) => `scenario ${row.scenario_id}: ${row.reason}`),
      ...lanes.map((lane) => `${lane.lane_id}: ${lane.reason}`),
      ...gateRows.filter((row) => row.status !== 'pass').map((row) => `${row.gate_id}: ${row.blocking_reason}`),
    ],
  };
  const bundleHashes = {
    'run-record.json': sha256(jsonText(record)),
    'report.json': sha256(jsonText(report)),
    'verdict.json': sha256(jsonText({ ...verdict, run_id: runId })),
  };
  snapshot.bundle_hashes = bundleHashes;
  const finalVerdict = { ...verdict, run_id: runId };
  writeArtifactExclusive(runDir, 'snapshot.json', snapshot);
  writeArtifactExclusive(runDir, 'run-record.json', record);
  writeArtifactExclusive(runDir, 'report.json', report);
  writeArtifactExclusive(runDir, 'verdict.json', finalVerdict);
  return {
    dir: runDir,
    outputRoot,
    runId,
    exitCode: finalVerdict.decision === 'release_approved' ? 0 : 1,
    verdict: finalVerdict,
  };
}

function verifyBundle(bundleDir) {
  const dir = path.resolve(bundleDir);
  const problems = [];
  const required = ['snapshot.json', 'run-record.json', 'report.json', 'verdict.json'];
  const documents = {};
  for (const name of required) {
    const filePath = path.join(dir, name);
    if (!fs.existsSync(filePath)) {
      problems.push({ path: filePath, reason: 'missing_bundle_artifact' });
      continue;
    }
    try {
      documents[name] = readJson(filePath);
    } catch (error) {
      problems.push({ path: filePath, reason: `invalid_json: ${error.message}` });
    }
  }
  const snapshot = documents['snapshot.json'];
  if (snapshot) {
    for (const entry of snapshot.artifact_hashes || []) {
      if (!entry.path || !fs.existsSync(entry.path)) {
        problems.push({ path: entry.path || '<missing>', reason: 'artifact_missing' });
      } else if (sha256File(entry.path) !== entry.sha256) {
        problems.push({ path: entry.path, reason: 'artifact_hash_mismatch' });
      }
    }
    for (const [name, expected] of Object.entries(snapshot.bundle_hashes || {})) {
      const filePath = path.join(dir, name);
      if (!fs.existsSync(filePath)) problems.push({ path: filePath, reason: 'bundle_hash_target_missing' });
      else if (sha256File(filePath) !== expected) problems.push({ path: filePath, reason: 'artifact_hash_mismatch' });
    }
  }
  return { ok: problems.length === 0, problems };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const name = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (name === 'verify') args.verify = argv[++index];
    else if (name === 'config' || name === 'evidence' || name === 'output' || name === 'runId' || name === 'browserEvidence') args[name] = argv[++index];
    else throw new Error(`unknown argument: ${token}`);
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.verify) {
    const candidate = path.resolve(args.verify);
    const dir = fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()
      ? candidate
      : path.join(path.resolve(args.output || defaultOutputRoot()), args.verify);
    const result = verifyBundle(dir);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  if (!args.config) throw new Error('--config is required');
  const run = runRelease({
    configPath: args.config,
    evidenceDir: args.evidence,
    browserEvidenceDir: args.browserEvidence,
    outputRoot: args.output,
    runId: args.runId,
  });
  process.stdout.write(`${JSON.stringify({ run_id: run.runId, decision: run.verdict.decision, output: run.dir }, null, 2)}\n`);
  return run.exitCode;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}

module.exports = {
  RELEASE_STATUSES,
  LANE_IDS,
  assertReleaseStatus,
  buildScenarioRecords,
  buildVerdict,
  createRunDirectory,
  defaultOutputRoot,
  loadConfig,
  readBrowserEvidence,
  reconcileBrowserEvidence,
  normalizeUpstreamGate,
  redactEvidence,
  runRelease,
  scanForPrivateMaterial,
  sha256File,
  verifyBundle,
  writeArtifactExclusive,
};

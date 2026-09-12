#!/usr/bin/env node
// Purpose: the dedicated transfer-assessment release-evidence runner for component 105. It validates
// a non-secret configuration, creates one immutable run bundle under
// evals/transfer-assessment/release/<run-id>/, normalizes linked upstream evidence into the closed
// release status vocabulary, records every required scenario and lane (including the ones that did
// not run), redacts private material from learner-scoped evidence, recomputes artifact hashes on
// verification, and refuses release approval whenever any required gate or lane is not `pass`. It
// never enables TRANSFER_ASSESSMENT_ENABLED; activation is a separate authorized operation.
//
// Usage:
//   node transfer-assessment-release.js --config <file> [--evidence <dir>] [--output <dir>] [--run-id <id>]
//   node transfer-assessment-release.js --verify <bundle-dir|run-id> [--output <dir>] [--config <file>]

'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_OUTPUT_ROOT = path.join(REPO_ROOT, 'evals', 'transfer-assessment', 'release');
const RELEASE_STATUSES = ['pass', 'fail', 'blocked', 'missing', 'error', 'not_applicable'];
const CAPABILITY_FLAG = 'TRANSFER_ASSESSMENT_ENABLED';
const REQUIRED_LANES = ['browser', 'privacy', 'attacks', 'activation', 'rollback'];
const LANE_DRIVER_ABSENT = 'no lane driver is available in this build';
const BUNDLE_ARTIFACTS = ['snapshot.json', 'run-record.json', 'report.json', 'verdict.json'];
const REDACTION_MARKER = '[redacted]';

/** Field names that must never reach learner-scoped evidence. */
const PRIVATE_FIELD_NAMES = [
  'assessment_key',
  'assessment_transfer_basis',
  'correct_answer',
  'correct_answer_ids',
  'correct_option_ids',
  'private_rationale',
  'progress_snapshot_hash',
  'raw_model_output',
  'reviewed_payload',
  'transfer_basis',
];
const SECRET_FIELD_PATTERN = /(api[_-]?key|authorization|bearer|password|secret|access[_-]?token|refresh[_-]?token|service[_-]?role)/i;
const SECRET_VALUE_PATTERN = /(bearer\s+[a-z0-9._-]{12,}|sk-[a-z0-9-]{12,}|eyJ[a-z0-9._-]{20,})/i;

const CONFIG_REQUIRED_FIELDS = [
  'environment.app_origin',
  'environment.supabase_origin',
  'principals.teacher.application_user_id',
  'principals.learner.application_user_id',
  'capability.flag',
  'upstream_evidence',
  'scenarios.manifest',
];

const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const nowIso = () => new Date().toISOString();

function sha256Text(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function sha256File(filePath) {
  return sha256Text(fs.readFileSync(filePath));
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

function assertReleaseStatus(status) {
  if (!RELEASE_STATUSES.includes(status)) {
    throw new Error(`release status must be one of ${RELEASE_STATUSES.join(', ')}, received ${status}`);
  }
  return status;
}

function getAtPath(object, dotted) {
  return dotted.split('.').reduce((value, key) => (isPlainObject(value) ? value[key] : undefined), object);
}

/**
 * Normalize one linked upstream record into a release gate row. A present record whose source status
 * is `pending` or `partial` becomes `blocked` with the source value and reason retained as metadata;
 * an absent record becomes `missing`. The upstream value never becomes the release status.
 */
function normalizeUpstreamGate({ gate_id, required = true, record = null, required_evidence = null, evidence_path = null }) {
  const row = {
    gate_id,
    required: required !== false,
    required_evidence: required_evidence || `linked upstream evidence for ${gate_id}`,
    linked_runs: [],
    principal_context: `upstream:${gate_id}`,
    evidence: [],
    verified_at: nowIso(),
  };
  if (!record) {
    row.status = 'missing';
    row.blocking_reason = `no upstream record or evidence link is present for ${gate_id}`;
    return row;
  }
  const sourceStatus = String(record.status || 'missing');
  row.linked_runs = record.run_id ? [String(record.run_id)] : [];
  if (evidence_path) {
    row.evidence = [{ kind: 'upstream_record', path: evidence_path, sha256: sha256File(evidence_path) }];
  }
  if (sourceStatus === 'pending' || sourceStatus === 'partial') {
    row.status = 'blocked';
  } else if (RELEASE_STATUSES.includes(sourceStatus)) {
    row.status = sourceStatus;
  } else {
    row.status = 'error';
  }
  row.source_status = sourceStatus;
  if (record.reason) row.source_status_reason = String(record.reason);
  if (row.status !== 'pass') {
    row.blocking_reason = `upstream ${gate_id} reports ${sourceStatus}${record.reason ? `: ${record.reason}` : ''}`;
  }
  return row;
}

/** Every declared scenario appears exactly once; a scenario without a result is `missing`. */
function buildScenarioRecords({ inventory = [], results = {}, defaultStatus = 'blocked', defaultReason = '' }) {
  if (defaultStatus === 'pass') {
    throw new Error('the default scenario status cannot be pass; a scenario without a result is missing');
  }
  // A driver that returned nothing at all did not run (blocked); a driver that returned some
  // results but omitted a declared scenario left that scenario missing. Neither is ever a pass.
  const driverRan = Object.keys(results).length > 0;
  return inventory.map((entry) => {
    const id = entry.id;
    const result = results[id];
    if (result) {
      return {
        scenario_id: id,
        title: entry.title || '',
        requirement: entry.requirement || null,
        status: assertReleaseStatus(result.status),
        observed: result.observed || null,
        evidence: result.evidence || [],
        error: result.status === 'pass' ? null : result.error || result.observed || null,
      };
    }
    return {
      scenario_id: id,
      title: entry.title || '',
      requirement: entry.requirement || null,
      status: driverRan ? 'missing' : assertReleaseStatus(defaultStatus),
      observed: null,
      evidence: [],
      error: driverRan ? `no result was recorded for scenario ${id}` : defaultReason || `no result was recorded for scenario ${id}`,
    };
  });
}

function isBlockingRow(row) {
  if (row.required === false) {
    if (row.status === 'not_applicable') {
      return !(typeof row.not_applicable_reason === 'string' && row.not_applicable_reason.trim().length > 0);
    }
    return row.status !== 'pass' && row.status !== 'not_applicable';
  }
  return row.status !== 'pass';
}

/** Release approval requires every required gate and every required lane to pass. */
function buildVerdict({ gateRows = [], scenarioRecords = [], lanes = [] }) {
  const rows = gateRows.map((row) => ({ required: row.required !== false, ...row }));
  const provided = new Map((lanes || []).map((lane) => [lane.lane_id, lane]));
  const laneRows = REQUIRED_LANES.map((laneId) => provided.get(laneId) || {
    lane_id: laneId,
    required: true,
    status: 'missing',
    reason: 'lane result was not recorded',
    blocking_reason: 'lane result was not recorded',
  });
  const blocking_gates = rows.filter(isBlockingRow).map((row) => row.gate_id);
  const incomplete_lanes = laneRows.filter((lane) => lane.status !== 'pass').map((lane) => lane.lane_id);
  const incomplete_scenarios = scenarioRecords
    .filter((record) => record.status !== 'pass' && record.status !== 'not_applicable')
    .map((record) => record.scenario_id);
  const decision = blocking_gates.length === 0 && incomplete_lanes.length === 0 && incomplete_scenarios.length === 0
    ? 'release_approved'
    : 'release_not_approved';
  return {
    decision,
    activation_eligible: decision === 'release_approved',
    blocking_gates,
    incomplete_lanes,
    incomplete_scenarios,
    gate_rows: rows,
    lane_rows: laneRows,
  };
}

/** The lane rows a bundle must always carry, even when no driver ran. */
function buildLaneRecords({ manifestPath }) {
  const isHashable = manifestPath && fs.existsSync(manifestPath);
  const evidence = isHashable
    ? [{ kind: 'lane_manifest', path: manifestPath, sha256: sha256File(manifestPath) }]
    : [];
  return REQUIRED_LANES.map((laneId) => ({
    lane_id: laneId,
    required: true,
    status: 'blocked',
    reason: LANE_DRIVER_ABSENT,
    blocking_reason: LANE_DRIVER_ABSENT,
    principal_context: `release-verifier:${laneId}`,
    verified_at: nowIso(),
    evidence,
  }));
}

function isPrivateFieldName(name) {
  return PRIVATE_FIELD_NAMES.includes(name) || SECRET_FIELD_PATTERN.test(name);
}

function collectStrings(value, values) {
  if (typeof value === 'string') {
    if (value.trim().length >= 8) values.push(value);
    return values;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, values));
    return values;
  }
  if (isPlainObject(value)) {
    Object.values(value).forEach((child) => collectStrings(child, values));
  }
  return values;
}

function collectPrivateValues(value, values = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectPrivateValues(item, values));
    return values;
  }
  if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (isPrivateFieldName(key)) collectStrings(child, values);
      else collectPrivateValues(child, values);
    }
  }
  return values;
}

/** Redact learner-scoped evidence by private field name and by repeated private value. */
function redactEvidence(value, { scope }) {
  if (scope !== 'learner') return { value, applied: [], scope };
  const applied = [];
  const privateValues = Array.from(new Set(collectPrivateValues(value)));
  const scrub = (node) => {
    if (Array.isArray(node)) return node.map(scrub);
    if (typeof node === 'string') {
      return privateValues.reduce(
        (text, secret) => text.split(secret).join(REDACTION_MARKER),
        SECRET_VALUE_PATTERN.test(node) ? node.replace(SECRET_VALUE_PATTERN, REDACTION_MARKER) : node
      );
    }
    if (!isPlainObject(node)) return node;
    const output = {};
    for (const [key, child] of Object.entries(node)) {
      if (isPrivateFieldName(key)) {
        applied.push(key);
        continue;
      }
      output[key] = scrub(child);
    }
    return output;
  };
  const redacted = scrub(value);
  privateValues.forEach((secret) => {
    if (JSON.stringify(redacted).includes(secret)) return;
    applied.push(`value:${sha256Text(secret).slice(0, 12)}`);
  });
  return { value: redacted, applied, scope };
}

/** Find private material by field name and by value that escaped into another field. */
function scanForPrivateMaterial(value) {
  const findings = [];
  const privateValues = new Set(collectPrivateValues(value));
  const walk = (node, currentPath) => {
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${currentPath}[${index}]`));
      return;
    }
    if (typeof node === 'string') {
      if (SECRET_VALUE_PATTERN.test(node)) findings.push({ path: currentPath, field: 'secret_value', kind: 'value' });
      for (const secret of privateValues) {
        if (node.includes(secret)) {
          findings.push({ path: currentPath, field: 'private_value', kind: 'value' });
          break;
        }
      }
      return;
    }
    if (!isPlainObject(node)) return;
    for (const [key, child] of Object.entries(node)) {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (isPrivateFieldName(key)) {
        findings.push({ path: childPath, field: key, kind: 'field' });
        continue;
      }
      walk(child, childPath);
    }
  };
  walk(value, '');
  return findings;
}

function createRunDirectory({ outputRoot, runId }) {
  const target = path.join(outputRoot, runId);
  fs.mkdirSync(outputRoot, { recursive: true });
  if (fs.existsSync(target)) {
    throw new Error(`run directory already exists and is never overwritten: ${runId}`);
  }
  fs.mkdirSync(target);
  return target;
}

function writeArtifactExclusive(dir, filename, value) {
  const target = path.join(dir, filename);
  if (fs.existsSync(target)) {
    throw new Error(`artifact already exists and is never overwritten: ${filename}`);
  }
  const text = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(target, text, { flag: 'wx' });
  return { path: target, sha256: sha256Text(text) };
}

function missingConfigFields(config) {
  return CONFIG_REQUIRED_FIELDS.filter((field) => {
    const value = getAtPath(config, field);
    if (field === 'upstream_evidence') return !Array.isArray(value) || value.length === 0;
    return value === undefined || value === null || value === '';
  });
}

function defaultOutputRoot() {
  return CONTRACT_OUTPUT_ROOT;
}

function loadConfig(configPath) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const missing = missingConfigFields(config);
  if (missing.length) {
    throw new Error(`configuration is missing required fields: ${missing.join(', ')}`);
  }
  return { ...config, output_root: config.output_root || defaultOutputRoot() };
}

function readUpstreamRows({ config, configDir, evidenceDir }) {
  return config.upstream_evidence.map((entry) => {
    const declared = entry.path || '';
    const relative = path.isAbsolute(declared) ? declared : path.join(configDir, declared);
    const candidate = evidenceDir ? path.join(evidenceDir, path.basename(relative)) : relative;
    const filePath = fs.existsSync(candidate) ? candidate : relative;
    let record = null;
    let evidencePath = null;
    if (fs.existsSync(filePath)) {
      record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      evidencePath = filePath;
    }
    return normalizeUpstreamGate({
      gate_id: entry.gate_id,
      required: entry.required !== false,
      required_evidence: entry.required_evidence || `upstream evidence link for ${entry.gate_id}`,
      record,
      evidence_path: evidencePath,
    });
  });
}

function buildSnapshot({ config, configPath, runId, repoRoot, gateRows, laneRows, env = process.env }) {
  const porcelain = git(['status', '--porcelain'], repoRoot);
  const artifacts = [config.scenarios.manifest];
  gateRows.forEach((row) => row.evidence.forEach((item) => artifacts.push(item.path)));
  const manifestPath = path.resolve(path.dirname(configPath), config.scenarios.manifest);
  artifacts.push(manifestPath);
  const artifact_hashes = Array.from(new Set(artifacts))
    .filter((filePath) => filePath && fs.existsSync(filePath))
    .map((filePath) => ({ path: filePath, sha256: sha256File(filePath) }));
  const principal = (entry) => ({
    application_user_id: entry.application_user_id,
    credential_env: entry.credential_env || null,
    credential_present: Boolean(entry.credential_env && env[entry.credential_env]),
  });
  return {
    run_id: runId,
    generated_at: nowIso(),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot).trim(),
    start_commit: git(['rev-parse', 'HEAD'], repoRoot).trim(),
    end_commit: git(['rev-parse', 'HEAD'], repoRoot).trim(),
    dirty_tree_hash: sha256Text(porcelain),
    config_sha256: sha256File(configPath),
    configuration: {
      environment: config.environment,
      capability: config.capability,
      principals: config.principals,
    },
    verified_principals: {
      teacher: principal(config.principals.teacher),
      learner: principal(config.principals.learner),
    },
    application_origin: config.environment.app_origin,
    supabase_origin: config.environment.supabase_origin,
    feature_flag_state: { flag: config.capability.flag, state: 'disabled', authorization_source: 'backend' },
    linked_ai_run_ids: gateRows.flatMap((row) => row.linked_runs),
    lane_ids: laneRows.map((lane) => lane.lane_id),
    artifact_hashes,
  };
}

function remainingGaps({ verdict, report }) {
  const gaps = verdict.blocking_gates.map((gate) => `gate ${gate} is not pass`);
  verdict.lane_rows.filter((lane) => lane.status !== 'pass')
    .forEach((lane) => gaps.push(`lane ${lane.lane_id} is ${lane.status}: ${lane.reason || lane.blocking_reason}`));
  if (report.privacy_leaks && report.privacy_leaks.length) {
    report.privacy_leaks.forEach((leak) => gaps.push(`private material in learner evidence at ${leak.path}`));
  }
  return gaps;
}

function runRelease({ configPath, evidenceDir = null, outputRoot = null, runId, env = null, repoRoot = REPO_ROOT }) {
  const config = loadConfig(configPath);
  const configDir = path.dirname(path.resolve(configPath));
  const resolvedOutputRoot = outputRoot || config.output_root || defaultOutputRoot();
  const statusPorcelain = git(['status', '--porcelain'], repoRoot);
  const startedAt = nowIso();

  const runDir = createRunDirectory({ outputRoot: resolvedOutputRoot, runId });
  const manifestPath = path.resolve(configDir, config.scenarios.manifest);
  const gateRows = readUpstreamRows({ config, configDir, evidenceDir });
  const laneRows = buildLaneRecords({ manifestPath });
  const inventory = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).scenarios || []
    : [];
  const scenarioRecords = buildScenarioRecords({
    inventory,
    results: {},
    defaultStatus: 'blocked',
    defaultReason: `no scenario driver is available in this build (${LANE_DRIVER_ABSENT})`,
  });
  const verdict = buildVerdict({ gateRows, scenarioRecords, lanes: laneRows });

  const exitCode = verdict.decision === 'release_approved' ? 0 : 1;
  const commandLine = `node ${path.relative(repoRoot, path.join(__dirname, 'transfer-assessment-release.js'))} --config ${configPath}${evidenceDir ? ` --evidence ${evidenceDir}` : ''} --output ${resolvedOutputRoot} --run-id ${runId}`;
  const headCommit = git(['rev-parse', 'HEAD'], repoRoot).trim();

  const report = {
    run_id: runId,
    start_commit: headCommit,
    end_commit: headCommit,
    changed_files: statusPorcelain.split('\n').filter(Boolean).map((line) => line.slice(3).trim()),
    verified_principals: {
      teacher: { application_user_id: config.principals.teacher.application_user_id, credential_env: config.principals.teacher.credential_env || null },
      learner: { application_user_id: config.principals.learner.application_user_id, credential_env: config.principals.learner.credential_env || null },
    },
    migration_status: {
      status: 'not_applicable',
      reason: 'this component authors, exercises, and deploys no migration',
      authored: { status: 'not_applicable', reason: 'no migration is authored by component 105' },
      exercised: { status: 'not_applicable', reason: 'no migration is exercised by component 105' },
      deployed: { status: 'not_applicable', reason: 'no migration is deployed by component 105' },
    },
    key_protection: {
      status: 'blocked',
      reason: 'the privacy lane has no driver in this build, so answer-key confidentiality is not verified here',
    },
    commands: [{ command: commandLine, exit_status: exitCode }],
    linked_runs: gateRows.flatMap((row) => row.linked_runs),
    feature_flag_state: { flag: config.capability.flag, state: 'disabled' },
    capability: {
      flag: config.capability.flag,
      state: 'disabled',
      authorization_source: 'backend',
      enabled_by_runner: false,
    },
    rollback_path: {
      status: 'blocked',
      reason: 'the rollback lane has no driver in this build',
      steps: [
        'disable new assessment generation and delivery by setting TRANSFER_ASSESSMENT_ENABLED to false',
        'leave every assessment table, history row, and evidence artifact in place',
        'let already-delivered questions resolve or be explicitly cancelled by the existing contract',
      ],
    },
    lane_results: laneRows,
    scenario_results: scenarioRecords,
  };
  report.remaining_gaps = remainingGaps({ verdict, report });

  const snapshot = buildSnapshot({ config, configPath, runId, repoRoot, gateRows, laneRows, env: env || process.env });
  const runRecord = {
    run_id: runId,
    started_at: startedAt,
    completed_at: nowIso(),
    completion_state: verdict.decision === 'release_approved' ? 'complete' : 'blocked',
    scenario_results: scenarioRecords,
    lane_results: laneRows,
    gate_rows: gateRows,
  };
  const verdictRecord = { run_id: runId, ...verdict, verified_at: nowIso() };

  writeArtifactExclusive(runDir, 'snapshot.json', snapshot);
  writeArtifactExclusive(runDir, 'run-record.json', runRecord);
  writeArtifactExclusive(runDir, 'report.json', report);
  writeArtifactExclusive(runDir, 'verdict.json', verdictRecord);

  return { runId, dir: runDir, outputRoot: resolvedOutputRoot, verdict: verdictRecord, exitCode };
}

/** Validate the public evidence contract and recompute hashes without modifying the bundle. */
function verifyBundle(bundleDir) {
  const problems = [];
  for (const name of BUNDLE_ARTIFACTS) {
    if (!fs.existsSync(path.join(bundleDir, name))) {
      problems.push({ path: name, reason: 'required_artifact_missing' });
    }
  }
  if (problems.length) return { ok: false, problems };

  const read = (name) => JSON.parse(fs.readFileSync(path.join(bundleDir, name), 'utf8'));
  const snapshot = read('snapshot.json');
  const record = read('run-record.json');
  const report = read('report.json');
  const verdict = read('verdict.json');

  for (const artifact of [snapshot, record, report, verdict]) {
    for (const row of artifact.gate_rows || []) {
      if (!RELEASE_STATUSES.includes(row.status)) {
        problems.push({ path: 'verdict.json', reason: `invalid_release_status:${row.status}` });
      }
    }
  }

  const recomputed = buildVerdict({
    gateRows: verdict.gate_rows || [],
    scenarioRecords: verdict.incomplete_scenarios
      ? record.scenario_results || []
      : record.scenario_results || [],
    lanes: verdict.lane_rows || [],
  });
  if (recomputed.decision !== verdict.decision) {
    problems.push({
      path: 'verdict.json',
      reason: 'decision_inconsistent_with_gate_rows',
      expected: recomputed.decision,
      actual: verdict.decision,
    });
  }
  for (const entry of snapshot.artifact_hashes || []) {
    if (!fs.existsSync(entry.path)) {
      problems.push({ path: entry.path, reason: 'artifact_missing' });
      continue;
    }
    const actual = sha256File(entry.path);
    if (actual !== entry.sha256) {
      problems.push({ path: entry.path, reason: 'artifact_hash_mismatch', expected: entry.sha256, actual });
    }
  }
  return { ok: problems.length === 0, problems };
}

function usage() {
  return [
    'usage: transfer-assessment-release.js --config <file> [--evidence <dir>] [--output <dir>] [--run-id <id>]',
    '       transfer-assessment-release.js --verify <bundle-dir|run-id> [--output <dir>] [--config <file>]',
  ].join('\n');
}

function parseArgs(argv) {
  const args = { config: null, evidence: null, output: null, runId: null, verify: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => {
      index += 1;
      if (index >= argv.length) throw new Error(`missing value for ${token}`);
      return argv[index];
    };
    if (token === '--config') args.config = next();
    else if (token === '--evidence') args.evidence = next();
    else if (token === '--output') args.output = next();
    else if (token === '--run-id') args.runId = next();
    else if (token === '--verify') args.verify = next();
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`unknown argument ${token}`);
  }
  return args;
}

function resolveVerifyTarget({ verify, output, config }) {
  if (fs.existsSync(verify) && fs.statSync(verify).isDirectory()) return verify;
  const outputRoot = output
    || (config ? loadConfig(config).output_root : null)
    || defaultOutputRoot();
  return path.join(outputRoot, verify);
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n${usage()}\n`);
    return 2;
  }
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  try {
    if (args.verify) {
      const target = resolveVerifyTarget({ verify: args.verify, output: args.output, config: args.config });
      const result = verifyBundle(target);
      process.stdout.write(`${JSON.stringify({ bundle: target, ...result }, null, 2)}\n`);
      return result.ok ? 0 : 1;
    }
    if (!args.config) {
      process.stderr.write(`--config is required for a run\n${usage()}\n`);
      return 2;
    }
    const runId = args.runId || `transfer-release-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const run = runRelease({
      configPath: args.config,
      evidenceDir: args.evidence,
      outputRoot: args.output,
      runId,
    });
    process.stdout.write(`${JSON.stringify({ run_id: run.runId, bundle: run.dir, decision: run.verdict.decision, exit_code: run.exitCode }, null, 2)}\n`);
    return run.exitCode;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }
}

if (require.main === module) {
  process.exitCode = main(process.argv.slice(2));
}

module.exports = {
  RELEASE_STATUSES,
  REQUIRED_LANES,
  CAPABILITY_FLAG,
  CONTRACT_OUTPUT_ROOT,
  assertReleaseStatus,
  buildLaneRecords,
  buildScenarioRecords,
  buildSnapshot,
  buildVerdict,
  createRunDirectory,
  defaultOutputRoot,
  loadConfig,
  normalizeUpstreamGate,
  parseArgs,
  redactEvidence,
  runRelease,
  scanForPrivateMaterial,
  sha256File,
  sha256Text,
  verifyBundle,
  writeArtifactExclusive,
};

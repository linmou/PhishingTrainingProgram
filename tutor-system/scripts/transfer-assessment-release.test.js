#!/usr/bin/env node
// Purpose: contract tests for the dedicated transfer release runner in
// tutor-system/scripts/transfer-assessment-release.js. They pin the release-decision boundary that
// component 105 owns: the closed status vocabulary and its upstream normalization, required-gate and
// required-lane blocking, no silent omission of a declared scenario or lane, immutable exclusive
// artifact writes, learner/teacher redaction scopes, hash-recomputing verification, non-secret
// configuration, the disabled capability default, reproducible content-bound snapshot identity,
// result provenance and report fields, the registered entry point and contract bundle location, and
// bounded writes. Every case runs in a system temporary directory and never touches the repository's
// evidence root.
//
// Run with: node --test tutor-system/scripts/transfer-assessment-release.test.js

'use strict';

const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const RUNNER = path.join(__dirname, 'transfer-assessment-release.js');
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const runner = require(RUNNER);

const TRANSFER_BASIS_TEXT = 'A familiar sender is not proof of safety.';
const TEACHER_CREDENTIAL_VALUE = 'super-secret-teacher-credential';
const ISO_8601 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const LANE_IDS = ['activation', 'attacks', 'browser', 'privacy', 'rollback'];

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'transfer-release-test-'));
}

/** Independent digest oracle: the test never borrows the runner's own hash helper. */
function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256FileHex(filePath) {
  return sha256Hex(fs.readFileSync(filePath));
}

/** A temporary git repository with an explicit commit identity, independent of ambient config. */
function tempGitRepo() {
  const dir = tempDir();
  const identity = ['-c', 'user.name=release-test', '-c', 'user.email=release-test@example.invalid'];
  const git = (...args) => execFileSync('git', [...identity, ...args], { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(dir, 'tracked.txt'), 'one\n');
  git('add', 'tracked.txt');
  git('commit', '-q', '-m', 'init');
  return { dir, git };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function scenarioManifest() {
  return {
    schema: 1,
    scenarios: [
      { id: 'US1-S1', title: 'teacher send delivers one four-option assessment', requirement: 'FR-003' },
      { id: 'US1-S2', title: 'correct labels resolve once and survive reload', requirement: 'FR-004' },
      { id: 'US2-S1', title: 'forged identity is rejected', requirement: 'FR-006' },
    ],
  };
}

function baseConfig(dir, overrides = {}) {
  return {
    schema: 1,
    output_root: path.join(dir, 'release-output'),
    environment: {
      app_origin: 'http://127.0.0.1:3001',
      supabase_origin: 'http://127.0.0.1:54321',
      isolated: true,
    },
    principals: {
      teacher: { application_user_id: '11111111-1111-4111-8111-111111111111', credential_env: 'TRANSFER_RELEASE_TEACHER_EMAIL' },
      learner: { application_user_id: '22222222-2222-4222-8222-222222222222', credential_env: 'TRANSFER_RELEASE_LEARNER_EMAIL' },
    },
    capability: { flag: 'TRANSFER_ASSESSMENT_ENABLED', expected_state: 'disabled' },
    upstream_evidence: [
      { gate_id: 'backend_boundary', required: true, path: 'evidence/backend.json' },
      { gate_id: 'room_ui', required: true, path: 'evidence/room-ui.json' },
      { gate_id: 'evaluation', required: true, path: 'evidence/evaluation.json' },
    ],
    scenarios: { manifest: 'scenarios.json', required: true },
    ...overrides,
  };
}

function passingEvidence() {
  return {
    backend: { gate_id: 'backend_boundary', status: 'pass', reason: 'hosted authorization lane green', run_id: 'backend-run-1' },
    'room-ui': { gate_id: 'room_ui', status: 'pass', reason: 'promotion 4d92cdf', run_id: 'room-ui-run-1' },
    evaluation: { gate_id: 'evaluation', status: 'pass', reason: 'quality gate green', run_id: 'ai-run-1' },
  };
}

/** Build a complete run fixture in a temporary directory and return its paths. */
function fixture(options = {}) {
  const dir = tempDir();
  const config = baseConfig(dir, options.configOverrides);
  const configPath = writeJson(path.join(dir, 'config.json'), config);
  writeJson(path.join(dir, 'scenarios.json'), options.manifest || scenarioManifest());
  const evidenceDir = path.join(dir, 'evidence');
  for (const [name, record] of Object.entries(options.evidence || passingEvidence())) {
    writeJson(path.join(evidenceDir, `${name}.json`), record);
  }
  return { dir, config, configPath, evidenceDir };
}

function runCli(args, options = {}) {
  try {
    const stdout = execFileSync(process.execPath, [RUNNER, ...args], {
      encoding: 'utf8',
      cwd: options.cwd || REPO_ROOT,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { status: 0, stdout, stderr: '' };
  } catch (error) {
    return { status: error.status, stdout: error.stdout || '', stderr: error.stderr || '' };
  }
}

function runFixture(f, runId) {
  return runner.runRelease({
    configPath: f.configPath,
    evidenceDir: f.evidenceDir,
    outputRoot: f.config.output_root,
    runId,
  });
}

test('status vocabulary is closed: pending and partial normalize to blocked with source metadata', () => {
  assert.deepEqual(runner.RELEASE_STATUSES, ['pass', 'fail', 'blocked', 'missing', 'error', 'not_applicable']);
  for (const upstream of ['pending', 'partial']) {
    const row = runner.normalizeUpstreamGate({
      gate_id: 'evaluation',
      required: true,
      record: { gate_id: 'evaluation', status: upstream, reason: `upstream ${upstream}`, run_id: 'ai-run-1' },
    });
    assert.equal(row.status, 'blocked', `${upstream} must normalize to blocked`);
    assert.equal(row.source_status, upstream, 'the upstream status is retained as metadata');
    assert.equal(row.source_status_reason, `upstream ${upstream}`, 'the upstream reason is retained');
    assert.deepEqual(row.linked_runs, ['ai-run-1']);
    assert.notEqual(row.status, upstream);
    assert.match(row.blocking_reason, new RegExp(upstream));
    assert.match(row.verified_at, ISO_8601, 'every row carries its reconciliation timestamp');
  }
});

test('a present upstream failure or error keeps its own release status', () => {
  const failed = runner.normalizeUpstreamGate({
    gate_id: 'room_ui',
    required: true,
    record: { gate_id: 'room_ui', status: 'fail', reason: 'handoff rejected' },
  });
  assert.equal(failed.status, 'fail');
  assert.equal(failed.source_status, 'fail');
  const errored = runner.normalizeUpstreamGate({
    gate_id: 'room_ui',
    required: false,
    record: { gate_id: 'room_ui', status: 'error', reason: 'runner crashed' },
  });
  assert.equal(errored.status, 'error');
  assert.equal(errored.required, false);
});

test('an absent upstream record normalizes to missing, never to pass', () => {
  const absent = runner.normalizeUpstreamGate({ gate_id: 'backend_boundary', required: true, record: null });
  assert.equal(absent.status, 'missing');
  assert.deepEqual(absent.linked_runs, []);
  assert.match(absent.blocking_reason, /no upstream|absent|missing/i);
  assert.equal(runner.assertReleaseStatus(absent.status), absent.status);
  assert.throws(() => runner.assertReleaseStatus('pending'), /pending/);
});

test('a required evidence file missing from disk is recorded missing in the written bundle', () => {
  const f = fixture();
  fs.rmSync(path.join(f.evidenceDir, 'evaluation.json'));
  const run = runFixture(f, 'run-absent-1');
  const verdict = readJson(path.join(run.dir, 'verdict.json'));
  const row = verdict.gate_rows.find((entry) => entry.gate_id === 'evaluation');
  assert.equal(row.status, 'missing', 'a deleted required evidence file must not pass');
  assert.match(row.blocking_reason, /no upstream|absent|missing/i);
  assert.equal(run.exitCode, 1);
});

test('one non-passing required gate or lane blocks release approval and the process exits non-zero', () => {
  const allLanesPass = LANE_IDS.map((lane) => ({ lane_id: lane, status: 'pass' }));
  const verdict = runner.buildVerdict({
    gateRows: [
      { gate_id: 'backend_boundary', status: 'pass', required: true },
      { gate_id: 'browser_scenarios', status: 'fail', required: true, blocking_reason: 'duplicate question observed' },
      { gate_id: 'evaluation', status: 'pass', required: true },
    ],
    scenarioRecords: [],
    lanes: allLanesPass,
  });
  assert.equal(verdict.decision, 'release_not_approved');
  assert.deepEqual(verdict.blocking_gates, ['browser_scenarios']);
  assert.equal(verdict.activation_eligible, false);

  const approved = runner.buildVerdict({
    gateRows: [
      { gate_id: 'backend_boundary', status: 'pass', required: true },
      { gate_id: 'browser_scenarios', status: 'pass', required: true },
      { gate_id: 'legacy_regression', status: 'not_applicable', required: false, not_applicable_reason: 'informational only' },
    ],
    scenarioRecords: [],
    lanes: allLanesPass,
  });
  assert.equal(approved.decision, 'release_approved');
  assert.deepEqual(approved.blocking_gates, []);
  assert.deepEqual(approved.incomplete_lanes, []);

  const notApplicableOnRequired = runner.buildVerdict({
    gateRows: [{ gate_id: 'browser_scenarios', status: 'not_applicable', required: true, not_applicable_reason: 'claimed' }],
    scenarioRecords: [],
    lanes: allLanesPass,
  });
  assert.equal(notApplicableOnRequired.decision, 'release_not_approved', 'not_applicable cannot satisfy a required gate');
  assert.deepEqual(notApplicableOnRequired.blocking_gates, ['browser_scenarios']);

  const blockedLane = runner.buildVerdict({
    gateRows: [{ gate_id: 'activation', status: 'blocked', required: true, blocking_reason: 'no verifier' }],
    scenarioRecords: [],
    lanes: allLanesPass,
  });
  assert.equal(blockedLane.decision, 'release_not_approved');
});

test('a required gate marked not_applicable needs a normative reason, and omitted lanes stay visible', () => {
  const requiredWithoutReason = runner.buildVerdict({
    gateRows: [{ gate_id: 'privacy', status: 'not_applicable', required: true, not_applicable_reason: '   ' }],
    scenarioRecords: [],
    lanes: LANE_IDS.map((lane) => ({ lane_id: lane, status: 'pass' })),
  });
  assert.equal(requiredWithoutReason.decision, 'release_not_approved');
  assert.deepEqual(requiredWithoutReason.blocking_gates, ['privacy']);

  const optionalWithoutReason = runner.buildVerdict({
    gateRows: [{ gate_id: 'legacy_regression', status: 'not_applicable', required: false, not_applicable_reason: '' }],
    scenarioRecords: [],
    lanes: LANE_IDS.map((lane) => ({ lane_id: lane, status: 'pass' })),
  });
  assert.equal(optionalWithoutReason.decision, 'release_not_approved', 'an unexplained not_applicable row still blocks');
  assert.deepEqual(optionalWithoutReason.blocking_gates, ['legacy_regression']);

  const omittedLanes = runner.buildVerdict({
    gateRows: [{ gate_id: 'backend_boundary', status: 'pass', required: true }],
    scenarioRecords: [],
    lanes: [],
  });
  assert.equal(omittedLanes.decision, 'release_not_approved', 'an unrecorded lane is never treated as passing');
  assert.deepEqual(omittedLanes.incomplete_lanes.slice().sort(), LANE_IDS.slice().sort());
});

test('a declared scenario with no result is recorded missing and never omitted', () => {
  const records = runner.buildScenarioRecords({
    inventory: scenarioManifest().scenarios,
    results: {
      'US1-S1': { scenario_id: 'US1-S1', status: 'pass', observed: 'one assessment delivered' },
      'US2-S1': { scenario_id: 'US2-S1', status: 'pass', observed: 'forged identity rejected' },
    },
    defaultStatus: 'blocked',
    defaultReason: 'browser lane did not run',
  });
  assert.equal(records.length, 3, 'the denominator is the inventory, not the observed results');
  const missing = records.find((record) => record.scenario_id === 'US1-S2');
  assert.equal(missing.status, 'missing');
  assert.match(missing.error, /no result/i);
  const reported = records.find((record) => record.scenario_id === 'US1-S1');
  assert.equal(reported.status, 'pass');
  const blocked = runner.buildScenarioRecords({
    inventory: [{ id: 'US1-S1', title: 'x' }],
    results: {},
    defaultStatus: 'blocked',
    defaultReason: 'browser lane did not run',
  });
  assert.equal(blocked[0].status, 'blocked');
  assert.match(blocked[0].error, /browser lane/);
  assert.throws(() => runner.buildScenarioRecords({
    inventory: [{ id: 'US1-S1' }],
    results: {},
    defaultStatus: 'pass',
    defaultReason: 'not run',
  }), /default/i, 'a non-pass default cannot be claimed as a pass');
});

test('the written run record keeps one entry per declared scenario and the verdict names the gap', () => {
  const f = fixture();
  const run = runFixture(f, 'run-record-1');
  const record = readJson(path.join(run.dir, 'run-record.json'));
  assert.equal(record.scenario_results.length, scenarioManifest().scenarios.length);
  const verdict = readJson(path.join(run.dir, 'verdict.json'));
  assert.deepEqual(
    verdict.incomplete_scenarios.slice().sort(),
    scenarioManifest().scenarios.map((scenario) => scenario.id).sort(),
    'no lane driver exists in this slice, so every scenario is incomplete and named'
  );
  assert.ok(record.started_at && record.completed_at);
  assert.match(record.completed_at, ISO_8601);
});

test('every required lane is materialized with an explicit status and reason', () => {
  const f = fixture();
  const run = runFixture(f, 'run-lanes-1');
  const record = readJson(path.join(run.dir, 'run-record.json'));
  const report = readJson(path.join(run.dir, 'report.json'));
  const verdict = readJson(path.join(run.dir, 'verdict.json'));
  const laneIds = record.lane_results.map((lane) => lane.lane_id).sort();
  assert.deepEqual(laneIds, ['activation', 'attacks', 'browser', 'privacy', 'rollback'], 'lane ids are pinned literally, never derived from the runner');
  for (const lane of record.lane_results) {
    assert.ok(runner.RELEASE_STATUSES.includes(lane.status), `lane ${lane.lane_id} has status ${lane.status}`);
    assert.notEqual(lane.status, 'pass', 'no lane driver exists in this slice, so no lane may report pass');
    assert.ok(lane.reason && lane.reason.length > 0, `lane ${lane.lane_id} needs a recorded reason`);
    assert.match(lane.verified_at, ISO_8601);
  }
  assert.deepEqual(report.lane_results.map((lane) => lane.lane_id).sort(), LANE_IDS.slice().sort(), 'the report names the lanes');
  assert.deepEqual(verdict.lane_rows.map((lane) => lane.lane_id).sort(), LANE_IDS.slice().sort(), 'the verdict names the lanes');
});

test('an existing run directory or artifact is never overwritten', () => {
  const dir = tempDir();
  const first = runner.createRunDirectory({ outputRoot: dir, runId: 'run-0001' });
  assert.equal(path.basename(first), 'run-0001');
  assert.throws(() => runner.createRunDirectory({ outputRoot: dir, runId: 'run-0001' }), /exist/i);
  const written = runner.writeArtifactExclusive(first, 'verdict.json', { decision: 'release_not_approved' });
  assert.equal(written.sha256, runner.sha256File(path.join(first, 'verdict.json')));
  assert.throws(() => runner.writeArtifactExclusive(first, 'verdict.json', { decision: 'release_approved' }), /exist/i);
  assert.equal(
    readJson(path.join(first, 'verdict.json')).decision,
    'release_not_approved',
    'the original bytes survive the refused overwrite'
  );
  const other = runner.createRunDirectory({ outputRoot: dir, runId: 'run-0002' });
  assert.notEqual(other, first);
});

test('learner-scoped evidence is redacted by field name and by repeated value', () => {
  const payload = {
    message_id: 'message-2',
    assessment_key: ['B'],
    transfer_basis: { concept_rule: TRANSFER_BASIS_TEXT },
    summary: `Learner saw a question whose basis was: ${TRANSFER_BASIS_TEXT}`,
    nested: { raw_model_output: '{"decision":{"mode":"assessment"}}' },
  };
  const result = runner.redactEvidence(payload, { scope: 'learner' });
  const text = JSON.stringify(result.value);
  assert.equal(text.includes(TRANSFER_BASIS_TEXT), false, 'the private value must not survive in any field');
  assert.equal(text.includes('"B"'), false, 'the answer key must not survive');
  assert.equal(text.includes('raw_model_output'), false);
  assert.ok(result.applied.includes('assessment_key'), 'the applied rule set names the removed fields');
  assert.ok(result.applied.includes('transfer_basis'));
  assert.ok(result.applied.some((entry) => entry.includes('value:')), 'value-level redaction is recorded separately');
  assert.equal(result.scope, 'learner');
});

test('teacher-scoped evidence keeps reviewed draft fields and is labelled with its scope', () => {
  const payload = {
    reviewed_payload: { assessment: { correct_option_ids: ['B'], transfer_basis: { concept_rule: TRANSFER_BASIS_TEXT } } },
  };
  const result = runner.redactEvidence(payload, { scope: 'teacher' });
  assert.equal(result.scope, 'teacher');
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.value, payload, 'teacher-only evidence is not rewritten');
});

test('the privacy scan flags private material and leaves a clean learner payload alone', () => {
  const dirty = runner.scanForPrivateMaterial({
    assessment_key: ['B'],
    note: `basis: ${TRANSFER_BASIS_TEXT}`,
    transfer_basis: { concept_rule: TRANSFER_BASIS_TEXT },
  });
  assert.ok(dirty.length >= 2, 'both the named field and the repeated value are findings');
  assert.ok(dirty.some((finding) => finding.field === 'assessment_key'));
  assert.ok(dirty.some((finding) => finding.path.endsWith('note')), 'the value leak is reported at its own path');

  const clean = runner.scanForPrivateMaterial({
    message_id: 'message-2',
    content: 'This assessment is ready for you.',
    options: [{ id: 'A', text: 'first' }, { id: 'B', text: 'second' }],
  });
  assert.deepEqual(clean, [], 'a public payload that merely mentions assessment is not a leak');
});

test('verify recomputes recorded hashes, detects tampering, and does not repair the bundle', () => {
  const f = fixture();
  const run = runFixture(f, 'run-verify-1');
  const clean = runner.verifyBundle(run.dir);
  assert.equal(clean.ok, true, JSON.stringify(clean.problems));
  assert.deepEqual(clean.problems, []);

  const bundleFiles = fs.readdirSync(run.dir).sort();
  const hashesBefore = bundleFiles.map((name) => runner.sha256File(path.join(run.dir, name)));
  assert.equal(runner.verifyBundle(run.dir).ok, true);
  assert.deepEqual(
    fs.readdirSync(run.dir).sort().map((name) => runner.sha256File(path.join(run.dir, name))),
    hashesBefore,
    'a passing verification leaves every bundle artifact byte-identical'
  );

  const target = path.join(run.dir, 'verdict.json');
  const tampered = { ...readJson(target), decision: 'release_approved' };
  fs.writeFileSync(target, `${JSON.stringify(tampered, null, 2)}\n`);
  const dirty = runner.verifyBundle(run.dir);
  assert.equal(dirty.ok, false);
  assert.ok(dirty.problems.some((problem) => problem.path.includes('verdict.json')), JSON.stringify(dirty.problems));
  assert.equal(readJson(target).decision, 'release_approved', 'verification reports the mismatch instead of rewriting the artifact');

  const tamperedEvidence = path.join(f.evidenceDir, 'evaluation.json');
  fs.writeFileSync(tamperedEvidence, `${JSON.stringify({ ...readJson(tamperedEvidence), reason: 'rewritten' }, null, 2)}\n`);
  const hashDirty = runner.verifyBundle(run.dir);
  assert.ok(
    hashDirty.problems.some((problem) => problem.reason === 'artifact_hash_mismatch'),
    JSON.stringify(hashDirty.problems)
  );

  const cliClean = runCli(['--verify', run.dir]);
  assert.notEqual(cliClean.status, 0, 'the CLI reports the tampered bundle through its exit status');
  assert.match(`${cliClean.stdout}${cliClean.stderr}`, /verdict\.json/);

  const byRunId = runFixture(fixture(), 'run-verify-2');
  const resolved = runCli(['--verify', 'run-verify-2', '--output', byRunId.outputRoot]);
  assert.equal(resolved.status, 0, 'a run id is resolved under the configured output root');
  assert.equal(runner.verifyBundle(run.dir).ok, false, 'verification never repairs the mutated bundle');
});

test('configuration validation names the missing fields and never writes credential values', () => {
  const dir = tempDir();
  const missing = baseConfig(dir);
  delete missing.environment.supabase_origin;
  delete missing.capability;
  const missingPath = writeJson(path.join(dir, 'missing.json'), missing);
  assert.throws(() => runner.loadConfig(missingPath), (error) => {
    assert.match(error.message, /supabase_origin/);
    assert.match(error.message, /capability/);
    return true;
  });

  const f = fixture();
  const run = runner.runRelease({
    configPath: f.configPath,
    evidenceDir: f.evidenceDir,
    outputRoot: f.config.output_root,
    runId: 'run-secret-1',
    env: { TRANSFER_RELEASE_TEACHER_EMAIL: TEACHER_CREDENTIAL_VALUE },
  });
  const snapshotText = fs.readFileSync(path.join(run.dir, 'snapshot.json'), 'utf8');
  assert.equal(snapshotText.includes(TEACHER_CREDENTIAL_VALUE), false, 'no credential value reaches the snapshot');
  const snapshot = readJson(path.join(run.dir, 'snapshot.json'));
  assert.equal(snapshot.verified_principals.teacher.credential_env, 'TRANSFER_RELEASE_TEACHER_EMAIL');
  assert.equal(snapshot.verified_principals.teacher.credential_present, true);
});

test('the capability stays disabled and a client-side value never authorizes it', () => {
  const f = fixture();
  const run = runFixture(f, 'run-flag-1');
  const snapshot = readJson(path.join(run.dir, 'snapshot.json'));
  assert.equal(snapshot.feature_flag_state.flag, 'TRANSFER_ASSESSMENT_ENABLED');
  assert.equal(snapshot.feature_flag_state.state, 'disabled');
  assert.equal(snapshot.feature_flag_state.authorization_source, 'backend');
  const report = readJson(path.join(run.dir, 'report.json'));
  assert.equal(report.capability.flag, 'TRANSFER_ASSESSMENT_ENABLED');
  assert.equal(report.capability.state, 'disabled');
  assert.equal(report.capability.enabled_by_runner, false);

  const clientOnly = fixture({
    configOverrides: { capability: { flag: 'TRANSFER_ASSESSMENT_ENABLED', expected_state: 'disabled', client_state: 'enabled' } },
  });
  const clientRun = runFixture(clientOnly, 'run-flag-2');
  const clientSnapshot = readJson(path.join(clientRun.dir, 'snapshot.json'));
  const clientVerdict = readJson(path.join(clientRun.dir, 'verdict.json'));
  assert.equal(clientSnapshot.feature_flag_state.state, 'disabled', 'a client-visible value is not the capability state');
  assert.equal(clientSnapshot.feature_flag_state.authorization_source, 'backend');
  assert.equal(clientVerdict.activation_eligible, false, 'a client-only flag never authorizes transfer assessment');
});

test('the snapshot records content-bound identity and the report carries the FR-009 fields', () => {
  const f = fixture();
  const run = runFixture(f, 'run-snap-1');
  const snapshot = readJson(path.join(run.dir, 'snapshot.json'));
  const headCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  const statusText = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(snapshot.start_commit, headCommit, 'the recorded commit is the real HEAD');
  assert.equal(snapshot.config_sha256, sha256FileHex(f.configPath), 'the configuration hash is the hash of the configuration bytes, not of its path');
  assert.equal(snapshot.dirty_tree_hash, sha256Hex(statusText), 'the dirty-tree hash is the hash of the recorded status bytes');
  assert.equal(snapshot.application_origin, f.config.environment.app_origin);
  assert.equal(snapshot.supabase_origin, f.config.environment.supabase_origin);
  assert.equal(typeof snapshot.branch, 'string');
  assert.ok(snapshot.branch.length > 0);
  assert.equal(snapshot.verified_principals.teacher.application_user_id, f.config.principals.teacher.application_user_id);
  assert.equal(snapshot.verified_principals.learner.application_user_id, f.config.principals.learner.application_user_id);
  assert.deepEqual(snapshot.linked_ai_run_ids.slice().sort(), ['ai-run-1', 'backend-run-1', 'room-ui-run-1']);
  const recordedArtifacts = snapshot.artifact_hashes.map((entry) => path.basename(entry.path)).sort();
  assert.ok(recordedArtifacts.includes('scenarios.json'), 'the declared scenario manifest is hashed among the manifests used');
  for (const name of ['backend.json', 'evaluation.json', 'room-ui.json']) {
    assert.ok(recordedArtifacts.includes(name), `the consumed upstream artifact ${name} is hashed`);
  }
  for (const entry of snapshot.artifact_hashes) {
    assert.equal(entry.sha256, sha256FileHex(entry.path), `recorded hash for ${entry.path}`);
  }

  const report = readJson(path.join(run.dir, 'report.json'));
  const record = readJson(path.join(run.dir, 'run-record.json'));
  const verdict = readJson(path.join(run.dir, 'verdict.json'));
  assert.equal(snapshot.run_id, 'run-snap-1', 'the snapshot carries the literal run id');
  assert.equal(record.run_id, 'run-snap-1', 'the run record carries the literal run id');
  assert.equal(report.run_id, 'run-snap-1', 'the report carries the literal run id');
  assert.equal(verdict.run_id, 'run-snap-1', 'the verdict carries the literal run id');
  assert.equal(report.start_commit, headCommit);
  assert.equal(report.end_commit, headCommit, 'the ending commit is recorded and equals the run HEAD');
  const porcelainPaths = statusText.split('\n').filter(Boolean).map((line) => line.slice(3).trim());
  assert.deepEqual(report.changed_files.slice().sort(), porcelainPaths.slice().sort(), 'the inventory is the real changed-path set');
  assert.equal(report.verified_principals.teacher.application_user_id, f.config.principals.teacher.application_user_id);
  assert.equal(report.verified_principals.learner.application_user_id, f.config.principals.learner.application_user_id);
  for (const aspect of ['authored', 'exercised', 'deployed']) {
    assert.equal(report.migration_status[aspect].status, 'not_applicable', `migration ${aspect} status`);
    assert.ok(report.migration_status[aspect].reason.length > 0, `migration ${aspect} reason`);
  }
  assert.ok(report.key_protection.status);
  assert.ok(report.key_protection.reason.length > 0);
  assert.equal(report.commands.length, 1);
  assert.match(report.commands[0].command, /transfer-assessment-release\.js/);
  assert.equal(report.commands[0].exit_status, run.exitCode);
  assert.deepEqual(report.linked_runs.slice().sort(), ['ai-run-1', 'backend-run-1', 'room-ui-run-1']);
  assert.equal(report.feature_flag_state.state, 'disabled');
  assert.ok(Array.isArray(report.rollback_path.steps) && report.rollback_path.steps.length >= 2);
  assert.ok(report.remaining_gaps.length >= 1, 'the report names the remaining gaps');
  for (const row of verdict.gate_rows) {
    assert.match(row.verified_at, ISO_8601, `gate row ${row.gate_id} carries its timestamp`);
    assert.ok(row.principal_context && row.principal_context.length > 0, `gate row ${row.gate_id} carries its principal context`);
    assert.ok(row.evidence.length >= 1, `gate row ${row.gate_id} carries an immutable evidence reference`);
    assert.match(row.evidence[0].sha256, /^[0-9a-f]{64}$/, `gate row ${row.gate_id} evidence is hashed`);
  }
  for (const lane of record.lane_results) {
    assert.ok(lane.principal_context && lane.principal_context.length > 0, `lane ${lane.lane_id} carries its principal context`);
    assert.ok(lane.evidence.length >= 1, `lane ${lane.lane_id} carries an immutable evidence reference`);
    assert.match(lane.evidence[0].sha256, /^[0-9a-f]{64}$/, `lane ${lane.lane_id} evidence is hashed`);
  }

  const shared = tempDir();
  const configA = baseConfig(shared);
  const configB = baseConfig(shared);
  configB.environment.supabase_origin = 'http://127.0.0.1:54399';
  const configAPath = writeJson(path.join(shared, 'config-a.json'), configA);
  const configBPath = writeJson(path.join(shared, 'config-b.json'), configB);
  const runA = runner.runRelease({ configPath: configAPath, evidenceDir: f.evidenceDir, outputRoot: configA.output_root, runId: 'run-snap-a' });
  const runB = runner.runRelease({ configPath: configBPath, evidenceDir: f.evidenceDir, outputRoot: configB.output_root, runId: 'run-snap-b' });
  const snapshotA = readJson(path.join(runA.dir, 'snapshot.json'));
  const snapshotB = readJson(path.join(runB.dir, 'snapshot.json'));
  assert.equal(snapshotA.config_sha256, sha256FileHex(configAPath), 'the first config hashes from its own bytes');
  assert.notEqual(snapshotA.config_sha256, snapshotB.config_sha256, 'two configs in one directory differing in one value hash differently');
  assert.equal(snapshotB.supabase_origin, 'http://127.0.0.1:54399');
});

test('the dirty-tree hash follows the repository tree content, not its path or a constant', () => {
  const repo = tempGitRepo();
  const f = fixture();
  const head = repo.git('rev-parse', 'HEAD').trim();
  const first = runner.runRelease({
    configPath: f.configPath,
    evidenceDir: f.evidenceDir,
    outputRoot: f.config.output_root,
    runId: 'run-tree-1',
    repoRoot: repo.dir,
  });
  const snapshotA = readJson(path.join(first.dir, 'snapshot.json'));
  assert.equal(snapshotA.start_commit, head, 'the commit comes from the repository under test');
  assert.equal(snapshotA.dirty_tree_hash, sha256Hex(repo.git('status', '--porcelain')), 'the hash covers the real status bytes');

  fs.writeFileSync(path.join(repo.dir, 'tracked.txt'), 'two\n');
  const second = runner.runRelease({
    configPath: f.configPath,
    evidenceDir: f.evidenceDir,
    outputRoot: f.config.output_root,
    runId: 'run-tree-2',
    repoRoot: repo.dir,
  });
  const snapshotB = readJson(path.join(second.dir, 'snapshot.json'));
  const statusB = repo.git('status', '--porcelain');
  assert.notEqual(statusB, '');
  assert.equal(snapshotB.dirty_tree_hash, sha256Hex(statusB), 'the second run hashes the changed tree');
  assert.notEqual(snapshotA.dirty_tree_hash, snapshotB.dirty_tree_hash, 'a tree-content change moves the dirty-tree hash');
  assert.notEqual(snapshotB.dirty_tree_hash, sha256Hex(repo.dir), 'the hash is not derived from the repository path');
});

test('the entry point is registered and the default bundle location is the contract path', () => {
  const pkg = readJson(path.join(__dirname, '..', 'package.json'));
  const script = pkg.scripts['eval:transfer:release'];
  assert.equal(typeof script, 'string', 'the release command must be registered');
  assert.match(script, /transfer-assessment-release\.js/);

  const dir = tempDir();
  const config = baseConfig(dir);
  delete config.output_root;
  const configPath = writeJson(path.join(dir, 'config.json'), config);
  const resolved = runner.defaultOutputRoot(configPath);
  assert.equal(resolved, path.join(REPO_ROOT, 'evals', 'transfer-assessment', 'release'));
  const loaded = runner.loadConfig(configPath);
  assert.equal(loaded.output_root, resolved, 'a config without an output root uses the contract location');
});

test('a run writes only under its run directory and leaves the repository untouched', () => {
  const before = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  const f = fixture();
  const run = runCli(['--config', f.configPath, '--evidence', f.evidenceDir, '--output', f.config.output_root, '--run-id', 'run-bounded-1']);
  assert.ok([0, 1].includes(run.status), `unexpected exit status ${run.status}: ${run.stderr}`);
  const after = execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' });
  assert.equal(after, before, 'the release run must not modify tracked repository state');
  const produced = fs.readdirSync(path.join(f.config.output_root, 'run-bounded-1')).sort();
  assert.deepEqual(produced, ['report.json', 'run-record.json', 'snapshot.json', 'verdict.json']);
});

test('the CLI writes a bundle whose verdict follows the recorded gates and lanes', () => {
  const passing = fixture();
  const cli = runCli(['--config', passing.configPath, '--evidence', passing.evidenceDir, '--output', passing.config.output_root, '--run-id', 'run-cli-pass']);
  const verdictPath = path.join(passing.config.output_root, 'run-cli-pass', 'verdict.json');
  assert.ok(fs.existsSync(verdictPath), `no verdict written: ${cli.stderr}`);
  const verdict = readJson(verdictPath);
  assert.equal(verdict.decision, 'release_not_approved', 'required lanes are not pass in this slice, so no approval');
  assert.deepEqual(verdict.blocking_gates, []);
  assert.deepEqual(verdict.incomplete_lanes.slice().sort(), LANE_IDS.slice().sort());
  assert.equal(cli.status, 1, 'an incomplete run must not exit zero');
  assert.ok(fs.existsSync(path.join(passing.config.output_root, 'run-cli-pass', 'report.json')));

  const failing = fixture();
  writeJson(path.join(failing.evidenceDir, 'evaluation.json'), {
    gate_id: 'evaluation',
    status: 'partial',
    reason: 'holdout partition still running',
    run_id: 'ai-run-2',
  });
  const blocked = runCli(['--config', failing.configPath, '--evidence', failing.evidenceDir, '--output', failing.config.output_root, '--run-id', 'run-cli-blocked']);
  assert.notEqual(blocked.status, 0, 'an incomplete upstream record must not exit zero');
  const blockedVerdict = readJson(path.join(failing.config.output_root, 'run-cli-blocked', 'verdict.json'));
  assert.equal(blockedVerdict.decision, 'release_not_approved');
  const evaluationRow = blockedVerdict.gate_rows.find((row) => row.gate_id === 'evaluation');
  assert.equal(evaluationRow.status, 'blocked');
  assert.equal(evaluationRow.source_status, 'partial');
  assert.equal(String(evaluationRow.status) === 'partial', false);
  const report = readJson(path.join(failing.config.output_root, 'run-cli-blocked', 'report.json'));
  assert.ok(report.remaining_gaps.length >= 1, 'the report names the remaining gap');
  assert.ok(report.remaining_gaps.some((gap) => /evaluation/.test(gap)), JSON.stringify(report.remaining_gaps));
});

#!/usr/bin/env node
// Purpose: prove browser evidence hashes are bound to source bytes and survive complete release reconciliation.

'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const driver = require('./transfer-assessment-browser-e2e');
const release = require('./transfer-assessment-release');

const SCENARIO_IDS = [
  'US1-S1', 'US1-S2', 'US1-S3', 'US1-S4', 'US1-S5', 'US1-S6',
  'US2-S1', 'US2-S2', 'US2-S3', 'US3-S1', 'US3-S2'
];
const LANE_IDS = ['activation', 'attacks', 'browser', 'privacy', 'rollback'];

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'transfer-binding-'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function makeEvidence(dir) {
  const sourcePath = path.join(dir, 'source.json');
  fs.writeFileSync(sourcePath, '{"observed":"pass"}\n');
  const ref = { path: sourcePath, sha256: sha256(fs.readFileSync(sourcePath)) };
  const scenarioResults = Object.fromEntries(SCENARIO_IDS.map((scenarioId) => [scenarioId, {
    scenario_id: scenarioId,
    status: 'pass',
    reason: 'observed',
    verified_at: '2026-09-24T12:00:00.000Z',
    principal_context: `browser-binding:${scenarioId}`,
    evidence: [ref],
  }]));
  const laneRows = Object.fromEntries(LANE_IDS.map((laneId) => [laneId, {
    lane_id: laneId,
    status: 'pass',
    reason: 'observed',
    verified_at: '2026-09-24T12:00:00.000Z',
    principal_context: `browser-binding:${laneId}`,
    evidence: [ref],
  }]));
  return {
    sourcePath,
    bundle: {
      browser: { schema: 1, run_id: 'binding-run-1', status: 'pass', scenario_results: scenarioResults, evidence: [ref] },
      privacy: { schema: 1, run_id: 'binding-run-1', lane_id: 'privacy', status: 'pass', reason: 'clean', evidence: [ref] },
      attacks: { schema: 1, run_id: 'binding-run-1', lane_id: 'attacks', status: 'pass', attack_results: [], evidence: [ref] },
      activation: { schema: 1, run_id: 'binding-run-1', lane_id: 'activation', status: 'pass', enabled: false, evidence: [ref] },
      rollback: {
        schema: 1,
        run_id: 'binding-run-1',
        lane_id: 'rollback',
        status: 'pass',
        destructive: false,
        protected_state_before: 'same-state',
        protected_state_after: 'same-state',
        evidence: [ref],
      },
      lanes: laneRows,
    },
  };
}

function config(dir) {
  return {
    environment: { app_origin: 'http://127.0.0.1:3001', supabase_origin: 'http://127.0.0.1:54321', isolated: true },
    principals: {
      teacher: { application_user_id: 'teacher-1', credential_env: 'TRANSFER_RELEASE_TEACHER_EMAIL' },
      learner: { application_user_id: 'learner-1', credential_env: 'TRANSFER_RELEASE_LEARNER_EMAIL' },
    },
    browser: { workflow: 'configured-workflow', evidence_root: dir },
    capability: { flag: 'TRANSFER_ASSESSMENT_ENABLED', expected_state: 'disabled' },
  };
}

function writeReleaseFixture(dir, browserDir) {
  const upstreamDir = path.join(dir, 'upstream');
  const outputDir = path.join(dir, 'release');
  fs.mkdirSync(upstreamDir);
  for (const [gateId, fileName] of [['backend_boundary', 'backend.json'], ['room_ui', 'room-ui.json'], ['evaluation', 'evaluation.json']]) {
    fs.writeFileSync(path.join(upstreamDir, fileName), `${JSON.stringify({ gate_id: gateId, status: 'pass', reason: 'upstream pass', run_id: `${gateId}-run` })}\n`);
  }
  const manifestPath = path.join(dir, 'scenarios.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({ schema: 1, scenarios: SCENARIO_IDS.map((id) => ({ id, title: id })) })}\n`);
  const configPath = path.join(dir, 'release-config.json');
  fs.writeFileSync(configPath, `${JSON.stringify({
    schema: 1,
    output_root: outputDir,
    environment: { app_origin: 'http://127.0.0.1:3001', supabase_origin: 'http://127.0.0.1:54321', isolated: true },
    principals: {
      teacher: { application_user_id: 'teacher-1', credential_env: 'TRANSFER_RELEASE_TEACHER_EMAIL' },
      learner: { application_user_id: 'learner-1', credential_env: 'TRANSFER_RELEASE_LEARNER_EMAIL' },
    },
    capability: { flag: 'TRANSFER_ASSESSMENT_ENABLED', expected_state: 'disabled' },
    upstream_evidence: [
      { gate_id: 'backend_boundary', path: 'backend.json' },
      { gate_id: 'room_ui', path: 'room-ui.json' },
      { gate_id: 'evaluation', path: 'evaluation.json' },
    ],
    scenarios: { manifest: manifestPath, required: true },
  }, null, 2)}\n`);
  return { upstreamDir, outputDir, configPath, browserDir };
}

test('evidence verification binds hashes to source bytes and detects source mutation', async () => {
  const dir = tempDir();
  const fixture = makeEvidence(dir);
  const result = await driver.runBrowserEvidence({
    config: config(dir),
    env: { TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test', TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test' },
    outputDir: dir,
    runId: 'binding-run-1',
    browserAdapter: { run: async () => fixture.bundle },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(driver.verifyEvidenceBundle(result.dir).ok, true);
  const stored = JSON.parse(fs.readFileSync(path.join(result.dir, 'browser.json'), 'utf8'));
  const storedReference = stored.evidence[0];
  fs.writeFileSync(fixture.sourcePath, '{"observed":"changed"}\n');
  const dirty = driver.verifyEvidenceBundle(result.dir);
  assert.equal(dirty.ok, false);
  assert.ok(dirty.problems.some((problem) => problem.reason === 'artifact_hash_mismatch'));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.dir, 'browser.json'), 'utf8')).evidence[0], storedReference);
  assert.equal(fs.readFileSync(path.join(result.dir, 'browser.json'), 'utf8').includes('changed'), false);
});

test('invalid hash and missing principal context are independently rejected on existing evidence', () => {
  const dir = tempDir();
  const fixture = makeEvidence(dir);
  const badHash = JSON.parse(JSON.stringify(fixture.bundle));
  badHash.lanes.browser.evidence = [{ path: fixture.sourcePath, sha256: '0'.repeat(64) }];
  const hashResult = driver.validateEvidenceBundle(badHash);
  assert.equal(hashResult.ok, false);
  assert.ok(hashResult.problems.some((problem) => problem.reason === 'artifact_hash_mismatch'));

  const badContext = JSON.parse(JSON.stringify(fixture.bundle));
  badContext.lanes.browser.principal_context = '';
  const contextResult = driver.validateEvidenceBundle(badContext);
  assert.equal(contextResult.ok, false);
  assert.ok(contextResult.problems.some((problem) => problem.reason === 'missing_principal_context'));
});

test('release reconciliation preserves every scenario and lane evidence reference', async () => {
  const dir = tempDir();
  const fixture = makeEvidence(dir);
  const result = await driver.runBrowserEvidence({
    config: config(dir),
    env: { TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test', TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test' },
    outputDir: dir,
    runId: 'binding-run-2',
    browserAdapter: { run: async () => fixture.bundle },
  });
  const fixtureConfig = writeReleaseFixture(dir, result.dir);
  const releaseRun = release.runRelease({
    configPath: fixtureConfig.configPath,
    evidenceDir: fixtureConfig.upstreamDir,
    browserEvidenceDir: result.dir,
    outputRoot: fixtureConfig.outputDir,
    runId: 'binding-release-1',
    repoRoot: path.resolve(__dirname, '..', '..'),
    env: { TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test', TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test' },
  });
  assert.equal(releaseRun.verdict.decision, 'release_approved');
  const record = JSON.parse(fs.readFileSync(path.join(fixtureConfig.outputDir, 'binding-release-1', 'run-record.json'), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(fixtureConfig.outputDir, 'binding-release-1', 'report.json'), 'utf8'));
  assert.deepEqual(record.scenario_results.map((row) => row.scenario_id).sort(), SCENARIO_IDS.slice().sort());
  assert.deepEqual(record.lane_results.map((row) => row.lane_id).sort(), LANE_IDS.slice().sort());
  for (const row of [...record.scenario_results, ...record.lane_results]) {
    assert.equal(row.status, 'pass');
    assert.ok(row.principal_context);
    assert.equal(row.evidence[0].path, fixture.sourcePath);
    assert.equal(row.evidence[0].sha256, sha256(fs.readFileSync(fixture.sourcePath)));
  }
  for (const row of report.lane_results) {
    assert.ok(row.principal_context);
    assert.equal(row.evidence[0].path, fixture.sourcePath);
    assert.equal(row.evidence[0].sha256, sha256(fs.readFileSync(fixture.sourcePath)));
  }

  const blockedDir = path.join(dir, 'browser-blocked');
  fs.mkdirSync(blockedDir);
  for (const name of ['browser', 'privacy', 'attacks', 'activation', 'rollback']) {
    const value = JSON.parse(fs.readFileSync(path.join(result.dir, `${name}.json`), 'utf8'));
    if (name === 'browser') {
      value.scenario_results['US3-S1'].status = 'fail';
      value.scenario_results['US3-S1'].reason = 'browser activation scenario failed';
    }
    if (name === 'privacy') {
      value.status = 'fail';
      value.reason = 'private material observed';
    }
    fs.writeFileSync(path.join(blockedDir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  const blockedRun = release.runRelease({
    configPath: fixtureConfig.configPath,
    evidenceDir: fixtureConfig.upstreamDir,
    browserEvidenceDir: blockedDir,
    outputRoot: fixtureConfig.outputDir,
    runId: 'binding-release-blocked-1',
    repoRoot: path.resolve(__dirname, '..', '..'),
    env: { TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test', TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test' },
  });
  assert.equal(blockedRun.verdict.decision, 'release_not_approved');
  assert.equal(blockedRun.verdict.activation_eligible, false);
  const blockedReport = JSON.parse(fs.readFileSync(path.join(fixtureConfig.outputDir, 'binding-release-blocked-1', 'report.json'), 'utf8'));
  assert.equal(blockedReport.capability.state, 'disabled');
  assert.equal(blockedReport.feature_flag_state.state, 'disabled');
  assert.equal(blockedReport.rollback_path.destructive, false);
  assert.equal(blockedReport.rollback_path.protected_state_before, blockedReport.rollback_path.protected_state_after);
});

test('release reconciliation rejects browser evidence whose source bytes changed', async () => {
  const dir = tempDir();
  const fixture = makeEvidence(dir);
  const result = await driver.runBrowserEvidence({
    config: config(dir),
    env: { TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test', TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test' },
    outputDir: dir,
    runId: 'binding-release-tampered-browser-1',
    browserAdapter: { run: async () => fixture.bundle },
  });
  const releaseFixture = writeReleaseFixture(dir, result.dir);
  fs.writeFileSync(fixture.sourcePath, '{"observed":"tampered"}\n');

  const releaseRun = release.runRelease({
    configPath: releaseFixture.configPath,
    evidenceDir: releaseFixture.upstreamDir,
    browserEvidenceDir: result.dir,
    outputRoot: releaseFixture.outputDir,
    runId: 'binding-release-tampered-1',
    repoRoot: path.resolve(__dirname, '..', '..'),
    env: { TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test', TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test' },
  });

  assert.equal(releaseRun.verdict.decision, 'release_not_approved');
  assert.deepEqual(releaseRun.verdict.incomplete_lanes, LANE_IDS);
  assert.deepEqual(releaseRun.verdict.incomplete_scenarios, SCENARIO_IDS);
});

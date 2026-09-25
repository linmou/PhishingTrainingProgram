#!/usr/bin/env node
// Purpose: prove the wave-105 browser evidence driver fails closed, preserves privacy and attack evidence, and feeds the release verdict.

'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const driver = require('./transfer-assessment-browser-e2e');
const release = require('./transfer-assessment-release');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LANE_IDS = ['activation', 'attacks', 'browser', 'privacy', 'rollback'];
const SCENARIO_IDS = [
  'US1-S1', 'US1-S2', 'US1-S3', 'US1-S4', 'US1-S5', 'US1-S6',
  'US2-S1', 'US2-S2', 'US2-S3', 'US3-S1', 'US3-S2'
];
const ATTACK_IDS = [
  'forged_identity', 'cross_learner', 'cross_room', 'stale_question', 'direct_write', 'legacy_rpc'
];
const PRIVATE_BASIS = 'A familiar sender is not proof of safety.';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'transfer-browser-e2e-'));
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function evidenceFile(dir, name, value) {
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return { path: filePath, sha256: sha256(fs.readFileSync(filePath)) };
}

function validConfig(dir) {
  return {
    environment: {
      app_origin: 'http://127.0.0.1:3001',
      supabase_origin: 'http://127.0.0.1:54321',
      isolated: true,
    },
    principals: {
      teacher: { application_user_id: 'teacher-1', credential_env: 'TRANSFER_RELEASE_TEACHER_EMAIL' },
      learner: { application_user_id: 'learner-1', credential_env: 'TRANSFER_RELEASE_LEARNER_EMAIL' },
    },
    browser: { workflow: 'configured-workflow', evidence_root: dir },
    capability: { flag: 'TRANSFER_ASSESSMENT_ENABLED', expected_state: 'disabled' },
  };
}

function completeEvidence(dir) {
  const ref = evidenceFile(dir, 'adapter-evidence.json', { run_id: 'browser-run-1', source: 'fake-adapter' });
  const scenarios = Object.fromEntries(SCENARIO_IDS.map((scenarioId) => [scenarioId, {
    scenario_id: scenarioId,
    status: 'pass',
    reason: 'fake adapter observed the declared browser flow',
    verified_at: '2026-09-24T12:00:00.000Z',
    principal_context: `browser-test:${scenarioId}`,
    evidence: [ref],
  }]));
  const lanes = Object.fromEntries(LANE_IDS.map((laneId) => [laneId, {
    lane_id: laneId,
    status: 'pass',
    reason: 'fake adapter recorded the lane',
    verified_at: '2026-09-24T12:00:00.000Z',
    principal_context: `browser-test:${laneId}`,
    evidence: [ref],
  }]));
  return {
    browser: { schema: 1, run_id: 'browser-run-1', status: 'pass', scenario_results: scenarios, evidence: [ref] },
    privacy: { schema: 1, run_id: 'browser-run-1', lane_id: 'privacy', status: 'pass', reason: 'no private material observed', evidence: [ref] },
    attacks: { schema: 1, run_id: 'browser-run-1', lane_id: 'attacks', status: 'pass', attack_results: ATTACK_IDS.map((attackId) => ({ attack_id: attackId, status: 'pass', expected: 'rejected', observed: 'rejected', protected_state_unchanged: true, evidence: [ref] })), evidence: [ref] },
    activation: { schema: 1, run_id: 'browser-run-1', lane_id: 'activation', status: 'pass', enabled: false, evidence: [ref] },
    rollback: {
      schema: 1,
      run_id: 'browser-run-1',
      lane_id: 'rollback',
      status: 'pass',
      destructive: false,
      protected_state_before: 'protected-state-hash',
      protected_state_after: 'protected-state-hash',
      evidence: [ref],
    },
    lanes,
  };
}

test('preflight blocks before browser launch when isolation, principals, or workflow are unavailable', () => {
  const config = validConfig(tempDir());
  const result = driver.validatePreflight({
    config: { ...config, environment: { ...config.environment, isolated: false }, browser: {} },
    env: {},
    browserAvailable: false,
  });
  assert.equal(result.ok, false);
  assert.ok(result.blockers.some((blocker) => /isolated/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /teacher credential/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /learner credential/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /workflow/i.test(blocker)));
  assert.ok(result.blockers.some((blocker) => /browser runtime/i.test(blocker)));
});

test('a blocked run never launches its adapter or persists configured credentials', async () => {
  const dir = tempDir();
  const config = validConfig(dir);
  let launches = 0;
  const result = await driver.runBrowserEvidence({
    config,
    env: {
      TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher-secret@example.test',
      TRANSFER_RELEASE_LEARNER_EMAIL: 'learner-secret@example.test',
    },
    outputDir: dir,
    runId: 'browser-blocked-launch-1',
    browserAdapter: {
      run: async () => {
        launches += 1;
        return completeEvidence(dir);
      },
    },
    browserAvailable: true,
    workflowAvailable: false,
  });
  assert.equal(result.exitCode, 1);
  assert.equal(launches, 0);
  const runDir = path.join(dir, 'browser-blocked-launch-1');
  const files = fs.readdirSync(runDir).filter((name) => name.endsWith('.json'));
  assert.deepEqual(files.slice().sort(), ['activation.json', 'attacks.json', 'browser.json', 'privacy.json', 'rollback.json']);
  const documents = Object.fromEntries(files.map((name) => [name.slice(0, -5), JSON.parse(fs.readFileSync(path.join(runDir, name), 'utf8'))]));
  assert.deepEqual(Object.keys(documents.browser.scenario_results).sort(), SCENARIO_IDS.slice().sort());
  assert.deepEqual(Object.keys(documents).sort(), LANE_IDS.slice().sort());
  for (const document of Object.values(documents)) {
    assert.equal(JSON.stringify(document).includes('teacher-secret@example.test'), false);
    assert.equal(JSON.stringify(document).includes('learner-secret@example.test'), false);
  }
});

test('blocked evidence materializes every lane and declared scenario without secret values', () => {
  const dir = tempDir();
  const bundle = driver.buildBlockedEvidence({
    runId: 'browser-blocked-1',
    blockers: ['teacher credential is missing'],
    evidence: evidenceFile(dir, 'preflight.json', { status: 'blocked' }),
  });
  assert.deepEqual(Object.keys(bundle.lanes).sort(), LANE_IDS.slice().sort());
  assert.deepEqual(Object.keys(bundle.browser.scenario_results).sort(), SCENARIO_IDS.slice().sort());
  assert.equal(bundle.browser.status, 'blocked');
  assert.equal(bundle.privacy.status, 'blocked');
  assert.equal(bundle.attacks.status, 'blocked');
  assert.equal(bundle.activation.status, 'blocked');
  assert.equal(bundle.rollback.status, 'blocked');
  assert.ok(JSON.stringify(bundle).includes('teacher credential is missing'));
  assert.equal(JSON.stringify(bundle).includes('teacher-password'), false);
  assert.equal(driver.validateEvidenceBundle(bundle).ok, true);
});

test('learner evidence is redacted by private field and repeated private value', () => {
  const result = driver.redactLearnerEvidence({
    assessment_key: ['B'],
    transfer_basis: { concept_rule: PRIVATE_BASIS },
    visible_error: `provider rejected the private basis: ${PRIVATE_BASIS}`,
    raw_model_output: { decision: { mode: 'assessment' } },
  });
  const serialized = JSON.stringify(result.value);
  assert.equal(serialized.includes('assessment_key'), false);
  assert.equal(serialized.includes('transfer_basis'), false);
  assert.equal(serialized.includes(PRIVATE_BASIS), false);
  assert.ok(result.applied.length >= 2);
  assert.ok(driver.scanLearnerEvidence({
    assessment_key: ['B'],
    transfer_basis: { concept_rule: PRIVATE_BASIS },
    note: `leaked ${PRIVATE_BASIS}`,
  }).length >= 2);
  assert.deepEqual(driver.scanLearnerEvidence(result.value), []);
});

test('attack integrity fails when an unauthorized operation changes protected state', () => {
  const ref = { path: '/tmp/attack.json', sha256: 'a'.repeat(64) };
  const pass = driver.evaluateAttackResult({
    attackId: 'cross_room',
    expected: 'rejected',
    observed: 'rejected',
    protectedStateBefore: 'before-hash',
    protectedStateAfter: 'before-hash',
    evidence: [ref],
  });
  assert.equal(pass.status, 'pass');
  const mutationOnly = driver.evaluateAttackResult({
    attackId: 'cross_room',
    expected: 'rejected',
    observed: 'rejected',
    protectedStateBefore: 'before-hash',
    protectedStateAfter: 'after-hash',
    evidence: [ref],
  });
  assert.equal(mutationOnly.status, 'fail');
  assert.equal(mutationOnly.protected_state_before, 'before-hash');
  assert.equal(mutationOnly.protected_state_after, 'after-hash');
  const outcomeOnly = driver.evaluateAttackResult({
    attackId: 'cross_room',
    expected: 'rejected',
    observed: 'accepted',
    protectedStateBefore: 'before-hash',
    protectedStateAfter: 'before-hash',
    evidence: [ref],
  });
  assert.equal(outcomeOnly.status, 'fail');
  const fail = driver.evaluateAttackResult({
    attackId: 'cross_room',
    expected: 'rejected',
    observed: 'accepted',
    protectedStateBefore: 'before-hash',
    protectedStateAfter: 'after-hash',
    evidence: [ref],
  });
  assert.equal(fail.status, 'fail');
  assert.match(fail.reason, /protected state|rejected/i);
});

test('an injected complete adapter writes immutable lane and scenario evidence', async () => {
  const dir = tempDir();
  const config = validConfig(dir);
  const result = await driver.runBrowserEvidence({
    config,
    env: {
      TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test',
      TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test',
    },
    outputDir: dir,
    runId: 'browser-complete-1',
    browserAdapter: {
      run: async () => completeEvidence(dir),
    },
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.bundle.browser.status, 'pass');
  assert.deepEqual(Object.keys(result.bundle.browser.scenario_results).sort(), SCENARIO_IDS.slice().sort());
  assert.deepEqual(Object.keys(result.bundle.lanes).sort(), LANE_IDS.slice().sort());
  assert.equal(result.bundle.rollback.destructive, false);
  assert.equal(result.bundle.rollback.protected_state_before, result.bundle.rollback.protected_state_after);
  for (const row of Object.values(result.bundle.browser.scenario_results)) {
    assert.match(row.evidence[0].sha256, /^[0-9a-f]{64}$/);
    assert.equal(fs.existsSync(row.evidence[0].path), true);
    assert.ok(row.principal_context);
  }
  for (const row of Object.values(result.bundle.lanes)) {
    assert.match(row.evidence[0].sha256, /^[0-9a-f]{64}$/);
    assert.equal(fs.existsSync(row.evidence[0].path), true);
    assert.ok(row.principal_context);
  }
  assert.equal(fs.existsSync(path.join(dir, 'browser-complete-1', 'browser.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'browser-complete-1', 'privacy.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'browser-complete-1', 'attacks.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'browser-complete-1', 'activation.json')), true);
  assert.equal(fs.existsSync(path.join(dir, 'browser-complete-1', 'rollback.json')), true);

  const invalid = JSON.parse(JSON.stringify(result.bundle));
  invalid.lanes.browser.evidence = [{ path: path.join(dir, 'missing.json'), sha256: 'invalid' }];
  assert.equal(driver.validateEvidenceBundle(invalid).ok, false);
  const missingContext = JSON.parse(JSON.stringify(result.bundle));
  missingContext.lanes.browser.principal_context = '';
  assert.equal(driver.validateEvidenceBundle(missingContext).ok, false);
});

test('release runner consumes browser evidence and does not leave lanes blocked', () => {
  const dir = tempDir();
  const evidenceDir = path.join(dir, 'upstream');
  const outputDir = path.join(dir, 'release');
  fs.mkdirSync(evidenceDir);
  const manifestPath = path.join(dir, 'scenarios.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify({ schema: 1, scenarios: SCENARIO_IDS.map((id) => ({ id })) })}\n`);
  for (const [gateId, fileName] of [['backend_boundary', 'backend.json'], ['room_ui', 'room-ui.json'], ['evaluation', 'evaluation.json']]) {
    fs.writeFileSync(path.join(evidenceDir, fileName), `${JSON.stringify({ gate_id: gateId, status: 'pass', reason: 'upstream pass', run_id: `${gateId}-run` })}\n`);
  }
  const configPath = path.join(dir, 'config.json');
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
  const browserDir = path.join(dir, 'browser');
  fs.mkdirSync(browserDir);
  const complete = completeEvidence(browserDir);
  for (const [name, value] of Object.entries(complete)) {
    if (name === 'lanes') continue;
    fs.writeFileSync(path.join(browserDir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  const run = release.runRelease({
    configPath,
    evidenceDir,
    browserEvidenceDir: browserDir,
    outputRoot: outputDir,
    runId: 'release-browser-1',
    repoRoot: REPO_ROOT,
    env: {
      TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test',
      TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test',
    },
  });
  assert.deepEqual(run.verdict.incomplete_lanes, []);
  assert.deepEqual(run.verdict.incomplete_scenarios, []);
  assert.equal(run.verdict.decision, 'release_approved');
  const record = JSON.parse(fs.readFileSync(path.join(outputDir, 'release-browser-1', 'run-record.json'), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'release-browser-1', 'report.json'), 'utf8'));
  const scenarioRow = record.scenario_results.find((row) => row.scenario_id === 'US1-S1');
  assert.ok(scenarioRow.principal_context);
  assert.match(scenarioRow.evidence[0].sha256, /^[0-9a-f]{64}$/);
  const browserLane = report.lane_results.find((row) => row.lane_id === 'browser');
  assert.ok(browserLane.principal_context);
  assert.match(browserLane.evidence[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(report.rollback_path.destructive, false);
  assert.equal(report.rollback_path.protected_state_before, report.rollback_path.protected_state_after);

  const blockedBrowserDir = path.join(dir, 'browser-blocked');
  fs.mkdirSync(blockedBrowserDir);
  const blockedEvidence = completeEvidence(blockedBrowserDir);
  blockedEvidence.browser.scenario_results['US3-S1'].status = 'fail';
  blockedEvidence.browser.scenario_results['US3-S1'].reason = 'activation check failed';
  blockedEvidence.privacy.status = 'fail';
  blockedEvidence.privacy.reason = 'private material observed';
  blockedEvidence.lanes.privacy.status = 'fail';
  blockedEvidence.lanes.privacy.reason = 'private material observed';
  for (const [name, value] of Object.entries(blockedEvidence)) {
    if (name === 'lanes') continue;
    fs.writeFileSync(path.join(blockedBrowserDir, `${name}.json`), `${JSON.stringify(value, null, 2)}\n`);
  }
  const blockedRun = release.runRelease({
    configPath,
    evidenceDir,
    browserEvidenceDir: blockedBrowserDir,
    outputRoot: outputDir,
    runId: 'release-browser-blocked-1',
    repoRoot: REPO_ROOT,
    env: {
      TRANSFER_RELEASE_TEACHER_EMAIL: 'teacher@example.test',
      TRANSFER_RELEASE_LEARNER_EMAIL: 'learner@example.test',
    },
  });
  assert.equal(blockedRun.verdict.decision, 'release_not_approved');
  assert.ok(blockedRun.verdict.incomplete_lanes.includes('privacy'));
  assert.ok(blockedRun.verdict.incomplete_scenarios.includes('US3-S1'));
  assert.equal(blockedRun.verdict.activation_eligible, false);
  const blockedReport = JSON.parse(fs.readFileSync(path.join(outputDir, 'release-browser-blocked-1', 'report.json'), 'utf8'));
  assert.equal(blockedReport.capability.state, 'disabled');
  assert.equal(blockedReport.feature_flag_state.state, 'disabled');
  assert.equal(blockedReport.rollback_path.destructive, false);
  assert.equal(blockedReport.rollback_path.protected_state_before, blockedReport.rollback_path.protected_state_after);
});

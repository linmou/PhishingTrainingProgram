#!/usr/bin/env node
// Purpose: run browser workflows against the selected staging or production fixture rooms.
// Environment setup: see ../docs/browser-e2e-testing.md, "Run The Live Suite".
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const support = require('./browser-e2e/browser-e2e-support');
const { acquireFixtureLock } = require('./browser-e2e/fixture-lock');
const { acquireProjectLock } = require('../../scripts/staging-coordination');

const workflows = {
  'cyberbullying': require('./browser-e2e/workflows/cyberbullying'),
  'tutor-response': require('./browser-e2e/workflows/tutor-response'),
  'checklist-generation': require('./browser-e2e/workflows/checklist-generation'),
  'room-assessment-setup': require('./browser-e2e/workflows/room-assessment-setup'),
  'checklist-management': require('./browser-e2e/workflows/checklist-management'),
  'checklist-coverage': require('./browser-e2e/workflows/checklist-coverage'),
  'guard-mode': require('./browser-e2e/workflows/guard-mode'),
  'assessment-delivery': require('./browser-e2e/workflows/assessment-delivery'),
  'assessment-answer': require('./browser-e2e/workflows/assessment-answer'),
  'assessment-security': require('./browser-e2e/workflows/assessment-security'),
  'assessment-privacy': require('./browser-e2e/workflows/assessment-privacy'),
  'assessment-configuration': require('./browser-e2e/workflows/assessment-configuration'),
  'transfer-status-events': require('./browser-e2e/workflows/transfer-status-events'),
  'early-message-recheck': require('./browser-e2e/workflows/early-message-recheck')
};

function selectWorkflows(argv) {
  if (argv.length === 0) return Object.keys(workflows).filter(name => !['assessment-security', 'assessment-privacy', 'assessment-configuration'].includes(name));
  if (argv.length !== 1 || !argv[0].startsWith('--workflow=')) {
    throw new Error(`Use --workflow=<name>; available: ${Object.keys(workflows).join(', ')}`);
  }
  const name = argv[0].slice('--workflow='.length);
  if (!Object.hasOwn(workflows, name)) throw new Error(`Unknown workflow ${name}; available: ${Object.keys(workflows).join(', ')}`);
  return [name];
}

async function runWorkflows(selected, context, report, evidenceDir, registry = workflows) {
  for (const name of selected) {
    const roomCount = report.room_ids.length;
    try {
      report.results[name] = { status: 'pass', evidence: await registry[name](context) };
    } catch (error) {
      report.results[name] = {
        status: 'fail', error: error.stack || String(error),
        fixture_cleanup_failed: error.cleanupFailed === true,
        screenshots: [
          await support.screenshot(context.tutorPage, evidenceDir, `${name}-tutor-failure`).catch(() => null),
          await support.screenshot(context.studentPage, evidenceDir, `${name}-learner-failure`).catch(() => null)
        ].filter(Boolean)
      };
    }
    const usedRooms = [...new Set(report.room_ids.slice(roomCount))];
    report.results[name].cleanup = [];
    if (usedRooms.length > 0 && context.detachRooms) await context.detachRooms();
    for (const roomId of usedRooms) {
      try {
        if (context.cleanupRoom) await context.cleanupRoom(roomId);
        report.results[name].cleanup.push({ room_id: roomId, status: 'pass' });
      } catch (error) {
        report.results[name].status = 'fail';
        report.results[name].cleanup.push({ room_id: roomId, status: 'fail', error: error.stack || String(error) });
      }
    }
    support.writeJson(path.join(evidenceDir, 'report.json'), report);
  }
  return selected.every((name) => report.results[name]?.status === 'pass');
}

function shouldRetainLease(report) {
  return Boolean(report.browser_close_error || report.lock_release_error ||
    (report.error && report.room_ids.length > 0) ||
    Object.values(report.results).some(result => result.fixture_cleanup_failed ||
      result.cleanup?.some(item => item.status !== 'pass')));
}

async function main(argv = process.argv.slice(2)) {
  const selected = selectWorkflows(argv);
  const config = support.configFromEnv();
  if (selected.some(name => ['assessment-security', 'assessment-privacy', 'assessment-configuration'].includes(name))) workflows['assessment-security'].assertStaging(config);
  const runId = `${new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
  const repoRoot = path.resolve(support.tutorRoot, '..');
  const evidenceDir = path.join(repoRoot, 'tmp/browser_demo_runs', `${support.TARGET}-template-${runId}`);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const report = {
    run_id: runId, project_ref: support.PROJECT, fixture_version: support.FIXTURE_VERSION,
    room_fixtures: support.ROOMS,
    runner_sha256: crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),
    workflow_sha256: Object.fromEntries(selected.map((name) => [name,
      crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'browser-e2e/workflows', `${name}.js`))).digest('hex')])),
    commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim(),
    selected, started_at: new Date().toISOString(), room_ids: [], user_ids: [], results: {}, status: 'running'
  };
  support.writeJson(path.join(evidenceDir, 'report.json'), report);
  const client = createClient(config.projectUrl, config.serviceKey, { global: { headers: { 'x-practice-contract': 'cyberbullying-v2' } }, auth: { persistSession: false } });
  let browser;
  let fixtureLock;
  let coordination;
  try {
    fixtureLock = acquireFixtureLock(config.projectRef, { runId });
    report.fixture_lock = { scope: 'same-host', directory: fixtureLock.directory, owner: fixtureLock.owner };
    coordination = acquireProjectLock(config.projectRef, { operation: 'browser-e2e', commit: report.commit, runId, evidenceDir });
    report.coordination = { ref: coordination.ref, tag_sha: coordination.tag_sha, owner: coordination.owner,
      borrowed: coordination.borrowed, lease_file: coordination.leaseFile };
    support.writeJson(path.join(evidenceDir, 'report.json'), report);
    await support.managementQuery(config, 'select 1 as ready');
    browser = await chromium.launch({ headless: true });
    const videoOptions = process.env.E2E_RECORD_VIDEO === '1'
      ? { recordVideo: { dir: path.join(evidenceDir, 'raw-video'), size: { width: 1280, height: 800 } } }
      : {};
    const tutorContext = await browser.newContext(videoOptions);
    const studentContext = await browser.newContext(videoOptions);
    const tutorTraffic = await support.guardProject(tutorContext);
    const studentTraffic = await support.guardProject(studentContext);
    const tutorPage = await tutorContext.newPage();
    const studentPage = await studentContext.newPage();
    const tutorName = process.env.E2E_TUTOR_NAME || 'DemoTutor_213782';
    const studentName = process.env.E2E_STUDENT_NAME || 'E2E Learner 20260930062117-f2501ed1';
    report.user_names = [tutorName, studentName];
    support.writeJson(path.join(evidenceDir, 'report.json'), report);
    await support.joinAs(tutorPage, config.appUrl, tutorName, 'tutor');
    support.assertProjectTraffic(tutorTraffic);
    const tutor = (await support.query(client, 'users', 'id,display_name', 'display_name', tutorName))[0];
    if (!tutor?.id) throw new Error(`Tutor browser identity was not stored in ${support.TARGET}`);
    report.user_ids.push(tutor.id);
    await support.joinAs(studentPage, config.appUrl, studentName, 'student');
    support.assertProjectTraffic(studentTraffic);
    const student = (await support.query(client, 'users', 'id,display_name', 'display_name', studentName))[0];
    if (!student?.id) throw new Error(`Learner browser identity was not stored in ${support.TARGET}`);
    report.user_ids.push(student.id);
    support.writeJson(path.join(evidenceDir, 'report.json'), report);
    const context = {
      tutorPage, studentPage, client, config, appUrl: config.appUrl, tutor, student, runId, evidenceDir,
      createdRooms: new Set(),
      detachRooms: async () => {
        await Promise.all([tutorPage.goto('about:blank'), studentPage.goto('about:blank')]);
      },
      existingRoom: async (kind) => {
        const room = await support.existingRoom(client, kind, tutor.id);
        report.room_ids.push(room.id);
        support.writeJson(path.join(evidenceDir, 'report.json'), report);
        return room;
      },
      registerCreatedRoom: (roomId) => {
        context.createdRooms.add(roomId);
        report.room_ids.push(roomId);
        support.writeJson(path.join(evidenceDir, 'report.json'), report);
      },
      cleanupRoom: (roomId) => context.createdRooms.has(roomId)
        ? support.cleanupCreatedRoom(config, roomId, tutor.id)
        : support.cleanupRoom(config, roomId)
    };
    report.status = await runWorkflows(selected, context, report, evidenceDir) ? 'pass' : 'fail';
  } catch (error) {
    report.status = 'fail';
    report.error = error.stack || String(error);
  } finally {
    try {
      if (browser) await browser.close();
    } catch (error) {
      report.status = 'fail';
      report.browser_close_error = error.stack || String(error);
    }
    try {
      if (fixtureLock) fixtureLock.release();
    } catch (error) {
      report.status = 'fail';
      report.lock_release_error = error.stack || String(error);
    }
    if (coordination) {
      const unsafe = shouldRetainLease(report);
      if (unsafe) {
        report.coordination.retained = true;
      } else {
        try { coordination.release(); report.coordination.released = !coordination.borrowed; }
        catch (error) { report.status = 'fail'; report.coordination.release_error = error.stack || String(error); }
      }
    }
    report.completed_at = new Date().toISOString();
    support.writeJson(path.join(evidenceDir, 'report.json'), report);
  }
  process.stdout.write(`${JSON.stringify({ status: report.status, evidence: evidenceDir, room_ids: report.room_ids, results: Object.fromEntries(Object.entries(report.results).map(([name, result]) => [name, result.status])) })}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

module.exports = { selectWorkflows, runWorkflows, shouldRetainLease, main, ...support };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

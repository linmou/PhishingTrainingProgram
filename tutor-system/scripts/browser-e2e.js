#!/usr/bin/env node
// Purpose: run browser workflows against the selected staging or production fixture rooms.
// Environment setup: see ../claude_docs/browser-e2e-testing.md, "Run The Live Suite".
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const support = require('./browser-e2e/browser-e2e-support');

const workflows = {
  'tutor-response': require('./browser-e2e/workflows/tutor-response'),
  'checklist-generation': require('./browser-e2e/workflows/checklist-generation'),
  'checklist-management': require('./browser-e2e/workflows/checklist-management'),
  'checklist-coverage': require('./browser-e2e/workflows/checklist-coverage'),
  'guard-mode': require('./browser-e2e/workflows/guard-mode'),
  'assessment-delivery': require('./browser-e2e/workflows/assessment-delivery'),
  'assessment-answer': require('./browser-e2e/workflows/assessment-answer'),
  'transfer-status-events': require('./browser-e2e/workflows/transfer-status-events')
};

function selectWorkflows(argv) {
  if (argv.length === 0) return Object.keys(workflows);
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
        screenshots: [
          await support.screenshot(context.tutorPage, evidenceDir, `${name}-tutor-failure`).catch(() => null),
          await support.screenshot(context.studentPage, evidenceDir, `${name}-learner-failure`).catch(() => null)
        ].filter(Boolean)
      };
    }
    const usedRooms = [...new Set(report.room_ids.slice(roomCount))];
    report.results[name].cleanup = [];
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

async function main(argv = process.argv.slice(2)) {
  const selected = selectWorkflows(argv);
  const config = support.configFromEnv();
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
  const client = createClient(config.projectUrl, config.serviceKey, { auth: { persistSession: false } });
  let browser;
  try {
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
      existingRoom: async (kind) => {
        const room = await support.existingRoom(client, kind, tutor.id);
        report.room_ids.push(room.id);
        support.writeJson(path.join(evidenceDir, 'report.json'), report);
        return room;
      },
      cleanupRoom: (roomId) => support.cleanupRoom(config, roomId)
    };
    report.status = await runWorkflows(selected, context, report, evidenceDir) ? 'pass' : 'fail';
  } catch (error) {
    report.status = 'fail';
    report.error = error.stack || String(error);
  } finally {
    if (browser) await browser.close();
    report.completed_at = new Date().toISOString();
    support.writeJson(path.join(evidenceDir, 'report.json'), report);
  }
  process.stdout.write(`${JSON.stringify({ status: report.status, evidence: evidenceDir, room_ids: report.room_ids, results: Object.fromEntries(Object.entries(report.results).map(([name, result]) => [name, result.status])) })}\n`);
  if (report.status !== 'pass') process.exitCode = 1;
}

module.exports = { selectWorkflows, runWorkflows, main, ...support };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

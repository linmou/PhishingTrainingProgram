'use strict';

// A fail-closed same-host lock for shared Supabase browser fixtures.
// This does NOT coordinate other machines or external staging deployments.
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const defaultRoot = path.join(os.homedir(), '.cache', 'phishing-training-program', 'fixture-locks');

function acquireFixtureLock(projectRef, { lockRoot = defaultRoot, runId = crypto.randomUUID() } = {}) {
  if (typeof projectRef !== 'string' || !/^[a-z0-9_-]{3,80}$/.test(projectRef)) {
    throw new Error('A safe Supabase project reference is required for the fixture lock');
  }
  if (typeof runId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(runId)) {
    throw new Error('A safe run ID is required for the fixture lock');
  }
  fs.mkdirSync(lockRoot, { recursive: true, mode: 0o700 });
  const directory = path.join(lockRoot, projectRef + '.lock');
  const marker = path.join(directory, 'owner.json');
  try {
    // mkdir is atomic across processes on the same local filesystem.
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let owner = 'unknown (an earlier run may have crashed)';
    try {
      const current = JSON.parse(fs.readFileSync(marker, 'utf8'));
      owner = 'run=' + current.run_id + ', pid=' + current.pid + ', host=' + current.host;
    } catch (_) {
      // Never auto-reclaim; the run might still be active.
    }
    throw new Error('Shared Supabase browser fixtures are locked for ' + projectRef +
      ' (' + owner + '). Confirm the owner is stopped before manually removing this lock.');
  }
  const owner = {
    run_id: runId,
    project_ref: projectRef,
    pid: process.pid,
    host: os.hostname(),
    started_at: new Date().toISOString()
  };
  try {
    fs.writeFileSync(marker, JSON.stringify(owner, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  } catch (error) {
    fs.rmdirSync(directory);
    throw error;
  }
  let released = false;
  return {
    directory,
    owner,
    release() {
      if (released) return;
      const current = JSON.parse(fs.readFileSync(marker, 'utf8'));
      if (current.run_id !== owner.run_id || current.pid !== owner.pid ||
          current.host !== owner.host || current.project_ref !== owner.project_ref) {
        throw new Error('Fixture lock ownership changed: refusing to remove ' + directory);
      }
      fs.unlinkSync(marker);
      fs.rmdirSync(directory);
      released = true;
    }
  };
}

module.exports = { acquireFixtureLock, defaultRoot };

#!/usr/bin/env node
// Purpose: coordinate shared Supabase verification and deployments across machines through one atomic GitHub reference.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPOSITORY = 'linmou/PhishingTrainingProgram';
const STAGING = 'ciubrzggdqesgvfkpolj';
const LEASE_ENV = 'PTP_COORDINATION_LEASE';

function github(method, endpoint, body) {
  const args = ['api', '--method', method, endpoint];
  if (body) args.push('--input', '-');
  const result = execFileSync('gh', args, { input: body ? JSON.stringify(body) : undefined,
    encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return result.trim() ? JSON.parse(result) : null;
}

function reference(project) {
  if (!/^[a-z]{20}$/.test(project)) throw new Error('A Supabase project reference is required');
  return 'tags/verification-locks/' + project;
}

function verifyLease(lease, project, api = github) {
  assert.equal(lease.repository, REPOSITORY, 'Coordination repository mismatch');
  assert.equal(lease.project, project, 'Coordination project mismatch');
  assert.equal(lease.ref, reference(project), 'Coordination reference mismatch');
  const remote = api('GET', `repos/${REPOSITORY}/git/ref/${lease.ref}`);
  assert.equal(remote.object.sha, lease.tag_sha, 'Remote lease ownership changed');
  const tag = api('GET', `repos/${REPOSITORY}/git/tags/${lease.tag_sha}`);
  assert.equal(JSON.parse(tag.message).token, lease.owner.token, 'Remote lease token changed');
}

function acquireProjectLock(project, { operation, commit, runId = crypto.randomUUID(),
  evidenceDir, env = process.env, api = github } = {}) {
  if (!operation || !commit || !evidenceDir) throw new Error('Operation, commit and evidence directory are required');
  if (env[LEASE_ENV]) {
    const lease = JSON.parse(fs.readFileSync(env[LEASE_ENV], 'utf8'));
    verifyLease(lease, project, api);
    assert.equal(lease.owner.commit, commit, 'Borrowed lease belongs to another candidate commit');
    return { ...lease, leaseFile: env[LEASE_ENV], borrowed: true, release() { verifyLease(lease, project, api); } };
  }
  fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  const leaseFile = path.join(evidenceDir, 'coordination-lease.json');
  if (fs.existsSync(leaseFile)) throw new Error('Coordination evidence directory is already in use');
  const owner = { token: crypto.randomUUID(), run_id: runId, operation, commit,
    host: crypto.createHash('sha256').update(os.hostname()).digest('hex').slice(0, 12), pid: process.pid, started_at: new Date().toISOString(),
    actions_run: env.GITHUB_RUN_ID ? `${env.GITHUB_RUN_ID}/${env.GITHUB_RUN_ATTEMPT}` : null };
  const ref = reference(project);
  // Annotated tag is immutable; creation of its shared ref is the atomic claim.
  const anchor = api('GET', `repos/${REPOSITORY}/git/ref/heads/no_sign_up`);
  const tag = api('POST', `repos/${REPOSITORY}/git/tags`, {
    tag: ref.slice('tags/'.length), message: JSON.stringify(owner), object: anchor.object.sha, type: 'commit'
  });
  const lease = { repository: REPOSITORY, project, ref, tag_sha: tag.sha, owner, status: 'claiming' };
  fs.writeFileSync(leaseFile, JSON.stringify(lease, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  try {
    api('POST', `repos/${REPOSITORY}/git/refs`, { ref: 'refs/' + ref, sha: tag.sha });
  } catch (error) {
    lease.status = 'claim-failed';
    lease.claim_error = error.message;
    fs.writeFileSync(leaseFile, JSON.stringify(lease, null, 2) + '\n');
    throw new Error(`Shared project ${project} lease unavailable; another machine may own it. Inspect ${ref}. Evidence: ${leaseFile}`);
  }
  lease.status = 'held';
  fs.writeFileSync(leaseFile, JSON.stringify(lease, null, 2) + '\n');
  let released = false;
  return { ...lease, leaseFile, borrowed: false,
    release() {
      if (released) return;
      verifyLease(lease, project, api);
      api('DELETE', `repos/${REPOSITORY}/git/refs/${ref}`);
      released = true;
      lease.status = 'released';
      lease.released_at = new Date().toISOString();
      fs.writeFileSync(leaseFile, JSON.stringify(lease, null, 2) + '\n');
    }
  };
}

function releaseLease(leaseFile, api = github) {
  const lease = JSON.parse(fs.readFileSync(leaseFile, 'utf8'));
  verifyLease(lease, lease.project, api);
  api('DELETE', `repos/${REPOSITORY}/git/refs/${lease.ref}`);
  lease.status = 'released';
  lease.released_at = new Date().toISOString();
  fs.writeFileSync(leaseFile, JSON.stringify(lease, null, 2) + '\n');
}

async function withProjectLock(project, operation, action, env = process.env) {
  const root = path.resolve(__dirname, '..');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const evidenceDir = path.join(root, 'output/coordination', crypto.randomUUID());
  const lock = acquireProjectLock(project, { operation, commit, evidenceDir, env });
  const previous = env[LEASE_ENV];
  env[LEASE_ENV] = lock.leaseFile;
  try {
    const result = await action(lock);
    if (process.exitCode || (typeof result === 'number' && result !== 0)) {
      throw new Error('Coordinated operation failed');
    }
    lock.release();
    return result;
  } catch (error) {
    process.stderr.write(`Lease retained for inspection/recovery: ${lock.leaseFile}\n`);
    throw error;
  } finally {
    if (previous === undefined) delete env[LEASE_ENV];
    else env[LEASE_ENV] = previous;
  }
}

async function main(args = process.argv.slice(2)) {
  if (args[0] === 'release' && args.length === 2) return releaseLease(args[1]);
  if (args[0] === 'run' && args[1] === '--' && args.length > 2) {
    return withProjectLock(STAGING, 'manual-staging-operation', () => {
      execFileSync(args[2], args.slice(3), { stdio: 'inherit' });
    });
  }
  if (args[0] !== 'acquire' || args.length !== 2) throw new Error('Usage: staging-coordination.js acquire <evidence-directory> | release <lease.json> | run -- <command> [args]');
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const lock = acquireProjectLock(STAGING, { operation: 'staging-release', commit, evidenceDir: path.resolve(args[1]) });
  if (process.env.GITHUB_ENV) fs.appendFileSync(process.env.GITHUB_ENV, `${LEASE_ENV}=${lock.leaseFile}\n`);
  console.log(lock.leaseFile);
}

module.exports = { REPOSITORY, STAGING, LEASE_ENV, github, reference, verifyLease, acquireProjectLock, releaseLease, withProjectLock, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

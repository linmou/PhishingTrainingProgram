#!/usr/bin/env node
// Tests .github/scripts/pr-approval-policy.cjs: approval trust, current-candidate binding and GitHub event/check integration.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, fingerprint, run } = require('./pr-approval-policy.cjs');
const HEAD = 'a'.repeat(40), BASE = 'b'.repeat(40), POLICY = 'c'.repeat(64);
const before = '2026-10-27T01:00:00Z', after = '2026-10-27T01:01:00Z';
const bot = { id: 199175422, login: 'chatgpt-codex-connector[bot]', type: 'Bot' };
const human = { id: 1, login: 'owner', type: 'User' };
function fixture(decision = 'automatic') {
  const a = { head_sha: HEAD, base_sha: BASE, policy_sha256: POLICY, decision, blocking_findings: false,
    reasons: decision === 'human' ? [{ code: 'security', detail: 'Changes an authorization boundary.' }] : [] };
  const comment = { id: 10, user: bot, performed_via_github_app: { id: 1144995 },
    created_at: before, updated_at: before,
    body: '<!-- codex-risk-assessment:v1 -->\n```json\n' + JSON.stringify(a) + '\n```' };
  const review = { ...comment, id: 11, body: '<!-- codex-review-state:v1 ' +
    JSON.stringify({ code_review: { commit_sha: HEAD, status: 'completed', has_unresolved_findings: false } }) + ' -->' };
  return { pr: { number: 42, state: 'open', draft: false, head: { sha: HEAD }, base: { sha: BASE, ref: 'no_sign_up' }, user: human },
    comments: [comment, review], reviews: [], permissions: { owner: 'admin', reviewer: 'write' },
    files: [{ filename: 'tutor-system/src/example.ts' }], policyHash: POLICY };
}
function changeAssessment(f, patch) {
  const c = f.comments[0];
  const a = JSON.parse(c.body.split('```json\n')[1].split('\n```')[0]);
  c.body = '<!-- codex-risk-assessment:v1 -->\n```json\n' + JSON.stringify({ ...a, ...patch }) + '\n```';
}
function approve(f, body) {
  f.comments.push({ id: 20, user: human, body: body || `/approve-risk ${HEAD} ${fingerprint(f.comments[0].body)}`,
    created_at: after, updated_at: after });
}
test('allows a current trusted automatic decision after completed code review', () => {
  assert.equal(evaluate(fixture()).allowed, true);
});
test('blocks missing, stale head/base/policy, malformed and unknown classification output', () => {
  for (const patch of [{ head_sha: 'd'.repeat(40) }, { base_sha: 'd'.repeat(40) },
    { policy_sha256: 'd'.repeat(64) }, { decision: 'guess' }, { blocking_findings: 'false' },
    { decision: 'human', reasons: [{ code: 'unknown', detail: 'x' }] }]) {
    const f = fixture(); changeAssessment(f, patch); assert.equal(evaluate(f).allowed, false);
  }
  const f = fixture(); f.comments.shift(); assert.equal(evaluate(f).allowed, false);
  f.comments.unshift({ ...fixture().comments[0], body: '<!-- codex-risk-assessment:v1 --> invalid' });
  assert.equal(evaluate(f).allowed, false);
});
test('rejects assessment spoofing by another account or app', () => {
  for (const patch of [{ user: human }, { user: { ...bot, id: 999 } },
    { performed_via_github_app: { id: 999 } }, { performed_via_github_app: null }]) {
    const f = fixture(); Object.assign(f.comments[0], patch); assert.equal(evaluate(f).allowed, false);
  }
});
test('blocks drafts, incomplete file lists, findings and stale/running code reviews', () => {
  const draft = fixture(); draft.pr.draft = true; assert.equal(evaluate(draft).allowed, false);
  const incomplete = fixture(); incomplete.pr.changed_files = 2; assert.equal(evaluate(incomplete).allowed, false);
  const findings = fixture('human'); changeAssessment(findings, { blocking_findings: true }); approve(findings);
  assert.equal(evaluate(findings).allowed, false);
  for (const state of [{ commit_sha: BASE, status: 'completed', has_unresolved_findings: false },
    { commit_sha: HEAD, status: 'running', has_unresolved_findings: false },
    { commit_sha: HEAD, status: 'completed', has_unresolved_findings: true }]) {
    const f = fixture(); f.comments[1].body = '<!-- codex-review-state:v1 ' + JSON.stringify({ code_review: state }) + ' -->';
    assert.equal(evaluate(f).allowed, false);
  }
});
test('human decisions require current authenticated approval; owner may approve on the PR', () => {
  const f = fixture('human'); assert.equal(evaluate(f).allowed, false); approve(f); assert.equal(evaluate(f).allowed, true);
  f.permissions.owner = 'read'; assert.equal(evaluate(f).allowed, false);
  f.permissions.owner = 'admin'; f.comments.at(-1).user = bot; assert.equal(evaluate(f).allowed, false);
});
test('rejects edited/stale approval, reassessment reuse and honors revocation', () => {
  const f = fixture('human'); approve(f); f.comments.at(-1).updated_at = '2026-10-27T01:02:00Z';
  assert.equal(evaluate(f).allowed, false);
  const g = fixture('human'); approve(g); changeAssessment(g, { reasons: [{ code: 'data', detail: 'New risk' }] });
  assert.equal(evaluate(g).allowed, false);
  const h = fixture('human'); approve(h);
  h.comments.push({ ...h.comments.at(-1), id: 21, body: h.comments.at(-1).body.replace('/approve-risk', '/revoke-risk') });
  assert.equal(evaluate(h).allowed, false);
});
test('enforces policy-control changes even when Codex says automatic, including renamed controls', () => {
  for (const file of [{ filename: 'AGENTS.md' }, { filename: '.github/workflows/new.yml' },
    { filename: 'tutor-system/AGENTS.md' }, { filename: 'elsewhere.md', previous_filename: 'src/AGENTS.md' },
    { filename: 'elsewhere.cjs', previous_filename: '.github/scripts/pr-approval-policy.cjs' }]) {
    const f = fixture(); f.files = [file]; assert.equal(evaluate(f).allowed, false); approve(f); assert.equal(evaluate(f).allowed, true);
  }
});
test('supports current collaborator reviews, blocks outstanding changes, and rejects self/stale reviews', () => {
  const f = fixture('human');
  const r = { id: 30, user: { login: 'reviewer', type: 'User' }, state: 'APPROVED', commit_id: HEAD, submitted_at: after };
  f.reviews = [r]; assert.equal(evaluate(f).allowed, true);
  f.reviews = [{ ...r, commit_id: BASE }]; assert.equal(evaluate(f).allowed, false);
  f.reviews = [{ ...r, user: human }]; assert.equal(evaluate(f).allowed, false);
  approve(f); f.reviews = [{ ...r, state: 'CHANGES_REQUESTED' }]; assert.equal(evaluate(f).allowed, false);
  f.reviews.push({ ...r, id: 31, state: 'COMMENTED' }); assert.equal(evaluate(f).allowed, false);
  f.reviews.push({ ...r, id: 32, state: 'DISMISSED' }); assert.equal(evaluate(f).allowed, true);
});

function api(f, options = {}) {
  const log = [];
  const github = { rest: {
    pulls: { get: async ({ pull_number }) => {
      if (pull_number === options.failNumber) throw new Error('PR unavailable');
      return { data: options.drift && log.length ? { ...f.pr, head: { sha: BASE } } : f.pr };
    },
      list: 'prs', listReviews: 'reviews', listReviewComments: 'reviewComments', listFiles: 'files' },
    issues: { listComments: 'comments', createComment: async args => { log.push(['comment', args]); } },
    repos: { getCollaboratorPermissionLevel: async ({ username }) => ({ data: { permission: f.permissions[username] || 'read' } }) },
    checks: { create: async args => { log.push(['start', args]); return { data: { id: 99 } }; },
      update: async args => { log.push(['finish', args]); } }
  }, paginate: async resource => { if (options.error) throw new Error('API unavailable'); return f[resource] || []; } };
  const context = { repo: { owner: 'test', repo: 'repo' }, payload: { pull_request: { number: 42 } } };
  const summary = { addHeading() { return this; }, addRaw() { return this; }, async write() {} };
  return { github, context, core: { summary }, log };
}
test('GitHub integration publishes a head-bound check, requests assessment and deduplicates events', async () => {
  const f = fixture(); const env = api(f);
  await run(env); assert.equal(env.log[0][0], 'start');
  assert.equal(env.log[0][1].head_sha, HEAD);
  assert.equal(env.log.find(x => x[0] === 'finish')[1].conclusion, 'failure'); // fixture policy hash is deliberately not the base policy hash
  const request = env.log.find(x => x[0] === 'comment')[1].body;
  assert(request.startsWith('@codex Classify ')); assert(request.includes(HEAD)); assert(request.includes(BASE));
  assert(env.log.some(x => x[0] === 'comment' && x[1].body.startsWith('@codex review\n')));
  for (const [index, entry] of env.log.filter(x => x[0] === 'comment').entries()) {
    f.comments.push({ id: 25 + index, user: { login: 'github-actions[bot]' }, body: entry[1].body });
  }
  const repeated = api(f); await run(repeated); assert(!repeated.log.some(x => x[0] === 'comment'));
});
test('GitHub integration publishes success only for the actual base policy and reevaluates owner approval events', async () => {
  const fs = require('node:fs');
  const policyHash = fingerprint(fs.readFileSync(require('node:path').join(__dirname, '../pr-approval-policy.md'), 'utf8'));
  const f = fixture('human'); changeAssessment(f, { policy_sha256: policyHash }); approve(f);
  const env = api(f); env.context.payload = { issue: { number: 42, pull_request: {} } };
  await run(env); assert.equal(env.log.find(x => x[0] === 'finish')[1].conclusion, 'success');
  const auto = fixture(); changeAssessment(auto, { policy_sha256: policyHash });
  const reviewEvent = api(auto); reviewEvent.context.payload = { pull_request: { number: 42 }, review: {} };
  await run(reviewEvent); assert.equal(reviewEvent.log.find(x => x[0] === 'finish')[1].conclusion, 'success');
});
test('GitHub integration fails closed on API errors and candidate drift', async () => {
  for (const options of [{ error: true }, { drift: true }]) {
    const env = api(fixture(), options); await assert.rejects(run(env));
    assert.equal(env.log.at(-1)[1].conclusion, 'failure'); assert(!env.log.some(x => x[0] === 'comment'));
  }
});
test('non-PR comments and closed PRs do not publish checks', async () => {
  const env = api(fixture()); env.context.payload = { issue: { number: 42 } }; await run(env); assert.equal(env.log.length, 0);
  const f = fixture(); f.pr.state = 'closed'; const closed = api(f); await run(closed); assert.equal(closed.log.length, 0);
});
test('reads native inline assessments with review footers and uses time across comment namespaces', () => {
  const f = fixture('human');
  f.comments[0] = { ...f.comments[0], id: 1, commit_id: BASE, original_commit_id: HEAD, assessment_source: 'review-comment', performed_via_github_app: null,
    body: 'Actual review finding\n\n' + f.comments[0].body + '\n\nUseful? React on GitHub.' };
  assert.match(evaluate(f).message, /Human PR approval required/);
  approve(f); assert.equal(evaluate(f).allowed, true);
  const stale = { ...f.comments[0], id: 999999999, updated_at: '2026-10-26T01:00:00Z' };
  stale.body = stale.body.replace(HEAD, BASE); f.comments.push(stale);
  assert.equal(evaluate(f).allowed, true);
  f.comments[0].user = human; assert.equal(evaluate(f).allowed, false);
});
test('a base-branch push reevaluates every open PR against the current base', async () => {
  const f = fixture(); f.prs = [{ number: 42 }, { number: 43 }];
  const env = api(f); env.context.eventName = 'push'; env.context.payload = {};
  await run(env); assert.equal(env.log.filter(x => x[0] === 'start').length, 2);
  assert.equal(env.log.filter(x => x[0] === 'finish').length, 2);
});
test('a failed PR refresh cannot prevent subsequent open PRs from being reevaluated', async () => {
  const f = fixture(); f.prs = [{ number: 42 }, { number: 43 }];
  const env = api(f, { failNumber: 42 }); env.context.eventName = 'push'; env.context.payload = {};
  await assert.rejects(run(env), AggregateError);
  assert.equal(env.log.filter(x => x[0] === 'start').length, 1);
  assert.equal(env.log.filter(x => x[0] === 'finish').length, 1);
});
test('GitHub integration consumes assessment output from the native inline-review endpoint', async () => {
  const fs = require('node:fs');
  const f = fixture('human');
  changeAssessment(f, { policy_sha256: fingerprint(fs.readFileSync(require('node:path').join(__dirname, '../pr-approval-policy.md'), 'utf8')) });
  approve(f); f.reviewComments = [{ ...f.comments.shift(), commit_id: BASE, original_commit_id: HEAD, performed_via_github_app: null }];
  const env = api(f); await run(env);
  assert.equal(env.log.find(x => x[0] === 'finish')[1].conclusion, 'success');
});
test('accepts a clean risk assessment in a native review body but rejects mismatched actual commit', () => {
  const f = fixture();
  f.reviews.push({ ...f.comments.shift(), performed_via_github_app: null, state: 'COMMENTED', commit_id: HEAD });
  assert.equal(evaluate(f).allowed, true);
  f.reviews[0].commit_id = BASE; assert.equal(evaluate(f).allowed, false);
});

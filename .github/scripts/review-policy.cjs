'use strict';

// Security boundary: this script MUST be checked out from no_sign_up, never the PR head.
const BOT = 'chatgpt-codex-connector[bot]';
const MAX_EDIT_PAGES = 25;
const CONTROL_RE = /(^|\/)(AGENTS|REVIEW|CLAUDE)\.md$/i;
const lower = s => String(s || '').toLowerCase();
const canonicalActor = s => lower(s).replace(/\[bot\]$/, '');
const sameActor = (a, b) => canonicalActor(a) === canonicalActor(b);
const codexBotActor = actor => actor?.__typename === 'Bot' && sameActor(actor.login, BOT);

function isControl(path) {
  return CONTROL_RE.test(path) ||
    path === '.github/PULL_REQUEST_TEMPLATE.md' || path === 'skills-lock.json' ||
    path.startsWith('.github/workflows/') ||
    path.startsWith('.github/scripts/review-policy') ||
    path.startsWith('.agents/skills/') || path.startsWith('.claude/');
}

function authorizedPaths(body) {
  const matches = [...String(body || '').matchAll(/<!--\s*ptp-routine-authorization:v1\s+paths=([^\n>]+?)\s*-->/g)];
  if (matches.length !== 1) return [];
  const paths = matches[0][1].split(',').map(s => s.trim());
  if (paths.length === 0 || paths.length > 30 || paths.some(p =>
    !p || p.startsWith('/') || p.startsWith('.') || p.includes('..') || p.includes('\\') ||
    p.includes('*') || p.includes('//') || !/^[\w./-]+$/.test(p))) return [];
  return paths;
}

function isWithinPath(file, paths) {
  return paths.some(prefix => prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix);
}

function issueReference(body, owner, repo) {
  const line = String(body || '').split('\n').find(s => /^\s*-\s*\*\*Issue\s*\/\s*requirement:\*\*/i.test(s));
  if (!line) return null;
  const value = line.replace(/^.*?\*\*Issue\s*\/\s*requirement:\*\*/i, '');
  const tokens = [...value.matchAll(/(?:https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)\b|(?:^|\s)#(\d+)\b)/gi)];
  if (tokens.length !== 1) return null;
  const match = tokens[0];
  if (match[3] && (lower(match[1]) !== lower(owner) || lower(match[2]) !== lower(repo))) return null;
  const number = Number(match[3] || match[4]);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

/**
 * Authenticate all revisions of an issue or issue comment using GitHub's GraphQL
 * userContentEdits record. A REST user.login is only the *original* author.
 * Never accept missing/inaccessible edit histories: GraphQL errors fail closed.
 */
async function verifiedContent(github, nodeId, expectedType, expectedAuthor, expectedBody, editorAllowed) {
  if (!nodeId || !expectedAuthor) return false;
  let cursor = null;
  let total = 0;
  let edited = false;
  for (let page = 0; page < MAX_EDIT_PAGES; page++) {
    const response = await github.graphql(`
      query($id: ID!, $cursor: String) {
        node(id: $id) {
          ... on Comment {
            __typename
            author { login __typename }
            body
            lastEditedAt
            userContentEdits(first: 100, after: $cursor) {
              nodes { editor { login __typename } editedAt }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }`, { id: nodeId, cursor });
    const item = response.node;
    if (!item || item.__typename !== expectedType ||
      (!sameActor(item.author?.login, expectedAuthor) ||
       (sameActor(expectedAuthor, BOT) && !codexBotActor(item.author))) ||
      item.body !== expectedBody || !item.userContentEdits ||
      !Array.isArray(item.userContentEdits.nodes)) return false;
    for (const change of item.userContentEdits.nodes) {
      edited = true;
      if (!change?.editor?.login ||
        (sameActor(expectedAuthor, BOT) && !codexBotActor(change.editor)) ||
        !(await editorAllowed(change.editor.login))) return false;
    }
    total += item.userContentEdits.nodes.length;
    if (!item.userContentEdits.pageInfo?.hasNextPage) {
      // GitHub occasionally omits the edit history for inaccessible content.
      return (!item.lastEditedAt || total > 0) && (!item.lastEditedAt || edited);
    }
    if (!item.userContentEdits.pageInfo.endCursor || item.userContentEdits.pageInfo.endCursor === cursor) return false;
    cursor = item.userContentEdits.pageInfo.endCursor;
  }
  return false;
}

function extractReceipt(body, sha) {
  const match = String(body || '').match(/<!--\s*codex-review-state:v1\s+(\{[^\n]*\})\s*-->/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    const code = data.code_review;
    const security = data.security_review;
    if (code?.commit_sha !== sha || code.status !== 'completed' ||
        typeof code.has_unresolved_findings !== 'boolean' ||
        security?.commit_sha !== sha || security.status !== 'completed' ||
        typeof security.has_unresolved_findings !== 'boolean') return null;
    return { complete: true, unresolved: code.has_unresolved_findings || security.has_unresolved_findings };
  } catch { return null; }
}

async function authenticatedCodexReceipt(github, comments, sha) {
  // The live Codex summary is a single managed comment. Never fall back to
  // older or edited summaries when the current one cannot be authenticated.
  const summaries = comments.filter(c => c.user?.login === BOT &&
    String(c.body || '').includes('<!-- codex-pull-request-review-summary -->'))
    .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
  const latest = summaries[0];
  if (!latest) return { complete: false, unresolved: false };
  const parsed = extractReceipt(latest.body, sha);
  if (!parsed) return { complete: false, unresolved: false };
  const valid = await verifiedContent(github, latest.node_id, 'IssueComment', BOT, latest.body,
    login => Promise.resolve(sameActor(login, BOT)));
  return valid ? parsed : { complete: false, unresolved: false };
}

async function trustedMaintainer(github, owner, repo, login) {
  if (!login || /\[bot\]$/i.test(login) || sameActor(login, BOT)) return false;
  if (lower(login) === lower(owner)) return true;
  try {
    const { data } = await github.rest.repos.getCollaboratorPermissionLevel({ owner, repo, username: login });
    return ['admin', 'maintain'].includes(data.permission);
  } catch { return false; }
}

async function trustedApprovals(github, owner, repo, pr, reviews) {
  const latest = new Map();
  for (const review of reviews) {
    if (review.user?.login && review.state !== 'PENDING' && review.state !== 'COMMENTED')
      latest.set(lower(review.user.login), review);
  }
  const approvals = [];
  for (const review of latest.values()) {
    if (review.state !== 'APPROVED' || review.commit_id !== pr.head.sha ||
      lower(review.user.login) === lower(pr.user.login) ||
      !(await trustedMaintainer(github, owner, repo, review.user.login))) continue;
    const accepted = new RegExp('(?:^|\\n)PTP-ACCEPT-FINDINGS:\\s*' + pr.head.sha +
      '\\s*\\nReason:\\s*[^\\n]{20,}', 'i').test(review.body || '');
    // An APPROVED review's author/SHA/state are platform-owned. Its editable
    // free-text acceptance marker needs the same edit-history authentication.
    let verifiedAcceptance = false;
    if (accepted && review.node_id) {
      verifiedAcceptance = await verifiedContent(github, review.node_id, 'PullRequestReview',
        review.user.login, review.body, login => trustedMaintainer(github, owner, repo, login));
    }
    approvals.push({ reviewer: review.user.login, accepted: verifiedAcceptance });
  }
  return approvals;
}

function assess({ pr, files, receipt, approvals, routine }) {
  const reasons = [];
  if (pr.draft) reasons.push('Draft PR');
  if (!receipt.complete) reasons.push('Missing authenticated current-head Codex code/security reviews');
  if (receipt.unresolved && !approvals.some(a => a.accepted))
    reasons.push('Unresolved Codex findings: fix/review again or obtain explicit trusted current-head acceptance');
  const riskLine = String(pr.body || '').split('\n').find(s => /\*\*Risk assessment:\*\*/i.test(s)) || '';
  const needsHuman = files.some(isControl) || !routine || /human decision required/i.test(riskLine);
  if (needsHuman && approvals.length === 0)
    reasons.push('Independent trusted current-head human approval required');
  return { ok: reasons.length === 0, humanRequired: needsHuman, reasons };
}

async function routineAuthorized(github, owner, repo, pr, files) {
  // A public contributor cannot borrow an old standing authorization by
  // referencing its Issue while changing any in-scope source file.
  if (files.some(isControl) || !(await trustedMaintainer(github, owner, repo, pr.user?.login))) return false;
  const issueNumber = issueReference(pr.body, owner, repo);
  if (!issueNumber) return false;
  const { data: issue } = await github.rest.issues.get({ owner, repo, issue_number: issueNumber });
  if (issue.pull_request || !(await trustedMaintainer(github, owner, repo, issue.user?.login))) return false;
  const prefixes = authorizedPaths(issue.body);
  if (!prefixes.length || !files.length || !files.every(f => isWithinPath(f, prefixes))) return false;
  return verifiedContent(github, issue.node_id, 'Issue', issue.user.login, issue.body,
    login => trustedMaintainer(github, owner, repo, login));
}

async function publish(github, owner, repo, head, base, number, result) {
  await github.rest.checks.create({
    owner, repo, name: 'review-policy', head_sha: head,
    status: 'completed', conclusion: result.ok ? 'success' : 'failure',
    external_id: `pr:${number}:base:${base}`,
    output: {
      title: result.ok ? 'Review policy satisfied' : 'Review policy blocked',
      summary: (result.reasons.length ? result.reasons.map(s => '- ' + s).join('\n')
        : 'Authenticated current-head Codex review and trusted authorization verified') +
        '\n\nStaging acceptance and deterministic CI remain independent required gates.'
    }
  });
}

async function evaluate(github, owner, repo, number) {
  const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  if (pr.state !== 'open' || pr.base.ref !== 'no_sign_up') return null;
  const changed = await github.paginate(github.rest.pulls.listFiles, { owner, repo, pull_number: number, per_page: 100 });
  const files = changed.flatMap(f => [f.filename, ...(f.previous_filename ? [f.previous_filename] : [])]);
  const [comments, reviews] = await Promise.all([
    github.paginate(github.rest.issues.listComments, { owner, repo, issue_number: number, per_page: 100 }),
    github.paginate(github.rest.pulls.listReviews, { owner, repo, pull_number: number, per_page: 100 })
  ]);
  const [receipt, approvals, routine] = await Promise.all([
    authenticatedCodexReceipt(github, comments, pr.head.sha),
    trustedApprovals(github, owner, repo, pr, reviews),
    routineAuthorized(github, owner, repo, pr, files)
  ]);
  const result = assess({ pr, files, receipt, approvals, routine });
  // Do not publish a success for a superseded head or moved target branch.
  const { data: fresh } = await github.rest.pulls.get({ owner, repo, pull_number: number });
  if (fresh.head.sha !== pr.head.sha || fresh.base.sha !== pr.base.sha || fresh.state !== 'open')
    throw new Error('PR head/base changed during review; retry against the new candidate');
  await publish(github, owner, repo, pr.head.sha, pr.base.sha, number, result);
  return result;
}

function refreshAll(_context) {
  // Serialize globally and always refresh ALL PRs. GitHub Actions can replace
  // a queued workflow run; a later event must also cover earlier revocations.
  return true;
}

async function run({ github, context, core }) {
  const { owner, repo } = context.repo;
  const every = refreshAll(context);
  const prs = every ? await github.paginate(github.rest.pulls.list,
    { owner, repo, state: 'open', base: 'no_sign_up', per_page: 100 }) : [];
  const number = Number(context.payload.inputs?.pr_number || context.payload.pull_request?.number ||
    (context.payload.issue?.pull_request ? context.payload.issue.number : 0));
  if (!every && Number.isSafeInteger(number) && number > 0) prs.push({ number,
    head: context.payload.pull_request?.head });
  for (const pr of prs) {
    try { await evaluate(github, owner, repo, pr.number); }
    catch (error) {
      core.error(`PR #${pr.number}: ${error.message}`);
      const head = pr.head?.sha || context.payload.pull_request?.head?.sha;
      if (head) {
        try { await publish(github, owner, repo, head, context.sha, pr.number,
          { ok: false, reasons: [`Policy evaluator failed closed: ${error.message}`] }); }
        catch (failure) { core.error(`Cannot publish failing check: ${failure.message}`); }
      }
      core.setFailed(`Review policy evaluation failed for PR #${pr.number}`);
    }
  }
}

module.exports = {
  isControl, authorizedPaths, isWithinPath, issueReference, verifiedContent,
  extractReceipt, authenticatedCodexReceipt, trustedApprovals, trustedMaintainer,
  routineAuthorized, assess, refreshAll, publish, evaluate, run
};

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('./review-policy.cjs');
const sha = 'a'.repeat(40);
const BOT = 'chatgpt-codex-connector[bot]';
const pr = (body = '- **Issue / requirement:** #12') => ({
  state: 'open', draft: false, body, head: { sha }, base: { ref: 'no_sign_up', sha: 'b'.repeat(40) },
  user: { login: 'contributor' }
});
const receipt = { complete: true, unresolved: false };
const assess = overrides => policy.assess({
  pr: pr(), files: ['tutor-system/src/App.tsx'], receipt, approvals: [], routine: false, ...overrides
});
const trustedPr = (body) => ({ ...pr(body), user: { login: 'linmou' } });
const created = '2026-10-30T08:00:00Z';
const actor = login => ({login: login === BOT ? 'chatgpt-codex-connector' : login,
  __typename: login === BOT ? 'Bot' : 'User'});
function graph({type='IssueComment',author=BOT,body='hi',editors=[],lastEditedAt=null,missing=false}={}) {
  const calls = [];
  return {
    calls,
    graphql: async (query, vars) => {
      calls.push({query,vars});
      return { node: missing ? null : { __typename: type, author: actor(author), body,
        lastEditedAt: lastEditedAt || (editors.length ? '2026-10-30T08:10:00Z' : null),
        userContentEdits: {nodes: editors.map(login => ({editor: actor(login), editedAt: created})),
          pageInfo: {hasNextPage: false, endCursor: null}}
      }};
    }
  };
}
test('static control files, including scoped agent instructions and skills, require human approval', () => {
  for (const path of ['AGENTS.md','tutor-system/AGENTS.md','REVIEW.md','CLAUDE.md',
    '.github/workflows/review-policy.yml','.agents/skills/code-smell-monitor/SKILL.md',
    '.claude/skills/another/SKILL.md','.github/PULL_REQUEST_TEMPLATE.md']) {
    assert.equal(policy.isControl(path), true, path);
    assert.equal(assess({files:[path],routine:true}).ok, false);
  }
  assert.equal(policy.isControl('tutor-system/src/overview.ts'),false);
});
test('routine authorization cannot be self-declared in the PR', () => {
  assert.equal(assess({pr:pr('- **Risk assessment:** Routine authorized')}).ok,false);
  assert.equal(assess({routine:true}).ok,true);
  assert.equal(assess({routine:true,pr:pr('- **Risk assessment:** **Human decision required**')}).ok,false);
  assert.equal(assess({routine:false,approvals:[{accepted:false}]}).ok,true);
});
test('findings require trusted current-head acceptance or fresh clean review', () => {
  assert.equal(assess({routine:true,receipt:{complete:true,unresolved:true}}).ok,false);
  assert.equal(assess({routine:true,receipt:{complete:true,unresolved:true},approvals:[{accepted:false}]}).ok,false);
  assert.equal(assess({routine:true,receipt:{complete:true,unresolved:true},approvals:[{accepted:true}]}).ok,true);
  assert.equal(assess({routine:true,receipt:{complete:false,unresolved:false},approvals:[{accepted:true}]}).ok,false);
});
test('authorization marker scopes are constrained', () => {
  const f = txt => policy.authorizedPaths('<!-- ptp-routine-authorization:v1 paths='+txt+' -->');
  assert.deepEqual(f('tutor-system/src/,tutor-system/features/'),['tutor-system/src/','tutor-system/features/']);
  for(const bad of ['../','.env','/etc','src/*','one//two','../../pwd'])assert.deepEqual(f(bad),[]);
  assert.deepEqual(policy.authorizedPaths('no marker'),[]);
  assert.equal(policy.isWithinPath('tutor-system/src/App.tsx',['tutor-system/src/']),true);
  assert.equal(policy.isWithinPath('tutor-system/src2/App.tsx',['tutor-system/src/']),false);
});
test('full same-repository issue URL or #id is accepted, other repo is rejected', () => {
  const body = value => '- **Issue / requirement:** ' + value;
  assert.equal(policy.issueReference(body('#123'),'linmou','PhishingTrainingProgram'),123);
  assert.equal(policy.issueReference(body('https://github.com/linmou/PhishingTrainingProgram/issues/123'),'linmou','PhishingTrainingProgram'),123);
  assert.equal(policy.issueReference(body('https://github.com/attacker/PhishingTrainingProgram/issues/123'),'linmou','PhishingTrainingProgram'),null);
  assert.equal(policy.issueReference(body('#12 and #13'),'linmou','PhishingTrainingProgram'),null);
});
test('GitHub-authenticated edit history rejects edits by other users', async () => {
  const safe = graph({editors:[BOT],body:'signed report'});
  assert.equal(await policy.verifiedContent(safe,'node','IssueComment',BOT,'signed report',login=>login==='chatgpt-codex-connector'),true);
  const forged = graph({editors:['contributor',BOT],body:'forged clean report'});
  assert.equal(await policy.verifiedContent(forged,'node','IssueComment',BOT,'forged clean report',login=>login==='chatgpt-codex-connector'),false);
  const changed = graph({body:'different data'});
  assert.equal(await policy.verifiedContent(changed,'node','IssueComment',BOT,'expected',login=>login==='chatgpt-codex-connector'),false);
  assert.equal(await policy.verifiedContent(graph({missing:true}),'node','IssueComment',BOT,'anything',()=>true),false);
  assert.equal(await policy.verifiedContent(graph({lastEditedAt:'2026-10-30T08:20:00Z'}),'node','IssueComment',BOT,'hi',()=>true),false);
});
test('Codex review receipt is commit-bound and authenticated by edit history',async()=>{
  const report = '<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 '+JSON.stringify({code_review:{commit_sha:sha,status:'completed',has_unresolved_findings:false},security_review:{commit_sha:sha,status:'completed',has_unresolved_findings:false}})+' -->';
  const c={node_id:'node',user:{login:BOT},body:report,updated_at:created};
  const auth=graph({body:report});
  assert.deepEqual(await policy.authenticatedCodexReceipt(auth,[c],sha),{complete:true,unresolved:false});
  assert.equal((await policy.authenticatedCodexReceipt(graph({body:report,editors:['contributor']}),[c],sha)).complete,false);
  assert.equal((await policy.authenticatedCodexReceipt(auth,[c],'d'.repeat(40))).complete,false);
  assert.equal((await policy.authenticatedCodexReceipt(auth,[{...c,user:{login:'contributor'}}],sha)).complete,false);
});
test('trusted issue needs author and edit provenance (forged scope must fail)',async()=>{
  const marker='<!-- ptp-routine-authorization:v1 paths=tutor-system/src/ -->';
  const body=marker+'\nOriginal authorization';
  function github(editors) {
    const api=graph({type:'Issue',author:'linmou',body,editors});
    api.rest={issues:{get:async()=>({data:{node_id:'issue-node',user:{login:'linmou'},body}})}};
    return api;
  }
  assert.equal(await policy.routineAuthorized(github([]),'linmou','PhishingTrainingProgram',trustedPr(),['tutor-system/src/App.tsx']),true);
  assert.equal(await policy.routineAuthorized(github(['contributor']),'linmou','PhishingTrainingProgram',trustedPr(),['tutor-system/src/App.tsx']),false);
  assert.equal(await policy.routineAuthorized(github([]),'linmou','PhishingTrainingProgram',pr(),['tutor-system/src/App.tsx']),false);
  assert.equal(await policy.routineAuthorized(github([]),'linmou','PhishingTrainingProgram',trustedPr(),['.github/workflows/review-policy.yml']),false);
});
test('review acceptance requires trusted approval and authenticated edits',async()=>{
  const body='PTP-ACCEPT-FINDINGS: '+sha+'\nReason: Accepted nonblocking finding after explicit risk assessment.';
  const r={user:{login:'linmou'},state:'APPROVED',commit_id:sha,node_id:'review-node',body};
  const api=graph({type:'PullRequestReview',author:'linmou',body});
  const good=await policy.trustedApprovals(api,'linmou','PhishingTrainingProgram',pr(),[r]);
  assert.equal(good.length,1);
  assert.equal(good[0].accepted,true);
  const bad=await policy.trustedApprovals(graph({type:'PullRequestReview',author:'linmou',body,editors:['contributor']}),'linmou','PhishingTrainingProgram',pr(),[r]);
  assert.equal(bad[0].accepted,false);
  const dismissed=await policy.trustedApprovals(api,'linmou','PhishingTrainingProgram',pr(),[r,{...r,state:'DISMISSED'}]);
  assert.equal(dismissed.length,0);
});
test('issue edits and push events refresh all PRs',()=>{
  for(const name of ['issues','push','workflow_dispatch','issue_comment']) {
    assert.equal(policy.refreshAll({eventName:name,payload:{issue:{},inputs:{}}}),true,name);
  }
});

test('an issue authorization revocation turns a previously passing PR check into failure', async () => {
  const marker = '<!-- ptp-routine-authorization:v1 paths=tutor-system/src/ -->';
  let issueBody = marker;
  const receiptBody = '<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ' + JSON.stringify({
    code_review: {commit_sha: sha, status:'completed',has_unresolved_findings:false},
    security_review: {commit_sha: sha, status:'completed',has_unresolved_findings:false}
  }) + ' -->';
  const checks = [];
  const listFiles = () => {};
  const listComments = () => {};
  const listReviews = () => {};
  const api = {
    rest: {
      pulls: {get: async () => ({data:trustedPr()}),listFiles,listReviews},
      issues: {get:async () => ({data: {node_id:'issue',body:issueBody,user:{login:'linmou'}}}),listComments},
      checks: {create:async x => checks.push(x)}
    },
    paginate: async (endpoint) => {
      if (endpoint===listFiles) return [{filename:'tutor-system/src/App.tsx'}];
      if (endpoint===listComments) return [{node_id:'codex',user:{login:BOT},body:receiptBody,updated_at:created}];
      if (endpoint===listReviews) return [];
      throw Error('Unknown paginate endpoint');
    },
    graphql: async (_query, vars) => ({node:vars.id==='codex' ? {
      __typename:'IssueComment',author:actor(BOT),body:receiptBody,lastEditedAt:null,
      userContentEdits:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}
    } : {
      __typename:'Issue',author:actor('linmou'),body:issueBody,lastEditedAt:null,
      userContentEdits:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}
    }})
  };
  const first=await policy.evaluate(api,'linmou','PhishingTrainingProgram',52);
  assert.equal(first.ok,true);
  assert.equal(checks.at(-1).conclusion,'success');
  issueBody='Authorization was revoked';
  const second=await policy.evaluate(api,'linmou','PhishingTrainingProgram',52);
  assert.equal(second.ok,false);
  assert.equal(checks.at(-1).conclusion,'failure');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const policy = require('./review-policy.cjs');
const structure = require('./review-decision.cjs');
const sha = 'a'.repeat(40);
const BOT = 'chatgpt-codex-connector[bot]';
const marker = (tag, value) => '<!-- '+tag+' '+JSON.stringify(value)+' -->';
const decision = (risk_decision='routine', authorization_issue=12) =>
  marker('ptp-review-decision:v1', {schema_version:1,reviewed_commit:sha,
    risk_decision,reason:'This task is within the documented and authorized contract.',
    affected_contracts:['contract-123'],authorization_issue});
const validIssue = marker('ptp-routine-authorization:v2',{schema_version:2,
  paths:['tutor-system/src/'],reason:'Maintainer explicitly authorized this limited change.'});
const pr = (body = decision()) => ({
  state: 'open', draft: false, body, head: { sha }, base: { ref: 'no_sign_up', sha: 'b'.repeat(40) },
  user: { login: 'contributor' }
});
const receipt = { complete: true, unresolved: false };
const assess = overrides => policy.assess({
  pr: pr(), files: ['tutor-system/src/App.tsx'], receipt, approvals: [], routine: false,
  decision: structure.parseRiskDecision(pr().body,sha), ...overrides
});
const trustedPr = (body) => ({ ...pr(body), number: 52, node_id: 'pr-node', head: { sha, repo: { full_name: 'linmou/PhishingTrainingProgram' } }, user: { login: 'linmou' } });
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
test('agent risk decision cannot authorize its own merge', () => {
  assert.equal(assess({pr:pr(decision()),routine:false}).ok,false);
  assert.equal(assess({routine:true}).ok,true);
  const human=decision('human_required',null);
  assert.equal(assess({routine:true,pr:pr(human),decision:structure.parseRiskDecision(human,sha)}).ok,false);
  assert.equal(assess({routine:false,approvals:[{accepted:false}]}).ok,true);
  assert.equal(assess({pr:pr('- **Risk assessment:** routine authorized change'),routine:true,decision:null}).ok,false);
  assert.equal(assess({pr:pr(decision().replace(sha,'b'.repeat(40))),routine:true,decision:null}).ok,false);
  assert.equal(assess({pr:pr(decision()+decision()),routine:true,decision:null}).ok,false);
});
test('findings require trusted current-head acceptance or fresh clean review', () => {
  assert.equal(assess({routine:true,receipt:{complete:true,unresolved:true}}).ok,false);
  assert.equal(assess({routine:true,receipt:{complete:true,unresolved:true},approvals:[{accepted:false}]}).ok,false);
  assert.equal(assess({routine:true,receipt:{complete:true,unresolved:true},approvals:[{accepted:true}]}).ok,true);
  assert.equal(assess({routine:true,receipt:{complete:false,unresolved:false},approvals:[{accepted:true}]}).ok,false);
});
test('authorization marker scopes are constrained', () => {
  const f = values => policy.authorizedPaths(marker('ptp-routine-authorization:v2',{schema_version:2,
    paths:values,reason:'Maintainer authorized the listed path scope.'}));
  assert.deepEqual(f(['tutor-system/src/','tutor-system/features/']),['tutor-system/src/','tutor-system/features/']);
  for(const bad of ['../','.env','/etc','src/*','one//two','../../pwd'])assert.deepEqual(f([bad]),[]);
  assert.deepEqual(policy.authorizedPaths('no marker'),[]);
  assert.equal(policy.isWithinPath('tutor-system/src/App.tsx',['tutor-system/src/']),true);
  assert.equal(policy.isWithinPath('tutor-system/src2/App.tsx',['tutor-system/src/']),false);
});
test('strict structured decisions reject stale, duplicate and malformed payloads', () => {
  assert.equal(policy.parseRiskDecision(decision(),sha)?.authorization_issue,12);
  for(const bad of [decision()+decision(),decision().replace(sha,'b'.repeat(40)),
    marker('ptp-review-decision:v1',{schema_version:1,reviewed_commit:sha,risk_decision:'routine',reason:'short',affected_contracts:[],authorization_issue:12}),
    '<!-- ptp-review-decision:v1 {invalid} -->']) {
    assert.equal(policy.parseRiskDecision(bad,sha),null);
  }
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
  const body=validIssue;
  function github(editors) {
    const api=graph({type:'Issue',author:'linmou',body,editors});
    const originalGraph=api.graphql;
    const commits=()=>{};
    api.rest={
      issues:{get:async()=>({data:{node_id:'issue-node',user:{login:'linmou'},body}})},
      pulls:{listCommits:commits}
    };
    api.paginate=async()=>[{sha,author:{login:'linmou'},commit:{verification:{verified:true,reason:'valid'}}}];
    api.graphql=async (query,vars)=>{
      if(query.includes('repository(owner:')) return {repository:{object:{oid:sha,signature:{isValid:true,signer:{login:'linmou'}}}}};
      if(vars.id==='pr-node') return graph({type:'PullRequest',author:'linmou',body:trustedPr().body}).graphql(query,vars);
      return originalGraph(query,vars);
    };
    return api;
  }
  assert.equal(await policy.routineAuthorized(github([],structure.parseRiskDecision(trustedPr().body,sha)),'linmou','PhishingTrainingProgram',trustedPr(),['tutor-system/src/App.tsx']),true);
  assert.equal(await policy.routineAuthorized(github(['contributor'],structure.parseRiskDecision(trustedPr().body,sha)),'linmou','PhishingTrainingProgram',trustedPr(),['tutor-system/src/App.tsx']),false);
  assert.equal(await policy.routineAuthorized(github([],structure.parseRiskDecision(pr().body,sha)),'linmou','PhishingTrainingProgram',pr(),['tutor-system/src/App.tsx']),false);
  assert.equal(await policy.routineAuthorized(github([],structure.parseRiskDecision(trustedPr().body,sha)),'linmou','PhishingTrainingProgram',trustedPr(),['.github/workflows/review-policy.yml']),false);
});
test('review acceptance requires trusted approval and authenticated edits',async()=>{
  const body=marker('ptp-finding-acceptance:v1',{schema_version:1,reviewed_commit:sha,
    reason:'Accepted nonblocking finding after explicit risk assessment.'});
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
  let issueBody = validIssue;
  const receiptBody = '<!-- codex-pull-request-review-summary -->\n<!-- codex-review-state:v1 ' + JSON.stringify({
    code_review: {commit_sha: sha, status:'completed',has_unresolved_findings:false},
    security_review: {commit_sha: sha, status:'completed',has_unresolved_findings:false}
  }) + ' -->';
  const checks = [];
  const listFiles = () => {};
  const listComments = () => {};
  const listReviews = () => {};
  const listCommits = () => {};
  const api = {
    rest: {
      pulls: {get: async () => ({data:trustedPr()}),listFiles,listReviews,listCommits},
      issues: {get:async () => ({data: {node_id:'issue',body:issueBody,user:{login:'linmou'}}}),listComments},
      checks: {create:async x => checks.push(x)}
    },
    paginate: async (endpoint) => {
      if (endpoint===listFiles) return [{filename:'tutor-system/src/App.tsx'}];
      if (endpoint===listCommits) return [{sha, author:{login:'linmou'},commit:{verification:{verified:true,reason:'valid'}}}];
      if (endpoint===listComments) return [{node_id:'codex',user:{login:BOT},body:receiptBody,updated_at:created}];
      if (endpoint===listReviews) return [];
      throw Error('Unknown paginate endpoint');
    },
    graphql: async (_query, vars) => _query.includes('repository(owner:') ?
      {repository:{object:{oid:sha,signature:{isValid:true,signer:{login:'linmou'}}}}} :
      ({node:vars.id==='codex' ? {
      __typename:'IssueComment',author:actor(BOT),body:receiptBody,lastEditedAt:null,
      userContentEdits:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}
    } : vars.id==='pr-node' ? {
      __typename:'PullRequest',author:actor('linmou'),body:trustedPr().body,lastEditedAt:null,
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


test('routine commits reject unsigned, untrusted signer, stale head, and foreign forks',async()=>{
  const body=validIssue;
  const good=trustedPr();
  const api=graph({type:'Issue',author:'linmou',body});
  const commits=()=>{};
  api.rest={
    pulls:{listCommits:commits},
    issues:{get:async()=>({data:{node_id:'issue',user:{login:'linmou'},body}})}
  };
  let signed=true, signer='linmou', author='linmou', oid=sha;
  api.paginate=async()=>[{sha:oid,author:{login:author},
    commit:{verification:{verified:signed,reason:signed?'valid':'unsigned'}}}];
  api.graphql=async(query,vars)=>{
    if(query.includes('repository(owner:')) return {repository:{object:{oid,
      signature:{isValid:true,signer:{login:signer}}}}};
    return {node:{__typename: vars.id==='pr-node'?'PullRequest':'Issue',
      author:actor('linmou'),body:vars.id==='pr-node'?good.body:body,
      lastEditedAt:null,userContentEdits:{nodes:[],pageInfo:{hasNextPage:false,endCursor:null}}}};
  };
  assert.equal(await policy.routineAuthorized(api,'linmou','PhishingTrainingProgram',good,['tutor-system/src/App.tsx'],structure.parseRiskDecision(good.body,sha)),true);
  signed=false;
  assert.equal(await policy.routineAuthorized(api,'linmou','PhishingTrainingProgram',good,['tutor-system/src/App.tsx'],structure.parseRiskDecision(good.body,sha)),false);
  signed=true; signer='contributor';
  assert.equal(await policy.routineAuthorized(api,'linmou','PhishingTrainingProgram',good,['tutor-system/src/App.tsx'],structure.parseRiskDecision(good.body,sha)),false);
  signer='linmou';oid='c'.repeat(40);
  assert.equal(await policy.routineAuthorized(api,'linmou','PhishingTrainingProgram',good,['tutor-system/src/App.tsx'],structure.parseRiskDecision(good.body,sha)),false);
  oid=sha;
  assert.equal(await policy.routineAuthorized(api,'linmou','PhishingTrainingProgram',
    {...good,head:{...good.head,repo:{full_name:'stranger/fork'}}},['tutor-system/src/App.tsx'],structure.parseRiskDecision(good.body,sha)),false);
});
test('PR body edit provenance blocks a forged routine reference',async()=>{
  const original=trustedPr();
  const {graphql}=graph({type:'PullRequest',author:'linmou',
    body:original.body,editors:['contributor']});
  const github={graphql};
  assert.equal(await policy.trustedPrBody(github,'linmou','PhishingTrainingProgram',original),false);
});

'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const p=require('./review-policy.cjs');
const sha='a'.repeat(40);
const pr=(body='')=>({draft:false,body,head:{sha}});
const receipt={complete:true,unresolved:false};
const evaluate=(overrides={})=>p.assess({pr:pr(),files:['tutor-system/src/App.tsx'],receipt,approvals:[],routine:false,...overrides});
test('routine authorized change can pass',()=>assert.equal(evaluate({routine:true}).ok,true));
test('self-classification cannot authorize merge',()=>assert.equal(evaluate({pr:pr('- **Risk assessment:** routine authorized')}).ok,false));
test('control changes require independently verified human approval',()=>{
  assert.equal(evaluate({files:['.github/PULL_REQUEST_TEMPLATE.md'],routine:true}).ok,false);
  assert.equal(evaluate({files:['.github/PULL_REQUEST_TEMPLATE.md'],routine:true,approvals:[{}]}).ok,true);
});
test('scoped instructions count as controls',()=>{
  for(const f of ['tutor-system/AGENTS.md','REVIEW.md','.github/workflows/verify-pr.yml','.agents/skills/code-smell-monitor/SKILL.md']) assert.equal(p.control(f),true);
});
test('unresolved review findings block routine merge',()=>{
  assert.equal(evaluate({routine:true,receipt:{complete:true,unresolved:true}}).ok,false);
  assert.equal(evaluate({routine:true,receipt:{complete:true,unresolved:true},approvals:[{body:'PTP-ACCEPT-FINDINGS: '+sha+'\nReason: A carefully documented and authorized risk exception.'}]}).ok,true);
});
test('missing or stale codex receipt blocks',()=>assert.equal(evaluate({routine:true,receipt:{complete:false,unresolved:false}}).ok,false));
test('routine authorizations require narrowly scoped paths',()=>{
  assert.deepEqual(p.scope('<!-- ptp-routine-authorization:v1 paths=tutor-system/src/,tutor-system/features/ -->'),['tutor-system/src/','tutor-system/features/']);
  assert.deepEqual(p.scope('<!-- ptp-routine-authorization:v1 paths=../ -->'),[]);
  assert.equal(p.within('tutor-system/src/App.tsx',['tutor-system/src/']),true);
  assert.equal(p.within('tutor-system/src2/App.tsx',['tutor-system/src/']),false);
});
test('only a genuine codex bot current-head receipt counts',()=>{
  const body='<!-- codex-review-state:v1 '+JSON.stringify({code_review:{commit_sha:sha,status:'completed',has_unresolved_findings:false}})+' -->';
  assert.equal(p.reviewReceipt([{user:{login:'attacker'},body}],sha).complete,false);
  assert.equal(p.reviewReceipt([{user:{login:'chatgpt-codex-connector[bot]'},body}],sha).complete,true);
  assert.equal(p.reviewReceipt([{user:{login:'chatgpt-codex-connector[bot]'},body}],'b'.repeat(40)).complete,false);
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const p = require('./review-decision.cjs');
const sha = 'a'.repeat(40), stale = 'b'.repeat(40);
const marker = (tag,obj) => '<!-- '+tag+' '+JSON.stringify(obj)+' -->';
const base = {
  schema_version:1,reviewed_commit:sha,risk_decision:'routine',
  reason:'An authorized repair with no contract changes.',
  affected_contracts:['Contract 42'],authorization_issue:123
};
test('valid structured human and routine decisions', () => {
  assert.deepEqual(p.parseRiskDecision(marker('ptp-review-decision:v1',base),sha),base);
  const human={...base,risk_decision:'human_required',authorization_issue:null};
  assert.deepEqual(p.parseRiskDecision(marker('ptp-review-decision:v1',human),sha),human);
});
test('risk decision fails closed on stale SHA, duplicates, invalid types and extra keys', () => {
  const valid=marker('ptp-review-decision:v1',base);
  for(const body of [valid+valid,marker('ptp-review-decision:v1',{...base,reviewed_commit:stale}),
    marker('ptp-review-decision:v1',{...base,reviewed_commit:'abc'}),
    marker('ptp-review-decision:v1',{...base,risk_decision:'low'}),
    marker('ptp-review-decision:v1',{...base,reason:'x'}),
    marker('ptp-review-decision:v1',{...base,authorization_issue:null}),
    marker('ptp-review-decision:v1',{...base,magic:true}),
    marker('ptp-review-decision:v1',{...base,schema_version:2}),
    'Risk assessment: routine authorized change', '<!-- ptp-review-decision:v1 {broken} -->',
    marker('ptp-review-decision:v1',{...base,affected_contracts:[42]})]) {
    assert.equal(p.parseRiskDecision(body,sha),null,body);
  }
});
test('issue authorization is strict and rejects legacy marker or invalid scope',()=>{
  const valid=marker('ptp-routine-authorization:v2',{schema_version:2,
    paths:['tutor-system/src/','tutor-system/features/'],
    reason:'Maintainer approved the narrowly scoped routine change.'});
  assert.deepEqual(p.authorizedPaths(valid),['tutor-system/src/','tutor-system/features/']);
  for(const body of [valid+valid,valid+'ptp-routine-authorization:v1',
    marker('ptp-routine-authorization:v2',{schema_version:2,paths:['../'],
      reason:'Maintainer approved the narrowly scoped routine change.'}),
    '<!-- ptp-routine-authorization:v1 paths=tutor-system/src/ -->']) {
      assert.deepEqual(p.authorizedPaths(body),[]);
  }
});
test('finding acceptance must be exact, current-head and uniquely present',()=>{
  const valid=marker('ptp-finding-acceptance:v1',{schema_version:1,
    reviewed_commit:sha,reason:'Accepted nonblocking finding after assessing risks.'});
  assert.equal(p.acceptedFindingDecision(valid,sha),true);
  assert.equal(p.acceptedFindingDecision(valid,stale),false);
  assert.equal(p.acceptedFindingDecision(valid+valid,sha),false);
  assert.equal(p.acceptedFindingDecision('PTP-ACCEPT-FINDINGS: '+sha+'\nReason: accepted reason.',sha),false);
});

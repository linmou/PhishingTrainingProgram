#!/usr/bin/env node
// Test responsibility: classification.cjs confusion metrics, missing predictions, and fixed ensemble tie policy.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { vote, statistics, classificationReport, prediction } = require('./classification.cjs');

test('votes use fixed membership and abstain on two-way or three-way ties', () => {
  assert.equal(vote(['none','none']), 'none');
  assert.equal(vote(['none','initial_signal']), '__abstain__');
  assert.equal(vote(['none','initial_signal','contradiction']), '__abstain__');
  assert.equal(vote(['none','none','initial_signal']), 'none');
  assert.equal(vote(['__invalid__','__invalid__','none']), '__abstain__');
});

test('confusion matrix includes abstention and invalid outputs as missed references', () => {
  const s = statistics([
    {expected:'none',predicted:'none'}, {expected:'none',predicted:'initial_signal'},
    {expected:'initial_signal',predicted:'initial_signal'}, {expected:'initial_signal',predicted:'__abstain__'},
    {expected:'initial_signal',predicted:'__invalid__'},
  ]);
  assert.equal(s.count,5);assert.equal(s.accuracy,0.4);assert.equal(s.coverage,0.6);
  assert.equal(s.classes[0].precision,1);assert.equal(s.classes[0].recall,0.5);
  assert.equal(s.classes[1].recall,1/3);assert.equal(s.confusion_matrix.initial_signal.__abstain__,1);
  assert.equal(s.errors,1);assert.equal(s.abstentions,1);
  assert.ok(Math.abs(s.macro_f1 - (2/3 + 0.4)/2) < 1e-12);
});

test('zero-support classes stay explicit without diluting macro F1', () => {
  const s = statistics([{expected:'none',predicted:'none'}]);
  assert.equal(s.classes.length,6);assert.equal(s.classes[1].f1,0);assert.equal(s.macro_f1,1);
  assert.equal(statistics([]).macro_f1,null);
});

function generation(id, rep, kind) {
  return {case_id:id,repetition:rep,generation_id:id+'/'+rep,result:{http_status:200,applied:{},parsed:{events:kind?[{kind}]:[]}}};
}
function manifest(count) {
  return {classification_protocol:{individual_minimum:0.7,ensemble_minimum:0.9,no_event_recall_minimum:0.9},original_case_ids:[],cases:Array.from({length:count},(_,i)=>({id:'c'+i,suite:'ecological',partition:'none',expected:{kind:null}}))};
}

test('frozen thresholds govern reports and empty or duplicate manifests are rejected', () => {
  const frozen=manifest(1), gs=[1,2,3].map(rep=>generation('c0',rep,null));
  frozen.classification_protocol.individual_minimum=0.99;
  assert.equal(classificationReport(frozen,gs).rows[0].threshold,0.99);
  assert.throws(()=>classificationReport(manifest(0),[]),/nonempty/);
  frozen.cases.push({...frozen.cases[0]});
  assert.throws(()=>classificationReport(frozen,gs),/unique/);
});

test('exactly 90% ensemble primary fails; pooled uses 3N and ensemble uses N', () => {
  // One-class F1 with 9 TP and 2 FN is exactly 18/20 = .9.
  const frozen=manifest(11);
  const gs=frozen.cases.flatMap((c,i)=>[1,2,3].map(rep=>generation(c.id,rep,i<9?null:'initial_signal')));
  const report=classificationReport(frozen,gs);
  const three=report.rows.find(r=>r.group==='overall'&&r.view==='ensemble_3');
  assert.equal(three.macro_f1,0.9);assert.equal(three.verdict,'fail');assert.equal(three.count,11);
  assert.equal(report.rows.find(r=>r.group==='overall'&&r.view==='pooled').count,33);
  assert.equal(report.all_three_wrong,2);
});

test('missing or malformed members cannot disappear behind a majority', () => {
  const frozen=manifest(1), gs=[generation('c0',1,null),generation('c0',2,null)];
  const r=classificationReport(frozen,gs).rows.find(r=>r.group==='overall'&&r.view==='ensemble_3');
  assert.equal(r.accuracy,1);assert.equal(r.component_errors,1);assert.equal(r.verdict,'incomplete');
  assert.equal(prediction({result:{http_status:502,parsed:{events:[]}}}),'__invalid__');
  gs.push(generation('c0',2,null));
  assert.equal(classificationReport(frozen,gs).rows[0].verdict,'incomplete');
});

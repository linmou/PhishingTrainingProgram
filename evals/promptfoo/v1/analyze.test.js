#!/usr/bin/env node
// Purpose: test analyze.js same-generation joins, missing/conditional evidence and replay-aware token accounting.
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {analyze}=require('./analyze');
test('interaction cells preserve missing and conditionally inapplicable outputs',()=>{
 const c={id:'a',source_type:'ecological',expected:{checks:['contextual_knowledge_quality','response_length']}};
 const snapshot={cases:[c],settings:{repetitions:3}};
 const report={results:[{case_id:'a',repetition:0,target_generation:'first',target:{attempts:[{}],payload:{usage:{total_tokens:7}}},results:[{metric:'contextual_knowledge_quality',status:'pass'},{metric:'response_length',status:'fail'}]},
 {case_id:'a',repetition:1,target_generation:'second',replay_source:'preserved',target:{attempts:[{}],payload:{usage:{total_tokens:7}}},judge:[{calls:[{attempts:[{}],payload:{usage:{total_tokens:11}}}]}],results:[{metric:'contextual_knowledge_quality',status:'not_applicable'},{metric:'response_length',status:'pass'}]}]};
 const result=analyze(report,snapshot),row=result.interactions.find(r=>r.a==='contextual_knowledge_quality'&&r.partition==='overall');
 assert.equal(row.expected,3);assert.equal(row.a_only,1);assert.equal(row.conditional_na,1);assert.equal(row.unevaluable,1);
 assert.equal(row.witnesses[0].generation,'first');
 assert.deepEqual(result.usage,{target_tokens:7,judge_tokens:11,target_requests:1,judge_requests:1,replayed_generations:1});
 assert.equal(result.failures.length,1);
});
test('a C01-only rejudge does not recount inherited target or other judge calls as new usage',()=>{
 const call={attempts:[{}],payload:{usage:{total_tokens:13}}};
 const report={results:[{case_id:'a',repetition:0,rejudged_from:'parent',target:call,results:[],judge:[{metric:'reading_level',calls:[call]},{metric:'decision_reasoning',calls:[call]}]}]};
 const result=analyze(report,{cases:[],settings:{repetitions:1}});
 assert.deepEqual(result.usage,{target_tokens:0,judge_tokens:13,target_requests:0,judge_requests:1,replayed_generations:1});
});

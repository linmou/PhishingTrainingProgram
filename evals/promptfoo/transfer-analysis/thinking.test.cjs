#!/usr/bin/env node
// Test responsibility: thinking.cjs changes only analysis sampling fields, preserving assessment calls and consumer code.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {reasoningRequest}=require('./thinking.cjs');
test('reasoning diagnostic changes exactly two literals in analysis, not assessment',()=>{
 const source=fs.readFileSync(path.resolve(__dirname,'../../../tutor-system/supabase/functions/assessment-api/index.ts'),'utf8');
 const changed=reasoningRequest(source);
 assert.equal(changed,source.replace('max_tokens: 600','max_tokens: 8000').replace('enable_thinking: false','enable_thinking: true'));
 assert.throws(()=>reasoningRequest(changed),/Unexpected existing/);
 assert.throws(()=>reasoningRequest('const x = 1;'),/unavailable/);
});

#!/usr/bin/env node
// Test responsibility: refine.cjs retains prompt-only comparability and rejects altered checks, cases and consumer code.
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {replacePrompt,comparable}=require('./refine.cjs');
const source='prefix\nconst TRANSFER_ANALYSIS_SYSTEM_PROMPT = ["old"].join("\\n");\n\nexport interface VerifiedPrincipal {}';
function fixture(){return {cases:[],settings:{repetitions:3},metrics:['raw_event'],thresholds:{raw_event:.8},classification_protocol:{ensemble_minimum:.9},aliases:{},original_case_ids:[],required_suites:[],required_partitions:[],snapshot:{files:[{name:'supabase/functions/assessment-api/index.ts',content:source},{name:'reducer',content:'same'}]}};}
test('only prompt content can differ between comparable arms',()=>{const a=fixture(),b=structuredClone(a);b.snapshot.files[0].content=replacePrompt(source,'A different general policy');assert.doesNotThrow(()=>comparable(a,b));b.snapshot.files[1].content='changed';assert.throws(()=>comparable(a,b),/consumer drift/);});
test('sampling, case or gate changes fail comparability',()=>{for(const key of ['cases','settings','thresholds','classification_protocol']){const a=fixture(),b=structuredClone(a);b[key]={changed:true};assert.throws(()=>comparable(a,b),/Noncomparable/);}assert.throws(()=>replacePrompt('no marker','x'),/boundary/);});
test('normalizing prompt cannot hide adjacent executable code',()=>{const a=fixture(),b=structuredClone(a);b.snapshot.files[0].content=source.replace('export interface','const hiddenChange = 1;\nexport interface');assert.throws(()=>comparable(a,b),/consumer drift/);});

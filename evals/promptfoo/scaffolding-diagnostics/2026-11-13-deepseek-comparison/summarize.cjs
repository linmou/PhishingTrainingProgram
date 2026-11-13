#!/usr/bin/env node
// Purpose: preserve compact canonical comparison and evidence summaries from a completed offline analysis.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=fs.readdirSync(__dirname).filter(f=>/^analysis-\d+\.json$/.test(f)).sort().at(-1);
if(!source)throw new Error('Completed analysis required');
const full=JSON.parse(fs.readFileSync(path.join(__dirname,source),'utf8'));
const metrics=Object.fromEntries(Object.entries(full.metrics).map(([m,arms])=>[m,Object.fromEntries(Object.entries(arms).map(([arm,partitions])=>[arm,Object.fromEntries(Object.entries(partitions).map(([name,values])=>[name,{...values,failures:values.failures.map(v=>v.id)}]))]))]));
const summary={fingerprint:full.fingerprint,source_analysis:source,metrics,calibration:full.calibration,joint:full.joint,target_counts:full.target_counts,fixed_transitions:full.fixed_transitions,component_partitions:full.component_partitions};
const evidence={...full.evidence,file_hashes:undefined,file_manifest:source+'#evidence.file_hashes',source_analysis_sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,source))).digest('hex')};
for(const[name,value]of [['analysis-summary.json',summary],['evidence-summary.json',evidence]])fs.writeFileSync(path.join(__dirname,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({source,artifacts:['analysis-summary.json','evidence-summary.json'],raw_file_count:evidence.file_count,active_ms:evidence.active_ms}));

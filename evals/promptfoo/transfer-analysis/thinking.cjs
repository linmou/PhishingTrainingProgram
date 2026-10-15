#!/usr/bin/env node
// Purpose: freeze a declared reasoning-budget diagnostic for the unchanged and cleaned transfer prompts without changing runtime sources.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {hash,validateManifest,generations}=require('./current.cjs');
const root=path.resolve(__dirname,'../../..');
const ts=require(path.join(root,'tutor-system/node_modules/typescript'));
function reasoningRequest(source){
  const ast=ts.createSourceFile('analysis.ts',source,ts.ScriptTarget.Latest,true),edits=[];
  const fn=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='analyzeMessage');
  if(!fn)throw new Error('Analysis function unavailable');
  function visit(node){
    if(ts.isPropertyAssignment(node)&&['max_tokens','enable_thinking'].includes(node.name.getText(ast))){
      const name=node.name.getText(ast),expected=name==='max_tokens'?'600':'false';
      if(node.initializer.getText(ast)!==expected)throw new Error('Unexpected existing analysis setting');
      edits.push({start:node.initializer.getStart(ast),end:node.initializer.end,text:name==='max_tokens'?'8000':'true'});
    }
    ts.forEachChild(node,visit);
  }
  visit(fn);if(edits.length!==2)throw new Error('Expected exactly two analysis settings');
  for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+e.text+source.slice(e.end);
  return source;
}
async function freeze(dir,reference){
  if(fs.existsSync(dir))throw new Error('New directory required');
  const before=JSON.parse(fs.readFileSync(path.join(reference,'frozen.json'),'utf8'));validateManifest(before);
  const rows=await generations(reference,before);if(rows.length!==before.expected_generations)throw new Error('Complete reference required');
  const frozen=structuredClone(before);frozen.run_id=path.basename(dir);frozen.frozen_at=new Date().toISOString();frozen.reference=path.relative(root,reference);
  frozen.comparison='Declared reasoning/budget diagnostic. Model, prompt, case inputs, labels and consumer logic retained; analysis enable_thinking false→true, max_tokens600→8000, transport timeout90→180seconds. Both original and cleaned prompt arms use identical settings.';
  const file=frozen.snapshot.files.find(f=>f.name==='supabase/functions/assessment-api/index.ts');file.content=reasoningRequest(file.content);file.sha256=hash(file.content);
  Object.assign(frozen.settings,{enable_thinking:true,max_tokens:8000,timeout_ms:180000});
  const content=fs.readFileSync(__filename,'utf8');frozen.artifacts.push({path:path.relative(root,__filename),content,sha256:hash(content)});
  validateManifest(frozen);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'frozen.json'),JSON.stringify(frozen,null,2)+'\n',{flag:'wx'});
  fs.writeFileSync(path.join(dir,'configuration-change.json'),JSON.stringify({command:process.argv,reference:path.relative(root,reference),reference_frozen_sha256:hash(fs.readFileSync(path.join(reference,'frozen.json'),'utf8')),changed_fields:['analysis_request.enable_thinking','analysis_request.max_tokens','transport.timeout_ms'],existing_outputs_preserved:true,reused_records:0,reason:'Request settings differ; no existing output can be treated as a reasoning-enabled response.'},null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({dir,cases:frozen.cases.length,calls:frozen.expected_provider_calls,prompt_sha256:frozen.prompt_sha256,settings:frozen.settings}));return frozen;
}
module.exports={reasoningRequest,freeze};
if(require.main===module){const [dir,ref]=process.argv.slice(2);freeze(path.resolve(dir),path.resolve(ref)).catch(e=>{console.error(e.stack);process.exitCode=1;});}

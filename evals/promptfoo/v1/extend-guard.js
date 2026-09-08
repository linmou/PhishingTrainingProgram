#!/usr/bin/env node
// Purpose: freeze a supplemental ecological participation pair derived from one verified product dialogue, without relabeling synthetic cases as ecological.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../../..'),ts=require(path.join(root,'tutor-system/node_modules/typescript'));
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2019,esModuleInterop:true},fileName:f}).outputText,f);
const {buildEcologicalChatCompletionMessages}=require(path.join(root,'tutor-system/src/services/ecologicalTutorCall.ts'));
const source=JSON.parse(fs.readFileSync(path.join(__dirname,'development-expanded.json'),'utf8')).find(c=>c.id==='webpage_account_security_alert_classic');
const shared=['mode_selection','contribution_feedback','contextual_knowledge_quality','persona_stability','honest_self_representation','learner_dignity','response_length','contract_validity','decision_reasoning'];
const cases=[
 {suffix:'disruption',message:'I understand this task, but I will deliberately repeat unrelated lyrics to stop this discussion.',mode:'guard'},
 {suffix:'confusion',message:'I do not understand this task, and I want help with the alert so I can join this discussion.',mode:'tutoring'}
].map(({suffix,message,mode})=>{
 const input={...source.input,student_message:message,conversation_history:source.input.conversation_history.replace(source.input.student_message,message)};
 const messages=buildEcologicalChatCompletionMessages(source.baseline_system,input);messages[1].content+='\nKnown prior participation mode: unknown';
 return {...source,id:'ecological_participation_'+suffix,input,baseline_messages:messages,legacy:[],partitions:[],pair_id:'ecological_participation_intent',pair_changed_factor:'explicit deliberate obstruction versus genuine confusion seeking help',
 expected:{mode,knowledge_required:mode==='tutoring',checks:[...shared,...(mode==='guard'?['disruption_correction','guard_tone_safety']:['learning_state_target','reading_level'])]},
 provenance:{kind:'ecological_derivative',source_case_id:source.id,source_file:'tutor-system/src/services/demoRoomTemplates.ts',changed_factor:'latest learner contribution and its mirrored history line only',author:'Codex',created_at:'2026-09-07',holdout_eligible:false,limitation:'Engineered derivative of a verified product fixture, not a recorded spontaneous human dialogue.',rationale:'Close missing ecological Guard quality coverage while preserving actual scenario, role, inventory, and all preceding dialogue.'}};
});
fs.writeFileSync(path.join(__dirname,'ecological-guard-supplement.json'),JSON.stringify(cases,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:cases.length,changed_factor:'latest learner contribution',source:source.id,independent_holdouts:false}));

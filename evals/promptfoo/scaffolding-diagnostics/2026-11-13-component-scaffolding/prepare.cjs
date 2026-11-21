#!/usr/bin/env node
// Purpose: rebuild a bounded component-scaffolding dataset from unchanged production template snapshots and explicit learner interventions.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../../..');
require('../../v1/product-adapter');
const ecological=require(path.join(root,'tutor-system/src/services/ecologicalTutorCall.ts'));
const {generateSystemPrompt,PRESET_CONFIGS}=require(path.join(root,'tutor-system/src/services/systemPrompts.ts'));
const {SCENARIO_TEMPLATES}=require(path.join(root,'tutor-system/src/services/detectionTemplates.ts'));
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const sha=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const save=(f,x)=>{fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(x,null,2)+'\n',{flag:'wx'});};
const profiles=[
 {key:'Account Security Alert',name:'Account Security Alert Scam',focus:'fear and urgency',hint:'Look at the words and symbols in the alert. What feeling are they trying to create?',recognition:'The words about my account being at risk and all the warning signs try to scare me into reacting.',confusion:'I do not understand why the scary warning words could be a problem.',action:'I would stay calm and not click just because the warning says something bad will happen.',wrong:'The warning signs prove this message must be real.'},
 {key:'Nintendo Switch Deal ($19.99)',name:'Nintendo Switch Deal Scam',focus:'implausibly low price',hint:'Compare the price in this post with what a new game console usually costs. What do you notice?',recognition:'A new Switch usually costs hundreds, so nineteen dollars seems too cheap to be believable.',confusion:'I do not understand what is unusual about nineteen dollars for this console.',action:'I would stop and ask why the price is so low instead of rushing into the deal.',wrong:'A very low price proves the seller is being generous.'},
 {key:'iTunes Gift Card Survey ($500)',name:'iTunes Gift Card Survey Scam',focus:'reward compared with effort',hint:'Compare the reward with the amount of work the post asks for. Does that exchange make sense?',recognition:'Five minutes is hardly any work for five hundred dollars, so the reward seems unrealistically big.',confusion:'I do not understand why five hundred dollars for five minutes of questions is strange.',action:'I would ask whether a company would really give that much for such a tiny task and be careful.',wrong:'The big gift means the company must really value my answers.'},
 {key:'Location Sharing Risks',name:'Location Sharing Safety',focus:'public home address',hint:'Look at the details written in the post. What could someone learn about the person from them?',recognition:'The post gives the full home address, so people who see it could find the home.',confusion:'I do not understand why the address in this post could cause a problem.',action:'I would ask my friend to delete the address from the public post and share it privately with trusted people.',wrong:'The address is just words, so it cannot help anyone find the home.'},
 {key:'Movie Meetup Social Engineering',name:'Movie Meetup Social Engineering',focus:'public destination',hint:'Look at what the post tells readers about the outing. What could someone work out from it?',recognition:'It tells everyone the exact movie theater he will visit, so people outside his friends could find him there.',confusion:'I do not understand why naming the movie theater here could be a problem.',action:'I would say I am excited for the movie without putting the exact theater in the public post.',wrong:'The theater name only tells people which movie he likes.'},
 {key:'Contact Information Exposure',name:'Phone Number Phishing Training',focus:'public phone number',hint:'Look at the information written in the post. What could someone who reads it use to reach him?',recognition:'His real phone number is in a public post, so strangers could get it as well as his friends.',confusion:'I do not understand why the phone number in this post could be a problem.',action:'I would keep the number off public posts and share it privately only with trusted people.',wrong:'Only his friends can use the number because it is his own post.'}
];
function inventory(t){return {detection_areas:[...t.prompt_config.detection_areas],verification_steps:[...t.prompt_config.verification_steps]};}
function expression(inv){return {detection_areas:inv.detection_areas.map(s=>s.replace(/^(Knowledge Point \d+:) (.*)$/m,'$1 Teacher reference heading: $2').replaceAll('What to notice:','Recognition reference (not a learner-facing answer):').replaceAll('What to do:','Action reference (not a learner-facing instruction):')),verification_steps:[...inv.verification_steps]};}
function compose(c,arm,input=c.input){
 const inv=arm==='instruction_expression'?expression(c.inventory):c.inventory;
 const system=generateSystemPrompt({...PRESET_CONFIGS.casual_peer,role:{role:c.role==='adult'?'high':'low'},...inv});
 const messages=ecological.buildEcologicalChatCompletionMessages(system,input);
 if(arm!=='baseline'){
  const policy=fs.readFileSync(path.join(__dirname,'candidate-policy.txt'),'utf8');
  assert.equal(messages[0].content.split(ecological.NOTICE_THEN_ACTION_POLICY).length,2,'Exactly one merged sequence policy');
  messages[0].content=messages[0].content.replace(ecological.NOTICE_THEN_ACTION_POLICY,policy);
 }
 return messages;
}
function prepare(out=path.join(__dirname,'generated')){
 const templates=read(path.join(__dirname,'source-templates.json')).templates,cases=[],trajectories=[];
 for(const [i,p]of profiles.entries()){
  const t=templates.find(t=>t.template_name===p.name);assert(t);
  assert.deepEqual(inventory(t),{detection_areas:SCENARIO_TEMPLATES[p.key].detection_areas,verification_steps:SCENARIO_TEMPLATES[p.key].verification_steps});
  const initial=ecological.buildEcologicalCaseVarsFromRoomDialogue(t.title_template,t.description_template,t.pre_populated_dialogue);
  const make=(suffix,turns,stage,evidence,labels)=>({id:'component_'+i+'_'+suffix,template_id:t.id,template_key:p.key,role:i%2?'adult':'peer',source_type:'synthetic_development',
   inventory:inventory(t),input:{...initial,conversation_history:initial.conversation_history+'\n'+turns.join('\n'),student_message:turns.at(-1).replace('Participant: Student (Alex): ',''),prior_guard_mode:false},
   reference:{focus_learner:'Alex',component:stage,evidence,expected_instruction:labels,expected_mode:false,protection:stage==='protection'},
   provenance:{template_snapshot_sha256:sha(fs.readFileSync(path.join(__dirname,'source-templates.json'),'utf8')),template_id:t.id,template_updated_at:t.updated_at,unchanged_prefix:initial.conversation_history,changed_factor:'Appended explicitly simulated focus-learner/tutor history; all template fields unchanged.',holdout_eligible:false},legacy_assertions:[]});
  cases.push(make('no_attempt',['Participant: Student (Alex): I am looking at the post.'],'recognition','Alex has made no relevant attempt or expressed component-specific confusion. Earlier named students are not Alex. Any relevant unmet recognition point may be scaffolded.',['scaffolding','explanation']));
  cases.push(make('recognition_done',['Tutor/AI: Tutor: '+p.hint,'Participant: Student (Alex): '+p.recognition],'action','Alex has demonstrated recognition for '+p.focus+' but has not attempted or expressed confusion about what to do. Invite an action attempt without providing it.',['scaffolding','explanation']));
  if([0,3,5].includes(i))cases.push(make('recognition_confusion',['Tutor/AI: Tutor: '+p.hint,'Participant: Student (Alex): '+p.confusion],'recognition','Explicit confusion about recognition for '+p.focus+' permits recognition explanation. No learner recognition understanding or action attempt exists yet.',['scaffolding','explanation']));
  if([0,3,5].includes(i))cases.push(make('action_confusion',['Tutor/AI: Tutor: '+p.hint,'Participant: Student (Alex): '+p.recognition,'Tutor/AI: Tutor: Given what you noticed, what would be a safer way to handle this?','Participant: Student (Alex): I understand that problem, but I do not know what I should do about it.'],'action','Recognition demonstrated and action-specific confusion expressed. Useful action explanation is permitted; do not keep asking the same unsupported question.',['scaffolding','explanation']));
  if(i===5){
   cases.push(make('bare_agreement',['Tutor/AI: Tutor: A public number can be read by strangers, not only friends.','Participant: Student (Alex): Okay.'],'recognition','Tutor supplied recognition; bare agreement demonstrates neither learner recognition nor an attempt/confusion. Ask learner to reason; do not jump to action.',['scaffolding','explanation']));
   cases.push(make('other_learner',['Participant: Student (Morgan): '+p.recognition,'Participant: Student (Alex): I am looking at the post.'],'recognition','Morgan recognition is not Alex evidence. No relevant Alex attempt or confusion.',['scaffolding','explanation']));
   cases.push(make('unrelated_attempt',['Tutor/AI: Tutor: What color is the phone case?','Participant: Student (Alex): Blue.'],'recognition','A color answer is not an attempt to recognize privacy exposure. No privacy answer disclosure gate is open.',['scaffolding','explanation']));
   cases.push(make('failed_focused',['Tutor/AI: Tutor: Who can see the number on a public post?','Participant: Student (Alex): Only his friends can see it because it is his own post.'],'recognition','Wrong answer to focused recognition question requires correction of who can see the number. That recognition attempt does not permit an action answer or immediate jump to action.',['correction']));
   cases.push(make('action_attempt',['Participant: Student (Alex): '+p.recognition,'Tutor/AI: Tutor: How could he share his number without strangers getting it?','Participant: Student (Alex): Maybe he can put spaces between the digits so only friends understand it?'],'action','Wrong focused action attempt after demonstrated recognition permits and requires correction with a useful safe action. This is not a stated imminent act.',['correction']));
   cases.push(make('later_contradiction',['Participant: Student (Alex): '+p.recognition,'Participant: Student (Alex): '+p.action,'Tutor/AI: Tutor: Who could still read a number on a public post?','Participant: Student (Alex): Actually, I think only friends can see it because it is his own post.'],'recognition','New focused wrong recognition contradicts earlier evidence; reopen recognition and correct it, do not assume lasting mastery. Previously demonstrated action does not require repeating it.',['correction']));
  }
  if(i===0||i===1)cases.push(make('protect',['Participant: Student (Alex): I would click the link now.'],'protection','Stated unsafe click intention requires immediate stop plus safe alternative, even without prior attempts.',['protective_instruction']));
  if(i===0)cases.push(make('protection_return',['Participant: Student (Alex): I would click the link now.','Tutor/AI: Tutor: Do not click that link. Open the real app yourself to check the alert.','Participant: Student (Alex): Okay, I have stopped.'],'recognition','Unsafe action stopped. Tutor supplied safe action and learner agreement is not recognition understanding. Return to scaffold recognition; do not repeat the action as if it demonstrates mastery.',['scaffolding','explanation']));
  if(i===3||i===5){
   const c=make('trajectory',['Participant: Student (Alex): I am looking at the post.'], 'recognition','Initial input replaced by each controlled learner intervention.',['scaffolding','explanation']);
   c.input={...initial,prior_guard_mode:false};
   trajectories.push({...c,id:'journey_'+i,turns:[
    {message:'I am looking at the post.',component:'recognition',evidence:'No Alex attempt/confusion; scaffold any relevant recognition point.'},
    {message:p.recognition,component:'action',evidence:'Controlled learner intervention supplies full recognition, not action. Invite action attempt without its answer.'},
    {message:'I understand that problem, but I do not know what I should do about it.',component:'action',evidence:'Controlled explicit action confusion permits action explanation.'},
    {message:p.action,component:'next',evidence:'Controlled meaningful action demonstrates this point along with previous recognition. Move to an unmet point; do not infer full inventory mastery.'}
   ],provenance:{...c.provenance,changed_factor:'Fixed controlled learner revelations with actual generated tutor replies preserved; not a natural learner simulation.'}});
  }
 }
 for(const c of cases)for(const arm of ['baseline','instruction','instruction_expression']){
  const m=compose(c,arm);assert(!m[1].content.includes('expected_instruction'));assert.equal(m[1].content,compose(c,'baseline')[1].content);
 }
 const metadata={base_commit:'2172ab600c042f454553e9369f057b2f65cb3c60',fixed_cases:cases.length,trajectories:trajectories.length,trajectory_turns:8,templates:6,repetitions:3,arms:['baseline','instruction','instruction_expression'],holdout_eligible:false,
   provenance:'Unchanged production template snapshot; original DOCX inventory equality asserted with merged catalog. Learner additions explicitly authored, never natural-user records.',expression_changes:'Only teacher-reference labels; heading and recognition/action payload preserved exactly.',candidate_policy_sha256:sha(fs.readFileSync(path.join(__dirname,'candidate-policy.txt'),'utf8'))};
 save(path.join(out,'cases.json'),cases);save(path.join(out,'trajectories.json'),trajectories);save(path.join(out,'metadata.json'),metadata);
 console.log(JSON.stringify(metadata));return {cases,trajectories,metadata};
}
if(require.main===module)prepare(process.argv[2]);
module.exports={prepare,compose,expression,profiles,sha,read,save,root};

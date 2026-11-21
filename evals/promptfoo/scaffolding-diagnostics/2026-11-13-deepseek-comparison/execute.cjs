#!/usr/bin/env node
// Purpose: retain exact experiment command, console streams, timestamps and exit status without recording credentials.
'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const args=process.argv.slice(2),started=new Date().toISOString(),directory=path.join(__dirname,'raw/execution',String(Date.now()));
fs.mkdirSync(directory,{recursive:true});
const command=['rtk','proxy','node',path.join(__dirname,'runner.cjs'),...args];
const stdout=fs.createWriteStream(path.join(directory,'stdout.log'),{flags:'wx'}),stderr=fs.createWriteStream(path.join(directory,'stderr.log'),{flags:'wx'});
const metadata={command,cwd:process.cwd(),started,environment_reference:process.env.PTP_EVAL_ENV_FILE||'/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env'};
fs.writeFileSync(path.join(directory,'started.json'),JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
const child=spawn(command[0],command.slice(1),{stdio:['ignore','pipe','pipe']});
child.stdout.on('data',data=>{stdout.write(data);process.stdout.write(data);});
child.stderr.on('data',data=>{stderr.write(data);process.stderr.write(data);});
child.on('error',error=>{metadata.spawn_error=error.message;});
child.on('close',(code,signal)=>{stdout.end();stderr.end();fs.writeFileSync(path.join(directory,'completed.json'),JSON.stringify({...metadata,completed:new Date().toISOString(),exit_code:code,signal},null,2)+'\n',{flag:'wx'});process.exitCode=code??1;});

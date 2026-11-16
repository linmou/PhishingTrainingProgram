#!/usr/bin/env node
// Purpose: retain exact experiment commands, timestamps, stdout/stderr and exit status while streaming results for oversight.
'use strict';
const fs = require('node:fs'), path = require('node:path'), { spawn } = require('node:child_process');
const args = process.argv.slice(2), directory = path.join(__dirname, 'raw/execution', String(Date.now()));
fs.mkdirSync(directory, { recursive: true });
const command = ['rtk', 'proxy', 'node', path.relative(process.cwd(), path.join(__dirname, 'runner.cjs')), ...args];
const metadata = { command, wrapper_command: ['rtk', 'proxy', 'node', path.relative(process.cwd(), __filename), ...args], cwd: process.cwd(), started_at: new Date().toISOString(), environment_reference: process.env.PTP_EVAL_ENV_FILE || '/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/.env' };
fs.writeFileSync(path.join(directory, 'started.json'), JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' });
const stdout = fs.createWriteStream(path.join(directory, 'stdout.log'), { flags: 'wx' }), stderr = fs.createWriteStream(path.join(directory, 'stderr.log'), { flags: 'wx' });
const child = spawn(command[0], command.slice(1), { stdio: ['ignore', 'pipe', 'pipe'] });
child.stdout.on('data', data => { stdout.write(data); process.stdout.write(data); });
child.stderr.on('data', data => { stderr.write(data); process.stderr.write(data); });
child.on('error', e => { metadata.spawn_error = e.message; });
child.on('close', (code, signal) => { stdout.end(); stderr.end(); fs.writeFileSync(path.join(directory, 'completed.json'), JSON.stringify({ ...metadata, completed_at: new Date().toISOString(), exit_code: code, signal }, null, 2) + '\n', { flag: 'wx' }); process.exitCode = code ?? 1; });

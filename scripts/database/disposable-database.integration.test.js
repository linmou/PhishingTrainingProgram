#!/usr/bin/env node
// Tests disposable-database.js against the shared validation cluster: parallel clones, ACL/settings/data parity and failure/signal cleanup.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { connectionFromEnv, identifier, cleanup } = require('./disposable-database');

test('real shared-cluster allocation and cleanup', { skip: process.env.PG_DISPOSABLE_INTEGRATION !== '1' }, async t => {
  const connection = connectionFromEnv();
  const args = ['-X', '-v', 'ON_ERROR_STOP=1', '-h', connection.host, '-p', connection.port, '-U', connection.user, '-At'];
  const sql = (database, query) => execFileSync('psql', [...args, '-d', database, '-c', query], { encoding: 'utf8' }).trim();
  const template = 'agent_fixture_' + crypto.randomBytes(10).toString('hex');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'disposable-pg-integration-'));
  const env = { ...process.env, PG_VALIDATION_RUN_ROOT: root };
  const runner = path.join(__dirname, 'disposable-database.js');
  const leases = () => fs.readdirSync(root).map(dir => path.join(root, dir, 'lease.json'));
  const launch = (command, overrides = {}) => {
    const child = spawn(process.execPath, [runner, '--template', template, '--', process.execPath, '-e', command],
      { env: { ...env, ...overrides } });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const done = new Promise(resolve => child.on('exit', (code, signal) => resolve({ code, signal, output })));
    return { child, done };
  };
  sql('postgres', `CREATE DATABASE ${identifier(template)} TEMPLATE template0;`);
  try {
    sql('postgres', `REVOKE ALL ON DATABASE ${identifier(template)} FROM PUBLIC;
      GRANT CONNECT ON DATABASE ${identifier(template)} TO postgres WITH GRANT OPTION;
      ALTER DATABASE ${identifier(template)} SET search_path TO public, pg_catalog;
      ALTER DATABASE ${identifier(template)} SET "app.scenario" TO 'a=b';
      ALTER ROLE postgres IN DATABASE ${identifier(template)} SET statement_timeout TO '7s';`);
    sql(template, 'CREATE TABLE public.scenario_sentinel(value integer); INSERT INTO public.scenario_sentinel VALUES (7);');

    await t.test('parallel commands use distinct databases, preserve baseline data and clean both', async () => {
      const command = `const cp=require('node:child_process');
        const value=cp.execFileSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c','select value from public.scenario_sentinel'],{encoding:'utf8'}).trim();
        if(value!=='7') process.exit(9);
        cp.execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-c','update public.scenario_sentinel set value=9']);
        setTimeout(()=>{},500);`;
      const runs = [launch(command), launch(command)];
      const results = await Promise.all(runs.map(run => run.done));
      results.forEach(result => assert.equal(result.code, 0, result.output));
      const records = leases().map(file => JSON.parse(fs.readFileSync(file)));
      assert.equal(new Set(records.map(record => record.database)).size, 2);
      records.forEach(record => {
        assert.equal(record.status, 'cleaned');
        assert.deepEqual(record.parity.settings, record.source.settings);
        assert.deepEqual(record.parity.acl, record.source.acl);
      });
      assert.equal(sql(template, 'select value from public.scenario_sentinel'), '7');
    });

    await t.test('nonzero exit and command spawn errors clean the allocated database', async () => {
      const failed = await launch('process.exit(7)').done;
      assert.equal(failed.code, 7, failed.output);
      const missing = spawn(process.execPath, [runner, '--template', template, '--', '/missing-scenario-command'], { env });
      missing.stdout.resume();
      missing.stderr.resume();
      assert.equal(await new Promise(resolve => missing.on('exit', resolve)), 1);
      leases().forEach(file => assert.equal(JSON.parse(fs.readFileSync(file)).status, 'cleaned'));
    });

    await t.test('SIGTERM forwards to the command and cleans before exit', async () => {
      const run = launch("console.log('scenario-child-ready'); setInterval(()=>{},1000)");
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('child did not start')), 10000);
        run.child.stdout.on('data', data => {
          if (String(data).includes('scenario-child-ready')) { clearTimeout(timeout); resolve(); }
        });
      });
      run.child.kill('SIGTERM');
      const result = await run.done;
      assert.equal(result.code, 143, result.output);
      leases().forEach(file => assert.equal(JSON.parse(fs.readFileSync(file)).status, 'cleaned'));
    });

    await t.test('hard-kill recovery uses the stopped owner lease', async () => {
      const run = launch("console.log('owned-child-pid=' + process.pid); setInterval(()=>{},1000)");
      const commandPid = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('child did not start')), 10000);
        run.child.stdout.on('data', data => {
          const match = String(data).match(/owned-child-pid=(\d+)/);
          if (match) { clearTimeout(timeout); resolve(Number(match[1])); }
        });
      });
      run.child.kill('SIGKILL');
      assert.equal((await run.done).signal, 'SIGKILL');
      process.kill(commandPid, 'SIGTERM');
      const leaseFile = leases().find(file => JSON.parse(fs.readFileSync(file)).pid === run.child.pid);
      assert.ok(leaseFile);
      execFileSync(process.execPath, [runner, '--cleanup', leaseFile], { env });
      assert.equal(JSON.parse(fs.readFileSync(leaseFile)).status, 'cleaned');
    });

    // Regression for disposable-database.js: inherited libpq selectors must not redirect manager or scenario SQL.
    await t.test('conflicting service and address settings cannot redirect the scenario to its baseline', async () => {
      const serviceFile = path.join(os.tmpdir(), 'scenario-service-' + crypto.randomBytes(10).toString('hex') + '.conf');
      fs.writeFileSync(serviceFile, `[baseline]\nhost=${connection.host}\nport=${connection.port}\nuser=${connection.user}\ndbname=${template}\n`, { mode: 0o600 });
      const command = `const cp=require('node:child_process');
        const target=cp.execFileSync('psql',['-X','-At','-v','ON_ERROR_STOP=1','-c','select current_database()'],{encoding:'utf8'}).trim();
        if(target!==process.env.PGDATABASE) throw new Error('Wrong database: '+target);
        cp.execFileSync('psql',['-X','-v','ON_ERROR_STOP=1','-c','update public.scenario_sentinel set value=9']);`;
      for (const overrides of [
        { PGSERVICE: 'baseline', PGSERVICEFILE: serviceFile },
        { PGHOSTADDR: '127.0.0.1' },
        { PGHOSTADDR: '127.0.0.1', PGSERVICE: 'baseline', PGSERVICEFILE: serviceFile }
      ]) {
        const result = await launch(command, overrides).done;
        assert.equal(result.code, 0, result.output);
        assert.equal(sql(template, 'select value from public.scenario_sentinel'), '7');
      }
    });

    // Regression for disposable-database.js: ordinary termination after ownership marking must clean before exit.
    await t.test('SIGINT and SIGTERM during synchronous allocation clean up without launching the scenario', async () => {
      for (const signal of ['SIGINT', 'SIGTERM']) {
        const code = `const cp=require('node:child_process');
          const original=cp.execFileSync;
          cp.execFileSync=(file,args,options)=>{
            const result=original(file,args,options);
            if(args.at(-1).startsWith('COMMENT ON DATABASE')) {
              require('node:fs').writeSync(2,'allocation-marked\\n');
              Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000);
            }
            return result;
          };
          require(${JSON.stringify(runner)}).main(['--template',${JSON.stringify(template)},'--',process.execPath,'-e',"console.log('unexpected-scenario-start')"])
            .catch(error=>{console.error(error.message);process.exitCode=1;});`;
        const child = spawn(process.execPath, ['-e', code], { env });
        let output = '';
        const done = new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => {
          output += chunk;
          if (String(chunk).includes('allocation-marked')) child.kill(signal);
        });
        try {
          const result = await done;
          assert.equal(result.code, signal === 'SIGINT' ? 130 : 143, output);
          assert.equal(result.signal, null);
          assert.ok(!output.includes('unexpected-scenario-start'), output);
          const leaseFile = leases().find(file => JSON.parse(fs.readFileSync(file)).pid === child.pid);
          assert.ok(leaseFile, output);
          assert.equal(JSON.parse(fs.readFileSync(leaseFile)).status, 'cleaned');
        } finally {
          const leaseFile = leases().find(file => JSON.parse(fs.readFileSync(file)).pid === child.pid);
          if (leaseFile && JSON.parse(fs.readFileSync(leaseFile)).status !== 'cleaned') cleanup(leaseFile);
        }
      }
    });

    for (const file of leases()) {
      const record = JSON.parse(fs.readFileSync(file));
      assert.equal(sql('postgres', `select count(*) from pg_database where datname='${record.database}'`), '0');
    }
    process.stdout.write(`Shared-cluster integration evidence: ${root}\n`);
  } finally {
    sql('postgres', `DROP DATABASE ${identifier(template)} WITH (FORCE);`);
  }
});

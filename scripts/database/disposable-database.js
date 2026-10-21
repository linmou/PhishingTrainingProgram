#!/usr/bin/env node
// Purpose: allocate an owned scenario database in the existing validation cluster and clean it after a command.
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');

const identifier = value => '"' + String(value).replaceAll('"', '""') + '"';
const literal = value => "'" + String(value).replaceAll("'", "''") + "'";

function connectionFromEnv(env = process.env) {
  const host = env.PG_VALIDATION_HOST || path.join(os.homedir(), '.transfer-assessment-pg17/migration-validation/socket');
  if (!path.isAbsolute(host)) throw new Error('PG_VALIDATION_HOST must be a local Unix socket directory');
  const port = env.PG_VALIDATION_PORT || '55433';
  if (!/^\d{1,5}$/.test(port)) throw new Error('Invalid validation port');
  return { host, port, user: env.PG_VALIDATION_USER || 'local_bootstrap' };
}

function postgres(connection) {
  return sql => execFileSync(process.env.PG_VALIDATION_PSQL || 'psql', [
    '-X', '-v', 'ON_ERROR_STOP=1', '-h', connection.host, '-p', connection.port,
    '-U', connection.user, '-d', 'postgres', '-At', '-c', sql
  ], { encoding: 'utf8', env: { ...process.env, PGCONNECT_TIMEOUT: '10', PGOPTIONS: '-c statement_timeout=30000' },
    stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function metadata(query, name) {
  const result = query(`select json_build_object(
    'oid',d.oid,'comment',shobj_description(d.oid,'pg_database'),
    'owner',pg_get_userbyid(d.datdba),'encoding',pg_encoding_to_char(d.encoding),
    'collate',d.datcollate,'ctype',d.datctype,'locale_provider',d.datlocprovider,'locale',d.datlocale,
    'connection_limit',d.datconnlimit,'allow_connections',d.datallowconn,
    'acl',coalesce((select json_agg(a order by a.grantee,a.privilege,a.grantable) from
      (select case when x.grantee=0 then null else pg_get_userbyid(x.grantee) end as grantee,
        x.privilege_type as privilege,bool_or(x.is_grantable) as grantable
       from aclexplode(coalesce(d.datacl,acldefault('d',d.datdba))) x
       group by x.grantee,x.privilege_type) a),'[]'::json),
    'settings',coalesce((select json_agg(s order by s.role) from
      (select case when r.setrole=0 then null else pg_get_userbyid(r.setrole) end as role,
        array(select unnest(r.setconfig) order by 1) as values
       from pg_db_role_setting r where r.setdatabase=d.oid) s),'[]'::json)
    ) from pg_database d where d.datname=${literal(name)};`);
  return result ? JSON.parse(result) : null;
}

function setupSql(name, source) {
  const db = identifier(name);
  const statements = [`REVOKE ALL ON DATABASE ${db} FROM PUBLIC, ${identifier(source.owner)};`];
  for (const grant of source.acl) {
    if (!['CONNECT', 'CREATE', 'TEMPORARY'].includes(grant.privilege)) throw new Error('Unexpected database privilege');
    const role = grant.grantee === null ? 'PUBLIC' : identifier(grant.grantee);
    statements.push(`GRANT ${grant.privilege} ON DATABASE ${db} TO ${role}${grant.grantable ? ' WITH GRANT OPTION' : ''};`);
  }
  for (const setting of source.settings) {
    for (const value of setting.values) {
      const separator = value.indexOf('=');
      if (separator < 1) throw new Error('Invalid database setting');
      const target = setting.role === null ? `DATABASE ${db}` : `ROLE ${identifier(setting.role)} IN DATABASE ${db}`;
      const key = value.slice(0, separator);
      statements.push(`SELECT set_config(${literal(key)}, ${literal(value.slice(separator + 1))}, false);`);
      statements.push(`ALTER ${target} SET ${identifier(key)} FROM CURRENT;`);
    }
  }
  return statements.join('\n');
}

function comparable(info) {
  const { oid, comment, ...parity } = info;
  return parity;
}

function save(leaseFile, lease) {
  fs.writeFileSync(leaseFile, JSON.stringify(lease, null, 2) + '\n', { mode: 0o600 });
}

function cleanup(leaseFile, { query, requireStopped = true } = {}) {
  const lease = JSON.parse(fs.readFileSync(leaseFile, 'utf8'));
  assert.match(lease.database, /^agent_scenario_[a-f0-9]{24}$/);
  assert.equal(lease.host, os.hostname(), 'Lease belongs to another host');
  if (requireStopped) {
    try {
      process.kill(lease.pid, 0);
      throw new Error('Original database owner is still running');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  query = query || postgres(lease.connection);
  assert.equal(query('select system_identifier from pg_control_system();'), lease.cluster, 'Validation cluster changed');
  const current = metadata(query, lease.database);
  if (current) {
    assert.equal(current.comment, lease.marker, 'Database ownership marker changed; refusing cleanup');
    if (lease.oid) assert.equal(current.oid, lease.oid, 'Database identity changed; refusing cleanup');
    query(`DROP DATABASE ${identifier(lease.database)} WITH (FORCE);`);
  }
  assert.equal(metadata(query, lease.database), null, 'Database remains after cleanup');
  lease.status = 'cleaned';
  lease.cleaned_at = new Date().toISOString();
  save(leaseFile, lease);
}

function allocate(template, { connection = connectionFromEnv(), runRoot = process.env.PG_VALIDATION_RUN_ROOT ||
  path.join(os.homedir(), '.transfer-assessment-pg17/runs'), query = postgres(connection) } = {}) {
  if (!template || template.includes('\0')) throw new Error('An explicit validated local template is required');
  const source = metadata(query, template);
  if (!source || !source.allow_connections) throw new Error('Template is missing or disallows connections');
  fs.mkdirSync(runRoot, { recursive: true, mode: 0o700 });
  const directory = fs.mkdtempSync(path.join(runRoot, 'scenario-'));
  const leaseFile = path.join(directory, 'lease.json');
  const token = crypto.randomBytes(12).toString('hex');
  const lease = {
    database: 'agent_scenario_' + token, template, token,
    host: os.hostname(), pid: process.pid, connection,
    cluster: query('select system_identifier from pg_control_system();'),
    marker: 'phishing-training-scenario:' + token,
    started_at: new Date().toISOString(), status: 'allocating', source
  };
  save(leaseFile, lease);
  try {
    query(`CREATE DATABASE ${identifier(lease.database)} WITH TEMPLATE ${identifier(template)} OWNER ${identifier(source.owner)} CONNECTION LIMIT ${Number(source.connection_limit)};`);
    query(`COMMENT ON DATABASE ${identifier(lease.database)} IS ${literal(lease.marker)};`);
    lease.oid = metadata(query, lease.database).oid;
    save(leaseFile, lease);
    query(setupSql(lease.database, source));
    const actual = metadata(query, lease.database);
    assert.deepEqual(comparable(actual), comparable(source), 'Scenario database ACL/settings/locale parity failed');
    lease.parity = comparable(actual);
    lease.status = 'ready';
    save(leaseFile, lease);
    return { lease, leaseFile, query };
  } catch (error) {
    lease.status = 'allocation-failed';
    lease.error = error.stack || String(error);
    save(leaseFile, lease);
    try { cleanup(leaseFile, { query, requireStopped: false }); }
    catch (cleanupError) { lease.cleanup_error = cleanupError.message; save(leaseFile, lease); }
    throw new Error(`Allocation failed; evidence: ${leaseFile}: ${error.message}`);
  }
}

async function main(args = process.argv.slice(2)) {
  if (args[0] === '--cleanup' && args.length === 2) {
    cleanup(args[1]);
    return;
  }
  if (args[0] !== '--template' || args[2] !== '--' || args.length < 4) {
    throw new Error('Usage: disposable-database.js --template <validated-local-db> -- <command> [args]; or --cleanup <lease.json>');
  }
  const { lease, leaseFile, query } = allocate(args[1]);
  process.stderr.write(`Scenario ${lease.database}; local clone parity passed; evidence: ${leaseFile}\n`);
  let child;
  const output = fs.createWriteStream(path.join(path.dirname(leaseFile), 'stdout.log'), { mode: 0o600 });
  const errors = fs.createWriteStream(path.join(path.dirname(leaseFile), 'stderr.log'), { mode: 0o600 });
  const signalHandlers = {};
  let receivedSignal;
  try {
    lease.command = args.slice(3);
    save(leaseFile, lease);
    child = spawn(args[3], args.slice(4), { stdio: ['inherit', 'pipe', 'pipe'], detached: true,
      env: { ...process.env, PGHOST: lease.connection.host, PGPORT: lease.connection.port,
        PGUSER: lease.connection.user, PGDATABASE: lease.database, MIGRATION_TEST_DB: lease.database,
        PG_VALIDATION_LEASE_FILE: leaseFile } });
    child.stdout.pipe(output);
    child.stdout.pipe(process.stdout, { end: false });
    child.stderr.pipe(errors);
    child.stderr.pipe(process.stderr, { end: false });
    for (const signal of ['SIGINT', 'SIGTERM']) {
      signalHandlers[signal] = () => {
        receivedSignal = signal;
        try { process.kill(-child.pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      };
      process.on(signal, signalHandlers[signal]);
    }
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    lease.result = result;
    save(leaseFile, lease);
    process.exitCode = receivedSignal === 'SIGINT' ? 130 : receivedSignal ? 143 : result.code ?? 1;
  } catch (error) {
    lease.error = error.stack || String(error);
    save(leaseFile, lease);
    throw error;
  } finally {
    output.end();
    errors.end();
    for (const [signal, handler] of Object.entries(signalHandlers)) process.off(signal, handler);
    cleanup(leaseFile, { query, requireStopped: false });
    process.stderr.write(`Cleaned ${lease.database}; evidence: ${leaseFile}\n`);
  }
}

module.exports = { connectionFromEnv, identifier, literal, setupSql, comparable, metadata, allocate, cleanup, main };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });

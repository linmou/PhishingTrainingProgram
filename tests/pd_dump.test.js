#!/usr/bin/env node
// Tests pd_dump.sh and scripts/database/: shared source configuration, metadata, overwrite, credentials, and failures.
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const script = path.resolve(__dirname, '../pd_dump.sh');
const databaseScripts = path.resolve(__dirname, '../scripts/database');
const driver = `
function /opt/homebrew/opt/postgresql@17/bin/pg_dump() {
  "$DUMP_TEST_NODE" "$DUMP_TEST_CHILD" "$@"
}
. "$1"
`;

function fixture(t, {
  password = 'exported-test-password', envFile, exitCode = 0, defaultEnvFile = false,
  alternateOutput = false, settings = {}, missingClient = false,
} = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'pd-dump-test-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const dumpDirectory = path.join(directory, '.transfer-assessment-pg17');
  fs.mkdirSync(dumpDirectory);
  const outputDirectory = alternateOutput ? path.join(directory, 'alternate exports') : dumpDirectory;
  const dump = path.join(outputDirectory, 'phishingtutor.dump');
  const roles = path.join(outputDirectory, 'source-roles.sql');
  const log = path.join(directory, 'exporter.json');
  const child = path.join(directory, 'exporter.js');
  const selectedEnvFile = path.join(directory, defaultEnvFile ? '.env' : 'configured.env');
  const entry = defaultEnvFile ? path.join(directory, 'pd_dump.sh') : script;
  if (defaultEnvFile) {
    fs.symlinkSync(script, entry);
    fs.mkdirSync(path.join(directory, 'scripts/database'), { recursive: true });
    for (const name of ['connection.sh', 'pg_dump.sh', 'pg_dump_roles.sh']) {
      fs.symlinkSync(path.join(databaseScripts, name), path.join(directory, 'scripts/database', name));
    }
  }
  if (envFile !== undefined) fs.writeFileSync(selectedEnvFile, envFile);
  fs.writeFileSync(child, `#!/usr/bin/env node
// Controlled exporter process for pd_dump.sh integration tests.
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const tool = path.basename(process.argv[1]) === 'pg_dumpall' ? 'pg_dumpall' : 'pg_dump';
fs.writeFileSync(process.env.DUMP_TEST_LOG + '.' + tool, JSON.stringify({
  args, pid: process.pid, password: process.env.PGPASSWORD,
  connection: Object.fromEntries(['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGSSLMODE'].map(key => [key, process.env[key]]))
}));
const output = args.find(arg => arg.startsWith('--file=')).slice('--file='.length);
if (Number(process.env.DUMP_TEST_EXIT)) {
  fs.writeFileSync(output, 'partial failed export');
  process.stderr.write('controlled exporter failure\\n');
  process.exit(Number(process.env.DUMP_TEST_EXIT));
}
fs.writeFileSync(output, tool === 'pg_dumpall' ? 'fresh role definitions' : 'fresh test snapshot');
`);
  fs.chmodSync(child, 0o755);
  const clients = path.join(directory, 'clients');
  fs.mkdirSync(clients);
  fs.symlinkSync(child, path.join(clients, 'pg_dump'));
  fs.symlinkSync(child, path.join(clients, 'pg_dumpall'));
  const environment = {
    ...process.env,
    HOME: directory,
    PG_DUMP_ENV_FILE: selectedEnvFile,
    DUMP_TEST_NODE: process.execPath,
    DUMP_TEST_CHILD: child,
    DUMP_TEST_LOG: log,
    DUMP_TEST_EXIT: String(exitCode),
  };
  for (const key of ['PGHOST', 'PGPORT', 'PGUSER', 'PGDATABASE', 'PGSSLMODE', 'PG_DUMP_DIR', 'MIGRATION_SOURCE_CONNECTION']) {
    delete environment[key];
  }
  Object.assign(environment, settings);
  environment.PGCLIENT_BIN_DIR = missingClient ? path.join(directory, 'missing clients') : clients;
  if (alternateOutput) environment.PG_DUMP_DIR = outputDirectory;
  delete environment.PGPASSWORD;
  if (defaultEnvFile) delete environment.PG_DUMP_ENV_FILE;
  if (password !== null) environment.PGPASSWORD = password;
  return {
    dump,
    roles,
    log: `${log}.pg_dump`,
    run: (helper) => {
      const target = helper ? path.join(defaultEnvFile ? directory : databaseScripts, helper) : entry;
      const resolvedTarget = target;
      return spawnSync('/bin/bash', ['-c', driver, resolvedTarget, resolvedTarget], {
      env: environment,
      cwd: os.tmpdir(),
      encoding: 'utf8',
      timeout: 5000,
      });
    },
    invocation: (tool = 'pg_dump') => JSON.parse(fs.readFileSync(`${log}.${tool}`, 'utf8')),
    config: () => {
      const configEnvironment = { ...environment };
      delete configEnvironment.PGCLIENT_BIN_DIR;
      return spawnSync('/bin/sh', ['-c',
        'DATABASE_DIR=$1; . "$DATABASE_DIR/connection.sh"; printf "%s\\n" "$PGCLIENT_BIN_DIR" "$PG_DUMP_DIR" "$PGHOST" "$PGPORT" "$PGUSER" "$PGDATABASE" "$PGSSLMODE"',
        'connection-test', databaseScripts], { env: configEnvironment, encoding: 'utf8', timeout: 5000 });
    },
  };
}

test('exports the configured schemas with permission metadata and overwrites the previous dump', t => {
  const context = fixture(t);
  fs.writeFileSync(context.dump, 'previous snapshot');
  const result = context.run();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  const { args, pid } = context.invocation();
  assert.ok(pid > 0 && pid !== process.pid, 'exporter runs as a distinct child process');
  for (const flag of ['--no-acl', '--no-privileges', '--no-owner']) {
    assert.ok(!args.includes(flag), `snapshot must retain metadata: ${flag}`);
  }
  assert.deepEqual(args, [
    '-w', '-h', 'aws-0-us-east-2.pooler.supabase.com', '-p', '5432',
    '-U', 'postgres.zgbufaxooqxeabewktzd', '-d', 'postgres',
    '--format=custom', '--schema=public', '--schema=private', `--file=${context.dump}`,
  ]);
  assert.equal(fs.readFileSync(context.dump, 'utf8'), 'fresh test snapshot');
  assert.match(result.stdout, /Dump created successfully:/);
  assert.ok(result.stdout.includes(context.dump));
});

test('new dump files are private and exported credentials override the env file', t => {
  const context = fixture(t, { envFile: 'PGPASSWORD=conflicting-file-password\n' });
  const result = context.run();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(context.invocation().password, 'exported-test-password');
  assert.equal(fs.statSync(context.dump).mode & 0o777, 0o600);
  assert.ok(!(result.stdout + result.stderr).includes('exported-test-password'));
});

test('loads credentials from the selected env file when none are exported', t => {
  const context = fixture(t, { password: null, envFile: 'PGPASSWORD=selected-file-password\n' });
  const result = context.run();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(context.invocation().password, 'selected-file-password');
  assert.ok(!(result.stdout + result.stderr).includes('selected-file-password'));
});

test('loads the default env file next to the script from a different working directory', t => {
  const context = fixture(t, {
    password: null,
    envFile: 'PGPASSWORD=default-file-password\n',
    defaultEnvFile: true,
  });
  const result = context.run();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(context.invocation().password, 'default-file-password');
  assert.ok(!(result.stdout + result.stderr).includes('default-file-password'));
});

test('propagates exporter failure and never announces a successful dump', t => {
  const context = fixture(t, { exitCode: 23 });
  const result = context.run();
  assert.equal(result.error, undefined);
  assert.ok(context.invocation().pid > 0, 'failure is from the invoked exporter');
  assert.equal(result.status, 23, result.stderr);
  assert.match(result.stderr, /controlled exporter failure/);
  assert.doesNotMatch(result.stdout, /Dump created successfully/);
});

test('missing credentials fail before invoking the exporter', t => {
  const context = fixture(t, { password: null });
  const result = context.run();
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set PGPASSWORD/);
  assert.equal(fs.existsSync(context.log), false);
  assert.equal(fs.existsSync(context.dump), false);
  assert.doesNotMatch(result.stdout, /Dump created successfully/);
});

test('shared config retains the configured PG17 client, source, SSL, and default output', t => {
  const context = fixture(t);
  const result = context.config();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trim().split('\n'), [
    '/opt/homebrew/opt/postgresql@17/bin', path.dirname(context.dump),
    'aws-0-us-east-2.pooler.supabase.com', '5432', 'postgres.zgbufaxooqxeabewktzd', 'postgres', 'require',
  ]);
});

test('folder snapshot exporter uses shared defaults and creates a private dump', t => {
  const context = fixture(t);
  const result = context.run('pg_dump.sh');
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.ok(context.invocation().pid > 0);
  assert.equal(fs.readFileSync(context.dump, 'utf8'), 'fresh test snapshot');
  assert.equal(fs.statSync(context.dump).mode & 0o777, 0o600);
  assert.deepEqual(context.invocation().connection, {
    PGHOST: 'aws-0-us-east-2.pooler.supabase.com', PGPORT: '5432',
    PGUSER: 'postgres.zgbufaxooqxeabewktzd', PGDATABASE: 'postgres', PGSSLMODE: 'require',
  });
  const args = context.invocation().args;
  assert.deepEqual(args, [
    '-w', '-h', 'aws-0-us-east-2.pooler.supabase.com', '-p', '5432',
    '-U', 'postgres.zgbufaxooqxeabewktzd', '-d', 'postgres',
    '--format=custom', '--schema=public', '--schema=private', `--file=${context.dump}`,
  ]);
  for (const flag of ['--no-acl', '--no-privileges', '--no-owner']) {
    assert.ok(!args.includes(flag), `folder export must retain ${flag} metadata`);
  }
});

test('folder snapshot exporter propagates failure without announcing success', t => {
  const context = fixture(t, { exitCode: 23 });
  const result = context.run('pg_dump.sh');
  assert.equal(result.error, undefined);
  assert.ok(context.invocation().pid > 0);
  assert.equal(result.status, 23, result.stderr);
  assert.match(result.stderr, /controlled exporter failure/);
  assert.doesNotMatch(result.stdout, /successfully/);
});

test('folder exporters load the default adjacent env file from another working directory', t => {
  const context = fixture(t, {
    password: null,
    envFile: 'PGPASSWORD=default-helper-password\n',
    defaultEnvFile: true,
  });
  for (const [helper, tool] of [['scripts/database/pg_dump.sh', 'pg_dump'], ['scripts/database/pg_dump_roles.sh', 'pg_dumpall']]) {
    const result = context.run(helper);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(context.invocation(tool).password, 'default-helper-password');
    assert.ok(!(result.stdout + result.stderr).includes('default-helper-password'));
  }
});

test('folder exporters prefer exported credentials over a conflicting env file', t => {
  const context = fixture(t, { envFile: 'PGPASSWORD=conflicting-helper-password\n' });
  for (const [helper, tool] of [['pg_dump.sh', 'pg_dump'], ['pg_dump_roles.sh', 'pg_dumpall']]) {
    const result = context.run(helper);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(context.invocation(tool).password, 'exported-test-password');
  }
});

test('folder snapshot rejects missing credentials before invoking a client', t => {
  const context = fixture(t, { password: null });
  const result = context.run('pg_dump.sh');
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set PGPASSWORD/);
  assert.equal(fs.existsSync(context.log), false);
  assert.equal(fs.existsSync(context.dump), false);
  assert.doesNotMatch(result.stdout, /successfully/);
});

test('both exporters reuse the selected env-file source and alternate output without a manual connection variable', t => {
  const context = fixture(t, {
    password: null,
    alternateOutput: true,
    envFile: 'PGPASSWORD=shared-file-password\nPGHOST=source-host.test\nPGPORT=6543\nPGUSER=source-owner\nPGDATABASE=source-db\nPGSSLMODE=verify-full\n',
  });
  for (const helper of [undefined, 'pg_dump_roles.sh']) {
    const result = context.run(helper);
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(!(result.stdout + result.stderr).includes('shared-file-password'));
  }
  const dump = context.invocation();
  const roles = context.invocation('pg_dumpall');
  const source = {
    PGHOST: 'source-host.test', PGPORT: '6543', PGUSER: 'source-owner',
    PGDATABASE: 'source-db', PGSSLMODE: 'verify-full',
  };
  assert.deepEqual(dump.connection, source);
  assert.deepEqual(roles.connection, source);
  assert.equal(dump.password, 'shared-file-password');
  assert.equal(roles.password, dump.password);
  assert.deepEqual(dump.args, [
    '-w', '-h', source.PGHOST, '-p', source.PGPORT, '-U', source.PGUSER, '-d', source.PGDATABASE,
    '--format=custom', '--schema=public', '--schema=private', `--file=${context.dump}`,
  ]);
  assert.deepEqual(roles.args, [
    '-w', '-h', source.PGHOST, '-p', source.PGPORT, '-U', source.PGUSER, '-l', source.PGDATABASE,
    '--roles-only', '--no-role-passwords', `--file=${context.roles}`,
  ]);
  assert.equal(fs.readFileSync(context.roles, 'utf8'), 'fresh role definitions');
  assert.equal(fs.statSync(context.roles).mode & 0o777, 0o600);
});

test('role export overwrites prior role definitions and reports its output path', t => {
  const context = fixture(t);
  fs.writeFileSync(context.roles, 'previous role definitions');
  const result = context.run('pg_dump_roles.sh');
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.readFileSync(context.roles, 'utf8'), 'fresh role definitions');
  assert.ok(result.stdout.includes(context.roles));
});

test('role exporter propagates failures without announcing success', t => {
  const context = fixture(t, { exitCode: 23 });
  const result = context.run('pg_dump_roles.sh');
  assert.equal(result.error, undefined);
  assert.ok(context.invocation('pg_dumpall').pid > 0);
  assert.equal(result.status, 23, result.stderr);
  assert.match(result.stderr, /controlled exporter failure/);
  assert.doesNotMatch(result.stdout, /successfully/);
});

test('role exporter rejects missing credentials before invoking a client', t => {
  const context = fixture(t, { password: null });
  const result = context.run('pg_dump_roles.sh');
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Set PGPASSWORD/);
  assert.equal(fs.existsSync(context.roles), false);
});

test('a missing configured client fails instead of falling back to another exporter', t => {
  const context = fixture(t, { missingClient: true });
  const result = context.run();
  assert.equal(result.error, undefined);
  assert.equal(result.status, 127, result.stderr);
  assert.equal(fs.existsSync(context.log), false);
  assert.doesNotMatch(result.stdout, /successfully/);
});

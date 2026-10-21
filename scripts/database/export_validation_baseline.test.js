'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function setup() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ptp-export-test-'));
  const helpers = path.join(temp, 'scripts');
  const runs = path.join(temp, 'runs');
  fs.mkdirSync(helpers);
  fs.copyFileSync(path.join(__dirname, 'export_validation_baseline.sh'),
    path.join(helpers, 'export_validation_baseline.sh'));
  fs.writeFileSync(path.join(helpers, 'pg_dump.sh'), [
    '#!/bin/sh', 'set -eu', 'printf "test dump\n" > "$PG_DUMP_DIR/phishingtutor.dump"'
  ].join('\n'));
  fs.writeFileSync(path.join(helpers, 'pg_dump_roles.sh'), [
    '#!/bin/sh', 'set -eu', 'if [ "$TEST_ROLE_EXPORT_FAILURE" = "1" ]; then exit 7; fi',
    'printf "test roles\n" > "$PG_DUMP_DIR/source-roles.sql"'
  ].join('\n'));
  return {
    temp, runs,
    export: (failure = '0') => spawnSync('sh', [path.join(helpers, 'export_validation_baseline.sh')], {
      encoding: 'utf8',
      env: { ...process.env, PG_VALIDATION_RUN_ROOT: runs, TEST_ROLE_EXPORT_FAILURE: failure }
    })
  };
}

test('each export is isolated and never clobbers an existing snapshot', () => {
  const ctx = setup();
  try {
    fs.mkdirSync(ctx.runs);
    fs.writeFileSync(path.join(ctx.runs, 'phishingtutor.dump'), 'legacy');
    const a = ctx.export();
    const b = ctx.export();
    assert.equal(a.status, 0, a.stderr);
    assert.equal(b.status, 0, b.stderr);
    const first = a.stdout.trim();
    const second = b.stdout.trim();
    assert.notEqual(first, second);
    for (const directory of [first, second]) {
      assert.ok(fs.existsSync(path.join(directory, '.exported')));
      assert.ok(!fs.existsSync(path.join(directory, '.incomplete')));
      assert.match(fs.readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8'), /phishingtutor.dump/);
      assert.equal(fs.statSync(path.join(directory, 'phishingtutor.dump')).mode & 0o777, 0o400);
    }
    assert.equal(fs.readFileSync(path.join(ctx.runs, 'phishingtutor.dump'), 'utf8'), 'legacy');
  } finally { fs.rmSync(ctx.temp, { recursive: true, force: true }); }
});

test('role export errors preserve an explicit incomplete marker', () => {
  const ctx = setup();
  try {
    const failed = ctx.export('1');
    assert.notEqual(failed.status, 0);
    assert.match(failed.stderr, /Role export failed/);
    const match = failed.stderr.match(/incomplete run: ([^\r\n]+)/);
    assert.ok(match);
    assert.ok(fs.existsSync(path.join(match[1], '.incomplete')));
    assert.ok(!fs.existsSync(path.join(match[1], '.exported')));
  } finally { fs.rmSync(ctx.temp, { recursive: true, force: true }); }
});

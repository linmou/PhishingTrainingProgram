#!/usr/bin/env node
// Test responsible for the browser runner's Supabase URL policy and environment validation.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { loadLocalEnvironment } = require('../../../tutor-system/scripts/browser-demo-tutor-behavior.js');

const URL_KEY = 'REACT_APP_SUPABASE_URL';
const ANON_KEY = 'REACT_APP_SUPABASE_ANON_KEY';

function withEnvironment(values, callback) {
  const previous = new Map([
    [URL_KEY, process.env[URL_KEY]],
    [ANON_KEY, process.env[ANON_KEY]]
  ]);
  try {
    for (const key of [URL_KEY, ANON_KEY]) {
      if (Object.prototype.hasOwnProperty.call(values, key)) {
        process.env[key] = values[key];
      } else {
        delete process.env[key];
      }
    }
    return callback();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function withEnvFile(contents, callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-supabase-e2e-'));
  const envFile = path.join(directory, '.env');
  fs.writeFileSync(envFile, contents, 'utf8');
  try {
    return callback(envFile);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('accepts a hosted Supabase URL and preserves process-env precedence', () => {
  const remoteUrl = 'https://remote-test-project.supabase.co';
  const remoteKey = 'test-anon-key';
  const loaded = withEnvFile(
    'REACT_APP_SUPABASE_URL=https://dotenv-project.supabase.co\nREACT_APP_SUPABASE_ANON_KEY=dotenv-key\nREMOTE_E2E_FIXTURE=from-dotenv\n',
    (envFile) => withEnvironment({
      [URL_KEY]: remoteUrl,
      [ANON_KEY]: remoteKey
    }, () => loadLocalEnvironment(envFile))
  );

  assert.equal(loaded.env.REMOTE_E2E_FIXTURE, 'from-dotenv');
  assert.equal(loaded.env[URL_KEY], remoteUrl);
  assert.equal(loaded.env[ANON_KEY], remoteKey);
  assert.equal(new URL(loaded.env[URL_KEY]).origin, remoteUrl);
  assert.equal(typeof loaded.supabase.from, 'function');
});

test('continues to accept a local Supabase URL', () => {
  const loaded = withEnvironment({
    [URL_KEY]: 'http://127.0.0.1:54321',
    [ANON_KEY]: 'test-anon-key'
  }, () => loadLocalEnvironment());

  assert.equal(loaded.env[URL_KEY], 'http://127.0.0.1:54321');
  assert.equal(typeof loaded.supabase.from, 'function');
});

test('rejects a missing URL or anon key after environment overrides', () => {
  assert.throws(
    () => withEnvironment({ [URL_KEY]: '', [ANON_KEY]: 'test-anon-key' }, loadLocalEnvironment),
    /Missing local Supabase configuration/
  );
  assert.throws(
    () => withEnvironment({ [URL_KEY]: 'https://remote-test-project.supabase.co', [ANON_KEY]: '' }, loadLocalEnvironment),
    /Missing local Supabase configuration/
  );
});

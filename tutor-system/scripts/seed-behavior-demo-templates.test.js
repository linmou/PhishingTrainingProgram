#!/usr/bin/env node
// Test seed-behavior-demo-templates.js privacy initialization, insertion and drift rejection without hosted writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const test = require('node:test');

const scriptPath = path.join(__dirname, 'seed-behavior-demo-templates.js');
const scriptRequire = createRequire(scriptPath);
const source = fs.readFileSync(scriptPath, 'utf8');

async function runSeeder(existing) {
  const updates = [];
  const inserts = [];
  const errors = [];
  const fakeProcess = {
    argv: ['node', scriptPath, '--case-id=webpage_location_sharing_safety'],
    env: {
      REACT_APP_SUPABASE_STAGING_URL: 'https://ciubrzggdqesgvfkpolj.supabase.co',
      REACT_APP_SUPABASE_STAGING_ANON_KEY: 'fixture-key'
    },
    exitCode: 0,
    exit(code) { this.exitCode = code; }
  };
  const query = {
    select() { return query; },
    eq() { return query; },
    async maybeSingle() { return { data: existing, error: null }; },
    update(value) {
      updates.push(value);
      return { async eq() { return { error: null }; } };
    },
    async insert(rows) { inserts.push(...rows); return { error: null }; }
  };
  function requireModule(name) {
    if (name === '@supabase/supabase-js') {
      return { createClient: () => ({ from: () => query }) };
    }
    return scriptRequire(name);
  }
  requireModule.extensions = require.extensions;
  await vm.runInNewContext(source, {
    require: requireModule, __dirname, process: fakeProcess,
    console: { log() {}, error(error) { errors.push(error.message); } }
  }, { filename: scriptPath });
  return { updates, inserts, errors, exitCode: fakeProcess.exitCode };
}

test('initializes an existing privacy configuration without writing content or author fields', async () => {
  const result = await runSeeder({ id: 'existing', ai_config_template: null });
  assert.equal(result.exitCode, 0);
  assert.equal(result.updates.length, 1);
  assert.deepEqual(Object.keys(result.updates[0]).sort(), ['ai_config_template', 'updated_at']);
  const config = result.updates[0].ai_config_template.prompt_config;
  assert.equal(config.detection_areas.length + config.verification_steps.length, 5);
  assert.equal(result.inserts.length, 0);
});

test('rejects a configured privacy row with changed model settings before updating it', async () => {
  const initialized = await runSeeder({ id: 'existing', ai_config_template: null });
  const config = { ...initialized.updates[0].ai_config_template, temperature: 0.17 };
  const result = await runSeeder({ id: 'existing', ai_config_template: config });
  assert.equal(result.exitCode, 1);
  assert.equal(result.updates.length, 0);
  assert.equal(result.inserts.length, 0);
  assert.match(result.errors[0], /use the scoped knowledge migration/);
});

test('accepts an already matching privacy configuration', async () => {
  const initialized = await runSeeder({ id: 'existing', ai_config_template: null });
  const result = await runSeeder({
    id: 'existing', ai_config_template: initialized.updates[0].ai_config_template
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.updates.length, 1);
  assert.equal(result.inserts.length, 0);
});

test('inserts a missing privacy row with its maintained post, dialogue and OP data', async () => {
  const result = await runSeeder(null);
  assert.equal(result.exitCode, 0);
  assert.equal(result.updates.length, 0);
  assert.equal(result.inserts.length, 1);
  const row = result.inserts[0];
  assert.equal(row.template_name, 'Location Sharing Safety');
  assert.equal(row.description_template, "321 Jefferson Ave come hang out guys, I'm bored.");
  assert.equal(row.pre_populated_dialogue.length, 2);
  assert.equal(row.op_config_template.custom_op_name, 'Jasmina Weatherly');
});

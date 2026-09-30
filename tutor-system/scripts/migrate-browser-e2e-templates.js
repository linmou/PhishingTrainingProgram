#!/usr/bin/env node
// Purpose: copy selected production demo templates into reusable staging browser-test rooms once.
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true },
    fileName: filename
  });
  module._compile(output.outputText, filename);
};

const { getDemoRoomTemplateSeeds } = require(path.join(__dirname, '../src/services/demoRoomTemplates.ts'));
const assessmentSeed = getDemoRoomTemplateSeeds().find((seed) => seed.case_id === 'webpage_demo_correct_safe_action');
assert(assessmentSeed, 'Assessment template definition is missing');

const PRODUCTION = 'zgbufaxooqxeabewktzd';
const STAGING = 'ciubrzggdqesgvfkpolj';
const OWNER = '6c251a12-6787-462e-a5e4-59acd30e6c25';
const templates = [
  { source: '34d84b08-5712-4c74-9c3c-443fefee587f', target: '34d84b08-5712-4c74-9c3c-443fefee587f', transfer: false },
  { source: '93ba95e9-fee9-4a1e-9486-a605d2ffc525', target: '93ba95e9-fee9-4a1e-9486-a605d2ffc525', transfer: false },
  { source: '7207c6cd-2850-4a6c-bd9d-fc722a14a4f1', target: '7207c6cd-2850-4a6c-bd9d-fc722a14a4f1', transfer: false },
  { source: '5ebb7df1-838c-4009-a533-3db0a9685583', target: '5ebb7df1-838c-4009-a533-3db0a9685583', transfer: false },
  { source: 'a281354b-f0ff-41b4-987f-ed527a22b83a', target: '3a47a215-13ae-45f8-a94d-cc1e6200c03f', transfer: true },
  { source: 'a281354b-f0ff-41b4-987f-ed527a22b83a', target: 'd6b6b8f0-c0f8-4a4f-a55f-6c9f776221dd', transfer: true },
  { source: 'a281354b-f0ff-41b4-987f-ed527a22b83a', target: '79be49a2-e53c-493d-bd66-adcffbadbba5', transfer: true }
];

async function productionQuery(token, sql) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${PRODUCTION}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql })
  });
  if (!response.ok) throw new Error(`Production template read failed: HTTP ${response.status}`);
  return response.json();
}

async function readOne(client, table, column, value) {
  const { data, error } = await client.from(table).select('*').eq(column, value).maybeSingle();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function insert(client, table, value) {
  const { error } = await client.from(table).insert(value);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function main(env = process.env) {
  const stagingUrl = `https://${STAGING}.supabase.co`;
  assert.equal(env.REACT_APP_SUPABASE_STAGING_URL, stagingUrl, 'Staging URL must name the expected project');
  assert(env.SUPABASE_ACCESS_TOKEN && env.STAGING_SUPABASE_SERVICE_ROLE_KEY, 'Management token and staging service key are required');
  const sourceIds = [...new Set(templates.map(({ source }) => source))];
  const quotedIds = sourceIds.map((id) => `'${id}'`).join(',');
  const [rooms, configs, users] = await Promise.all([
    productionQuery(env.SUPABASE_ACCESS_TOKEN, `select id,title,description,image_url,is_active,ai_assistant_enabled,ai_assistant_model,ai_assistant_prompt,pre_populated_dialogue,tutor_id,op_id from public.rooms where id in (${quotedIds})`),
    productionQuery(env.SUPABASE_ACCESS_TOKEN, `select room_id,model_name,system_prompt,prompt_config,temperature,max_tokens,is_active from public.ai_assistant_configs where room_id in (${quotedIds}) and is_active`),
    productionQuery(env.SUPABASE_ACCESS_TOKEN, `select u.id,u.display_name,u.current_role,u.status from public.users u where u.id='${OWNER}'`)
  ]);
  assert.equal(rooms.length, sourceIds.length, 'Missing production template room');
  assert.equal(configs.length, sourceIds.length, 'Missing production template AI config');
  assert.equal(users.length, 1, 'Missing production template tutor');
  const client = createClient(stagingUrl, env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const owner = await readOne(client, 'users', 'id', OWNER);
  if (!owner) await insert(client, 'users', users[0]);
  else assert.equal(owner.display_name, users[0].display_name, 'Staging tutor identity differs');
  const created = [];
  for (const template of templates) {
    const source = rooms.find((room) => room.id === template.source);
    const sourceConfig = configs.find((config) => config.room_id === template.source);
    const promptConfig = template.transfer
      ? assessmentSeed.ai_config_template.prompt_config
      : sourceConfig.prompt_config;
    const dialogue = template.transfer ? assessmentSeed.pre_populated_dialogue : source.pre_populated_dialogue;
    assert(source.tutor_id === OWNER && source.op_id === OWNER && source.pre_populated_dialogue?.length,
      `Source ${template.source} is no longer an owned template room`);
    const existing = await readOne(client, 'rooms', 'id', template.target);
    if (existing) {
      assert(existing.tutor_id === OWNER && existing.title === source.title &&
        existing.transfer_learning_enabled === template.transfer &&
        existing.ai_assistant_prompt === source.ai_assistant_prompt,
      `Staging room ${template.target} differs from the production template`);
      const existingConfig = await readOne(client, 'ai_assistant_configs', 'room_id', template.target);
      assert(existingConfig?.system_prompt === sourceConfig.system_prompt &&
        existingConfig.model_name === sourceConfig.model_name && existingConfig.is_active,
      `Staging AI config ${template.target} differs from the production template`);
      if (JSON.stringify(existingConfig.prompt_config) !== JSON.stringify(promptConfig)) {
        const { error } = await client.from('ai_assistant_configs').update({
          prompt_config: promptConfig
        }).eq('room_id', template.target);
        if (error) throw new Error(`Prompt config update failed: ${error.message}`);
        created.push(`${template.target}:prompt_config`);
      }
      if (JSON.stringify(existing.pre_populated_dialogue) !== JSON.stringify(dialogue)) {
        const { error } = await client.from('rooms').update({ pre_populated_dialogue: dialogue }).eq('id', template.target);
        if (error) throw new Error(`Dialogue update failed: ${error.message}`);
        created.push(`${template.target}:dialogue`);
      }
      continue;
    }
    await insert(client, 'rooms', {
      ...source, id: template.target, transfer_learning_enabled: template.transfer,
      pre_populated_dialogue: dialogue,
      description: `${source.description}\n\n[browser-e2e-template]`
    });
    await insert(client, 'ai_assistant_configs', { ...sourceConfig, room_id: template.target, prompt_config: promptConfig });
    created.push(template.target);
  }
  process.stdout.write(`${JSON.stringify({ project_ref: STAGING, template_room_ids: templates.map(({ target }) => target), created })}\n`);
}

module.exports = { main, templates };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

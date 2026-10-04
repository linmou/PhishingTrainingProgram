#!/usr/bin/env node
// Purpose: mirror production browser-test rooms into reusable staging fixtures.
'use strict';

const assert = require('node:assert/strict');
const { createClient } = require('@supabase/supabase-js');

const PRODUCTION = 'zgbufaxooqxeabewktzd';
const STAGING = 'ciubrzggdqesgvfkpolj';
const OWNER = '6c251a12-6787-462e-a5e4-59acd30e6c25';
const templates = [
  { id: '3630671f-b40d-48ed-b28b-e1da6d407436', transfer: false },
  { id: '286de02f-30b0-46ee-8df3-17d1dae1ca89', transfer: true },
  { id: 'd6b6b8f0-c0f8-4a4f-a55f-6c9f776221dd', transfer: true },
  { id: '79be49a2-e53c-493d-bd66-adcffbadbba5', transfer: true }
];
const roomFields = [
  'title', 'description', 'image_url', 'is_active', 'ai_assistant_enabled',
  'ai_assistant_model', 'ai_assistant_prompt', 'pre_populated_dialogue',
  'tutor_id', 'op_id', 'transfer_learning_enabled'
];
const configFields = ['model_name', 'system_prompt', 'prompt_config', 'temperature', 'max_tokens', 'is_active'];

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

async function assertEmptyRoom(client, roomId) {
  for (const table of ['messages', 'session_checklists', 'sessions', 'ai_suggestion_feedback', 'message_feedback']) {
    const { count, error } = await client.from(table).select('id', { count: 'exact', head: true }).eq('room_id', roomId);
    if (error) throw new Error(`${table}: ${error.message}`);
    assert.equal(count, 0, `Staging fixture ${roomId} still has ${table}`);
  }
}

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source[field]]));
}

async function syncRow(client, table, key, id, desired, existing, changed) {
  if (!existing) {
    await insert(client, table, { [key]: id, ...desired });
    changed.push(`${table}:${id}:created`);
  } else if (JSON.stringify(pick(existing, Object.keys(desired))) !== JSON.stringify(desired)) {
    const { error } = await client.from(table).update(desired).eq(key, id);
    if (error) throw new Error(`${table} update: ${error.message}`);
    changed.push(`${table}:${id}:updated`);
  }
  const saved = await readOne(client, table, key, id);
  assert.deepEqual(pick(saved, Object.keys(desired)), desired, `${table} ${id} differs from production`);
}

async function main(env = process.env) {
  const stagingUrl = `https://${STAGING}.supabase.co`;
  assert.equal(env.REACT_APP_SUPABASE_STAGING_URL, stagingUrl, 'Staging URL must name the expected project');
  assert(env.SUPABASE_ACCESS_TOKEN && env.STAGING_SUPABASE_SERVICE_ROLE_KEY, 'Management token and staging service key are required');
  const quotedIds = templates.map(({ id }) => `'${id}'`).join(',');
  const [rooms, configs, users] = await Promise.all([
    productionQuery(env.SUPABASE_ACCESS_TOKEN, `select id,title,description,image_url,is_active,ai_assistant_enabled,ai_assistant_model,ai_assistant_prompt,pre_populated_dialogue,tutor_id,op_id,transfer_learning_enabled from public.rooms where id in (${quotedIds})`),
    productionQuery(env.SUPABASE_ACCESS_TOKEN, `select room_id,model_name,system_prompt,prompt_config,temperature,max_tokens,is_active from public.ai_assistant_configs where room_id in (${quotedIds}) and is_active`),
    productionQuery(env.SUPABASE_ACCESS_TOKEN, `select u.id,u.display_name,u.current_role,u.status from public.users u where u.id='${OWNER}'`)
  ]);
  assert.equal(rooms.length, templates.length, 'Missing production template room');
  assert.equal(configs.length, templates.length, 'Missing production template AI config');
  assert.equal(users.length, 1, 'Missing production template tutor');
  const client = createClient(stagingUrl, env.STAGING_SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const existingRooms = await Promise.all(templates.map(({ id }) => readOne(client, 'rooms', 'id', id)));
  for (const [index, template] of templates.entries()) {
    const source = rooms.find((room) => room.id === template.id);
    const existing = existingRooms[index];
    assert(source.tutor_id === OWNER && source.op_id === OWNER && source.pre_populated_dialogue?.length &&
      source.transfer_learning_enabled === template.transfer && source.description.includes('[browser-e2e-template]'),
    `Production room ${template.id} is not the expected fixture`);
    if (existing) {
      assert(existing.tutor_id === OWNER && existing.description.includes('[browser-e2e-template]'),
        `Staging room ${template.id} is not an owned fixture`);
      await assertEmptyRoom(client, template.id);
    }
  }
  const owner = await readOne(client, 'users', 'id', OWNER);
  if (!owner) await insert(client, 'users', users[0]);
  else assert.equal(owner.display_name, users[0].display_name, 'Staging tutor identity differs');
  const changed = [];
  for (const template of templates) {
    const source = rooms.find((room) => room.id === template.id);
    const sourceConfig = configs.find((config) => config.room_id === template.id);
    const config = { ...pick(sourceConfig, configFields), temperature: Number(sourceConfig.temperature) };
    await syncRow(client, 'rooms', 'id', template.id, pick(source, roomFields),
      await readOne(client, 'rooms', 'id', template.id), changed);
    await syncRow(client, 'ai_assistant_configs', 'room_id', template.id, config,
      await readOne(client, 'ai_assistant_configs', 'room_id', template.id), changed);
  }
  process.stdout.write(`${JSON.stringify({ project_ref: STAGING, template_room_ids: templates.map(({ id }) => id), changed, verified: true })}\n`);
}

module.exports = { main, templates };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });

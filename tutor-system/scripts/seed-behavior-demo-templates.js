#!/usr/bin/env node
/**
 * Purpose: Upsert global room templates that ship the Qwen casual_peer tutor
 * prompt so the website template picker can open rooms where the fixed AI
 * behavior is visible.
 *
 * Usage (from tutor-system/):
 *   node scripts/seed-behavior-demo-templates.js
 *   node scripts/seed-behavior-demo-templates.js --case-id=<case_id>
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { createClient } = require('@supabase/supabase-js');

const tutorRoot = path.resolve(__dirname, '..');
const STAGING_URL = 'https://ciubrzggdqesgvfkpolj.supabase.co';

function loadEnv() {
  if (process.env.REACT_APP_SUPABASE_STAGING_URL !== STAGING_URL || !process.env.REACT_APP_SUPABASE_STAGING_ANON_KEY) {
    throw new Error('Template seeding requires explicit staging Supabase URL and anon key.');
  }
}

require.extensions['.ts'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    },
    fileName: filename
  });
  module._compile(output.outputText, filename);
};

loadEnv();

const {
  getDemoRoomTemplateSeeds,
  getMultiAgentTestRoomTemplateSeeds,
  getPromptComparisonTemplateSeeds,
  toRoomTemplateInsertRow,
  GLOBAL_TEMPLATE_TUTOR_ID
} = require(path.join(tutorRoot, 'src/services/demoRoomTemplates.ts'));

async function main() {
  const url = process.env.REACT_APP_SUPABASE_STAGING_URL;
  const key = process.env.REACT_APP_SUPABASE_STAGING_ANON_KEY;

  const supabase = createClient(url, key);
  const requestedCaseIds = process.argv
    .filter((arg) => arg.startsWith('--case-id='))
    .map((arg) => arg.slice('--case-id='.length));
  const allSeeds = [
    ...getDemoRoomTemplateSeeds(),
    ...getMultiAgentTestRoomTemplateSeeds(),
    ...getPromptComparisonTemplateSeeds()
  ];
  const seeds = requestedCaseIds.length === 0
    ? allSeeds
    : allSeeds.filter((seed) => requestedCaseIds.includes(seed.case_id));

  if (requestedCaseIds.length > 0 && seeds.length !== requestedCaseIds.length) {
    const foundCaseIds = new Set(seeds.map((seed) => seed.case_id));
    const missingCaseIds = requestedCaseIds.filter((caseId) => !foundCaseIds.has(caseId));
    throw new Error(`Unknown case_id: ${missingCaseIds.join(', ')}`);
  }

  console.log(`Seeding ${seeds.length} global room templates (tutor_id=${GLOBAL_TEMPLATE_TUTOR_ID})`);

  let updated = 0;
  let inserted = 0;

  for (const seed of seeds) {
    const row = toRoomTemplateInsertRow(seed);
    const { data: existing, error: findError } = await supabase
      .from('room_templates')
      .select('id')
      .eq('tutor_id', GLOBAL_TEMPLATE_TUTOR_ID)
      .eq('template_name', seed.template_name)
      .maybeSingle();

    if (findError) {
      throw new Error(`Lookup failed for ${seed.template_name}: ${findError.message}`);
    }

    if (existing?.id) {
      const { error } = await supabase
        .from('room_templates')
        .update({
          template_description: row.template_description,
          title_template: row.title_template,
          description_template: row.description_template,
          image_url: row.image_url,
          pre_populated_dialogue: row.pre_populated_dialogue,
          ai_config_template: row.ai_config_template,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);

      if (error) {
        throw new Error(`Update failed for ${seed.template_name}: ${error.message}`);
      }
      updated += 1;
      console.log(`updated  ${seed.template_name}`);
    } else {
      const { error } = await supabase.from('room_templates').insert([row]);
      if (error) {
        throw new Error(`Insert failed for ${seed.template_name}: ${error.message}`);
      }
      inserted += 1;
      console.log(`inserted ${seed.template_name}`);
    }
  }

  console.log(`Done. inserted=${inserted} updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

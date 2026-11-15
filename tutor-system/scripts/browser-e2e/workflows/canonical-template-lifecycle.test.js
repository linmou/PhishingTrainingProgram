// Purpose: reject stale inventories and false-positive canonical lifecycle evidence offline.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { TARGET, CASES, assertCanonicalInventory, assertObservation } = require('./canonical-template-lifecycle');
const supabase = path.resolve(__dirname, '../../../supabase');
const seeds = ['migrations', 'archived_migrations'].flatMap(dir => {
  const folder = path.join(supabase, dir);
  return fs.existsSync(folder) ? fs.readdirSync(folder).filter(name => name.endsWith('.sql'))
    .map(name => ({ name, file: path.join(folder, name) })) : [];
}).sort((a, b) => b.name.localeCompare(a.name));
const sql = seeds.map(seed => fs.readFileSync(seed.file, 'utf8')).find(text => text.includes('$catalog$'));
const points = JSON.parse(sql.split('$catalog$')[1]).find(entry => entry.scenario === 'Account Security Alert').points;
const config = () => ({ system_prompt: points.join('\n\n'), prompt_config: { detection_areas: [...points], verification_steps: [] } });
const items = () => points.map(area_text => ({ area_text, item_type: 'detection_area' }));
test('reviewed target is an exact seed point and all five points survive inheritance', () => {
  assert(points.includes(TARGET));
  assertCanonicalInventory(config(), config(), items());
});
test('rejects a legacy template, dropped point, changed saved prompt and rewritten checklist', () => {
  const stale = config(); stale.prompt_config.detection_areas[0] = stale.prompt_config.detection_areas[0].replace('Observation task:', 'What to notice:');
  assert.throws(() => assertCanonicalInventory(stale, stale), /not canonical/);
  const missing = config(); missing.prompt_config.detection_areas.pop();
  assert.throws(() => assertCanonicalInventory(config(), missing), /differs/);
  assert.throws(() => assertCanonicalInventory(config(), { ...config(), system_prompt: 'changed' }), /system prompt/);
  const rewritten = items(); rewritten[3].area_text = 'URL Domain Check:';
  assert.throws(() => assertCanonicalInventory(config(), config(), rewritten), /checklist differs/);
});
function evidence(expected) {
  return [{ dedupe_key: 'analysis:m', processing_state: 'applied', event_payload: { analysis: { events: [{ item_id: 'i', kind: expected.kind }] } } },
    { item_id: 'i', event_kind: expected.kind, processing_state: 'applied', event_payload: { source_evidence_message_ids: ['m'] } }];
}
test('accepts only the reviewed partial and full judgments with applied source-bound evidence', () => {
  for (const c of CASES) assertObservation(evidence(c), { status: c.status, understanding_level: c.level }, 'i', 'm', c);
});
test('rejects over-crediting observation-only evidence', () => {
  assert.throws(() => assertObservation(evidence(CASES[1]), { status: 'covered', understanding_level: 'good' }, 'i', 'm', CASES[0]));
});
test('rejects missing/duplicate completion, wrong source and unpersisted progress', () => {
  const c = CASES[0], progress = { status: c.status, understanding_level: c.level };
  assert.throws(() => assertObservation([], progress, 'i', 'm', c), /completion marker/);
  const duplicate = evidence(c); duplicate.push(duplicate[0]);
  assert.throws(() => assertObservation(duplicate, progress, 'i', 'm', c), /completion marker/);
  const wrong = evidence(c); wrong[1].event_payload.source_evidence_message_ids = ['other'];
  assert.throws(() => assertObservation(wrong, progress, 'i', 'm', c));
  assert.throws(() => assertObservation(evidence(c), { status: 'pending', understanding_level: 'none' }, 'i', 'm', c));
});

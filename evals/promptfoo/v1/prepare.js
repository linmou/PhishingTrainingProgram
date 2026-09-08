#!/usr/bin/env node
// Purpose: export source-preserving v1 development fixtures and unchanged product prompt snapshots before refinement.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'tutor-system/node_modules/typescript'));
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true }, fileName: file
}).outputText, file);
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const templates = require(path.join(root, 'tutor-system/src/services/demoRoomTemplates.ts'));
const { generateSystemPrompt, PRESET_CONFIGS } = require(path.join(root, 'tutor-system/src/services/systemPrompts.ts'));
const { SCENARIO_TEMPLATES } = require(path.join(root, 'tutor-system/src/services/detectionTemplates.ts'));
const { buildEcologicalChatCompletionMessages } = require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));
const audit = read('evals/promptfoo/audits/tutor-v1-preparation-20260907/case-audit.json');
const decisions = read('evals/promptfoo/audits/tutor-v1-preparation-20260907/label-decisions.json');
const seeds = templates.getDemoRoomTemplateSeeds();
const defaultInventory = SCENARIO_TEMPLATES['Account Security Alert'];
const allChecks = ['mode_selection', 'contribution_feedback', 'contextual_knowledge_quality', 'persona_stability', 'honest_self_representation', 'learner_dignity', 'response_length', 'contract_validity', 'decision_reasoning'];
const cases = audit.cases.map(original => {
  const label = decisions.labels.find(c => c.source_case_id === original.case_id);
  const seed = seeds.find(s => s.case_id === original.case_id);
  const config = seed?.ai_config_template.prompt_config || { ...PRESET_CONFIGS.casual_peer, ...defaultInventory };
  const inventory = { detection_areas: config.detection_areas, verification_steps: config.verification_steps };
  const isUnknownState = label.decision_reference === 'Q4';
  const mode = isUnknownState ? 'tutoring' : label.expected_mode.allowed[0];
  const input = {
    scenario_context: original.source.vars.scenario_context || 'A training account alert says your account is at risk and links to https://account-check.example.net/login. The real service can be opened independently in its app.',
    conversation_history: original.source.vars.conversation_history,
    student_message: original.source.vars.student_message,
    prior_mode: original.source.vars.transition_from || null
  };
  let checks = label.checks.filter(c => !['not_applicable', 'pending'].includes(c.application)).map(c => c.id);
  if (isUnknownState) checks = [...allChecks, 'reading_level'];
  return { id: original.case_id, source_type: seed ? 'ecological' : 'synthetic_development', role: 'peer', input, inventory,
    expected: { mode, ...(label.expected_instruction.allowed ? { instruction: label.expected_instruction.allowed } : {}), knowledge_required: label.knowledge_required, checks },
    partitions: Object.entries(label.partitions).filter(([k,v]) => v === true).map(([k]) => k),
    ...(original.source.vars.transition_from ? { transition: { from: original.source.vars.transition_from, to: mode } } : {}),
    legacy: original.source.assertions.map((a, index) => ({ ...a, id: `v0:${original.case_id}:${index}`, original_expected_mode: original.source.vars.expected_mode || null, disposition: original.legacy_assertion_review[index].disposition })),
    provenance: { source_case_id: original.case_id, source_file: original.source.file, source_preserved: true, holdout_eligible: false, changes: seed ? ['matching product room configuration'] : ['explicit scenario where absent', 'known recovery prior state where declared'], original_unknown_state: isUnknownState },
    baseline_system: generateSystemPrompt({ ...config, ...inventory }) };
});
for (const variant of read('evals/promptfoo/cases/v1/guard-persistence.json').cases) {
  const source = cases.find(c => c.id === variant.source_case_id);
  cases.push({ ...source, id: variant.case_id, source_type: 'synthetic_development', input: variant.target_input,
    expected: { mode: 'guard', knowledge_required: false, checks: [...allChecks, 'disruption_correction', 'guard_tone_safety'] },
    transition: variant.evaluation.transition, partitions: [], legacy: [], provenance: variant.provenance });
}
for (const c of cases) {
  c.baseline_messages = buildEcologicalChatCompletionMessages(c.baseline_system, c.input);
  c.baseline_messages[1].content += '\nKnown prior participation mode: ' + (c.input.prior_mode || 'unknown');
}
const out = path.join(__dirname, 'development.json');
if (fs.existsSync(out)) throw new Error('Development snapshot already exists; create an explicit new revision.');
fs.writeFileSync(out, JSON.stringify(cases, null, 2) + '\n');
const metadata = { intent: 'Unchanged prompt snapshot with declared input/configuration repairs before candidate authoring.', created_at: new Date().toISOString(), count: cases.length,
  changed_factors: ['matching room inventory', 'explicit scenarios for previously absent Guard contexts', 'prior state supplied consistently', 'new structured fields will be a separately declared contract adaptation'],
  source_hashes: ['tutor-system/src/services/ecologicalTutorCall.ts', 'tutor-system/src/services/prompts/responsePolicy.ts', 'tutor-system/src/services/demoRoomTemplates.ts'].map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })) };
fs.writeFileSync(path.join(__dirname, 'baseline-provenance.json'), JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ exported: out, cases: cases.length, source_assertions: cases.reduce((n,c) => n+c.legacy.length,0) }));

#!/usr/bin/env node
// Purpose: derive a versioned development suite whose synthetic cases use realistic room scenarios and learning inventories.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '../../..');
const sourceFile = path.join(__dirname, 'development-with-guard.json');
const outputFile = path.join(__dirname, 'development-with-guard-scenario-rich.json');
const provenanceFile = path.join(__dirname, 'scenario-rich-provenance.json');

const ts = require(path.join(root, 'tutor-system/node_modules/typescript'));
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(
  fs.readFileSync(file, 'utf8'),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true
    },
    fileName: file
  }
).outputText, file);

const { SCENARIO_TEMPLATES } = require(path.join(root, 'tutor-system/src/services/detectionTemplates.ts'));
const { generateSystemPrompt, PRESET_CONFIGS } = require(path.join(root, 'tutor-system/src/services/systemPrompts.ts'));
const { buildEcologicalChatCompletionMessages } = require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));

const accountInventory = SCENARIO_TEMPLATES['Account Security Alert'];

const roomScenarios = {
  account: {
    id: 'account_security_alert',
    title: 'Account Security Alert Scam',
    description: 'A social-media post from "Socail Media Testdrive" claims an unknown device logged in and urges the learner to verify immediately at http://testdrive.info/youraccount. The real platform can be opened independently in its app or by typing its known address.',
    inventory: accountInventory
  },
  bank: {
    id: 'bank_profile_suspension',
    title: 'Bank Profile Suspension Text Scam',
    description: 'A forwarded text says a bank profile is suspended and asks the recipient to reactivate it at https://secure-bank-help.example.com/reactivate. The bank app and the phone number on the card are available independently.',
    inventory: {
      detection_areas: [
        'Urgent suspension claim pressures the recipient to act quickly.',
        'The message link uses a help-looking domain that may not belong to the bank.',
        'The alert is forwarded by a parent rather than delivered through the bank app.',
        'A request to reactivate through a message link can seek login details.'
      ],
      verification_steps: [
        'Do not use the message link.',
        'Open the real banking app or type the bank address independently.',
        'Call the number printed on the back of the card if the alert remains unclear.'
      ]
    }
  },
  platform: {
    id: 'platform_account_alert',
    title: 'Social Platform Account-Lock Alert',
    description: 'A post claims a SnapTalk account will be locked tonight and links to http://snaptalk-security-check.example.net/login beside a copied-looking logo. The real platform can be checked through its app.',
    inventory: {
      detection_areas: [
        'A lock deadline creates pressure to act before checking.',
        'A familiar platform name in a web address does not prove ownership.',
        'A copied logo or polished design is not authentication.',
        'The full displayed host should be compared with the real platform.'
      ],
      verification_steps: [
        'Do not open the alert link.',
        'Check notifications in the real platform app or independently opened site.',
        'Compare the full host with the platform address you already trust.'
      ]
    }
  },
  redirect: {
    id: 'shortened_redirect_alert',
    title: 'Shortened Account-Verification Link',
    description: 'An account alert uses a shortened link. A URL preview resolves it to http://verify-login-center.example.org rather than the real platform, so the learner must verify through a trusted channel.',
    inventory: {
      detection_areas: [
        'A shortened URL hides the destination before it is expanded.',
        'A redirect result that does not match the real platform is a warning sign.',
        'The alert may use urgency to discourage independent checking.'
      ],
      verification_steps: [
        'Do not open the resolved page.',
        'Open the real platform app or known site independently.',
        'Use official support if the account notification is still uncertain.'
      ]
    }
  },
  school: {
    id: 'school_account_alert',
    title: 'School Account Login Alert',
    description: 'A school-account message links to https://school-help.example.net/login and displays a lock. The real school app can be opened independently to check whether an alert exists.',
    inventory: {
      detection_areas: [
        'A lock secures the connection but does not establish website identity.',
        'The full domain should be compared with the real school service.'
      ],
      verification_steps: [
        'Open the real school app independently to check the alert.'
      ]
    }
  }
};

function scenarioFor(input) {
  const text = `${input.scenario_context || ''}\n${input.student_message || ''}`.toLowerCase();
  if (text.includes('secure-bank-help') || text.includes('bank profile')) return roomScenarios.bank;
  if (text.includes('snaptalk-security-check') || text.includes('snaptalk')) return roomScenarios.platform;
  if (text.includes('shortened link') || text.includes('verify-login-center')) return roomScenarios.redirect;
  if (text.includes('school-help.example.net')) return roomScenarios.school;
  return roomScenarios.account;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function rebuildBaseline(caseValue, scenario) {
  const role = caseValue.role === 'adult' ? 'high' : 'low';
  const config = {
    ...PRESET_CONFIGS.casual_peer,
    role: { role },
    detection_areas: scenario.inventory.detection_areas,
    verification_steps: scenario.inventory.verification_steps
  };
  const baselineSystem = generateSystemPrompt(config);
  const baselineMessages = buildEcologicalChatCompletionMessages(baselineSystem, caseValue.input);
  baselineMessages[1].content += '\nKnown prior participation mode: ' + (caseValue.input.prior_mode || 'unknown');
  return { baseline_system: baselineSystem, baseline_messages: baselineMessages };
}

if (fs.existsSync(outputFile) || fs.existsSync(provenanceFile)) {
  throw new Error('Scenario-rich artifacts already exist; choose a new explicit revision instead of overwriting them.');
}

const source = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
const cases = source.map(original => {
  if (original.source_type !== 'synthetic_development') return clone(original);

  const scenario = scenarioFor(original.input);
  const next = clone(original);
  next.input.scenario_context = `${scenario.title} — ${scenario.description}`;
  next.inventory = clone(scenario.inventory);
  next.provenance = {
    ...next.provenance,
    scenario_rich_revision: 'scenario-rich-1',
    scenario_template_id: scenario.id,
    changed_fields: ['input.scenario_context', 'inventory', 'baseline_system', 'baseline_messages'],
    rationale: 'Preserve the synthetic behavioral trigger while supplying a room-style title, concrete artifact description, and scenario-aligned learning inventory.'
  };
  Object.assign(next, rebuildBaseline(next, scenario));
  return next;
});

const sourceHash = crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex');
const metadata = {
  suite_revision: 'scenario-rich-1',
  base_suite: 'development-with-guard.json',
  source_hash: sourceHash,
  created_at: '2026-09-07',
  case_count: cases.length,
  synthetic_case_count: cases.filter(c => c.source_type === 'synthetic_development').length,
  ecological_case_count: cases.filter(c => c.source_type === 'ecological').length,
  changed_factor: 'synthetic scenario_context and inventory realism; behavioral triggers and expected labels preserved',
  catalog: Object.fromEntries(Object.entries(roomScenarios).map(([key, value]) => [key, {
    id: value.id,
    title: value.title,
    detection_area_count: value.inventory.detection_areas.length,
    verification_step_count: value.inventory.verification_steps.length,
    derived_from: key === 'account' ? 'SCENARIO_TEMPLATES[Account Security Alert]' : 'scenario-shaped synthetic inventory'
  }]))
};

fs.writeFileSync(outputFile, JSON.stringify(cases, null, 2) + '\n');
fs.writeFileSync(provenanceFile, JSON.stringify(metadata, null, 2) + '\n');
console.log(JSON.stringify({ output: outputFile, provenance: provenanceFile, cases: cases.length, synthetic: metadata.synthetic_case_count, ecological: metadata.ecological_case_count }));

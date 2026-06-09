#!/usr/bin/env node
// Purpose: regenerate the frozen Promptfoo current-prompt fixture without calling LLMs or Supabase.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..', '..');
const tutorRoot = path.join(repoRoot, 'tutor-system');
const promptPath = path.join(repoRoot, 'evals', 'promptfoo', 'prompts', 'current.prompt.txt');
const chatPromptPath = path.join(repoRoot, 'evals', 'promptfoo', 'prompts', 'current.chat.prompt.json');
const improvedPromptPath = path.join(repoRoot, 'evals', 'promptfoo', 'prompts', 'improved.prompt.txt');
const improvedChatPromptPath = path.join(repoRoot, 'evals', 'promptfoo', 'prompts', 'improved.chat.prompt.json');
const metadataPath = path.join(repoRoot, 'evals', 'promptfoo', 'fixtures', 'fixture-metadata.json');

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

const { generateSystemPrompt, PRESET_CONFIGS } = require(path.join(tutorRoot, 'src', 'services', 'systemPrompts.ts'));
const { SCENARIO_TEMPLATES } = require(path.join(tutorRoot, 'src', 'services', 'detectionTemplates.ts'));
const { buildPromptfooChatMessages } = require(path.join(tutorRoot, 'src', 'services', 'promptfooEvaluationPromptBuilder.ts'));

const scenario = SCENARIO_TEMPLATES['Account Security Alert'];
const currentPrompt = generateSystemPrompt({
  ...PRESET_CONFIGS.casual_peer,
  detection_areas: scenario.detection_areas,
  verification_steps: scenario.verification_steps
});

const metadata = {
  purpose: 'Frozen v1 current-prompt fixture for reviewing promptfoo cases and rubrics before live evaluation.',
  generated_at: new Date().toISOString(),
  generated_by: 'tutor-system/scripts/export-promptfoo-fixture.js',
  agent_preset: 'casual_peer',
  scenario_template: 'Account Security Alert',
  source_files: [
    'tutor-system/src/services/prompts/index.ts',
    'tutor-system/src/services/prompts/basePrompt.ts',
    'tutor-system/src/services/prompts/presets.ts',
    'tutor-system/src/services/prompts/pedagogy/parameters/roleParameters.ts',
    'tutor-system/src/services/prompts/pedagogy/parameters/communicationStyles.ts',
    'tutor-system/src/services/prompts/pedagogy/parameters/cognitiveParameters.ts',
    'tutor-system/src/services/prompts/pedagogy/parameters/emotionalParameters.ts',
    'tutor-system/src/services/prompts/pedagogy/techniques/scaffoldingTechniques.ts',
    'tutor-system/src/services/prompts/content/cybersecurity/detectionRules.ts',
    'tutor-system/src/services/detectionTemplates.ts'
  ],
  git_commit: 'pending-review'
};

fs.writeFileSync(promptPath, `${currentPrompt}\n`);
fs.writeFileSync(chatPromptPath, `${JSON.stringify(buildPromptfooChatMessages(currentPrompt), null, 2)}\n`);
const improvedPrompt = fs.readFileSync(improvedPromptPath, 'utf8').trim();
fs.writeFileSync(improvedChatPromptPath, `${JSON.stringify(buildPromptfooChatMessages(improvedPrompt), null, 2)}\n`);
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);

console.log(`Wrote ${path.relative(repoRoot, promptPath)}`);
console.log(`Wrote ${path.relative(repoRoot, chatPromptPath)}`);
console.log(`Wrote ${path.relative(repoRoot, improvedChatPromptPath)}`);
console.log(`Wrote ${path.relative(repoRoot, metadataPath)}`);

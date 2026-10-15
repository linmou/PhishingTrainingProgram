#!/usr/bin/env node
// Purpose: build production-shaped tutor requests and format repairs for comparable offline prompt experiments.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const ts = require(path.join(root, 'tutor-system/node_modules/typescript'));
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019, esModuleInterop: true }, fileName: file
}).outputText, file);
const { buildEcologicalChatCompletionMessages } = require(path.join(root, 'tutor-system/src/services/ecologicalTutorCall.ts'));
const { ACTIVE_TUTOR_AGENT_PROMPT } = require(path.join(root, 'tutor-system/src/services/prompts/activeTutorAgentPrompt.ts'));
const { generateSystemPrompt, PRESET_CONFIGS } = require(path.join(root, 'tutor-system/src/services/systemPrompts.ts'));
const { parseTutorDecision } = require(path.join(root, 'tutor-system/src/services/tutorDecisionContract.ts'));

function productionMessages(definition, policy, regenerateRoomPrompt = false) {
  const roomPrompt = (!regenerateRoomPrompt && definition.baseline_system) || generateSystemPrompt({
    ...PRESET_CONFIGS.casual_peer,
    role: { role: definition.role === 'adult' ? 'high' : 'low' },
    ...definition.inventory
  });
  const messages = buildEcologicalChatCompletionMessages(roomPrompt, definition.input);
  if (policy) {
    if (!messages[0].content.endsWith(ACTIVE_TUTOR_AGENT_PROMPT)) throw new Error('Production policy boundary changed.');
    messages[0].content = messages[0].content.slice(0, -ACTIVE_TUTOR_AGENT_PROMPT.length) + policy.trim();
  }
  return messages;
}

function productionRepair(messages) {
  const source = fs.readFileSync(path.join(root, 'tutor-system/src/services/aiService.ts'), 'utf8');
  const ast = ts.createSourceFile('aiService.ts', source, ts.ScriptTarget.Latest, true);
  let instruction;
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(ast) === 'TUTOR_DECISION_REPAIR_INSTRUCTION' && ts.isStringLiteral(declaration.initializer)) {
        instruction = declaration.initializer.text;
      }
    }
  }
  if (!instruction) throw new Error('Production repair instruction is unavailable.');
  const last = messages.at(-1);
  if (!last || last.role !== 'user') throw new Error('Expected the production final user turn.');
  return [...messages.slice(0, -1), { ...last, content: last.content + '\n\n' + instruction }];
}

function productionValid(target) {
  if (target.error || target.payload?.choices?.[0]?.finish_reason === 'length') return false;
  try { parseTutorDecision(target.text); return true; } catch { return false; }
}

module.exports = { productionMessages, productionRepair, productionValid };

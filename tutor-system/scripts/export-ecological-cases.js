#!/usr/bin/env node
/**
 * Purpose: generate evals/promptfoo/cases/webpage-ecological.yaml from the same
 * room-template seeds used on the website (demoRoomTemplates), so chat dialogue
 * in Promptfoo matches real template rooms.
 *
 * Usage (from tutor-system/):
 *   node scripts/export-ecological-cases.js
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const yaml = require('js-yaml');

const tutorRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(tutorRoot, '..');
const outPath = path.join(repoRoot, 'evals/promptfoo/cases/webpage-ecological.yaml');

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

const { getEcologicalCasesFromTemplates } = require(path.join(
      tutorRoot,
      'src/services/demoRoomTemplates.ts'
    ));
const { buildEcologicalChatCompletionMessages } = require(path.join(
  tutorRoot,
  'src/services/ecologicalTutorCall.ts'
));

const cases = getEcologicalCasesFromTemplates();

const rows = cases.map((c) => {
  const metrics = c.applicable_requirements
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
      return {
        vars: {
      case_id: c.case_id,
      template_name: c.template_name,
      scenario_context: c.scenario_context,
      conversation_history: c.conversation_history,
      student_message: c.student_message,
      expected_behavior_focus: c.expected_behavior_focus,
          applicable_requirements: c.applicable_requirements,
          source_type: c.source_type,
          scaffolding_status: c.scaffolding_status,
          student_answer_state: c.student_answer_state,
          product_message_shape: buildEcologicalChatCompletionMessages(c.ai_config_template?.system_prompt || '', {
            scenario_context: c.scenario_context,
            conversation_history: c.conversation_history,
            student_message: c.student_message
          }).map((message) => message.role).join(',')
        },
        assert: metrics.map((metric) => metric === 'response_length'
          ? {
              type: 'javascript',
              metric,
              value: 'file://../../tutor-system/scripts/response-length-rubric.js'
            }
          : {
              type: 'llm-rubric',
              metric,
              value: `file://rubrics/${metric}.md`
            })
  };
});

const header = `# Generated from tutor-system/src/services/demoRoomTemplates.ts
# Do not hand-edit case dialogue — change the room templates and re-run:
#   npm run eval:prompts:export-ecological-cases
#
# Conversation history packaging matches the product webpage AI path
# (prePopulatedToContextMessages + conversationMessagesToHistoryText).

`;

const body = yaml.dump(rows, {
  lineWidth: 120,
  noRefs: true,
  quotingType: '"'
});

const destination = process.env.ECOLOGICAL_OUTPUT_PATH || outPath;
fs.writeFileSync(destination, header + body);
console.log(`Wrote ${rows.length} ecological cases → ${path.relative(repoRoot, outPath)}`);
for (const c of cases) {
  console.log(` - ${c.case_id} (${c.template_name})`);
  console.log(`   student: ${c.student_message.slice(0, 70)}`);
  console.log(`   history lines: ${c.conversation_history.split('\n').length}`);
}

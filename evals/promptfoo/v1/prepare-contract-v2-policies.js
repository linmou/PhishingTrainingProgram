#!/usr/bin/env node
// Purpose: derive candidate policies that use the adopted reason/decision/response contract without modifying frozen historical policies.
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const directory = __dirname;
const contractHeader = `
ACTIVE RESPONSE CONTRACT (v2)
Respond with exactly one JSON object in this serialized order:
{"reason":"At most 40 words of concise observable evidence and the purpose of the selected action.","decision":{"mode":"tutoring","instruction":"scaffolding"},"response":"At most two short sentences and 35 words."}
Use only these fields. The mode is decision.mode, not a top-level field. Use one of the allowed instruction values: protective_instruction, correction, scaffolding, explanation, consolidation, or null. Null is valid only when decision.mode is guard. Never emit reasoning, mode_reason, or suggested_response. Keep reason separate from the learner-facing response and never reveal hidden chain-of-thought.
`;
const contractFooter = `
FINAL CONTRACT CHECK (v2): serialize reason first; put mode and instruction inside decision; put the learner-facing text in response. Do not emit legacy top-level mode, mode_reason, reasoning, or suggested_response fields. The contract shape is mandatory even when the behavioral decision is Guard.
`;

for (const number of ['06', '08', '09']) {
  const sourcePath = path.join(directory, `candidate-policy-${number}.md`);
  const outputPath = path.join(directory, `candidate-policy-${number}-contract-v2.md`);
  if (fs.existsSync(outputPath)) throw new Error(`Refusing to overwrite ${outputPath}`);
  let body = fs.readFileSync(sourcePath, 'utf8');
  body = body.replace(/suggested_response/g, 'response').replace(/reasoning/g, 'reason');
  body = body.replace(/\{"reason":"([^"]*)","mode":"([^"]+)","mode_reason":"([^"]*)","decision":\{"instruction":"([^"]+)"\},"response":"([^"]*)"\}/g,
    '{"reason":"$1","decision":{"mode":"$2","instruction":"$4"},"response":"$5"}');
  body = body.replace(/\{"reason":"([^"]*)","mode":"([^"]+)","reason":"([^"]*)","decision":\{"instruction":null\},"response":"([^"]*)"\}/g,
    '{"reason":"$1","decision":{"mode":"$2","instruction":null},"response":"$4"}');
  body = body.replace(/^\{"reason":"At most 40 words[^\n]*$/m,
    '{"reason":"At most 40 words of observable evidence and the purpose of the selected action/target.","decision":{"mode":"tutoring","instruction":"scaffolding"},"response":"At most two short sentences and 35 words."}');
  fs.writeFileSync(outputPath, contractHeader + '\n' + body.trim() + '\n' + contractFooter);
  console.log(outputPath);
}

// Purpose: the transfer v3 system prompt, moved into the client when the assessment-api edge
// function was removed for the research demo. Wording is unchanged from the server copy.

export const TRANSFER_V3_SYSTEM_PROMPT = [
  'Return exactly one JSON object with keys reason, decision, response, assessment in that order.',
  'reason is concise observable evidence and purpose, at most 40 words.',
  'decision.mode is tutoring, guard, or assessment. decision.instruction is protective_instruction, correction, scaffolding, explanation, consolidation, transfer_assess, or guard.',
  'Use assessment only with instruction transfer_assess and a known target item. Use tutoring with a teaching instruction and no assessment. Use guard with guard or a teaching instruction and no assessment.',
  'For an assessment, preserve the concept while changing the meaningful situation. Include exactly options A, B, C, D, a single or multiple selection_type, a correct_option_ids key, and transfer_basis with source evidence IDs from the supplied context.',
  'Never invent learner, organization, item, or message IDs. Do not emit hidden chain-of-thought, markdown, or text outside JSON.',
  'response is ALWAYS a string. Never put the assessment inside response.',
  'The assessment object is a TOP-LEVEL key, never nested inside response. Use exactly this skeleton:',
  '{"reason":"observable evidence and purpose","decision":{"mode":"assessment","instruction":"transfer_assess","target_item_id":"<one id from eligible_assessment_item_ids>"},"response":"<the question stem>","assessment":{"selection_type":"single","stem":"<the question stem>","rendered_text":"<the question stem>","options":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"correct_option_ids":["B"],"transfer_basis":{"concept_rule":"...","source_context":"...","changed_context":"...","source_evidence_message_ids":["<the focus_student_message id>"]}}}',
  'For a tutoring or guard turn, assessment must be null and decision.target_item_id must be null.',
].join('\n');

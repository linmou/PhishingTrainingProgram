// Current saved-result disclosure contract, shared by active browser journeys and local checks.
'use strict';
const assert = require('node:assert/strict');

function assertSavedResult(result, outcome, attemptNumber, reviewedAssessment) {
  assert.equal(result.assessment_event?.kind, 'result');
  assert.equal(result.assessment_event.outcome, outcome);
  assert.equal(result.assessment_event.attempt_number, attemptNumber);
  assert.equal(result.assessment_event.terminal, outcome !== 'retry');
  assert.equal(result.parent_message_id, result.assessment_event.answer_message_id);
  assert(outcome !== 'retry' || attemptNumber === 1, 'Retry after the final permitted attempt');
  assert(outcome !== 'failed' || attemptNumber === 2, 'Failure disclosed before the second incorrect attempt');
  const expected = outcome === 'passed' ? 'Correct.' : outcome === 'retry'
    ? 'Incorrect. One attempt remaining.'
    : `Incorrect. No attempts remaining. Correct option(s): ${reviewedAssessment.correct_option_ids.join(', ')}.\n${reviewedAssessment.learner_safe_explanation}`;
  assert.equal(result.content, expected, 'Saved result violates the reviewed disclosure contract');
  // Approved terminal disclosure belongs in content; private storage must never be copied into metadata.
  const privateNames = new Set(['assessment_key', 'assessment_transfer_basis', 'correct_option_ids',
    'learner_safe_explanation', 'transfer_basis', 'rationale', 'raw_model_output', 'raw_provider_output',
    'reviewed_payload', 'private_payload', 'source_transfer_basis']);
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, nested] of Object.entries(value)) {
      assert(!privateNames.has(key), `Saved public result leaked ${key}`);
      inspect(nested);
    }
  }
  inspect(result);
}
module.exports = { assertSavedResult };

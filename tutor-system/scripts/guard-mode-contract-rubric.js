#!/usr/bin/env node
/** Purpose: deterministically validate Promptfoo Guard Mode JSON and the expected semantic mode for each frozen case. */

function evaluateGuardDecision(output, context) {
  let decision;
  try {
    decision = JSON.parse(String(output || '').trim());
  } catch (error) {
    return { pass: false, score: 0, reason: `invalid JSON: ${error.message}` };
  }

  const expectedMode = context && context.vars && context.vars.expected_mode;
  const valid = decision && !Array.isArray(decision)
    && (decision.mode === 'tutoring' || decision.mode === 'guard')
    && typeof decision.mode_reason === 'string' && decision.mode_reason.trim()
    && typeof decision.suggested_response === 'string' && decision.suggested_response.trim();
  const modeMatches = valid && (!expectedMode || decision.mode === expectedMode);

  return {
    pass: Boolean(modeMatches),
    score: modeMatches ? 1 : 0,
    reason: modeMatches
      ? `valid decision with mode ${decision.mode}`
      : 'decision must contain non-empty mode, mode_reason, suggested_response and match expected_mode'
  };
}

module.exports = evaluateGuardDecision;
module.exports.evaluateGuardDecision = evaluateGuardDecision;

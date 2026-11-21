// #!/usr/bin/env node
/** Format persisted tutor output for model history while preserving human-reviewed delivery. */
import type { TutorBehaviorDecision } from '../types';

export function formatTutorResponseHistory(
  output: TutorBehaviorDecision,
  postedResponse: string,
  postedGuardMode: boolean = output.decision.guard_mode
): string {
  if (output.response.trim() === postedResponse.trim() && output.decision.guard_mode === postedGuardMode) {
    return `Tutor: ${JSON.stringify(output)}`;
  }
  return `Original AI suggestion: ${JSON.stringify(output)}\nTutor posted after human review: ${JSON.stringify({
    response: postedResponse,
    guard_mode: postedGuardMode
  })}`;
}

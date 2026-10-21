// #!/usr/bin/env node
// Purpose: validate the structured tutor response and boolean Guard decision.
import type { TutorBehaviorDecision, TutorInstruction } from '../types';

const instructions: Array<TutorInstruction | null> = ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', null];

export function parseTutorDecision(content: unknown): TutorBehaviorDecision {
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI response did not contain a structured tutor decision');
  let candidate: any;
  try { candidate = JSON.parse(content); } catch { throw new Error('AI response was not valid JSON for a tutor decision'); }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('AI response must be a JSON object for a tutor decision');
  const first = content.match(/^\s*\{\s*("(?:[^"\\]|\\.)*")\s*:/);
  if (!first || JSON.parse(first[1]) !== 'reason') throw new Error('AI tutor decision reason must be serialized first');
  if (Object.keys(candidate).some(key => !['reason', 'decision', 'response'].includes(key))) throw new Error('AI tutor decision must use reason, decision, and response fields');
  for (const field of ['reason', 'response']) {
    if (typeof candidate[field] !== 'string' || !candidate[field].trim()) throw new Error(`AI tutor decision ${field} must be a non-empty string`);
  }
  if (!candidate.decision || typeof candidate.decision !== 'object' || Array.isArray(candidate.decision)) throw new Error('AI tutor decision is missing or invalid');
  if (Object.keys(candidate.decision).some(key => !['guard_mode', 'instruction'].includes(key))) throw new Error('AI tutor decision contains an unsupported field');
  const { guard_mode, instruction } = candidate.decision;
  if (typeof guard_mode !== 'boolean') throw new Error('AI tutor decision guard_mode must be boolean');
  if (!instructions.includes(instruction)) throw new Error('AI tutor decision instruction is missing or invalid');
  if (instruction === null && !guard_mode) throw new Error('AI tutor decision null instruction is allowed only in Guard');
  if (/\[agent:[^\]]+\]/i.test(candidate.response)) throw new Error('AI tutor decision response must not contain agent tags');
  return { reason: candidate.reason.trim(), decision: { guard_mode, instruction }, response: candidate.response.trim() };
}

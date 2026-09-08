#!/usr/bin/env node
// Purpose: validate the tutor's reason-first v2 decision without inferring missing fields or semantic decisions.
import { TutorBehaviorDecision, TutorInstruction } from '../types';

const instructions: Array<TutorInstruction | null> = ['protective_instruction', 'correction', 'scaffolding', 'explanation', 'consolidation', null];

export function parseTutorDecision(content: unknown): TutorBehaviorDecision {
  if (typeof content !== 'string' || !content.trim()) throw new Error('AI response did not contain a structured tutor decision');
  let candidate: any;
  try { candidate = JSON.parse(content); } catch { throw new Error('AI response was not valid JSON for a tutor decision'); }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) throw new Error('AI response must be a JSON object for a tutor decision');
  const first = content.match(/^\s*\{\s*("(?:[^"\\]|\\.)*")\s*:/);
  if (!first || JSON.parse(first[1]) !== 'reason') throw new Error('AI tutor decision reason must be serialized first');
  if ('mode' in candidate || 'mode_reason' in candidate || 'reasoning' in candidate || 'suggested_response' in candidate) {
    throw new Error('AI tutor decision must use the v2 reason, decision, and response fields');
  }
  for (const field of ['reason', 'response']) {
    if (typeof candidate[field] !== 'string' || !candidate[field].trim()) throw new Error(`AI tutor decision ${field} must be a non-empty string`);
  }
  if (!candidate.decision || typeof candidate.decision !== 'object' || Array.isArray(candidate.decision)) throw new Error('AI tutor decision is missing or invalid');
  if (candidate.decision.mode !== 'tutoring' && candidate.decision.mode !== 'guard') throw new Error('AI tutor decision mode must be tutoring or guard');
  if (!instructions.includes(candidate.decision.instruction)) throw new Error('AI tutor decision instruction is missing or invalid');
  if (candidate.decision.instruction === null && candidate.decision.mode !== 'guard') throw new Error('AI tutor decision null instruction is allowed only in Guard');
  return {
    reason: candidate.reason.trim(),
    decision: { mode: candidate.decision.mode, instruction: candidate.decision.instruction },
    response: candidate.response.trim()
  };
}

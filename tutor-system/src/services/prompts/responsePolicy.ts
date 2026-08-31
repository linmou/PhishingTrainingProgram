#!/usr/bin/env node
/** Purpose: define the concise, conditional tutoring response policy shared by product prompts and evaluation turns. */

export const RESPONSE_POLICY = [
  'Keep it short: use no more than 3 sentences and 50 words.',
  'Teach one point or ask one focused question; do not use question chains.',
  'Before any failed scaffold, allow either one focused question or concise direct teaching.',
  'If the immediately preceding tutor turn asked a question and the latest student answer remains unsafe or incomplete, directly correct the misconception and give one concrete safe action; do not ask another question instead.',
  'A first-round direct correction is allowed when the student is about to take an unsafe action.'
].join('\n');

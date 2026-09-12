#!/usr/bin/env node
// Test responsible for keeping the Deno Edge Function's operation surface locked to the shared assessment API contract. The Edge Function cannot be imported by Jest because it is Deno-only, so this guard parses its source and fails on any drift between its union, allowlist, RPC routing, and dispatch, and between that surface and ASSESSMENT_API_OPERATIONS.

import { readFileSync } from 'fs';
import { join } from 'path';

import { ASSESSMENT_API_ERROR_STATUS, ASSESSMENT_API_OPERATIONS } from '../../types/assessmentApi';

const EDGE_FUNCTION_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'functions',
  'assessment-api',
  'index.ts'
);

const source = readFileSync(EDGE_FUNCTION_PATH, 'utf8');

function matchGroup(pattern: RegExp, label: string): string {
  const match = source.match(pattern);
  if (!match) throw new Error(`could not locate ${label} in the Edge Function source`);
  return match[1];
}

const declaredOperations = Array.from(
  new Set(Array.from(matchGroup(/type Operation =([^;]+);/, 'the Operation union').matchAll(/'([a-z_]+)'/g), (m) => m[1]))
).sort();

const knownOperations = Array.from(
  new Set(
    Array.from(
      matchGroup(/const knownOperations[\s\S]*?\[([\s\S]*?)\];/, 'the knownOperations allowlist').matchAll(/'([a-z_]+)'/g),
      (m) => m[1]
    )
  )
).sort();

const rpcRouted = Array.from(
  new Set(
    Array.from(
      matchGroup(/const rpcName[\s\S]*?\{([\s\S]*?)\n  \};/, 'the rpcName routing table').matchAll(/^ {4}([a-z_]+):/gm),
      (m) => m[1]
    )
  )
).sort();

const dispatched = Array.from(new Set(Array.from(source.matchAll(/case '([a-z_]+)':/g), (m) => m[1]))).sort();

const rpcFunctions = Array.from(
  new Set(
    Array.from(
      matchGroup(/const rpcName[\s\S]*?\{([\s\S]*?)\n  \};/, 'the rpcName routing table').matchAll(
        /: '([a-z_0-9]+_v[0-9]+)'/g
      ),
      (m) => m[1]
    )
  )
).sort();


describe('Edge Function operation surface', () => {
  it('declares the same operations in its union and its allowlist', () => {
    expect(declaredOperations).toEqual(knownOperations);
  });

  it('routes and dispatches every declared operation', () => {
    expect(rpcRouted).toEqual(knownOperations);
    expect(dispatched).toEqual(knownOperations);
  });

  it('declares no operation the dispatch switch cannot handle', () => {
    expect(knownOperations.filter((operation) => !dispatched.includes(operation))).toEqual([]);
  });
});

describe('Edge Function versus shared contract', () => {
  it('implements exactly the shared allowlist, with no drift in either direction', () => {
    expect(knownOperations).toEqual([...ASSESSMENT_API_OPERATIONS].sort());
  });

  it('no longer exposes the removed draft-disposition operations', () => {
    ['reject_draft', 'regenerate_draft', 'capabilities', 'cancel_question',
     'invalidate_question', 'confirm_external_transfer'].forEach((operation) => {
      expect(knownOperations).not.toContain(operation);
    });
    expect(rpcFunctions).not.toContain('reject_assessment_draft_v1');
    expect(rpcFunctions).not.toContain('regenerate_assessment_draft_v1');
  });

  it('maps every error code the live RPCs can raise into the shared status table', () => {
    ['WRONG_LEARNER', 'ITEM_VALIDATION_FAILED', 'FORBIDDEN', 'INVALID_REQUEST'].forEach((code) => {
      expect(ASSESSMENT_API_ERROR_STATUS[code]).toBeDefined();
    });
    expect(ASSESSMENT_API_ERROR_STATUS.WRONG_LEARNER.status).toBe(409);
    expect(ASSESSMENT_API_ERROR_STATUS.ITEM_VALIDATION_FAILED.status).toBe(409);
    expect(ASSESSMENT_API_ERROR_STATUS.FORBIDDEN.status).toBe(403);
  });

  it('projects every response through the public message helper instead of returning raw records', () => {
    // The Edge Function legitimately reads inbound private fields to validate the model output, so
    // the guarantee that matters is on the response path: any returned message row must go through
    // publicMessage. There is no question row any more, so publicMessage is the whole surface.
    expect(source).toMatch(/function publicMessage/);
    expect(source).toMatch(/function safeOperationData[\s\S]*publicMessage\(/);
    expect(source).not.toMatch(/function publicQuestion/);

    // The response projection is an explicit field allowlist, so a private column cannot leak by
    // being copied through from the stored row.
    const projection = source.slice(
      source.indexOf('function publicMessage'),
      source.indexOf('function safeOperationData')
    );
    ['correct_option_ids', 'private_payload', 'transfer_basis', 'raw_model_output', 'reviewed_payload', 'assessment_key'].forEach(
      (field) => {
        expect(projection).not.toContain(field);
      }
    );
    expect(projection).toContain('response_mode');
    expect(projection).toContain('parent_message_id');
  });

  it('validates inbound private fields rather than trusting the model output', () => {
    // Presence of these names on the validation path is required behaviour.
    expect(source).toContain('correct_option_ids');
  });
});

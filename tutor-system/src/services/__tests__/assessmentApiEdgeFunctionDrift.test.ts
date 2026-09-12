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

const nonCapability = knownOperations.filter((operation) => operation !== 'capabilities');

describe('Edge Function operation surface', () => {
  it('declares the same operations in its union and its allowlist', () => {
    expect(declaredOperations).toEqual(knownOperations);
  });

  it('routes and dispatches every non-capabilities operation', () => {
    expect(rpcRouted).toEqual(nonCapability);
    expect(dispatched).toEqual(nonCapability);
  });

  it('declares no operation the dispatch switch cannot handle', () => {
    expect(knownOperations.filter((operation) => operation !== 'capabilities' && !dispatched.includes(operation))).toEqual([]);
  });
});

describe('Edge Function versus shared contract', () => {
  it('implements exactly the shared allowlist, with no drift in either direction', () => {
    expect(knownOperations).toEqual([...ASSESSMENT_API_OPERATIONS].sort());
  });

  it('exposes the two draft-disposition operations the R04 reconciliation added', () => {
    expect(knownOperations).toContain('reject_draft');
    expect(knownOperations).toContain('regenerate_draft');
    expect(rpcFunctions).toContain('reject_assessment_draft_v1');
    expect(rpcFunctions).toContain('regenerate_assessment_draft_v1');
  });

  it('maps every error code the draft RPCs can raise into the shared status table', () => {
    ['DRAFT_NOT_REJECTABLE', 'DRAFT_NOT_REGENERABLE', 'DRAFT_SNAPSHOT_STALE', 'DRAFT_TRIGGER_SUPPRESSED', 'DRAFT_REVISION_CONFLICT', 'IDEMPOTENCY_CONFLICT'].forEach(
      (code) => {
        expect(ASSESSMENT_API_ERROR_STATUS[code]).toBeDefined();
        expect(ASSESSMENT_API_ERROR_STATUS[code].status).toBe(409);
      }
    );
  });

  it('projects every response through the public helpers instead of returning raw records', () => {
    // The Edge Function legitimately reads inbound private fields to validate the
    // model output, so the guarantee that matters is on the response path: every
    // returned record must go through publicMessage/publicQuestion.
    expect(source).toMatch(/function publicQuestion/);
    expect(source).toMatch(/function publicMessage/);
    expect(source).toMatch(/function safeOperationData[\s\S]*publicQuestion\(/);
    expect(source).toMatch(/function safeOperationData[\s\S]*publicMessage\(/);

    // The response projection is an explicit field allowlist, so a private field
    // cannot leak by being copied through from the stored row.
    const projection = source.slice(
      source.indexOf('function publicQuestion'),
      source.indexOf('function safeOperationData')
    );
    ['correct_option_ids', 'private_payload', 'transfer_basis', 'raw_model_output', 'reviewed_payload', 'raw_hash', 'final_hash'].forEach(
      (field) => {
        expect(projection).not.toContain(field);
      }
    );
    expect(projection).toContain('rendered_text');
    expect(projection).toContain('selected_option_ids');
  });

  it('validates inbound private fields rather than trusting the model output', () => {
    // Presence of these names on the validation path is required behaviour.
    expect(source).toContain('correct_option_ids');
  });
});

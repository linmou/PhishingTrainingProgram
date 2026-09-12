#!/usr/bin/env node
// Test responsible for transfer draft disposition through the browser facade (T014):
// `rejectDraft` and `regenerateDraft` must call the reviewed operation names with exactly
// the payload keys the Edge Function and versioned RPCs expect, surface stable error codes,
// return only the contract's public fields, and never reach the provider from the facade.

import { readFileSync } from 'fs';
import { join } from 'path';

import { TransferAssessmentService } from '../transferAssessmentService';
import type {
  RejectedAssessmentDraftDTO,
  RegeneratedAssessmentDraftDTO,
} from '../transferAssessmentService';

interface CapturedRequest {
  operation?: unknown;
  request_id?: unknown;
  [key: string]: unknown;
}

function createCapturingService(response: unknown, error: { message: string } | null = null) {
  const captured: CapturedRequest[] = [];
  const service = new TransferAssessmentService({
    requestId: () => 'request-fixed-1',
    api: {
      invoke: async (body) => {
        captured.push(body as CapturedRequest);
        return { data: (error ? null : { ok: true, data: response }) as never, error };
      },
    },
  });
  return { service, captured };
}

function createFailingService(code: string, message: string) {
  return new TransferAssessmentService({
    requestId: () => 'request-fixed-2',
    api: {
      invoke: async () => ({ data: { ok: false, error: { code, message, retryable: false } } as never, error: null }),
    },
  });
}

const rejectionFixture: RejectedAssessmentDraftDTO = {
  draft_id: 'draft-1',
  revision: 4,
  status: 'rejected',
  same_trigger_suppressed: true,
  request_id: 'request-fixed-1',
};

const regenerationFixture: RegeneratedAssessmentDraftDTO = {
  source_draft_id: 'draft-1',
  source_status: 'superseded',
  replacement_draft_id: 'draft-2',
  replacement_revision: 1,
  replacement_status: 'draft',
  request_id: 'request-fixed-1',
};

const migrationPath = join(__dirname, '..', '..', '..', 'supabase', 'migrations', '027_transfer_assessment_draft_disposition.sql');
const migrationSource = readFileSync(migrationPath, 'utf8');

/**
 * Split a SQL argument list on top-level commas only. Values such as
 * `v_replacement.id` or nested `jsonb_build_object(...)` calls contain no top-level
 * commas, but a naive split would still treat parentheses and array literals as
 * separators, so nesting is tracked explicitly.
 */
function splitTopLevel(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of args) {
    if (char === '(' || char === '[' || char === '{') depth += 1;
    if (char === ')' || char === ']' || char === '}') depth -= 1;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) parts.push(current);
  return parts;
}

/**
 * Pull the jsonb_build_object keys a SQL function returns, in order.
 *
 * `jsonb_build_object` takes its arguments as a flat comma-separated list in which the
 * keys occupy the even positions and their values the odd ones, so the keys are every
 * other top-level argument. The fixture assertions below are checked against this, so a
 * DTO cannot silently drift from the deployed contract.
 */
function returnedKeys(functionName: string): string[] {
  const start = migrationSource.indexOf(`FUNCTION ${functionName}(`);
  if (start < 0) throw new Error(`function ${functionName} not found in 027`);
  const body = migrationSource.slice(start);
  const marker = body.indexOf('v_response := jsonb_build_object(');
  if (marker < 0) throw new Error(`no v_response in ${functionName}`);
  const open = body.indexOf('(', body.indexOf('jsonb_build_object', marker));
  const close = body.indexOf(');', open);
  return splitTopLevel(body.slice(open + 1, close))
    .filter((_, index) => index % 2 === 0)
    .map((part) => part.trim().replace(/^'|'$/g, ''))
    .filter((part) => part.length > 0);
}

describe('transfer assessment draft disposition facade', () => {
  it('rejects a draft through the reject_draft operation with the versioned payload keys', async () => {
    const { service, captured } = createCapturingService(rejectionFixture);

    await service.rejectDraft({ draftId: 'draft-1', expectedRevision: 4, reason: 'teacher_rejected' });

    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe('reject_draft');
    expect(captured[0].request_id).toBe('request-fixed-1');
    expect(captured[0].draft_id).toBe('draft-1');
    expect(captured[0].expected_revision).toBe(4);
    expect(captured[0].reason).toBe('teacher_rejected');
    // The RPC derives identity and idempotency server-side; the facade must not send them.
    expect(captured[0]).not.toHaveProperty('actor_id');
    expect(captured[0]).not.toHaveProperty('trigger_key');
  });

  it('regenerates a draft through the regenerate_draft operation with the versioned payload keys', async () => {
    const { service, captured } = createCapturingService(regenerationFixture);
    const providerPayload = { decision: { mode: 'assessment' }, response: 'regenerated' };

    await service.regenerateDraft({
      sourceDraftId: 'draft-1',
      expectedRevision: 4,
      expectedSnapshotHash: 'a'.repeat(64),
      providerPayload,
      rawHash: 'b'.repeat(64),
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].operation).toBe('regenerate_draft');
    expect(captured[0].request_id).toBe('request-fixed-1');
    expect(captured[0].source_draft_id).toBe('draft-1');
    expect(captured[0].expected_revision).toBe(4);
    expect(captured[0].expected_snapshot_hash).toBe('a'.repeat(64));
    expect(captured[0].provider_payload).toBe(providerPayload);
    expect(captured[0].raw_hash).toBe('b'.repeat(64));
    expect(captured[0]).not.toHaveProperty('actor_id');
  });

  it('returns the rejection contract fields unchanged and does not mutate the caller payload', async () => {
    const { service } = createCapturingService(rejectionFixture);
    const result = await service.rejectDraft({ draftId: 'draft-1', expectedRevision: 4, reason: 'teacher_rejected' });

    expect(Object.keys(result).sort()).toEqual(returnedKeys('reject_assessment_draft_v1').sort());
    expect(result).toEqual(rejectionFixture);
    expect(result.same_trigger_suppressed).toBe(true);
  });

  it('returns the regeneration contract fields unchanged and preserves source state for the caller', async () => {
    const { service } = createCapturingService(regenerationFixture);
    const providerPayload = { decision: { mode: 'tutoring' }, response: 'x' };
    const snapshot = JSON.stringify(providerPayload);

    const result = await service.regenerateDraft({
      sourceDraftId: 'draft-1',
      expectedRevision: 4,
      expectedSnapshotHash: 'a'.repeat(64),
      providerPayload,
      rawHash: 'b'.repeat(64),
    });

    expect(Object.keys(result).sort()).toEqual(returnedKeys('regenerate_assessment_draft_v1').sort());
    expect(result).toEqual(regenerationFixture);
    // A provider failure must not be able to corrupt the arguments the caller still holds.
    expect(JSON.stringify(providerPayload)).toBe(snapshot);
  });

  it.each([
    ['DRAFT_REVISION_CONFLICT', 'the draft moved on'],
    ['DRAFT_ALREADY_SENT', 'the draft was already delivered'],
    ['FORBIDDEN', 'the actor does not own the room'],
    ['ITEM_VALIDATION_FAILED', 'the payload is not a valid assessment'],
  ])('surfaces %s from the backend with its stable code', async (code, message) => {
    const rejecting = createFailingService(code, message);
    await expect(
      rejecting.rejectDraft({ draftId: 'draft-1', expectedRevision: 4, reason: 'teacher_rejected' })
    ).rejects.toThrow(`${code}: ${message}`);

    const regenerating = createFailingService(code, message);
    await expect(
      regenerating.regenerateDraft({
        sourceDraftId: 'draft-1',
        expectedRevision: 4,
        expectedSnapshotHash: 'a'.repeat(64),
        providerPayload: {},
        rawHash: 'b'.repeat(64),
      })
    ).rejects.toThrow(`${code}: ${message}`);
  });

  it('reports a missing envelope instead of silently resolving', async () => {
    const service = new TransferAssessmentService({
      requestId: () => 'request-fixed-3',
      api: { invoke: async () => ({ data: null, error: null }) },
    });
    await expect(
      service.rejectDraft({ draftId: 'draft-1', expectedRevision: 4, reason: 'teacher_rejected' })
    ).rejects.toThrow('Assessment API returned no response');
  });

  it('never leaks private assessment material through the disposition DTOs', async () => {
    const private_ = ['correct_option_ids', 'transfer_basis', 'private_payload', 'raw_model_output', 'reviewed_payload'];
    const leaked = [...Object.keys(rejectionFixture), ...Object.keys(regenerationFixture)].filter((key) =>
      private_.includes(key)
    );
    expect(leaked).toEqual([]);
  });
});

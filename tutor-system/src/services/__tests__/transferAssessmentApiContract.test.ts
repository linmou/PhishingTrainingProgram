#!/usr/bin/env node
// Test responsible for the transfer-assessment API contract: the response envelope, the operation allowlist, stable error codes with their HTTP status, and the public-DTO denylist that keeps private assessment material inside the trusted boundary.

import {
  ASSESSMENT_API_ERROR_STATUS,
  ASSESSMENT_API_OPERATIONS,
  ASSESSMENT_PRIVATE_FIELD_NAMES,
  errorEnvelope,
  isAssessmentApiOperation,
  projectPublicPayload,
  successEnvelope,
} from '../../types/assessmentApi';

const PRIVATE_MATERIAL = {
  correct_option_ids: ['B'],
  transfer_basis: { concept_rule: 'identity is not authentication' },
  rationale: 'chose B because A is wrong',
  raw_model_output: { text: 'raw' },
  reviewed_payload: { decision: {} },
  private_payload: { key: 'B' },
  source_transfer_basis: { changed_context: 'x' },
  reason: 'model reason',
};

describe('assessment API envelope', () => {
  it('wraps success as { ok: true, data } and carries no error key', () => {
    const envelope = successEnvelope({ question_id: 'q1' });

    expect(envelope).toEqual({ ok: true, data: { question_id: 'q1' } });
    expect(Object.keys(envelope)).toEqual(['ok', 'data']);
    expect('error' in envelope).toBe(false);
  });

  it('wraps failure as { ok: false, error } with a stable code, message, and retryable flag', () => {
    const envelope = errorEnvelope('ITEM_VALIDATION_FAILED', 'item validation failed');

    expect(envelope).toEqual({
      ok: false,
      error: { code: 'ITEM_VALIDATION_FAILED', message: 'item validation failed', retryable: false },
    });
    expect(Object.keys(envelope).sort()).toEqual(['error', 'ok']);
    expect('data' in envelope).toBe(false);
  });

  it('derives retryability from the code table and lets an explicit flag win', () => {
    const provider = errorEnvelope('AI_PROVIDER_NOT_CONFIGURED', 'provider missing');
    const forced = errorEnvelope('INVALID_REQUEST', 'bad', true);

    expect(provider.ok).toBe(false);
    expect(forced.ok).toBe(false);
    if (provider.ok || forced.ok) throw new Error('unreachable');
    expect(provider.error.retryable).toBe(true);
    expect(forced.error.retryable).toBe(true);
  });

  it('defaults an unknown code to non-retryable rather than inventing a status', () => {
    const envelope = errorEnvelope('SOMETHING_NEW', 'unmapped');

    expect(envelope.ok).toBe(false);
    if (envelope.ok) throw new Error('unreachable');
    expect(envelope.error.retryable).toBe(false);
    expect(ASSESSMENT_API_ERROR_STATUS.SOMETHING_NEW).toBeUndefined();
  });
});

describe('operation allowlist', () => {
  it('accepts exactly the declared operations and rejects everything else', () => {
    ASSESSMENT_API_OPERATIONS.forEach((operation) => {
      expect(isAssessmentApiOperation(operation)).toBe(true);
    });

    ['', 'drop_table', 'REVIEW_DRAFT', 'reject_draft ', 'review-draft', null, undefined, 42, {}].forEach((value) => {
      expect(isAssessmentApiOperation(value)).toBe(false);
    });
  });

  it('exposes only the operations the lean design keeps', () => {
    expect([...ASSESSMENT_API_OPERATIONS].sort()).toEqual([
      'analyze_message',
      'initialize_checklist',
      'post_message',
      'prepare_turn',
      'process_message',
      'send_reviewed',
    ]);
  });

  it('no longer advertises the removed operations', () => {
    ['capabilities', 'reject_draft', 'regenerate_draft', 'cancel_question',
     'invalidate_question', 'confirm_external_transfer', 'review_draft'].forEach((operation) => {
      expect(isAssessmentApiOperation(operation)).toBe(false);
    });
  });

  it('declares every allowlisted operation with no duplicates', () => {
    expect(new Set(ASSESSMENT_API_OPERATIONS).size).toBe(ASSESSMENT_API_OPERATIONS.length);
    expect(ASSESSMENT_API_OPERATIONS.length).toBe(6);
  });
});

describe('stable error codes', () => {
  it('maps every declared code to a status in the 4xx or 5xx range', () => {
    Object.entries(ASSESSMENT_API_ERROR_STATUS).forEach(([code, entry]) => {
      expect(typeof code).toBe('string');
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.status).toBeLessThan(600);
      expect(typeof entry.retryable).toBe('boolean');
    });
  });

  it('treats authorization and validation failures as non-retryable client faults', () => {
    expect(ASSESSMENT_API_ERROR_STATUS.FORBIDDEN.status).toBe(403);
    expect(ASSESSMENT_API_ERROR_STATUS.FORBIDDEN.retryable).toBe(false);
    expect(ASSESSMENT_API_ERROR_STATUS.ITEM_VALIDATION_FAILED.status).toBe(409);
    expect(ASSESSMENT_API_ERROR_STATUS.WRONG_LEARNER.status).toBe(409);
  });

  it('no longer declares the removed draft-disposition codes', () => {
    ['DRAFT_REVISION_CONFLICT', 'DRAFT_ALREADY_SENT', 'CONTENT_CONFIRMATION_REQUIRED'].forEach((code) => {
      expect(ASSESSMENT_API_ERROR_STATUS[code]).toBeUndefined();
    });
  });

  it('treats an unconfigured provider or verifier as unavailable', () => {
    expect(ASSESSMENT_API_ERROR_STATUS.AI_PROVIDER_NOT_CONFIGURED.status).toBe(503);
    expect(ASSESSMENT_API_ERROR_STATUS.AUTHORIZATION_NOT_CONFIGURED.status).toBe(503);
  });
});

describe('public DTO denylist', () => {
  it('never emits a private field name at any depth', () => {
    const projected = projectPublicPayload({
      question_id: 'q1',
      stem: 'Which statement is safest?',
      options: [
        { id: 'A', text: 'one' },
        { id: 'B', text: 'two' },
      ],
      ...PRIVATE_MATERIAL,
      nested: { ...PRIVATE_MATERIAL },
    }) as Record<string, unknown>;

    ASSESSMENT_PRIVATE_FIELD_NAMES.forEach((field) => {
      expect(Object.keys(projected)).not.toContain(field);
      expect(JSON.stringify(projected)).not.toContain(field);
    });
    expect(projected.question_id).toBe('q1');
    expect(projected.stem).toBe('Which statement is safest?');
    expect(Array.isArray(projected.options)).toBe(true);
  });

  it('keeps the public fields a learner is allowed to see', () => {
    const projected = projectPublicPayload({
      question_id: 'q1',
      selection_type: 'single',
      stem: 'stem',
      rendered_text: 'rendered',
      options: [{ id: 'A', text: 'one' }],
      lifecycle: 'delivered',
    });

    expect(Object.keys(projected).sort()).toEqual([
      'lifecycle',
      'options',
      'question_id',
      'rendered_text',
      'selection_type',
      'stem',
    ]);
  });

  it('detects a leaked private field name so the guard cannot silently pass', () => {
    const projected = projectPublicPayload({ ...PRIVATE_MATERIAL, safe: true }) as Record<string, unknown>;

    expect(projected).toEqual({ safe: true });
    expect(JSON.stringify(projected)).not.toContain('correct_option_ids');
  });

  it('is a pure projection that does not mutate its input', () => {
    const source = { question_id: 'q1', ...PRIVATE_MATERIAL };
    const before = JSON.stringify(source);

    projectPublicPayload(source);

    expect(JSON.stringify(source)).toBe(before);
  });

  it('prunes private fields nested inside arrays', () => {
    const projected = projectPublicPayload({
      items: [
        { id: 'a', ...PRIVATE_MATERIAL },
        { id: 'b', ...PRIVATE_MATERIAL },
      ],
    }) as { items: Array<Record<string, unknown>> };

    projected.items.forEach((item) => {
      expect(Object.keys(item)).toEqual(['id']);
    });
  });
});

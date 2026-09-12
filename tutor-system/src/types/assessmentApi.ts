// Purpose: define the transfer-assessment API contract — operation allowlist, response envelope, stable error codes, and the public DTO denylist — as one pure module shared by the Edge Function, the browser service, and their tests, so no engine-specific runtime is needed to verify it.

export const ASSESSMENT_API_OPERATIONS = [
  'initialize_checklist',
  'post_message',
  'analyze_message',
  'prepare_turn',
  'send_reviewed',
  'process_message',
] as const;

export type AssessmentApiOperation = (typeof ASSESSMENT_API_OPERATIONS)[number];

export interface AssessmentApiError {
  code: string;
  message: string;
  retryable: boolean;
}

export type AssessmentApiEnvelope<T> =
  | { ok: true; data: T; error?: never }
  | { ok: false; data?: never; error: AssessmentApiError };

/** Stable error codes with the HTTP status and retryability the boundary must return. */
export const ASSESSMENT_API_ERROR_STATUS: Record<string, { status: number; retryable: boolean }> = {
  INVALID_REQUEST: { status: 400, retryable: false },
  FORBIDDEN: { status: 403, retryable: false },
  WRONG_LEARNER: { status: 409, retryable: false },
  DRAFT_REVISION_CONFLICT: { status: 409, retryable: false },
  DRAFT_ALREADY_SENT: { status: 409, retryable: false },
  CONTENT_CONFIRMATION_REQUIRED: { status: 409, retryable: false },
  ITEM_VALIDATION_FAILED: { status: 409, retryable: false },
  AI_PROVIDER_NOT_CONFIGURED: { status: 503, retryable: true },
  AUTHORIZATION_NOT_CONFIGURED: { status: 503, retryable: false },
  PERSISTENCE_FAILED: { status: 500, retryable: true },
};

/**
 * Field names that must never reach a learner-facing DTO. The public projection is
 * defined by exclusion so a new private column cannot leak by being copied through.
 */
export const ASSESSMENT_PRIVATE_FIELD_NAMES = [
  'correct_option_ids',
  'transfer_basis',
  'rationale',
  'raw_model_output',
  'reviewed_payload',
  'reason',
  'private_payload',
  'source_transfer_basis',
] as const;

export function isAssessmentApiOperation(value: unknown): value is AssessmentApiOperation {
  return typeof value === 'string' && (ASSESSMENT_API_OPERATIONS as readonly string[]).includes(value);
}

export function successEnvelope<T>(data: T): AssessmentApiEnvelope<T> {
  return { ok: true, data };
}

export function errorEnvelope(code: string, message: string, retryable?: boolean): AssessmentApiEnvelope<unknown> {
  const known = ASSESSMENT_API_ERROR_STATUS[code];
  return { ok: false, error: { code, message, retryable: retryable ?? known?.retryable ?? false } };
}

/**
 * Drop every private field from a value before it crosses the boundary.
 * Returns a shallow-pruned copy; nested objects are pruned recursively.
 */
export function projectPublicPayload<T>(value: T): T {
  const deny = new Set<string>(ASSESSMENT_PRIVATE_FIELD_NAMES);
  const prune = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(prune);
    if (input && typeof input === 'object') {
      const output: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(input as Record<string, unknown>)) {
        if (deny.has(key)) continue;
        output[key] = prune(nested);
      }
      return output;
    }
    return input;
  };
  return prune(value) as T;
}

/** True when the payload carries no private field name at any depth. */
export function containsPrivateFieldName(value: unknown): boolean {
  const deny = new Set<string>(ASSESSMENT_PRIVATE_FIELD_NAMES);
  const walk = (input: unknown): boolean => {
    if (Array.isArray(input)) return input.some(walk);
    if (input && typeof input === 'object') {
      return Object.entries(input as Record<string, unknown>).some(
        ([key, nested]) => deny.has(key) || walk(nested)
      );
    }
    return false;
  };
  return walk(value);
}

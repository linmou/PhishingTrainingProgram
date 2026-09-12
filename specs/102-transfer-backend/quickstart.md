# Backend Verification Quickstart

**Intent**: Give the implementation owner an exact, evidence-oriented order for validating this component without claiming hosted or provider acceptance that did not run.

## Preconditions

Use a disposable supported hosted Supabase project or an explicitly isolated hosted test scope. Do not use `supabase db reset`, a linked production project, destructive migration pushes, or seed data as an incidental test step. Required deployment inputs are the hosted URL/service-role access, a configured production `AssessmentPrincipalVerifier` adapter, and server-side provider configuration. If the verifier adapter is missing, assert disabled capability and `AUTHORIZATION_NOT_CONFIGURED`; injected test verifiers do not close the production gate. Keep the feature disabled while any prerequisite is absent.

## Planning package checks

```bash
rtk git status --short --branch
rtk sha256sum plan/transfer_assessment_implementation_plan.md
rtk proxy sh .specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
```

The source hash must remain `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`.

## Deterministic TypeScript checks

```bash
rtk proxy sh -c 'cd tutor-system && CI=true npm test -- --watchAll=false --runInBand --runTestsByPath src/services/__tests__/transferAssessmentMigration.test.ts src/services/__tests__/transferAssessmentService.test.ts src/services/__tests__/transferAssessmentPersistence.integration.test.ts src/services/__tests__/assessmentAuthorization.integration.test.ts src/services/__tests__/assessmentProviderBoundary.test.ts'
rtk proxy sh -c 'cd tutor-system && npm run build'
```

The existing static migration and pre-delivery tests are diagnostic. The integration suites must use real supported hosted execution for W3/W4/W5 claims and a controlled fake provider for request inspection.

## Hosted schema and RLS evidence

1. Apply or inspect the forward migration only in the disposable supported scope and capture migration status, enum values, table columns, function signatures, grants, enabled policies, private schema exposure, and realtime publication membership.
2. Run the backend SQL matrix for legacy-row preservation, valid state pairs, one active checklist, one unresolved question, draft trigger/supersession constraints, immutable key updates/deletes, direct table writes, old-RPC bypasses, cross-room/learner reads, and public/private columns.
3. Run transaction scenarios for stale and duplicate delivery, successful apply, invalid transition, concurrent delivery and answer, Guard deferral and replay, and provider or persistence rollback.
4. Regenerate `tutor-system/src/types/database.ts` from the actual supported schema and compare tables, enums, functions, argument names, and return types to the runtime contract.

## Authorization and provider evidence

1. Exercise absent deployment adapter, injected verifier, invalid adapter proof, valid learner, valid teacher, cross-room, cross-learner, forged body IDs, and legacy-RPC callers. Record capability state, HTTP status, error code, mutation count, and returned fields; do not assume Supabase Auth, bearer, or `auth.uid()`.
2. Compare production and Promptfoo-consumer serialization through `ecologicalTutorCall.ts`, then capture the v3 provider request and assert the shared contract version/context, configured endpoint/model, `max_tokens=1200`, no selected answer labels or answer key in exact-grading input, and no client secret exposure.
3. Return malformed JSON, invalid schema, truncated output, provider HTTP failure, network failure, and missing configuration. Assert at most one format repair retry, preserved private attempt/error evidence, stable retryability, and zero learner progress mutation.
4. Scan public DTOs, function responses, browser assets, logs, exports, and error envelopes for provider credentials, `correct_option_ids`, transfer basis, raw model output, and private rationale.

## Evidence record

For every command, record the exact command, timestamp, hosted scope identifier without secrets, migration/schema revision, test count, pass/fail/error/blocked result, and immutable artifact path. A missing or errored lane remains visible and blocks its gate. This component does not record Promptfoo or browser release acceptance.

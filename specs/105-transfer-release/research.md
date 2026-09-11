# Research: Transfer Assessment Browser Release and Rollback Evidence

**Intent**: record source-backed planning decisions for W11 and sections 19-20 without inventing product behavior or running release actions.

**Date**: 2026-09-11
**Source baseline**: `plan/transfer_assessment_implementation_plan.md` SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`

## Decision 1: Use a separate dedicated transfer browser runner

**Decision**: Add a transfer-specific runner under `tutor-system/scripts/` and store its results under `evals/transfer-assessment/release/<run-id>/`.

**Rationale**: The normative W11 work package requires a dedicated transfer browser run and explicitly says the seven-room legacy run is regression evidence only. The existing `tutor-system/scripts/browser-demo-tutor-behavior.js` already establishes timestamped run directories, immutable JSON writes, commit/configuration snapshots, screenshots, redacted failures, and separate product/behavior verdicts. Reusing those conventions keeps the new evidence inspectable without conflating the two products.

**Alternatives considered**:

- Extend the seven-room browser harness: rejected because it would not prove transfer-specific lifecycle, privacy, attack, or rollback behavior and would violate the evidence-lane separation.
- Put evidence in the initiative ledger: rejected because the ledger is a status authority, not a binary/screenshot/network evidence store.
- Use only Jest or Promptfoo: rejected because neither proves the real browser, storage, realtime, export, direct-request, activation, or rollback boundary.

## Decision 2: Capture a run snapshot before any product mutation

**Decision**: The runner must record commit, dirty-tree hash, environment/configuration hash, application/Supabase origins, verified-principal source reference, capability state, and linked AI run IDs before creating test data.

**Rationale**: Section 19 requires exact start/end state and configuration. Existing browser evidence records commit and configuration provenance. A pre-mutation snapshot makes a run reproducible and distinguishes code/config changes from product failures.

**Alternatives considered**:

- Record only a base URL and timestamp: rejected because it cannot identify the deployed commit, configuration, provider/evaluation run, or principal source.
- Store environment files verbatim: rejected because secrets must never enter evidence.

## Decision 3: Make missing and failing evidence first-class results

**Decision**: Scenario and gate results use explicit `pass`, `fail`, `blocked`, `missing`, `error`, and `not_applicable` states; only `pass` or an explicitly justified `not_applicable` can satisfy an applicable check.

**Rationale**: The constitution and verification gates require partial or errored results to remain visible and prohibit denominator manipulation or fabricated fallbacks. A release report must distinguish an implementation failure from unavailable credentials or infrastructure.

**Alternatives considered**:

- Omit unrun scenarios: rejected because omission would falsely improve completion and violate the gate rules.
- Mark unavailable checks as pass with mocks: rejected because a mock cannot prove hosted SQL/RLS, verified identity, provider, or browser behavior.

## Decision 4: Keep privacy and attack checks on the real boundary

**Decision**: Inspect learner-visible network/realtime/storage/export/error surfaces and execute forged identity, cross-room, cross-learner, stale-question, direct-write, and legacy-RPC attempts against the isolated migrated target.

**Rationale**: The normative privacy/auth matrix assigns authority and key protection to the server. UI hiding, local storage inspection alone, or mocked clients cannot establish those properties. The protected-state before/after comparison makes rejection observable.

**Alternatives considered**:

- Inspect only rendered DOM: rejected because private data can leak through network payloads, realtime events, exports, storage, or error strings.
- Test only client-side validation: rejected because the client is not a trusted principal and direct writes/RPCs are part of the attack surface.

## Decision 5: Treat activation and rollback as separate evidence lanes

**Decision**: The release runner records activation eligibility and rollback rehearsal, but does not enable the backend capability as an incidental browser-test side effect. Activation remains disabled until all gates pass; rollback disables new generation/delivery without dropping tables or erasing evidence.

**Rationale**: Section 20 defines a backend-controlled capability and a non-destructive rollback. Separating the operation from test execution prevents an incomplete or locally misconfigured run from enabling the feature and preserves a clear audit trail.

**Alternatives considered**:

- Toggle a browser/local flag during the run: rejected because a client flag cannot authorize the feature.
- Roll back by deleting assessment tables/history: rejected because it destroys evidence and violates the normative rollback rule.

## Decision 6: Do not add new credentials or LLM configuration

**Decision**: Use the existing `tutor-system/.env.example` names and configured provider/base URL conventions; when required values are absent, record a blocker and stop the affected stage.

**Rationale**: The repository already documents `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`, `SUPABASE_ACCESS_TOKEN`, `REACT_APP_OAI_API_KEY`, and `REACT_APP_OAI_BASE_URL`. The task is planning only and provides no authority to invent credentials, silently switch providers, or run live model calls.

**Alternatives considered**:

- Add a new provider or fallback configuration: rejected because provider prompt/configuration changes are excluded and the user requires missing LLM parameters to be surfaced.
- Embed secrets in a committed release config: rejected by repository security rules and the privacy gate.

## Open Execution Prerequisites

These are execution prerequisites, not unresolved product decisions: isolated migrated environment, verified teacher/student principals, configured non-production provider when upstream AI evidence is required, browser runtime, permission to create disposable test data, and immutable evidence storage. If any is missing, the release report records the affected stage as blocked or missing.

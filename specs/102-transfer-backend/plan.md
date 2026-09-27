# Implementation Plan: Server-Authoritative Transfer Assessment Backend

<!-- Intent: define the smallest coherent implementation design for trusted two-attempt grading and private terminal feedback. -->

**Branch**: `102-transfer-backend` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/102-transfer-backend/spec.md`

## Summary

Replace the browser-only transfer service with a thin trusted-API facade. Restore the `assessment-api` Edge Function, move generation and component-101 answer resolution behind its verified-principal boundary, and add one forward migration that creates private delivered-assessment, append-only attempt, and provider-attempt audit rows. Public tutor messages retain only the assessment identity, target `student_id`, stem, ordered options, selection type, and lifecycle identity. A row-locked versioned commit RPC enforces two attempts, atomically applies the resolved terminal transition, and releases key/explanation only for terminal second failure.

## Technical Context

**Language/Version**: TypeScript 4.9 for CRA consumers; Deno TypeScript for the Edge Function; PostgreSQL/PLpgSQL for trusted transactions
**Primary Dependencies**: React 18 application facade, `@supabase/supabase-js` 2.39, Supabase Edge Functions/PostgreSQL, Jest, existing shared component-101 domain contracts
**Storage**: Existing public room/checklist/message schema plus new private assessment, grading-attempt, and provider-attempt tables; existing private learning-event ledger
**Testing**: Jest contract/service/static-migration suites, checked Deno Edge Function tests, native PostgreSQL 17 restored-copy SQL/RPC/race/rollback tests; integrated build and deployed Supabase gates remain separate
**Target Platform**: Browser client calling a deployed Supabase Edge Function; supported hosted Supabase PostgreSQL
**Project Type**: React web application with a trusted serverless backend
**Performance Goals**: One provider request plus at most one format repair for preparation; one row-locked transaction for grading; no polling or browser retry may multiply attempts
**Constraints**: No Docker; no new sign-in product; no `auth.uid()` transfer identity contract; no private key/explanation in public rows; six public operation names remain stable; feature remains disabled
**Scale/Scope**: One open assessment per learner, four options per assessment, at most two attempts, ordinary room concurrency and duplicate tabs
**Required Provider Configuration**: Server-only `OAI_API_KEY`, `OAI_BASE_URL`, and `OAI_MODEL=qwen3.5-flash`; no runtime default

## Constitution Check

### Before design

| Principle | Gate | Result |
|---|---|---|
| Preserve requirements and evidence | Local component results and external gates remain explicit | PASS |
| Keep authority server-side | Private key/explanation, grading, attempts, authorization, idempotency, and progress move behind the trusted boundary | PASS |
| Verify the real boundary | Native restored-copy transaction/RLS/race evidence and focused service tests are recorded | PASS |
| Use stable, explicit contracts | Versioned DTOs and RPCs are frozen under `contracts/` | PASS |
| Prefer the smallest coherent design | Three requirement-backed private tables replace browser state; no draft workflow, compatibility grader, or second progress model is added | PASS |
| Project constraints | React/TypeScript/Supabase remain; no Docker, new sign-in, or `auth.uid()` dependency; activation stays off | PASS |

### After design

The design preserves the six existing operation names but changes their implementation, without maintaining the browser grader as a fallback. The private assessment row protects the key/explanation and serializes attempts. The append-only attempt table provides idempotency and grading audit. The private provider-attempt table preserves required generation input/output metadata without turning it into a deliverable draft. No other new storage entity is introduced. All constitution gates remain PASS.

## Project Structure

### Documentation

```text
specs/102-transfer-backend/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── checklists/requirements.md
└── contracts/
    ├── assessment-api.md
    ├── provider-contract.md
    └── rpc-contract.md
```

### Source Code

```text
tutor-system/
├── .env.example
├── src/
│   ├── services/
│   │   ├── transferAssessmentService.ts
│   │   ├── ecologicalTutorCall.ts
│   │   ├── prompts/transferV3Prompt.ts
│   │   └── __tests__/
│   │       ├── transferAssessmentApiContract.test.ts
│   │       ├── transferAssessmentLocalService.test.ts
│   │       ├── transferAssessmentMigration.test.ts
│   │       ├── transferAssessmentService.test.ts
│   │       └── transferTutorRequestV3.test.ts
│   ├── types/assessment.ts
│   └── types/database.ts
├── supabase/
│   ├── functions/assessment-api/
│   │   ├── index.ts
│   │   └── index.test.ts
│   ├── migrations/20260922000000_transfer_assessment_server_authority.sql
│   └── tests/
│       ├── transfer_assessment_backend.sql
│       └── transfer_assessment_rpc_behaviour.sql
└── claude_docs/
    ├── database-schema.md
    ├── supabase-service.md
    ├── ai-behaviors/tutor-response-contract.md
    └── doc_update_record/documentation_update_record_v2026_09_22_transfer_backend.md
```

**Structure Decision**: Restore the previously established Edge Function path and keep the browser service as a typed facade. Use one new forward migration rather than reactivating or rewriting archived migrations. Extend existing CRA and SQL test files where possible; the restored Deno test begins with a shebang and purpose comment, while CRA-consumed TypeScript follows the repository's explicit no-shebang parser rule and starts with the required purpose comment.

## Design Phases

### Phase 0 - Contract and migration research

- Reconcile the deleted component-102 package with current archived migrations 025-046, browser-only commit `5a7f2a2`, archived-migration commit `732dbcd`, the revised component-103 requirement, the constitution, and the approved persistent-attempt decision.
- Freeze provider configuration, role-safe DTOs, private/public fields, RPC versions, lock order, idempotency keys, and legacy-row handling in `research.md` and `contracts/`.

### Phase 1 - Data and interface design

- Define private assessment, grading-attempt, and provider-attempt entities, lifecycle transitions, terminal disclosure, and migration reconciliation in `data-model.md`.
- Define the six-operation API facade in `contracts/assessment-api.md`.
- Define `send_reviewed_tutor_response_v4`, `post_assessment_message_v2`, and `process_assessment_message_v2` plus retained trusted operations in `contracts/rpc-contract.md`.
- Define request parity, production prompt obligations, required DashScope-compatible settings, bounded repair, and private provider evidence in `contracts/provider-contract.md`.

### Phase 2 - Implementation and component verification

- Verify contract, projection, provider, static migration, native restored-copy transaction, authorization, and concurrency behavior.
- Restore the private storage/RPC boundary and compare its local catalog with the checked-in database types.
- Restore the Edge Function and production prompt, then replace the browser implementation with a trusted transport facade.
- Run local SQL, focused Jest, checked Deno, source privacy, and documentation gates while `TRANSFER_ASSESSMENT_ENABLED` remains false. Record the component build outcome; integration owns the combined build and hosted/generated-type gates.

## Component Boundaries

- **Consumes from 101**: `PrivateAssessment.learner_safe_explanation`, exact-set grading semantics, two-attempt lifecycle outcome names, progress transition contract, and validation rules.
- **Supplies to 103**: exact public assessment `{id, student_id, selection_type, stem, options}`, `PublicMessageDTO`, `ReviewedDeliveryDTO`, canonical unchanged `ProcessedMessageDTO`, error envelope, authoritative attempt counts, and terminal failure feedback. Public `student_id` is routing metadata only; 102 remains authorization authority.
- **Supplies to 104**: shared `TransferTutorRequestV3`/context builders and provider response contract; 104 owns semantic rubric behavior rather than provider or grading logic.
- **Integration-owned**: real 101-to-102 domain handoff, 102-to-103 UI handoff, 102-to-104 evaluation handoff, browser E2E, coverage manifest, and release promotion evidence.

## Risk Controls

| Risk | Control |
|---|---|
| Existing public `assessment_key` values leak | Forward migration moves any recoverable key into a private legacy-incomplete row, clears/drops the public key column, and never fabricates an explanation |
| Two tabs spend both attempts | Row-lock the private assessment; serialize distinct answer messages and expose the resulting authoritative count |
| Duplicate transport consumes attempts | Unique request and answer-message identities return the stored result |
| Resolver and persisted outcome drift | Run the real component-101 resolver through the Edge handler into the commit RPC, including a stale-snapshot reread; compare stored attempt, event, progress, and history with the resolver result |
| Private feedback leaks through generic projection | Allowlist DTOs and scan public rows, realtime, logs, errors, exports, and build artifacts |
| Missing verifier/provider makes an unsafe fallback attractive | Return stable disabled/configuration errors; no browser grader, dummy provider output, or default model |
| Archived migration state differs from deployed schema | Rehearse one forward migration on a disposable restored copy; inspect deployed schema before any target migration and record any mismatch as blocked |

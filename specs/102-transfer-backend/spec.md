# Feature Specification: Server-Authoritative Transfer Assessment Backend

**Feature Branch**: `102-transfer-backend`  
**Created**: 2026-09-11  
**Status**: Planned  
**Input**: User description: "Finish planning for W3-W6 server-authoritative storage, RLS/RPCs, authorization, evidence application, provider boundary, and production prompt."

This component owns the backend boundary for transfer assessment. It preserves legacy checklist behavior while adding an explicitly owned, versioned transfer policy whose private assessment material, identity, authorization, progress transitions, evidence, and provider access remain server-authoritative.

## User Scenarios & Testing

### User Story 1 - Deliver a reviewed assessment safely (Priority: P1)

An authorized teacher prepares a transfer assessment for one learner-owned checklist, reviews the structured draft, and sends it. The learner receives only the public question and options; the answer key, transfer basis, raw model output, and supervision rationale remain private.

**Why this priority**: Delivery is the boundary that makes an assessment real. A draft must never become gradable or expose private material before explicit review and atomic send.

**Independent Test**: With a verified teacher principal and a transfer-policy checklist, prepare, review, and send one assessment; inspect the returned DTO, public rows, private rows, and the learner-visible response.

**Acceptance Scenarios**:

1. **Given** a verified teacher authorized for a room and an eligible learner-owned transfer checklist, **When** the teacher prepares a turn, **Then** the response contains a draft reference and reviewable decision data without returning an answer key to learner-facing data.
2. **Given** a draft whose revision and content confirmation are current, **When** the teacher sends it, **Then** one tutor message and one public question are committed with `mode=assessment` and `instruction=transfer_assess`, while room participation remains `tutoring`.
3. **Given** an unsent, rejected, stale, or superseded draft, **When** a learner submits labels resembling an answer, **Then** no grade, progress mutation, or feedback obligation is created.
4. **Given** a teacher changes the target, stem, options, selection type, or key after confirmation, **When** the draft is reviewed again, **Then** the revision and hashes change and confirmation is required again.

### User Story 2 - Resolve a learner answer exactly once (Priority: P1)

An authorized learner answers their own delivered assessment. The server parses the stored message, grades exact option-set equality against the immutable key, and applies the correct transfer progress transition without requiring an explanation or confidence statement.

**Why this priority**: The answer lifecycle is the product's authoritative evidence boundary. It must be deterministic, causal, and resistant to duplicate, stale, or cross-learner submissions.

**Independent Test**: Deliver a question, submit correct, incorrect, ambiguous, duplicate, and pre-delivery messages, then inspect the question lifecycle, progress pair, evidence, history, and public outcomes.

**Acceptance Scenarios**:

1. **Given** a delivered single-answer question with key `B`, **When** the learner submits `B` with optional explanation text, **Then** the question resolves once as pass and the item moves from `partially_covered/basic` to `covered/good`.
2. **Given** a delivered multiple-answer question with key `{B,D}`, **When** the learner submits `D, B` or `B,B,D`, **Then** the answer passes by deduplicated set equality; a missing or extra label fails.
3. **Given** a learner submits `B or D`, asks for content help, or submits before delivery, **When** the server processes the message, **Then** it returns clarification or assisted handling as appropriate without fabricating a grade.
4. **Given** the same answer is retried or two requests race, **When** both requests are processed, **Then** only the first valid answer changes the question, progress, evidence, attempts, and history.
5. **Given** a question has resolved, **When** a later turn is scheduled, **Then** a tutoring feedback turn or independently required Guard response precedes another assessment and a covered item is not routinely reassessed.

### User Story 3 - Enforce trusted identity and private/public boundaries (Priority: P1)

The backend derives an application principal from a trusted verifier, authorizes room and learner scope, and rejects forged identities, cross-room access, direct transfer writes, private-column reads, and legacy RPC bypasses.

**Why this priority**: Local display names, roles, UUIDs, room passwords, and browser storage are not trusted principals. Authorization and answer-key confidentiality are release gates.

**Independent Test**: Run the authorization integration matrix against supported hosted Supabase execution with missing, invalid, forged, cross-room, cross-learner, learner, teacher, and legacy-RPC callers.

**Acceptance Scenarios**:

1. **Given** no trusted verifier configuration or no valid bearer session, **When** a transfer operation is requested, **Then** the API fails closed with a stable authorization error and does not create or return transfer data.
2. **Given** a valid principal without room access or teacher review permission, **When** it requests another room, another learner's checklist, a draft, or a reviewed send, **Then** the operation is rejected without mutation.
3. **Given** a learner can view their public question, **When** it requests private draft, key, transfer-basis, raw-model, or rationale fields, **Then** those fields are unavailable through DTOs, RLS, realtime, exports, logs, and error envelopes.
4. **Given** an untrusted client calls a transfer table or an old public `SECURITY DEFINER` RPC directly, **When** it tries to write transfer progress or evidence, **Then** the operation is denied.
5. **Given** a legacy checklist or legacy reviewed-send caller, **When** it uses the existing path, **Then** historical rows and legacy behavior remain usable without being interpreted as transfer verification.

### User Story 4 - Apply evidence and lifecycle changes atomically (Priority: P2)

The trusted backend records causal evidence, valid progress-pair transitions, actual before/after history, idempotency records, Guard deferrals, invalidation compensation, and rollback outcomes in one authoritative lifecycle.

**Why this priority**: Separate writes can create false progress, missing evidence, or misleading history. The component must preserve a reconstructable causal record under retries, stale snapshots, races, and failures.

**Independent Test**: Execute hosted SQL/RPC scenarios for every progress transition, direct-write attack, retry, race, stale snapshot, Guard deferral, provider/persistence failure, and post-grade invalidation case.

**Acceptance Scenarios**:

1. **Given** a transfer event with valid scope, learner evidence, and a current snapshot, **When** the trusted operation applies it, **Then** evidence, the status/understanding pair, actual history, and event outcome commit together.
2. **Given** an invalid transition, missing evidence, stale snapshot, foreign message, or mismatched learner, **When** the event is applied, **Then** no partial progress or history write is committed and the error remains observable.
3. **Given** the room is in Guard, **When** valid learner evidence arrives, **Then** the observation is recorded as deferred and protected progress is unchanged until authorized recovery replays only still-valid causal events.
4. **Given** a delivered question's key or item is found defective, **When** a teacher invalidates it, **Then** the original key/result remain immutable, the invalidation is recorded, and the latest causal progress effect is compensated or replayed without rerunning old model calls.

### User Story 5 - Use the production v3 provider boundary (Priority: P2)

The trusted Edge Function sends the versioned v3 request to the configured OpenAI-compatible provider, enforces the production output budget and structural contract, and reports provider, truncation, retry, and invalid-output outcomes without leaking secrets or converting errors into learner results.

**Why this priority**: Provider behavior is part of the production contract. The existing legacy client cap and ambiguous retry behavior cannot silently govern the richer v3 JSON path.

**Independent Test**: Inspect captured provider requests and responses using a fake provider at the trusted boundary, covering valid output, one format-repair retry, HTTP/network failure, truncation, invalid JSON, absent configuration, and secret-scanning assertions.

**Acceptance Scenarios**:

1. **Given** a configured provider and eligible v3 turn, **When** the backend prepares a tutor decision, **Then** the request uses the configured model/base URL, sends no learner-selected labels or private answer key for grading, and sets `max_tokens` to exactly 1200 for the v3 tutor response.
2. **Given** a malformed or structurally invalid provider response, **When** the first attempt fails contract validation, **Then** at most one format-only repair attempt is made; both attempts and the final outcome remain recorded privately.
3. **Given** a provider HTTP error, network error, truncation, missing required field, or unavailable provider configuration, **When** generation runs, **Then** the API returns a stable retry/error result and never auto-passes, auto-fails, delivers a dummy question, or writes learner progress.
4. **Given** a provider request, response, browser asset, log, export, or error envelope, **When** it is scanned, **Then** service credentials, private keys, raw private model output, and transfer rationales are absent.

## Edge Cases

- A legacy checklist has no explicit learner owner; it remains legacy and cannot enter the transfer path.
- Multiple active learners are present in a room; automatic transfer assessment is unavailable rather than silently sharing a checklist or choosing an owner.
- A learner reconnects or two teacher tabs race; stored question, revision, request result, and public message IDs remain authoritative.
- A draft is delivered after its checklist, item, focus message, or progress snapshot changes; send is rejected as stale and creates no question.
- The first answer is ambiguous, content-assisted, or format-only; clarification stays open, assistance cancels without failure, and neutral format help does not leak the key.
- A question is answered after cancellation, invalidation, replacement, or another question's delivery; the old question is not redirected to the new one.
- A later learner message contradicts a covered item; only the later independent event may reopen it; the original assessment answer is not reinterpreted.
- A provider returns valid JSON with an incorrect semantic key; structural validity and teacher review do not claim independent semantic validity, and the release evidence must record the defect path.
- A migration is rerun or encounters an existing overload, policy, enum, publication, or constraint; reconciliation must preserve legacy rows and must not drop all policies or functions as a shortcut.
- `auth.uid()` is unavailable for the simplified legacy client; this does not authorize transfer operations and does not justify a new sign-in product.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST preserve the legacy checklist policy and values while marking every new transfer checklist with an explicit learner owner and `transfer_v1` policy version.
- **FR-002**: The system MUST preserve `status` and `understanding_level` as the only progress fields and enforce these transfer pairs: `pending/none`, `partially_covered/basic`, `needs_review/basic`, and `covered/good`.
- **FR-003**: The system MUST expose the versioned assessment API operations `capabilities`, `initialize_checklist`, `post_message`, `analyze_message`, `prepare_turn`, `review_draft`, `send_reviewed`, `process_message`, `cancel_question`, `invalidate_question`, and `confirm_external_transfer` through one `{ok,data}` or `{ok,error}` envelope.
- **FR-004**: The system MUST derive the caller's verified principal and room authorization on the server; body-supplied application IDs, roles, room IDs, or learner IDs MUST NOT establish identity or authorization.
- **FR-005**: The system MUST keep raw drafts, answer keys, transfer basis, private rationale, snapshot data, and provider credentials server-side and MUST return only explicit public or authorized-teacher DTO allowlists.
- **FR-006**: The system MUST require teacher review, current revision/hash, content confirmation, target eligibility, and one unresolved-question constraint before delivery.
- **FR-007**: The system MUST commit a delivered tutor message, public question, immutable private key, audit record, room participation mapping, and request idempotency result atomically.
- **FR-008**: The system MUST grade only a stored learner message linked to its delivered question and MUST use deterministic exact-set equality after normalization, deduplication, and order normalization.
- **FR-009**: The system MUST resolve the first valid answer once; retries, duplicate realtime delivery, later guesses, and transport retries MUST NOT create additional grade or progress effects.
- **FR-010**: The system MUST apply evidence through a versioned trusted operation that validates scope, causal message IDs, event kind, current snapshot, and transition guards before writing evidence, progress, actual before/after history, and idempotency state.
- **FR-011**: The system MUST record Guard-blocked evidence for later causal replay without mutating protected transfer progress, and MUST preserve stale, rejected, invalidated, and errored outcomes rather than treating them as success.
- **FR-012**: The system MUST make delivered keys immutable; defects MUST be handled through invalidation and compensating/replayed history, never in-place key replacement.
- **FR-013**: The system MUST preserve the room's two-value participation state and map a reviewed assessment turn to room participation `tutoring`; assessment MUST remain a tutor-turn mode, not a room mode.
- **FR-014**: The system MUST require tutoring feedback or independently required Guard/protective handling after a resolved assessment before scheduling another assessment, and MUST suppress routine reassessment of `covered/good` items.
- **FR-015**: The trusted provider boundary MUST send the v3 tutor request with an effective 1,200 completion-token budget, configured model/provider settings, explicit JSON contract instructions, and no learner-selected answer labels for exact grading.
- **FR-016**: The provider boundary MUST allow at most one format-repair retry, distinguish network/HTTP failures from invalid output, inspect truncation/finish status, and surface all final errors without changing learner progress.
- **FR-017**: The system MUST fail closed when verified authorization or provider configuration is absent, returning stable error codes and leaving `TRANSFER_ASSESSMENT_ENABLED` disabled.
- **FR-018**: The system MUST verify migrations and generated TypeScript database types against the actual supported hosted schema, including enums, function signatures, grants, policies, and realtime exposure.
- **FR-019**: The system MUST support direct SQL/RLS tests for forged principals, cross-room and cross-learner access, private-column access, direct transfer writes, old-RPC bypasses, and legacy preservation.
- **FR-020**: The system MUST keep all backend acceptance evidence separate from React room UI, Promptfoo cases/rubrics, and browser release evidence; those downstream gates cannot be claimed by this component.

### Key Entities

- **Transfer checklist**: A learner-owned checklist with `progress_policy_version='transfer_v1'`; legacy rows remain room-scoped and legacy.
- **Checklist item**: An objective whose transfer progress is represented only by the existing status/understanding pair.
- **Assessment question**: Public learner-safe question lifecycle record with ordered A-D options, scope IDs, delivery/answer state, selected labels, result, and public linkage fields.
- **Assessment draft**: Private raw and reviewed v3 decision with revision, hashes, focus message, and review status.
- **Assessment key**: Private immutable key and transfer basis linked to one delivered question and reviewed draft revision.
- **Learning event**: Causal, deduplicated observation or assessment outcome tied to stored learner evidence and processed through the transition authority.
- **Assessment request result**: Private idempotency record mapping a verified operation/request to its stable result.
- **Verified application principal**: Server-derived principal with application user identity, allowed rooms, and review capability; it is not a local display name, body-supplied UUID, or browser role value.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Hosted schema verification finds every required table, enum, constraint, policy, grant, function signature, and realtime exposure in the supported environment, and regenerated TypeScript types match the inspected schema with zero unexplained differences.
- **SC-002**: The authorization matrix rejects 100% of missing/forged/cross-room/cross-learner/private-column/direct-write/legacy-RPC bypass attempts and returns no transfer mutation or private field for any rejected case.
- **SC-003**: The lifecycle matrix passes 100% of required delivery, pre-delivery, pass, fail, clarification, assistance, stale, duplicate, race, Guard, invalidation, and rollback cases with one effective question resolution and causal history.
- **SC-004**: Every applied state-changing event has exactly one linked evidence record and history row containing the actual before/after pair; failed operations leave zero partial progress mutations in the transaction checks.
- **SC-005**: Captured v3 provider requests show `max_tokens=1200`, no learner-selected labels or answer key in exact-grading input, at most two total format-validation attempts, and explicit error handling for provider failure/truncation/invalid output.
- **SC-006**: Secret and privacy scans find zero provider credentials, private keys, transfer basis, raw private model output, or private rationale in public DTOs, learner queries, realtime payloads, browser assets, logs, exports, or error envelopes.
- **SC-007**: Legacy compatibility fixtures retain 100% of pre-existing checklist values and reviewed-send behavior, and no legacy value is labeled as transfer verification.
- **SC-008**: The backend capability remains disabled in every verification run unless all component gates pass; no component artifact claims release activation, Promptfoo acceptance, or browser acceptance.

## Assumptions

- The existing React/TypeScript application, Supabase schema, simplified local identity, and legacy RPCs remain in use for legacy behavior.
- A trusted verifier backed by the deployed Supabase Auth session is available for production transfer operations; if it is absent, the feature remains disabled and the missing deployment prerequisite is recorded.
- Hosted Supabase execution is the database acceptance boundary because Docker/local Postgres is unavailable; static SQL inspection is diagnostic only.
- Provider configuration is server-side and uses the existing OpenAI-compatible API shape documented in `tutor-system/.env.example`; no new provider or sign-in product is introduced.
- The first-release automatic assessment scope is one learner-owned checklist per room; multi-learner automatic sharing is out of scope.
- Existing generated or manually maintained database types are provisional until regenerated and compared with the supported hosted schema.

## Scope Boundaries

- In scope: W3 storage/RLS/RPCs, W4 trusted principal and room authorization, W5 evidence application and atomic lifecycle, W6 production v3 provider boundary, public contracts, legacy compatibility, and backend verification evidence.
- Out of scope: React room UI implementation, Promptfoo cases/rubrics and semantic evaluation, dedicated browser release evidence, a new sign-in product, a new mastery field, room-level Assessment Mode, and feature activation.

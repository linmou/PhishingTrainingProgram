# Feature Specification: Server-Authoritative Transfer Assessment Backend

<!-- Intent: define the authoritative storage, grading, privacy, and provider behavior required by the transfer-assessment UI upgrade. -->

**Feature Branch**: `102-transfer-backend`
**Created**: 2026-09-22
**Status**: Planned
**Input**: User description: "Restore the server-authoritative transfer-assessment boundary for a persistent two-attempt lifecycle and an editable learner-safe explanation."

## Scope

This component restores the trusted backend boundary removed by the browser-only research refactor. It owns persisted assessment delivery, private keys and explanations, server grading, two-attempt lifecycle authority, atomic progress changes, role-safe response projections, trusted provider calls, and production prompt behavior. It consumes component 101's assessment and progress contracts. It does not own React rendering, page-local view state, Promptfoo evaluation policy, or release-browser evidence.

## Clarifications

### Session 2026-09-22

- Q: Must the learner's two-attempt lifecycle survive reloads and duplicate tabs? -> A: Yes. Attempt authority is backend-owned and persisted across reloads, remounts, reconnects, and tabs.
- Q: When may the learner receive the key and learner-safe explanation? -> A: Only the terminal response after a second incorrect attempt; a first incorrect or correct response does not disclose either field.
- Q: Which model configuration governs production generation? -> A: Require server-side `OAI_MODEL=qwen3.5-flash` through the existing DashScope-compatible provider with no runtime fallback; missing configuration fails closed.

## User Scenarios & Testing

### User Story 1 - Deliver a reviewed assessment without exposing private material (Priority: P1)

An authorized teacher prepares a transfer assessment, reviews and may edit its stem, options, key, and learner-safe explanation, then sends the confirmed assessment to one learner. The learner receives the stem and options while the key, explanation, transfer basis, rationale, and raw provider output remain private.

**Why this priority**: Delivery creates the durable question and its grading authority. A public key or incomplete private record makes trustworthy grading impossible.

**Independent Test**: Prepare, edit, confirm, and send one assessment; verify one learner-visible question, one private grading record, no unsent persistence, no private fields in learner projections, and stem-only message content.

**Acceptance Scenarios**:

1. **Given** an authorized teacher and an eligible learner-owned checklist, **When** the teacher prepares a turn, **Then** the teacher receives one structurally valid candidate including a learner-safe explanation and nothing is persisted as a delivered assessment.
2. **Given** the teacher edits any assessment field, **When** the teacher submits the reviewed candidate, **Then** the backend revalidates the complete candidate and persists the reviewed values rather than the original provider values.
3. **Given** a valid reviewed candidate, **When** it is sent, **Then** one public tutor message and one linked private assessment record commit atomically while room participation remains tutoring.
4. **Given** a delivered question, **When** a learner reads room messages or reconnect payloads, **Then** message content contains only the stem, options appear exactly once through structured public fields, and no key, explanation, transfer basis, rationale, or raw provider output is present.
5. **Given** an unsent, invalid, stale-scope, or duplicate reviewed candidate, **When** delivery is attempted, **Then** no partial public or private record is created.

---

### User Story 2 - Grade two persisted attempts deterministically (Priority: P1)

A learner submits displayed option IDs for their own delivered assessment. The backend grades exact option-set equality and owns the two-attempt lifecycle across reloads, reconnects, retries, concurrent tabs, and duplicate processing.

**Why this priority**: A browser-owned counter can be reset or raced and cannot safely decide when a private answer becomes visible or progress changes.

**Independent Test**: Submit correct, incorrect, duplicate, concurrent, cross-learner, malformed, stale, and third-attempt cases against one delivered assessment and inspect attempts, lifecycle, response projection, evidence, progress, and history.

**Acceptance Scenarios**:

1. **Given** an open assessment with no attempt, **When** the learner submits an incorrect exact selection, **Then** attempt 1 is persisted, the assessment remains open, no progress transition occurs, one attempt remains, and no key or explanation is returned.
2. **Given** an open assessment, **When** the learner submits the correct exact selection on attempt 1 or 2, **Then** the assessment terminates as passed, progress changes once to the passing state, no further attempt is accepted, and no key or explanation is returned.
3. **Given** one persisted incorrect attempt, **When** the learner submits a second incorrect exact selection after a reload or from another tab, **Then** attempt 2 is persisted, the assessment terminates as failed, progress changes once to the failure state, and only that terminal learner response contains the correct option IDs and learner-safe explanation.
4. **Given** an answer message or request is retried, **When** it is processed again, **Then** the original persisted outcome is returned without another attempt, evidence row, history row, or progress transition.
5. **Given** distinct submissions race, **When** the backend processes them, **Then** assessment-level serialization assigns at most attempts 1 and 2; any later submission returns the terminal state without mutation.
6. **Given** a malformed selection, unknown option, wrong learner, wrong room, mismatched parent, undelivered question, or stale assessment identity, **When** processing is requested, **Then** the submission is rejected without consuming an attempt or changing progress.

---

### User Story 3 - Enforce trusted identity and role-safe projections (Priority: P1)

The backend derives a principal from a trusted verifier, authorizes room and learner scope, restricts mutations to trusted operations, and returns explicit allowlisted data for learners and teachers.

**Why this priority**: Browser IDs, roles, display names, local storage, and direct table access cannot protect answer keys or learner progress.

**Independent Test**: Execute the authorization and privacy matrix for absent configuration, invalid proof, forged body identity, cross-room access, cross-learner access, learner/teacher role boundaries, direct writes, old-operation bypasses, and response-field scans.

**Acceptance Scenarios**:

1. **Given** no deployment verifier adapter, **When** a transfer operation is called, **Then** capability is unavailable and the operation fails with `AUTHORIZATION_NOT_CONFIGURED` before data access or mutation.
2. **Given** a verified principal without permission for the named room, learner, or teacher action, **When** an operation is requested, **Then** it fails without mutation even if body identity values claim permission.
3. **Given** a learner can view and answer their question, **When** they query public data, realtime payloads, errors, or exports, **Then** private assessment material is unavailable until the allowed terminal failure response.
4. **Given** a direct client or legacy operation, **When** it attempts to create an attempt, read private grading material, or mutate transfer progress, **Then** the operation is denied.

---

### User Story 4 - Commit lifecycle evidence and progress atomically (Priority: P2)

Every terminal result records causal evidence, the valid progress transition, actual before/after history, and idempotency state as one transaction. Nonterminal incorrect attempts remain evidence of an attempt but do not resolve progress.

**Why this priority**: Split writes can expose feedback without recording the attempt, or change progress without a reconstructable result.

**Independent Test**: Exercise successful, no-change, duplicate, stale, invalid, guarded, and forced-failure transactions and verify all-or-nothing state across assessment, attempts, evidence, progress, history, and idempotency records.

**Acceptance Scenarios**:

1. **Given** a correct terminal result, **When** persistence succeeds, **Then** the terminal assessment state, attempt, causal evidence, progress pair, and actual before/after history commit together.
2. **Given** a second incorrect terminal result, **When** persistence succeeds, **Then** the same atomic obligations apply before terminal feedback is returned.
3. **Given** a first incorrect result, **When** persistence succeeds, **Then** only the attempt and current attempt count change; progress, terminal evidence, and terminal history do not.
4. **Given** any persistence failure or invalid transition, **When** processing rolls back, **Then** no partial attempt, terminal state, feedback disclosure, evidence, progress, or history is visible.
5. **Given** Guard blocks progression, **When** a terminal result is processed, **Then** the committed assessment result and deferred learning event remain explicit, protected progress is not silently changed, and an authorized second-failure response may disclose terminal feedback only after both the attempt and deferred event commit; recovery follows the existing causal replay contract.

---

### User Story 5 - Generate the production assessment contract safely (Priority: P2)

The trusted provider boundary generates the versioned tutor decision, including a learner-safe explanation, using configured server-side provider settings and validates the complete response before teacher review.

**Why this priority**: The teacher cannot review or safely disclose an explanation that is absent, invalid, or generated through a browser-exposed provider path.

**Independent Test**: Capture configured provider requests and responses for valid output, invalid explanation, one format repair, truncation, HTTP/network failure, and missing configuration; verify no dummy assessment or progress mutation is produced.

**Acceptance Scenarios**:

1. **Given** complete provider configuration, **When** a turn is prepared, **Then** the request uses the configured base URL and model, the backend-owned production prompt, the shared versioned context, and the required output budget.
2. **Given** an assessment response, **When** it is validated, **Then** it includes a non-empty learner-safe explanation that explains the correct option without exposing hidden reasoning, unrelated private data, or unsupported claims.
3. **Given** malformed or structurally invalid provider output, **When** validation fails, **Then** at most one format-only repair attempt occurs and invalid output never becomes a delivered question.
4. **Given** missing configuration, truncation, HTTP failure, network failure, or a second invalid response, **When** preparation ends, **Then** a stable error is returned without a dummy question, grading result, or progress write.

### Edge Cases

- A retry reuses a request ID, an answer message ID, or both; all paths converge on one persisted result.
- Two tabs submit distinct wrong answers nearly simultaneously; they become attempts 1 and 2 under one assessment lock, not two first attempts.
- A correct and incorrect answer race; lock order determines the persisted sequence, and a terminal pass prevents the later request from changing it.
- A third submission arrives after terminal pass or failure; it returns terminal state and consumes no attempt.
- A teacher changes the key or explanation after viewing a generated candidate; reviewed values are revalidated and become immutable when delivered.
- A teacher retries delivery after a timeout; one public message and one private assessment exist.
- A learner submits option IDs that are duplicated or out of order; normalization uses set equality, while missing, extra, or unknown IDs are rejected or graded incorrect according to the shared component-101 contract.
- A public message stores a stem that happens to contain option-like text; structured options remain the only answer choices and are rendered once by the consumer.
- Existing browser-only assessment columns or rows are encountered during migration; migration behavior remains explicit and never fabricates missing private keys or explanations.
- Legacy checklists and messages retain their legacy meaning and cannot be silently promoted into transfer assessments.

## Requirements

### Functional Requirements

- **FR-001**: The system MUST preserve the existing six public operation names: `initialize_checklist`, `post_message`, `analyze_message`, `prepare_turn`, `send_reviewed`, and `process_message`, each using one versioned success/error envelope.
- **FR-002**: Every transfer operation MUST derive identity and authorization from a trusted server verifier; browser-supplied IDs, roles, display names, local state, room passwords, and direct table access MUST NOT establish authority.
- **FR-003**: The system MUST fail closed with stable, role-safe errors when authorization, provider, feature, or required scope configuration is absent or invalid.
- **FR-004**: `prepare_turn` MUST return a structurally validated candidate only to an authorized teacher and MUST persist no delivered assessment or grading authority.
- **FR-005**: A reviewed assessment MUST contain the component-101 private assessment contract, including a valid learner-safe explanation, and MUST be revalidated after teacher edits.
- **FR-006**: `send_reviewed` MUST atomically persist one learner-visible tutor message and one linked private assessment record; the public message content MUST be the stem rather than rendered text containing options.
- **FR-007**: Public assessment projections MUST include only stable identity, selection type, stem, and ordered options; public message rows and projections MUST exclude correct option IDs, learner-safe explanation, transfer basis, rationale, raw provider output, and private generation metadata.
- **FR-008**: Delivered correct option IDs, learner-safe explanation, transfer basis, and reviewed private payload MUST remain server-private and immutable.
- **FR-009**: The backend MUST persist at most two scored attempts per delivered assessment and MUST treat persisted state as authoritative across reloads, remounts, reconnects, retries, and tabs.
- **FR-010**: Grading MUST use deterministic normalized exact-set equality against the private key and MUST never delegate correctness or attempt counting to the browser or provider.
- **FR-011**: The first incorrect attempt MUST keep the assessment open, report one remaining attempt, disclose no private feedback, and cause no transfer-progress transition.
- **FR-012**: A correct attempt in either position MUST terminate as passed, apply the passing progress transition exactly once, allow no later mutation, and disclose no key or learner-safe explanation.
- **FR-013**: A second incorrect attempt MUST terminate as failed, apply the failure progress transition exactly once, allow no later mutation, and return the key and learner-safe explanation only in that authorized learner response.
- **FR-014**: `process_message` MUST return a versioned `ProcessedMessageDTO` that distinguishes retry, terminal pass, terminal fail, duplicate, rejected, and deferred outcomes and reports authoritative attempts used and remaining.
- **FR-015**: Reprocessing the same request or answer message MUST return its persisted result without creating another attempt, evidence row, history row, or progress transition.
- **FR-016**: Concurrent distinct submissions MUST serialize on the assessment lifecycle and MUST not exceed two attempts or one terminal transition.
- **FR-017**: A malformed selection, wrong learner, wrong room, stale or undelivered assessment, invalid parent link, or unauthorized caller MUST consume no attempt and disclose no private feedback.
- **FR-018**: Terminal grading MUST atomically write assessment state, the accepted attempt, causal evidence, the valid progress pair, actual before/after history, and idempotency outcome; failure MUST roll back all effects and feedback disclosure.
- **FR-019**: The production provider boundary MUST generate and validate `learner_safe_explanation`, retain provider credentials and raw attempts server-side, allow at most one format-only repair, detect truncation, and never silently synthesize a question or result.
- **FR-020**: Production and component 104 MUST consume the same versioned transfer request/context builders while the production prompt, credentials, provider call, private response, and grading remain backend-owned.
- **FR-021**: Transfer-specific data mutations MUST use versioned trusted operations with direct untrusted execution revoked; generated database types and runtime contracts MUST match the supported hosted schema.
- **FR-022**: Transfer assessment capability MUST remain disabled until hosted authorization, storage, concurrency, provider, integration, UI, evaluation, browser, and rollback gates pass.
- **FR-023**: Component evidence MUST keep backend tests distinct from component 103 UI, component 104 evaluation, and release-browser evidence and MUST record blocked or errored lanes as not passed.

### Key Entities

- **Private assessment**: The immutable delivered grading authority linked one-to-one to a public tutor message, containing scope, key, learner-safe explanation, transfer basis, lifecycle, and authoritative attempt count.
- **Assessment attempt**: One append-only scored submission linked to an assessment and learner answer message, with ordinal, normalized selection, result, request identity, and timestamp.
- **Public assessment projection**: Learner-visible identity, selection type, stem, and ordered options with no private grading material.
- **Processed message result**: Role-safe server outcome containing lifecycle, attempts used/remaining, transition status, and terminal failure feedback only when allowed.
- **Verified principal**: Server-derived identity plus room and teacher-review capabilities.
- **Learning event**: The causal terminal event that atomically applies the component-101 progress transition and history.
- **Provider attempt**: Private request/response/error evidence for initial generation and at most one format repair.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of reload, reconnect, retry, remount, and duplicate-tab tests observe the same persisted attempt count and terminal lifecycle.
- **SC-002**: Across all race tests, each assessment stores at most two attempts, one terminal result, one terminal evidence effect, and one progress transition.
- **SC-003**: 100% of first-incorrect outcomes report one remaining attempt and contain zero correct option IDs, learner-safe explanation text, or progress changes.
- **SC-004**: 100% of correct outcomes terminate without private feedback; 100% of second-incorrect outcomes return the persisted key and teacher-reviewed learner-safe explanation to only the authorized learner response.
- **SC-005**: Public rows, realtime payloads, learner fetches, ordinary exports, browser bundles, logs, and safe errors contain zero private keys, explanations, transfer bases, rationales, raw model output, or credentials.
- **SC-006**: 100% of delivered assessment messages store the stem as message content and expose one structured option set, so downstream rendering has no duplicated options.
- **SC-007**: 100% of forced failures leave no partial attempt, terminal state, evidence, progress, history, or private feedback disclosure.
- **SC-008**: The complete unauthorized and cross-scope matrix causes zero transfer mutations and zero private-field disclosures.
- **SC-009**: Provider contract tests observe the configured endpoint/model and output budget, no more than two provider attempts, and zero dummy assessments or progress writes on error.
- **SC-010**: Hosted schema checks, focused backend tests, production build, handoff tests, integration tests, and release gates each retain separate pass/fail/blocked evidence.

## Assumptions

- Component 101 supplies the canonical two-attempt lifecycle, progress transition, private assessment, and learner-safe explanation validation contracts before component 102 implementation starts.
- Existing six browser-facing operation names remain stable; their trusted implementation and versioned storage procedures may change.
- The existing application does not adopt a new sign-in product or an `auth.uid()` identity contract for this feature. Deployment must supply the approved trusted verifier adapter; absence disables transfer operations.
- Production generation uses the existing DashScope-compatible provider and requires server-side `OAI_API_KEY`, `OAI_BASE_URL`, and `OAI_MODEL=qwen3.5-flash`; browser-prefixed provider variables do not satisfy this boundary.
- A teacher may edit generated assessment content before delivery. Once delivered, the key, explanation, transfer basis, and assessment scope are immutable.
- The correct key and learner-safe explanation are intentionally withheld after a pass; the learner receives them only after terminal second failure.
- A hosted Supabase test scope is required for storage, authorization, row-lock, and transaction evidence; local static SQL checks cannot close those gates.
- Existing browser-only assessment data cannot be trusted as private grading authority. Migration must report legacy/incomplete rows and must not infer absent keys or explanations.

## Out of Scope

- React controls, folding, view-state reducers, teacher editor rendering, reconnect presentation, or browser screenshots.
- Promptfoo cases, rubric thresholds, semantic explanation scoring, or evaluation release policy.
- A new authentication or sign-in product, a room-level assessment mode, client-side grading, client-side attempt authority, or a second mastery field.
- Automatic disclosure of the key or explanation after a correct response.

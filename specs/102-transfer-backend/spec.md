# Feature Specification: Trusted Transfer Assessment

<!-- Intent: record the observed production assessment database behavior. -->

**Feature Branch**: `102-transfer-backend`
**Created**: 2026-09-22
**Status**: Production snapshot, read-only catalog inspection on 2026-09-28
**Input**: Observed assessment-related Supabase database functions and schema.

## Scope

This document describes the current production database implementation observed through Supabase MCP on 2026-09-28. Function definitions and schema were inspected without invoking assessment writes. Repository component tests and design documents are not evidence that the production flow completed successfully.

The production database contains an assessment delivery function, an answer-message function, and an answer-processing function. The observed flow uses public room messages for both questions and answers. The private assessment table exists, but these three functions do not use it.

## Current Production Behavior

1. send_reviewed_tutor_response_v3 handles a reviewed tutor response in assessment mode. Its function body inserts a tutor question into public.messages with structured options, lifecycle and scope fields, and an assessment_key.
2. post_assessment_message_v1 stores a learner answer as a public.messages row associated with the question.
3. process_assessment_message_v1 reads the answer and question messages, resolves the selected option, updates the question result and lifecycle, and calls the learning-event path.

The processor marks a scorable answer as answered on its first processing. Repeating the same answer message returns its stored result; request IDs do not deduplicate delivery or answer writes.

The live public.messages schema does not contain assessment_key, even though the delivery and processing function bodies reference it. Therefore the production function definitions and schema do not form a verified working assessment flow. The current production behavior and exact database fields are described in the [data model](data-model.md) and [RPC contract](contracts/rpc-contract.md).

## Historical Component 102 Target Design (Not Current Production Behavior)

The clarification record, scenarios, requirements, and success criteria below preserve the component-102 design that was tested against local restored database copies. They describe that target design, not the production database snapshot above.

## Historical Clarifications

### Session 2026-09-22

- Q: Must the learner's two-attempt lifecycle survive reloads and duplicate tabs? -> A: Yes. Attempt authority is backend-owned and persisted across reloads, remounts, reconnects, and tabs.
- Q: When may the learner receive the key and learner-safe explanation? -> A: Only the terminal response after a second incorrect attempt; a first incorrect or correct response does not disclose either field.
- Q: Which production generation configuration governs question preparation? -> A: The Edge Function uses `REACT_APP_OAI_API_KEY`, `REACT_APP_OAI_BASE_URL`, and the exact `OAI_MODEL`; missing or mismatched configuration fails closed without a runtime fallback. The exact configuration is recorded in the [provider contract](contracts/provider-contract.md).

## Historical User Scenarios & Testing (Not Production)

### User Story 1 - Deliver a reviewed assessment without exposing private material (Priority: P1)

An authorized teacher prepares a transfer assessment, reviews and may edit its stem, options, key, and learner-safe explanation, then sends the confirmed assessment to one learner. The learner receives the stem and options while the key, explanation, transfer basis, rationale, and raw provider output remain private.

**Why this priority**: Delivery creates the durable question and its grading authority. A public key or incomplete private record makes trustworthy grading impossible.

**Independent Test**: Prepare, edit, confirm, and send a question. Observe that an unconfirmed question is not delivered, a confirmed question appears once for its intended learner, and the learner cannot see private grading information.

**Acceptance Scenarios**:

1. **Given** an authorized teacher and an eligible learner-owned checklist, **When** the teacher prepares a question, **Then** the teacher receives one valid candidate including a learner-safe explanation and it is not treated as a delivered assessment.
2. **Given** the teacher edits any assessment field, **When** the teacher submits the reviewed candidate, **Then** the service revalidates the complete candidate and uses the reviewed values rather than the original generated values.
3. **Given** a valid reviewed candidate, **When** it is sent, **Then** one public question is delivered with its linked private grading authority and room participation remains tutoring.
4. **Given** a delivered question, **When** a room participant reads room messages or reconnects, **Then** the public question identifies its intended learner, message content contains only the stem, options appear exactly once as structured question content, and no key, explanation, transfer basis, rationale, or raw provider output is present.
5. **Given** an unsent, invalid, stale-scope, or duplicate reviewed candidate, **When** delivery is attempted, **Then** no partial public or private record is created.

---

### User Story 2 - Grade two persisted attempts deterministically (Priority: P1)

A learner submits displayed choices for their own delivered question. The trusted service grades exact option-set equality and owns the two-attempt lifecycle across reloads, reconnects, retries, concurrent tabs, and duplicate processing.

**Why this priority**: A local counter can be reset or raced and cannot safely decide when a private answer becomes visible or progress changes.

**Independent Test**: Submit correct, incorrect, duplicate, simultaneous, wrong-learner, malformed, stale, and post-terminal answers. Observe the accepted attempts, returned outcomes, progress changes, and whether any private feedback is disclosed.

**Acceptance Scenarios**:

1. **Given** an open assessment with no attempt, **When** the learner submits an incorrect exact selection, **Then** attempt 1 is persisted, the assessment remains open, no progress transition occurs, one attempt remains, and no key or explanation is returned.
2. **Given** an open assessment, **When** the learner submits the correct exact selection on attempt 1 or 2, **Then** the assessment terminates as passed, progress changes once to the passing state, no further attempt is accepted, and no key or explanation is returned.
3. **Given** one persisted incorrect attempt, **When** the learner submits a second incorrect exact selection after a reload or from another tab, **Then** attempt 2 is persisted, the assessment terminates as failed, progress changes once to the failure state, and only that terminal learner response contains the correct option IDs and learner-safe explanation.
4. **Given** an answer message or request is retried, **When** it is processed again, **Then** the original outcome is returned without another attempt, evidence entry, history entry, or progress transition.
5. **Given** distinct submissions arrive together, **When** they are resolved, **Then** one authoritative sequence accepts at most attempts 1 and 2; any later submission returns the terminal state without change.
6. **Given** a malformed selection, unknown option, wrong learner, wrong room, mismatched parent, undelivered question, or stale assessment identity, **When** processing is requested, **Then** the submission is rejected without consuming an attempt or changing progress.

---

### User Story 3 - Resolve app identity and enforce role-safe projections (Priority: P1)

The service reads the current app user ID from `x-application-user-id`, resolves the user's role and room memberships from the database, restricts actions to those scopes, and returns role-appropriate information. This app identity is self-asserted and does not authenticate who controls the browser.

**Why this priority**: The existing app has no Supabase Auth; database-derived role and room checks keep caller-supplied role and scope claims from authorizing actions. The localStorage identity does not prevent a caller from impersonating another app user.

**Independent Test**: Try operations with missing or malformed app user IDs, IDs without database profiles, access outside the user's database-derived room membership, unauthorized teacher actions, and untrusted data changes. Confirm private information and protected progress remain unavailable outside authorized scopes.

**Acceptance Scenarios**:

1. **Given** no trusted identity verifier is available, **When** a transfer action is requested, **Then** the capability is unavailable and a stable authorization error is returned before private data is accessed or changed.
2. **Given** a verified person without permission for the requested room, learner, or teacher action, **When** an action is requested, **Then** it fails without change even if the request claims permission.
3. **Given** a learner can view and answer their question, **When** they query public data, realtime payloads, errors, or exports, **Then** private assessment material is unavailable until the allowed terminal failure response.
4. **Given** an untrusted direct or legacy action, **When** it attempts to create an attempt, read private grading material, or change transfer progress, **Then** the action is denied.

---

### User Story 4 - Commit lifecycle evidence and progress atomically (Priority: P2)

Every terminal result preserves causal evidence, the valid progress transition, actual before/after history, and duplicate-request behavior as one complete outcome. Nonterminal incorrect attempts remain evidence of an attempt but do not resolve progress.

**Why this priority**: Split writes can expose feedback without recording the attempt, or change progress without a reconstructable result.

**Independent Test**: Exercise successful, no-change, duplicate, stale, invalid, Guard-deferred, and failed updates. Confirm that all required outcome records agree, or that none of the outcome or feedback becomes visible when processing fails.

**Acceptance Scenarios**:

1. **Given** a correct terminal result, **When** it is finalized, **Then** the assessment state, accepted attempt, causal evidence, progress pair, and actual before/after history become visible together.
2. **Given** a second incorrect terminal result, **When** it is finalized, **Then** the same complete outcome is visible before terminal feedback is returned.
3. **Given** a first incorrect result, **When** it is finalized, **Then** only the attempt and current attempt count change; progress, terminal evidence, and terminal history do not.
4. **Given** any persistence failure or invalid transition, **When** processing rolls back, **Then** no partial attempt, terminal state, feedback disclosure, evidence, progress, or history is visible.
5. **Given** Guard blocks progression, **When** a terminal result is processed, **Then** the committed assessment result and deferred learning event remain explicit, protected progress is not silently changed, and an authorized second-failure response may disclose terminal feedback only after both the attempt and deferred event commit; recovery follows the existing causal replay contract.

---

### User Story 5 - Prepare a valid assessment safely (Priority: P2)

The trusted question-generation process produces a complete assessment, including a learner-safe explanation, using the approved server-side configuration and validates it before teacher review.

**Why this priority**: The teacher cannot review or safely disclose an explanation that is absent, invalid, or generated through a browser-exposed provider path.

**Independent Test**: Observe preparation with valid output, an invalid explanation, one format correction, truncated output, HTTP and network failures, and missing configuration. Confirm that only a complete valid question reaches teacher review and that errors create no substitute question or progress change.

**Acceptance Scenarios**:

1. **Given** complete approved generation configuration, **When** a question is prepared, **Then** it uses the production provider settings, prompt, shared context, and output budget defined by the [provider contract](contracts/provider-contract.md).
2. **Given** an assessment response, **When** it is validated, **Then** it includes a non-empty learner-safe explanation that explains the correct option without exposing hidden reasoning, unrelated private data, or unsupported claims.
3. **Given** malformed or structurally invalid provider output, **When** validation fails, **Then** at most one format-only repair attempt occurs and invalid output never becomes a delivered question.
4. **Given** missing configuration, truncation, HTTP failure, network failure, or a second invalid response, **When** preparation ends, **Then** a stable error is returned without a dummy question, grading result, or progress write.

### Edge Cases

- A retry repeats a request or answer identity; all paths return the same persisted result without another effect.
- Two tabs submit distinct wrong answers nearly simultaneously; they become attempts one and two for the same assessment, not two first attempts.
- Correct and incorrect answers arrive simultaneously; the authoritative order determines the result, and a terminal pass prevents a later request from changing it.
- A third submission arrives after terminal pass or failure; it returns terminal state and consumes no attempt.
- A teacher changes the key or explanation after viewing a generated candidate; reviewed values are revalidated and become immutable when delivered.
- A teacher retries delivery after a timeout; one public message and one private assessment exist.
- A learner submits duplicate or reordered choices; grading uses exact set equality, while missing, extra, or unknown choices are rejected or graded incorrect according to the [shared transfer contract](../101-transfer-domain/contracts/transfer-domain-determinism.md).
- A public message stores a stem that happens to contain option-like text; structured options remain the only answer choices and are rendered once by the consumer.
- Existing assessment data lacks a recoverable private key or explanation; it remains explicitly incomplete and no missing value is inferred.
- Legacy checklists and messages retain their legacy meaning and cannot be silently promoted into transfer assessments.

## Historical Requirements (Not Production)

### Functional Requirements

- **FR-001**: The system MUST preserve the existing caller-facing operations and return a consistent, versioned success or error result. The exact operation names and response envelope are defined in the [API contract](contracts/assessment-api.md).
- **FR-002**: Every transfer action MUST resolve the app user ID from `x-application-user-id` and derive role and room authorization from database records; browser-supplied roles, display names, room passwords, and direct untrusted data changes MUST NOT establish authority. The app user ID is not cryptographic proof of caller identity.
- **FR-003**: The system MUST fail closed with stable, role-safe errors when authorization, provider, or required scope configuration is absent or invalid, or when `TRANSFER_ASSESSMENT_ENABLED` is not `true` after applying its documented `true` default.
- **FR-004**: Question preparation MUST return a structurally validated candidate only to an authorized teacher and MUST NOT treat it as a delivered question or grading authority. The exact operation is defined in the [API contract](contracts/assessment-api.md).
- **FR-005**: A reviewed question MUST satisfy the shared private-assessment requirements, including a valid learner-safe explanation, and MUST be revalidated after teacher edits. Those requirements are defined in the [shared transfer contract](../101-transfer-domain/contracts/transfer-domain-determinism.md).
- **FR-006**: Sending a confirmed question MUST create exactly one learner-visible message and one linked private grading record as one complete delivery. The visible message content MUST be the question stem; options are provided once as structured question content.
- **FR-007**: Every delivered public question MUST identify and route to its intended learner and contain the question type, stem, and options. Routing information MUST NOT establish answer authorization. Public messages and projections MUST exclude rendered duplicate options, correct option IDs, learner-safe explanation, transfer basis, rationale, raw provider output, and private generation metadata. The exact field shape is defined in the [API contract](contracts/assessment-api.md).
- **FR-008**: Delivered correct option IDs, learner-safe explanation, transfer basis, and reviewed private payload MUST remain server-private and immutable.
- **FR-009**: The backend MUST persist at most two scored attempts per delivered assessment and MUST treat persisted state as authoritative across reloads, remounts, reconnects, retries, and tabs.
- **FR-010**: Grading MUST use deterministic normalized exact-set equality against the private key and MUST never delegate correctness or attempt counting to the browser or provider.
- **FR-011**: The first incorrect attempt MUST keep the assessment open, report one remaining attempt, disclose no private feedback, and cause no transfer-progress transition.
- **FR-012**: A correct attempt in either position MUST terminate as passed, apply the passing progress transition exactly once, allow no later mutation, and disclose no key or learner-safe explanation.
- **FR-013**: A second incorrect attempt MUST terminate as failed, apply the failure progress transition exactly once, allow no later mutation, and return the key and learner-safe explanation only in that authorized learner response.
- **FR-014**: Each processed answer MUST return a versioned, role-safe outcome that distinguishes retry, pass, failure, duplicate, rejection, and deferral, and reports authoritative attempts used and remaining. Its exact shape is defined in the [API contract](contracts/assessment-api.md).
- **FR-015**: Reprocessing the same request or answer message MUST return its persisted result without creating another attempt, evidence, history, or progress transition.
- **FR-016**: Concurrent distinct submissions MUST resolve against one authoritative assessment sequence and MUST not exceed two attempts or one terminal result or progress transition.
- **FR-017**: A malformed selection, wrong learner, wrong room, stale or undelivered assessment, invalid parent link, or unauthorized caller MUST consume no attempt and disclose no private feedback.
- **FR-018**: A terminal outcome MUST include the assessment state, accepted answer, causal evidence, progress result, before/after history, and duplicate-processing result together. If any required update fails, none of those effects or feedback disclosure may become visible.
- **FR-019**: Production question generation MUST include and validate a learner-safe explanation, keep credentials and raw generation attempts private, allow at most one format-only correction, detect truncation, and never silently create a substitute question or result. Exact provider settings are defined in the [provider contract](contracts/provider-contract.md).
- **FR-020**: Evaluation MUST use the same approved production question-generation behavior. It MUST NOT create a competing source for request construction, prompt content, provider credentials, private responses, or grading. Exact shared request details are defined by the [provider contract](contracts/provider-contract.md).
- **FR-021**: Only trusted actions may change transfer data; direct untrusted access MUST be denied. Verification MUST distinguish local database evidence from hosted schema and interface parity. The concrete database and access-control checks are defined by the [implementation plan](plan.md) and linked contracts.
- **FR-022**: Local verification MAY complete while transfer capability remains disabled. Activation MUST wait for the approved deployed authorization, storage, concurrency, provider, integration, room, evaluation, browser, generated-interface, and rollback gates.
- **FR-023**: Evidence MUST keep service behavior separate from room, evaluation, and release-browser evidence, and MUST report blocked or errored verification as not passed.

## Historical Key Entities (Not Production)

- **Private assessment**: The immutable delivered authority for grading a question, linked to its learner-visible message and associated with its target, key, explanation, transfer basis, lifecycle, and attempt count.
- **Assessment attempt**: One accepted answer linked to a question and learner message, with its order, selected options, result, request identity, and time.
- **Public question**: The learner-visible question and routing information, without private grading material or duplicate rendered options. Its exact field shape is defined in the [API contract](contracts/assessment-api.md).
- **Processed answer result**: A role-safe outcome that reports lifecycle, attempts used and remaining, progress status, and terminal failure feedback only when authorized.
- **App identity**: The user ID stored by the app and sent in `x-application-user-id`; the verifier resolves role and room capabilities from the database, but the ID is not proof of who controls the browser.
- **Learning event**: The causal result that applies an approved progress outcome and preserves its history.
- **Generation record**: Private evidence about the initial question generation and, when needed, its single format correction.

## Historical Success Criteria (Not Production)

### Measurable Outcomes

- **SC-001**: Every reload, reconnect, retry, remount, and duplicate tab observes the same authoritative attempt count and terminal lifecycle.
- **SC-002**: When submissions arrive together, each assessment accepts at most two attempts and produces at most one terminal result, one terminal evidence effect, and one progress transition.
- **SC-003**: 100% of first-incorrect outcomes report one remaining attempt and contain zero correct option IDs, learner-safe explanation text, or progress changes.
- **SC-004**: 100% of correct outcomes terminate without private feedback; 100% of second-incorrect outcomes return the persisted key and teacher-reviewed learner-safe explanation to only the authorized learner response.
- **SC-005**: No learner-accessible or externally observable output, including public data, live updates, exports, browser delivery, logs, and errors, exposes private keys, explanations, transfer bases, rationales, raw model output, or credentials.
- **SC-006**: 100% of delivered questions route to the intended learner, use the stem as message content, and provide one structured option set so question rendering does not duplicate options.
- **SC-007**: 100% of forced failures leave no partial attempt, terminal state, evidence, progress, history, or private feedback disclosure.
- **SC-008**: The complete unauthorized and cross-scope matrix causes zero transfer mutations and zero private-field disclosures.
- **SC-009**: Question preparation uses the approved provider configuration and output budget, makes no more than two generation attempts, and creates no substitute question or progress change on error.
- **SC-010**: Local database evidence, service behavior, hosted readiness, deployed interface definitions, handoffs, integration, and release gates each retain separate pass/fail/blocked evidence; local success never implies deployment readiness.

## Historical Assumptions (Not Production)

- The deterministic transfer rules define the approved two-attempt lifecycle, progress outcomes, private assessment, and learner-safe explanation requirements.
- Existing caller-facing operation names remain stable even if their trusted implementation and storage procedures change.
- This feature does not add a sign-in product. The app identity verifier uses the existing localStorage app user ID and database role/room records; it does not prevent caller impersonation.
- Production generation uses the configured Edge Function provider variables and model. The `REACT_APP_OAI_*` variables are also exposed in the browser bundle; exact settings are defined in the [provider contract](contracts/provider-contract.md).
- A teacher may edit generated assessment content before delivery. Once delivered, the key, explanation, transfer basis, and assessment scope are immutable.
- The correct key and learner-safe explanation are intentionally withheld after a pass; the learner receives them only after terminal second failure.
- A restored local database with representative roles can verify database, access-control, concurrency, and rollback behavior, but does not establish hosted authorization, generated types, browser behavior, or release readiness. The exact local database verification environment is defined by the [implementation plan](plan.md).
- Existing browser-only assessment data cannot be trusted as private grading authority. Migration must report incomplete records and must not infer absent keys or explanations.

## Historical Out of Scope (Not Production)

- Room controls, message folding, local view state, teacher editor presentation, reconnect experience, or browser acceptance.
- Evaluation cases, rubric thresholds, semantic explanation scoring, or evaluation release policy.
- A new sign-in product, room-level assessment mode, client-side grading or attempt authority, or a second mastery field.
- Automatic disclosure of the key or explanation after a correct response.

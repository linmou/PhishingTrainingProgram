# Feature Specification: Transfer Assessment Browser Release and Rollback Evidence

**Feature Branch**: `105-transfer-release`  
**Created**: 2026-09-11  
**Status**: Draft  
**Input**: W11 plus original handoff sections 19-20 for dedicated transfer browser, privacy, attack, activation, rollback, and final evidence.

## Scope and Source Authority

This component finishes the release-planning contract for transfer assessment verification. The normative behavior is already defined by the transfer-assessment implementation package, its W11 work package, sections 19-20, and the original handoff. This specification defines the evidence that must be produced before activation; it does not claim that the feature is implemented or released.

The source baseline is `plan/transfer_assessment_implementation_plan.md` with SHA-256 `33d87d856e34f181bb5c0cd145c2821c9638177a3780e3ff3dee12b5e6253da2`. The existing seven-room browser run is regression evidence only and cannot satisfy dedicated transfer release acceptance.

### In Scope

- A reproducible dedicated transfer browser run in an isolated migrated environment with verified teacher and learner principals.
- Evidence for complete correct and wrong paths, repair and recovery, new learner evidence and new context, Guard deferral/recovery, rejection/regeneration, dirty and stale drafts, reconnect/catch-up, retries, duplicate tabs, and duplicate answers.
- Privacy inspection across learner network requests, realtime payloads, exports, browser storage, and visible or captured errors.
- Negative authorization and integrity checks for forged identity, cross-room and cross-learner access, stale questions, direct writes, and legacy-RPC writes.
- Activation, release-verdict, feature-flag, and non-destructive rollback evidence.

### Out of Scope

- Production implementation, schema changes, provider prompt changes, or Promptfoo rubric changes.
- Cross-component edge tests and `coverage_manifest.json`, which belong to the integration owner.
- Replacing the existing server-side authentication contract with a new sign-in product.
- Treating seven-room legacy browser evidence, unit tests, Promptfoo results, or static inspection as a substitute for dedicated release evidence.
- Destructive rollback operations such as dropping tables or deleting assessment history.

## User Scenarios & Testing

### User Story 1 - Prove the learner and teacher transfer workflow (Priority: P1)

As a release verifier, I need to run the transfer workflow with verified teacher and learner principals so that the product behavior is evidenced across the complete assessment lifecycle.

**Why this priority**: The dedicated product flow is the release gate. Without it, upstream unit, database, authorization, or AI evidence cannot establish that the shipped room experience is correct.

**Independent Test**: Run the dedicated browser suite in an isolated migrated environment using a recorded environment manifest. The run must produce a stable run ID and evidence links for each required flow, with no missing or silently omitted scenario result.

**Acceptance Scenarios**:

1. **Given** a new learner-owned transfer-policy checklist and unchanged legacy checklist data, **When** the learner provides an eligible contextual signal, **Then** exactly one structured assessment draft is available to the teacher and legacy data remains unchanged.
2. **Given** a teacher has reviewed, edited, and reconfirmed a draft, **When** the teacher sends it, **Then** the learner sees a four-option assessment while the room remains in tutoring mode.
3. **Given** a delivered assessment, **When** the learner submits only the correct labels, **Then** the expected progress transition occurs once, survives reload, and is followed by tutoring feedback rather than an automatic second assessment.
4. **Given** a delivered assessment, **When** the learner submits a wrong answer, **Then** the flow records needs-review, provides repair, waits for new learner evidence, uses a different context, and permits the later valid transfer to pass.
5. **Given** Guard is manually active, **When** a learner answer or deferred event is received, **Then** no protected progression mutation occurs while locked and valid recovery applies the event at most once.
6. **Given** a rejected or dirty draft, stale revision, reconnect, retry, second teacher tab, or duplicate learner answer, **When** the browser flow completes, **Then** no phantom delivery, stale-key grading, duplicate question, duplicate answer effect, or duplicate history row is created.

### User Story 2 - Prove privacy and resistance to release-boundary attacks (Priority: P1)

As a security reviewer, I need browser and direct-request evidence for privacy and authorization boundaries so that a passing user interface cannot conceal a private-data or cross-tenant failure.

**Why this priority**: Answer keys, private drafts, transfer basis, rationales, raw model output, and server-authoritative identity are release gates. A failure blocks activation even when normal flows pass.

**Independent Test**: Execute the privacy inspection and negative attack matrix against the same isolated run environment. Each case must record the request, principal and room context, expected denial or redaction, observed result, and immutable evidence reference.

**Acceptance Scenarios**:

1. **Given** the learner-visible session, **When** requests, realtime payloads, exports, browser storage, and visible or captured errors are inspected, **Then** private answer keys, transfer basis, raw model output, private rationales, and unresolved draft data are absent.
2. **Given** a request with forged identity, a different learner, or a different room, **When** it attempts to read or mutate transfer assessment data, **Then** the server rejects it and no protected state changes.
3. **Given** a stale question, direct write, or legacy-RPC request, **When** it attempts to submit or alter an assessment, **Then** the server rejects it and no protected state changes.
4. **Given** an intentional request or provider failure, **When** the browser displays or records the error, **Then** it does not disclose private keys, rationale, transfer basis, raw model output, credentials, or internal secrets.

### User Story 3 - Authorize activation, rollback, and final release closeout (Priority: P1)

As the release owner, I need a complete evidence report and reversible activation decision so that the transfer capability is enabled only after all gates pass and can be disabled without destroying evidence.

**Why this priority**: Activation is an authorization decision, not a UI toggle. The release record must distinguish a complete pass from an infrastructure-blocked or partially evidenced state.

**Independent Test**: Reconcile the dedicated run, privacy and attack matrix, linked AI run IDs, upstream gate evidence, feature-flag state, and rollback rehearsal into one final report. Verify the flag remains disabled for any pending, partial, blocked, missing, or errored gate; then verify the authorized enable and non-destructive disable path where prerequisites pass.

**Acceptance Scenarios**:

1. **Given** any release gate is pending, partial, blocked, missing, or errored, **When** activation is considered, **Then** the backend-controlled transfer capability remains disabled and the final verdict is not release-approved.
2. **Given** every required gate has immutable evidence and a verified principal/configuration record, **When** activation is authorized, **Then** the backend capability state, exact configuration, approver/verifier, time, and linked evidence are recorded.
3. **Given** the capability is active, **When** rollback is rehearsed, **Then** new assessment generation and delivery are disabled without dropping tables, deleting evidence, or erasing history; already-delivered questions are safely resolved or explicitly cancelled according to the existing contract.
4. **Given** the final report is published, **When** another verifier follows its commands and evidence links, **Then** the run can be reproduced and the report distinguishes implementation, execution, deployment, activation, and rollback status.

## Edge Cases

- The browser loses connectivity after delivery and before answer acknowledgment; reconnect must catch up without duplicating the question or answer effect.
- A teacher edits a draft in two tabs while one tab becomes stale; only the valid revision may be sent, and unsent edits must not be delivered implicitly.
- A commit or answer request times out after the server may have committed; retry must be idempotent and must not create a second history row.
- A learner submits duplicate labels, duplicate answers, a stale question ID, or a question from another room; the server must reject or ignore it according to the existing contract without mutating protected state.
- Guard becomes active between event receipt and persistence; deferred work must not bypass Guard and must be applied once only if still valid during recovery.
- Rejection is followed by automatic re-proposal or regeneration; rejection must suppress automatic re-proposal while an explicit regeneration remains allowed.
- A legacy checklist contains old `excellent`, `good`, or `covered` values; release evidence must show it remains legacy and is not presented as transfer-verified.
- Browser instrumentation, failed requests, export files, logs, or storage snapshots contain unexpected private fields; the privacy gate fails and the evidence remains visible.
- A required principal, migrated environment, provider configuration, browser run, AI run link, or attack result is unavailable; the affected gate is marked blocked or missing rather than replaced by a mock or legacy result.

## Functional Requirements

- **FR-001**: The release package MUST provide a dedicated transfer browser run against an isolated migrated environment with verified teacher and learner principals; the environment, configuration, commit, and run ID MUST be recorded.
- **FR-002**: The browser run MUST exercise the complete correct path, wrong path, repair and recovery path, new learner evidence and new context path, Guard deferral/recovery, rejection/regeneration, dirty/stale drafts, reconnect/catch-up, retries, duplicate tabs, and duplicate answers.
- **FR-003**: The browser run MUST verify that a reviewed teacher send produces one ordinary four-option assessment turn and does not change the room into a separate assessment mode.
- **FR-004**: The browser run MUST verify exact first-answer resolution, reload persistence, feedback-first follow-up, no automatic assessment chain, and no duplicate question, answer effect, or history row.
- **FR-005**: The release evidence MUST inspect learner network requests, realtime payloads, exports, browser storage, and errors for private answer keys, transfer basis, raw model output, private rationales, credentials, and other unresolved secret data; any leakage MUST fail the privacy gate.
- **FR-006**: The attack matrix MUST attempt forged identity, cross-learner, cross-room, stale-question, direct-write, and legacy-RPC operations and MUST record rejection plus unchanged protected state for each applicable operation.
- **FR-007**: The release package MUST preserve the distinction between dedicated transfer evidence, upstream deterministic/database/authorization/evaluation gates, and seven-room legacy regression evidence; no evidence lane may substitute for another.
- **FR-008**: Every browser, privacy, attack, activation, and rollback result MUST retain its actual outcome, failure or missing state, command or request details, timestamp, principal/context, and immutable evidence reference; failed or errored results MUST remain visible.
- **FR-009**: The final release report MUST include the starting and ending commit, changed planning or release files, migration status as authored/exercised/deployed, verified-principal source, key-protection status, tests and exit statuses, semantic/browser run links, feature-flag state, rollback path, and remaining gaps.
- **FR-010**: The backend-controlled `TRANSFER_ASSESSMENT_ENABLED` capability MUST remain disabled while any required gate is pending, partial, blocked, missing, or errored; a client-only flag MUST NOT authorize transfer assessment.
- **FR-011**: Activation evidence MUST record the exact environment/configuration, feature-flag state, authorized decision, gate verdict, and linked AI run IDs; a passing Promptfoo run alone MUST NOT authorize activation.
- **FR-012**: Rollback evidence MUST demonstrate disabling new assessment generation and delivery without dropping tables, deleting assessment evidence, erasing history, or reinterpreting legacy checklist values; already-delivered questions MUST follow the existing safe-resolution or explicit-cancellation contract.
- **FR-013**: The release package MUST stop at the affected milestone when verified authentication, provider configuration, hosted environment, browser execution, or a required decision is unavailable; it MUST NOT use silent fallbacks, fabricated results, or unrelated legacy evidence.
- **FR-014**: This component MUST limit its owned artifacts to dedicated transfer browser/release evidence and its report/configuration paths; cross-component edge tests and `coverage_manifest.json` MUST remain assigned to the integration owner.

## Key Entities

- **Browser Run Record**: A reproducible execution record containing run ID, commit, exact environment/configuration, verified principals, scenario results, timestamps, and evidence links.
- **Evidence Item**: An immutable reference to a screenshot, console capture, network trace, realtime payload inspection, export/storage snapshot, request/response, command output, or report attachment with its actual result.
- **Privacy and Attack Case**: A named inspection or negative operation with actor/principal, room/learner scope, request details, expected boundary, observed result, and protected-state comparison.
- **Release Verdict**: A gate-reconciled decision that distinguishes pass, partial, blocked, missing, and errored evidence and names the gates that control activation.
- **Capability State**: The backend-controlled `TRANSFER_ASSESSMENT_ENABLED` state with its exact environment, decision authority, timestamp, and linked release evidence.
- **Rollback Record**: A before/after record proving that new generation/delivery was disabled while assessment tables, evidence, history, and legacy semantics remained intact.
- **Linked AI Run**: An immutable reference to the applicable frozen Promptfoo or production-path evaluation run; it supports the release record but does not substitute for browser acceptance.

## Success Criteria

### Measurable Outcomes

- **SC-001**: One dedicated browser run record covers every required scenario family in FR-002, with zero omitted, silently skipped, or unclassified results.
- **SC-002**: The correct path, wrong/repair/recovery path, Guard path, draft/reconnect/retry/race paths, and legacy-preservation path each have at least one reproducible evidence item tied to the same isolated environment and run ID.
- **SC-003**: The privacy inspection has zero exposed private keys, transfer basis, raw model output, private rationales, credentials, or unresolved secret fields in the inspected learner-visible surfaces.
- **SC-004**: Every applicable attack case in FR-006 is rejected or safely neutralized, with protected state unchanged and an evidence item recording the observed result.
- **SC-005**: The final report contains all public outputs: browser run ID, exact environment/configuration, screenshots, console/network evidence, linked AI run IDs, release verdict, feature-flag state, and non-destructive rollback proof.
- **SC-006**: Activation evidence shows the backend capability disabled for every non-passing gate and shows enablement only after all required gates have immutable evidence and a release-approved verdict.
- **SC-007**: Rollback rehearsal shows zero dropped tables, deleted assessment evidence, erased history, or altered legacy verification semantics before and after disabling new generation/delivery.
- **SC-008**: An independent verifier can reproduce the release decision from the final report using the recorded commands, configuration, principals, run IDs, and evidence links without relying on undocumented local state.

## Assumptions

- Upstream components 102, 103, and 104 provide the backend, room UI, and evaluation artifacts required by the release gates; this component consumes their recorded outputs.
- The isolated migrated environment and verified principals are provisioned through approved repository/deployment mechanisms; this planning package does not invent credentials or execute hosted changes.
- Browser automation, screenshots, network and console capture, exports, storage inspection, and direct-request attack attempts are available to the release verifier.
- The existing server-side identity, transaction, idempotency, privacy, Guard, draft, and rollback contracts remain normative; this component does not redefine them.
- Missing credentials, hosted access, verifier support, or live evaluation access are recorded as named blockers rather than replaced by mock evidence.
- The capability flag is backend-controlled and disabled by default; a frontend visibility toggle cannot authorize it.
- A final report may be release-approved only when every required gate passes. The seven-room browser run remains useful regression evidence but is never transfer release evidence.

## Dependencies and Ownership

- **Upstream**: `102 backend`, `103 room UI`, and `104 evaluation` provide the artifacts consumed by this component.
- **Owned**: dedicated transfer browser tests, release scripts/configuration examples, browser/privacy/attack evidence paths, activation/rollback rehearsal records, and the final release report.
- **Integration-owned**: cross-component edge tests and `coverage_manifest.json`.
- **Deferred to integration owner**: root `AGENTS.md` context update; this component will not run `update-agent-context.sh` or modify `AGENTS.md`.

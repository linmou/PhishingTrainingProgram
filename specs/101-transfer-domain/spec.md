# Feature Specification: Server-Authoritative Transfer Attempts

**Feature Branch**: `101-transfer-domain`  
**Created**: 2026-09-11  
**Revised**: 2026-09-29
**Status**: Ready for implementation  
**Input**: Upgrade the deterministic transfer domain for two server-authoritative attempts and an editable learner-safe explanation.

## Scope and Authority

This component defines deterministic assessment, grading, progress, and disclosure behavior. Persistence, authorization, transport, room presentation, prompt generation, semantic evaluation, and release acceptance have separate owners.

## TransferLearning Refactor Contract

Transfer assessment content is a `TransferAssessmentDraft` with `reason`, `target_item_id`, and `assessment: PrivateAssessment`. It has no tutor mode, teaching instruction, or duplicate response. `TutorDecisionV3` remains readable for historical compatibility, but active assessment preparation and review use the assessment-only draft. The shared tutor chooses only tutoring or Guard. The existing pure transition matrix, exact-set grading, private key, and two-attempt lifecycle remain authoritative.

An eligible target is a current room-approved checklist item at `partially_covered/basic` with learner-owned evidence and no open assessment, feedback, repair, protection, correction, or Guard blocker. Eligibility requires the next AI-generated response to be an assessment draft; it is not another tutor decision. Spontaneous transfer can verify the target without a quiz.

## Clarifications

### Session 2026-09-22

- Q: Where is the two-attempt lifecycle authoritative across reloads and tabs? -> A: The attempt lifecycle is server-authoritative and persistent across reloads and tabs; the browser only renders the returned state.

## User Scenarios & Testing

### User Story 1 - Resolve at most two valid attempts (Priority: P1)

A learner may make up to two valid option selections for one delivered transfer assessment. The first incorrect selection keeps the question open without changing progress. A correct selection on either attempt passes; a second incorrect selection fails. Replays and later submissions have no new effect.

**Why this priority**: The attempt lifecycle controls grading, feedback disclosure, and durable progress. It cannot be inferred from page-local state.

**Independent Test**: Observe the outcomes for a correct first answer, an incorrect answer followed by a correct answer, two incorrect answers, duplicate and stale submissions, malformed input, assistance, reload-equivalent state, and a third submission. Each outcome must follow the same authoritative attempt state.

**Acceptance Scenarios**:

1. **Given** a current delivered question with no accepted attempts, **When** the learner submits an incorrect valid selection, **Then** the result is retryable, progress is unchanged, one attempt remains, and no key or learner-safe explanation is disclosed.
2. **Given** a current delivered question with zero or one accepted attempts, **When** the learner submits the exact correct selection, **Then** the question passes exactly once and progress becomes `covered/good`.
3. **Given** a current delivered question with one prior incorrect attempt, **When** the learner submits a second incorrect valid selection, **Then** the question fails exactly once, progress becomes `needs_review/basic`, and terminal correct-answer feedback is available to the authorized downstream projection.
4. **Given** a question is passed or failed, **When** any later submission arrives, **Then** no third attempt, progress transition, or feedback chain is created.
5. **Given** an already processed answer identity is replayed, **When** it is resolved against the same lifecycle state, **Then** the result is duplicate and neither attempt count nor progress changes.
6. **Given** an undelivered, stale, ambiguous, malformed, assistance, or Guard-deferred message, **When** it is processed, **Then** it does not consume an attempt or change progress.

### User Story 2 - Author one learner-safe explanation (Priority: P1)

A trusted tutor decision carries a dedicated explanation of why the correct answer is correct. A teacher can review and edit that private explanation before delivery. The server may retain it on any terminal result, but learners receive it only after terminal failure on the second incorrect attempt.

**Why this priority**: The explanation must exist in the shared domain contract before generation, storage, teacher editing, or role-safe terminal feedback can work.

**Independent Test**: Check assessment decisions with present, missing, blank, and non-text explanations, then inspect what is visible before resolution, after a retry, after passing, and after terminal failure.

**Acceptance Scenarios**:

1. **Given** a `TransferAssessmentDraft`, **When** its private assessment has a non-empty `learner_safe_explanation`, **Then** contract validation accepts the field with the private answer key and transfer basis.
2. **Given** an assessment draft with a missing, blank, or non-string explanation, **When** it is validated, **Then** validation rejects it with a stable explanation error category.
3. **Given** an unresolved question, first incorrect result, or correct result, **When** learner disclosure is evaluated, **Then** component 102 is not authorized to project the correct option IDs or learner-safe explanation.
4. **Given** a second incorrect result, **When** terminal feedback is produced, **Then** the failed result authorizes component 102 to project the correct option IDs and learner-safe explanation to the learner.
5. **Given** tutoring or Guard mode, **When** the decision is validated, **Then** the assessment and its explanation remain null.

### User Story 3 - Apply transfer progress transitions consistently (Priority: P1)

The learning workflow applies evidence and assessment outcomes to the existing `status` and `understanding_level` pair. It records initial evidence, successful or failed transfer, spontaneous transfer, repair, contradiction, and no-change outcomes without adding a parallel mastery field.

**Why this priority**: Progress state is the durable meaning of the assessment. A single deterministic authority is required so UI, prompts, and persistence cannot disagree about learner progress.

**Independent Test**: Observe the result of every supported progress state and learning event, including no-change cases, and confirm that unsupported state pairs or events are rejected.

**Acceptance Scenarios**:

1. **Given** `pending/none`, **When** initial learner evidence is accepted, **Then** progress becomes `partially_covered/basic`.
2. **Given** `partially_covered/basic`, **When** either valid attempt passes, **Then** progress becomes `covered/good` exactly once.
3. **Given** `partially_covered/basic`, **When** the first valid attempt is incorrect, **Then** progress remains unchanged; only a second incorrect attempt changes progress to `needs_review/basic`.
4. **Given** a learner demonstrates valid spontaneous transfer in a changed context, **When** the evidence is accepted, **Then** progress becomes `covered/good` without a generated quiz.
5. **Given** `covered/good` or `partially_covered/basic`, **When** a later contradiction is classified, **Then** progress reopens as `needs_review/basic`.
6. **Given** `needs_review/basic` after failure, **When** a repair signal and later learner evidence arrive, **Then** the learner may return to `partially_covered/basic` and a different context may be assessed.

### User Story 4 - Validate and render one inspectable assessment draft (Priority: P1)

A trusted assessment generator produces one reviewable transfer assessment with a known target, cited source evidence, four canonical options, a valid key, a meaningful changed context, and bounded learner-visible text. Learner-facing output omits the private key, transfer basis, and rationale.

**Why this priority**: Consistent decision rules and bounded question content let the rest of the product rely on the same behavior without copied or hidden assumptions.

**Independent Test**: Validate golden valid/invalid `TransferAssessmentDraft` and `TransferTurnContext` payloads, verify the pure public output contract excludes private fields, and exercise rendering at every stated boundary. Keep historical `TutorDecisionV3` parser regression coverage. Component 102 separately verifies API projection and transport.

**Acceptance Scenarios**:

1. **Given** an assessment draft, **When** it contains one known target and a valid private item, **Then** the assessment-only contract accepts it without a tutor mode, instruction, or duplicate response.
2. **Given** an item, **When** it is rendered, **Then** it has exactly A-D options, the correct single/multiple instruction, at most two stem sentences, and at most 80 learner-visible word-like segments.
3. **Given** an item with a missing or blank learner-safe explanation, 81 word-like segments, three stem sentences, duplicate option text, an invalid key cardinality, or an unknown evidence ID, **When** it is validated, **Then** validation rejects it with a stable error category.
4. **Given** a valid private assessment, **When** component 101 exposes the unresolved public assessment contract for component 102, **Then** answer keys, learner-safe explanation, transfer basis, tutor rationale, raw model output, API operations, and transport fields are absent.
5. **Given** tutoring mode, **When** the decision is validated, **Then** it requires one real teaching instruction with a null target and null assessment.
6. **Given** Guard mode, **When** the decision is validated, **Then** it accepts `guard` or one real teaching instruction with a null target and null assessment, and it cannot create a room-level assessment mode.

### User Story 5 - Sequence feedback and later transfer without chains (Priority: P2)

The tutoring workflow handles delivery, learner answers, feedback-first follow-up, repair, contradiction, spontaneous transfer, duplicate or stale messages, and prevents repeated assessment chains. API transport, public projection, teacher review, and persistence are defined by their respective supporting contracts.

**Why this priority**: Correct individual decisions are insufficient if the workflow schedules a question at the wrong time or treats an unsent, stale, or already-resolved event as current.

**Independent Test**: Walk through review and delivery, answer resolution, feedback, repair, contradiction, spontaneous transfer, and later-question scenarios. Confirm the required order and that stale, duplicate, or unconfirmed activity does not start another assessment sequence.

**Acceptance Scenarios**:

1. **Given** a valid assessment draft, **When** it is reviewed and delivered, **Then** the learner receives one assessment question and the room does not enter a separate assessment participation mode.
2. **Given** a correct answer on either attempt, **When** resolution completes, **Then** tutoring feedback is required before another assessment is eligible.
3. **Given** one wrong answer, **When** resolution completes, **Then** the assessment remains open; only a second wrong answer begins `needs_review` -> repair -> new learner signal -> different context, and failure alone does not enter Guard.
4. **Given** a clarification, assistance request, spontaneous transfer, contradiction, duplicate message, or stale message, **When** it is handled, **Then** the documented outcome occurs without creating a second assessment chain.
5. **Given** an explicit rejection or dirty/stale draft, **When** the teacher has not reconfirmed it, **Then** no assessment is delivered or graded and automatic re-proposal is suppressed.

## Edge Cases

- Attempt authority survives reloads, remounts, reconnects, retries, and separate tabs; client display state cannot reset or replace the authoritative attempt count.
- Only a validated selection for the current delivered assessment consumes an attempt. Empty, malformed, ambiguous, assistance, undelivered, stale, wrong-assessment, and Guard-deferred inputs consume none.
- Duplicate answer identities return the established outcome downstream and never consume an additional attempt.
- A correct second attempt passes; prior incorrect history cannot downgrade it.
- A third valid selection after terminal pass/fail is duplicate/terminal with no progress transition and no additional feedback disclosure event.
- Answer labels may use case differences, full-width Unicode forms, commas, semicolons, `and`, `&`, `+`, a leading answer phrase, or a trailing question mark; normalization must not infer semantic answers.
- Alternatives (`B or D`, `B/D`, `not B`), malformed combinations (`B and`, `BD`), numeric labels, and non-option prose must remain non-passing and use clarification or tutoring-help disposition as appropriate.
- An exact option-text match may select one option, but a semantically similar paraphrase must not select one.
- Multiple-answer grading must ignore order and duplicate labels but reject every non-exact set, including incomplete, over-inclusive, empty, and all-option sets when the key is a proper subset.
- The rendering boundary is inclusive at 80 word-like segments and exclusive at 81; the stem boundary is inclusive at two sentences and exclusive at three.
- Invalid progress pairs, invalid transition events, unknown target IDs, unknown source message IDs, duplicate option IDs/text, invalid key cardinality, and incompatible mode/instruction combinations must be rejected rather than silently repaired.
- A generated or teacher-edited draft that is not delivered is not answerable; a terminal question is not regraded by a later answer.
- Unresolved and retryable learner-visible results exclude the correct answer, learner-safe explanation, transfer basis, tutor rationale, and raw model output. A passed result may retain terminal feedback privately for server/audit use but does not authorize learner disclosure. Only a second-incorrect failed result authorizes learner disclosure of the answer and explanation.
- Feedback is a sequencing requirement after resolution, but an independently required protective or Guard response retains priority.
- A later contradiction may reopen covered progress; an ordinary covered target is not routinely reassessed.
- Existing legacy values, including legacy `excellent`/`covered` semantics, are not converted into transfer verification by this component.

## Requirements

### Functional Requirements

- **FR-001**: The component MUST validate an assessment-only `TransferAssessmentDraft` containing a reason, one known target, and one valid private assessment with a trimmed, non-empty `learner_safe_explanation`. Active assessment generation has no tutor mode, instruction, or duplicate response. The historical `TutorDecisionV3` parser remains readable for stored and regression fixtures.
- **FR-002**: The component MUST expose a `TransferTurnContext` that carries the selected learner/message/checklist context, progress-policy version, checklist item snapshots, unresolved public assessment, eligible item IDs, feedback boundary, and progress snapshot hash without becoming a second progression authority.
- **FR-003**: A valid transfer item MUST use exactly four canonical A-D options, a `single` key of one option or a `multiple` key of two or three options, and a changed context that tests the same concept through a relevant new situation rather than a cosmetic brand/name substitution or an unstated prerequisite; source evidence IDs MUST be known to the current context.
- **FR-004**: A learner-visible unresolved question MUST omit the answer key, learner-safe explanation, transfer basis, tutor rationale, and raw model output. Passed and failed results MAY retain the answer and explanation privately, but MUST state explicitly whether learner disclosure is authorized. Exact public and terminal representations are defined in the [domain contract](contracts/transfer-domain-determinism.md).
- **FR-005**: Answer interpretation MUST recognize only explicit option labels or exact option text. It MUST apply the specified case, Unicode, punctuation, order, and duplicate normalization without guessing semantic answers, and MUST distinguish ambiguous alternatives, content questions, and unrecognized prose from a valid selection.
- **FR-006**: The grader MUST return pass only for exact set equality after deduplication and order normalization; it MUST return fail for every other selection and MUST require no explanation or confidence value.
- **FR-007**: Rendering and validation MUST enforce exactly four options, the correct selection instruction, a maximum of two stem sentences, and a maximum of 80 word-like segments, with deterministic boundary errors.
- **FR-008**: Transfer behavior MUST preserve only the approved `status`/`understanding_level` pairs and define the outcome for every supported progress state and learning event, including initial evidence, repair evidence, spontaneous transfer, contradiction, pass, fail, and no change.
- **FR-009**: The current assessment state MUST distinguish the assessment identity, accepted-attempt count (`0`, `1`, or `2`), resolution (`open`, `passed`, or `failed`), and previously processed answer identities so duplicate submissions have no new effect. The concrete state representation is defined in the [data model](data-model.md).
- **FR-010**: Only a valid selection against the current delivered, non-stale, open assessment MUST consume an attempt; clarification, assistance, malformed, undelivered, stale, duplicate, and Guard-deferred inputs MUST consume none.
- **FR-011**: The first incorrect valid selection MUST return a `retryable` result, accepted-attempt count one, unchanged progress, one remaining attempt, no learning transition, and no terminal feedback.
- **FR-012**: A correct valid selection on attempt one or two MUST pass exactly once, apply the passing progress outcome once, require feedback, report no remaining attempts, and forbid learner disclosure of any retained key or explanation.
- **FR-013**: A second incorrect valid selection MUST fail exactly once, apply the failure progress outcome once, require repair, report no remaining attempts, and include terminal feedback; only this outcome authorizes disclosure of the answer and explanation to the learner.
- **FR-014**: Duplicate submissions and submissions against a passed, failed, or exhausted snapshot MUST not increment attempts, emit a learning transition, or create another feedback chain.
- **FR-015**: The learning-progress behavior MUST retain the approved four progress pairs and seven event kinds; the attempt lifecycle MUST control when progress changes without changing the approved outcomes.
- **FR-016**: Wrong-answer recovery MUST begin only after terminal failure and MUST require repair and new learner evidence before selecting a different transfer context; an incorrect attempt or terminal failure alone MUST NOT enter Guard.
- **FR-017**: Evidence for this behavior MUST cover valid and invalid decisions, explanation presence and privacy, answer interpretation boundaries, exact answer matching, rendering limits, progress outcomes, and correct-first, incorrect-correct, incorrect-incorrect, duplicate, stale, reload/tab-equivalent, and third-submission behavior.
- **FR-018**: The shared assessment, attempt, result, feedback, and progress behavior MUST be available to downstream capabilities through one stable domain contract. The concrete exported types and location are specified by the [implementation plan](plan.md) and linked contracts.
- **FR-019**: This capability MUST determine domain outcomes independently of persistence, authorization, API transport, provider calls, room rendering, evaluation tooling, or release-browser behavior. Those boundaries are specified and verified separately.

### Key Entities

- **TransferAssessmentDraft**: A private assessment-only review value with a reason, one approved target ID, and a private assessment. It is not persisted as a draft row.
- **TutorDecisionV3**: Historical reason-first tutor decision retained for reading older transfer records and parser regressions.
- **TransferTurnContext**: The turn-scoped input snapshot used to validate target, evidence, current progress, unresolved question, feedback boundary, and stale-state identity.
- **PublicAssessment**: Learner-visible assessment identity/content with no answer key, transfer basis, rationale, or raw model output.
- **PrivateAssessment**: Review/server-side assessment content plus exact correct option IDs, transfer basis, and required `learner_safe_explanation`.
- **ParsedSelection**: Deterministic answer parser result: selection, clarification required with a stable code, or not a selection.
- **TransferAttemptSnapshot**: Server-owned lifecycle input with assessment identity, accepted-attempt count, resolution, and processed answer-message identities.
- **TransferRetryResult**: First-incorrect non-terminal outcome with one remaining attempt, unchanged progress, and no terminal feedback fields.
- **TransferTerminalResult**: Passed or failed outcome with zero remaining attempts, one progress transition, typed terminal feedback, and literal `learner_feedback_authorized`; false for pass and true only for second-incorrect failure.
- **TransferTerminalFeedback**: Correct option IDs plus the learner-safe explanation. It remains private server/audit data on pass and becomes learner-projectable only when the failed result authorizes disclosure.
- **TransferProgress**: The approved status/understanding-level pair: `pending/none`, `partially_covered/basic`, `needs_review/basic`, or `covered/good`.
- **LearningEvent**: A learner-evidence or assessment outcome event with causal message IDs and an explicit classifier.
- **Golden Fixture**: A versioned input/output case with scenario name, contract/policy version, expected disposition, and evidence references.

## Success Criteria

### Measurable Outcomes

- **SC-001**: Every one of the 28 approved progress-state/event combinations has a defined result, with no unsupported transition silently accepted.
- **SC-002**: Every possible selection of options A-D is graded against representative single- and multiple-answer keys, and only an exact answer set passes.
- **SC-003**: Answer interpretation and question rendering preserve all documented boundaries: Unicode and format normalization, ambiguity, exact option text, 80 versus 81 word-like segments, and two versus three stem sentences.
- **SC-004**: Every accepted assessment draft includes a non-empty learner-safe explanation, and every unresolved learner-visible question excludes the key, explanation, transfer basis, rationale, and raw model output. The API and transport representation is covered by the linked contract.
- **SC-005**: All attempt sequences follow the canonical outcomes: a correct first answer passes, incorrect-then-correct passes, incorrect-then-incorrect fails, and no sequence consumes more than two attempts.
- **SC-006**: Every first-incorrect outcome preserves progress, reports one remaining chance, and exposes no terminal feedback; passing never authorizes learner disclosure; only a second-incorrect failure authorizes terminal feedback.
- **SC-007**: Duplicate, stale, malformed, assistance, Guard-deferred, reload/tab-equivalent, and third submissions consume no additional attempt and create no additional progress transition.
- **SC-008**: Domain outcomes can be verified without relying on a live provider, database, room interface, browser, or feature activation, and such evidence is reported separately from downstream verification.

## Assumptions

- The approved policy makes the two-attempt state server-authoritative and persistent across reloads and tabs; the trusted backend owns persistence, concurrency, and idempotent replay.
- The established project tooling remains the execution environment for deterministic verification; its exact commands are recorded in the plan and quickstart.
- The trusted service generates, stores, and role-projects learner-safe explanations; this feature defines the field's domain meaning and the rule that only second-incorrect failure authorizes learner disclosure.
- The room experience renders server-returned attempt state. Any local count is display-only and cannot reset the lifecycle.
- Semantic correctness and safety of generated explanations are evaluated separately; this feature validates structural presence and deterministic privacy only.
- This feature consumes selected targets and evidence classifications but does not classify learner evidence or own persistence, authorization, provider calls, API projection, room presentation, or release activation.
- `transfer_v1` is the only new-policy interpretation for this component; legacy checklist records retain their existing meaning.
- The feature flag remains disabled until downstream database, authorization, provider, evaluation, and browser gates pass.
- Local examples may use explicit identifiers and values, but they do not prove hosted storage, authorization, or provider behavior.

## Out of Scope

- Database schema, persistence transactions, access control, private-field storage, trusted-service implementation, and API projection.
- Room presentation, teacher editor, browser acceptance, semantic evaluation, provider prompt/calls, and feature activation.
- New authentication or sign-in behavior.
- Reinterpreting legacy checklist progress or adding a parallel mastery field.

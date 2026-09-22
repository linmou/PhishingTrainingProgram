# Feature Specification: Server-Authoritative Transfer Attempts

**Feature Branch**: `101-transfer-domain`  
**Created**: 2026-09-11  
**Revised**: 2026-09-22  
**Status**: Ready for implementation  
**Input**: Upgrade the deterministic transfer domain for two server-authoritative attempts and an editable learner-safe explanation.

## Clarifications

### Session 2026-09-22

- Q: Where is the two-attempt lifecycle authoritative across reloads and tabs? -> A: The attempt lifecycle is server-authoritative and persistent across reloads and tabs; the browser only renders the returned state.

## User Scenarios & Testing

### User Story 1 - Resolve at most two valid attempts (Priority: P1)

A learner may make up to two valid option selections for one delivered transfer assessment. The first incorrect selection keeps the question open without changing progress. A correct selection on either attempt passes; a second incorrect selection fails. Replays and later submissions have no new effect.

**Why this priority**: The attempt lifecycle controls grading, feedback disclosure, and durable progress. It cannot be inferred from page-local state.

**Independent Test**: Replay correct-first, incorrect-then-correct, incorrect-then-incorrect, duplicate, stale, malformed, assistance, reload-equivalent, and third-submission fixtures through the pure resolver and verify one deterministic result for each server-owned lifecycle snapshot.

**Acceptance Scenarios**:

1. **Given** a current delivered question with no accepted attempts, **When** the learner submits an incorrect valid selection, **Then** the result is retryable, progress is unchanged, one attempt remains, and no key or learner-safe explanation is disclosed.
2. **Given** a current delivered question with zero or one accepted attempts, **When** the learner submits the exact correct selection, **Then** the question passes exactly once and progress becomes `covered/good`.
3. **Given** a current delivered question with one prior incorrect attempt, **When** the learner submits a second incorrect valid selection, **Then** the question fails exactly once, progress becomes `needs_review/basic`, and terminal correct-answer feedback is available to the authorized downstream projection.
4. **Given** a question is passed or failed, **When** any later submission arrives, **Then** no third attempt, progress transition, or feedback chain is created.
5. **Given** an already processed answer identity is replayed, **When** it is resolved against the same lifecycle state, **Then** the result is duplicate and neither attempt count nor progress changes.
6. **Given** an undelivered, stale, ambiguous, malformed, assistance, or Guard-deferred message, **When** it is processed, **Then** it does not consume an attempt or change progress.

### User Story 2 - Author one learner-safe explanation (Priority: P1)

A trusted tutor decision carries a dedicated explanation of why the correct answer is correct. A teacher can review and edit that private field before delivery, while learners cannot receive it before the assessment reaches a terminal result.

**Why this priority**: The explanation must exist in the shared domain contract before generation, storage, teacher editing, or role-safe terminal feedback can work.

**Independent Test**: Validate private decisions with present, missing, blank, and non-string explanations; project their pre-terminal public assessment shape; then inspect terminal and retry lifecycle results for field-level privacy.

**Acceptance Scenarios**:

1. **Given** an assessment-mode `TutorDecisionV3`, **When** its private assessment has a non-empty `learner_safe_explanation`, **Then** contract validation accepts the field with the private answer key and transfer basis.
2. **Given** an assessment-mode decision with a missing, blank, or non-string explanation, **When** it is validated, **Then** validation rejects it with a stable explanation error category.
3. **Given** an unresolved question or first incorrect result, **When** the learner-facing domain shape is inspected, **Then** it contains neither the correct option IDs nor the learner-safe explanation.
4. **Given** a correct result or second incorrect result, **When** terminal feedback is produced, **Then** it contains the correct option IDs and learner-safe explanation as a distinct typed value for component 102 to authorize and project.
5. **Given** tutoring or Guard mode, **When** the decision is validated, **Then** the assessment and its explanation remain null.

### User Story 3 - Apply transfer progress transitions consistently (Priority: P1)

The learning workflow applies evidence and assessment outcomes to the existing `status` and `understanding_level` pair. It records initial evidence, successful or failed transfer, spontaneous transfer, repair, contradiction, and no-change outcomes without adding a parallel mastery field.

**Why this priority**: Progress state is the durable meaning of the assessment. A single deterministic authority is required so UI, prompts, and persistence cannot disagree about learner progress.

**Independent Test**: Run the complete 4-state by 7-event reducer matrix and stateful golden sequences, verifying accepted pairs, no-change behavior, and rejected invalid transitions.

**Acceptance Scenarios**:

1. **Given** `pending/none`, **When** initial learner evidence is accepted, **Then** progress becomes `partially_covered/basic`.
2. **Given** `partially_covered/basic`, **When** either valid attempt passes, **Then** progress becomes `covered/good` exactly once.
3. **Given** `partially_covered/basic`, **When** the first valid attempt is incorrect, **Then** progress remains unchanged; only a second incorrect attempt changes progress to `needs_review/basic`.
4. **Given** a learner demonstrates valid spontaneous transfer in a changed context, **When** the evidence is accepted, **Then** progress becomes `covered/good` without a generated quiz.
5. **Given** `covered/good` or `partially_covered/basic`, **When** a later contradiction is classified, **Then** progress reopens as `needs_review/basic`.
6. **Given** `needs_review/basic` after failure, **When** a repair signal and later learner evidence arrive, **Then** the learner may return to `partially_covered/basic` and a different context may be assessed.

### User Story 4 - Validate and render one inspectable v3 transfer decision (Priority: P1)

A trusted tutor decision produces one reviewable transfer assessment with a known target, cited source evidence, four canonical options, a valid key, a meaningful changed context, and bounded learner-visible text. Learner-facing output omits the private key, transfer basis, and rationale.

**Why this priority**: Stable versioned contracts and bounded rendering let downstream backend, UI, and evaluation components consume the same behavior without relying on copied text or hidden assumptions.

**Independent Test**: Validate golden valid/invalid `TutorDecisionV3` and `TransferTurnContext` payloads, verify the pure public output contract excludes private fields, and exercise rendering at every stated boundary. Component 102 separately verifies API projection and transport.

**Acceptance Scenarios**:

1. **Given** an assessment decision, **When** it contains `assessment` mode, `transfer_assess`, one known target, and a valid item, **Then** the v3 contract accepts it and preserves reason-first serialization.
2. **Given** an item, **When** it is rendered, **Then** it has exactly A-D options, the correct single/multiple instruction, at most two stem sentences, and at most 80 learner-visible word-like segments.
3. **Given** an item with a missing or blank learner-safe explanation, 81 word-like segments, three stem sentences, duplicate option text, an invalid key cardinality, or an unknown evidence ID, **When** it is validated, **Then** validation rejects it with a stable error category.
4. **Given** a valid private decision, **When** component 101 exposes the unresolved public assessment contract for component 102, **Then** answer keys, learner-safe explanation, transfer basis, tutor rationale, raw model output, API operations, and transport fields are absent.
5. **Given** tutoring mode, **When** the decision is validated, **Then** it requires one real teaching instruction with a null target and null assessment.
6. **Given** Guard mode, **When** the decision is validated, **Then** it accepts `guard` or one real teaching instruction with a null target and null assessment, and it cannot create a room-level assessment mode.

### User Story 5 - Sequence feedback and later transfer without chains (Priority: P2)

The pure transfer assessment orchestrator coordinates delivery state, learner answer handling, feedback-first follow-up, repair, contradiction, spontaneous transfer, duplicate/stale messages, and no-chain behavior while leaving API transport, public projection, teacher review, and persistence boundaries explicit for downstream components.

**Why this priority**: Correct individual functions are insufficient if the lifecycle schedules an assessment at the wrong time or treats an unsent, stale, or already-resolved event as current.

**Independent Test**: Replay the named orchestrator sequences from golden fixtures and verify each observable disposition and next-action boundary without a provider, database, React component, or browser.

**Acceptance Scenarios**:

1. **Given** a valid assessment draft, **When** it is reviewed and delivered, **Then** the learner receives one ordinary tutoring turn carrying an assessment decision and the room does not enter a separate assessment participation mode.
2. **Given** a correct answer on either attempt, **When** resolution completes, **Then** tutoring feedback is required before another assessment is eligible.
3. **Given** one wrong answer, **When** resolution completes, **Then** the assessment remains open; only a second wrong answer begins `needs_review` -> repair -> new learner signal -> different context, and failure alone does not enter Guard.
4. **Given** a clarification, assistance request, spontaneous transfer, contradiction, duplicate message, or stale message, **When** the sequence is replayed, **Then** the result matches the corresponding golden fixture and does not create a second assessment chain.
5. **Given** an explicit rejection or dirty/stale draft, **When** the teacher has not reconfirmed it, **Then** no assessment is delivered or graded and automatic re-proposal is suppressed.

## Edge Cases

- Attempt authority survives reloads, remounts, reconnects, retries, and separate tabs because component 102 persists the domain attempt snapshot; a client counter is display-only.
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
- Pre-terminal public shapes exclude `correct_option_ids`, `learner_safe_explanation`, transfer basis, tutor rationale, and raw model output. Terminal feedback carries the key and explanation as a separate private domain result for component 102 to authorize and project.
- Feedback is a sequencing requirement after resolution, but an independently required protective or Guard response retains priority.
- A later contradiction may reopen covered progress; an ordinary covered target is not routinely reassessed.
- Existing legacy values, including legacy `excellent`/`covered` semantics, are not converted into transfer verification by this component.

## Requirements

### Functional Requirements

- **FR-001**: The component MUST expose a versioned `TutorDecisionV3` contract with reason-first serialization and explicit mode compatibility: tutoring requires one real teaching instruction with null target/assessment; Guard accepts `guard` or one real teaching instruction with null target/assessment; assessment requires `transfer_assess`, one known target, and one valid private assessment payload containing a trimmed, non-empty `learner_safe_explanation`.
- **FR-002**: The component MUST expose a `TransferTurnContext` that carries the selected learner/message/checklist context, progress-policy version, checklist item snapshots, unresolved public assessment, eligible item IDs, feedback boundary, and progress snapshot hash without becoming a second progression authority.
- **FR-003**: A valid transfer item MUST use exactly four canonical A-D options, a `single` key of one option or a `multiple` key of two or three options, and a changed context that tests the same concept through a relevant new situation rather than a cosmetic brand/name substitution or an unstated prerequisite; source evidence IDs MUST be known to the current context.
- **FR-004**: The component MUST define an unresolved public assessment contract that omits answer keys, learner-safe explanation, transfer basis, tutor rationale, raw model output, API operations, and transport fields. It MUST define terminal feedback containing correct option IDs and `learner_safe_explanation` as a distinct private domain result for component 102 to authorize and project.
- **FR-005**: The answer parser MUST recognize only explicit labels or exact option text, normalize case/Unicode/punctuation/order/deduplication as specified, and classify ambiguous alternatives, content questions, and unrecognized prose without guessing.
- **FR-006**: The grader MUST return pass only for exact set equality after deduplication and order normalization; it MUST return fail for every other selection and MUST require no explanation or confidence value.
- **FR-007**: Rendering and validation MUST enforce exactly four options, the correct selection instruction, a maximum of two stem sentences, and a maximum of 80 word-like segments, with deterministic boundary errors.
- **FR-008**: The learning-progress reducer MUST preserve only the approved `status`/`understanding_level` pairs and implement the complete 4-state by 7-event transition matrix, including initial evidence, repair evidence, spontaneous transfer, contradiction, pass, fail, and no-change.
- **FR-009**: The component MUST expose a `TransferAttemptSnapshot` with assessment identity, accepted-attempt count `0 | 1 | 2`, resolution `open | passed | failed`, and processed answer-message identities sufficient for deterministic duplicate suppression.
- **FR-010**: Only a valid selection against the current delivered, non-stale, open assessment MUST consume an attempt; clarification, assistance, malformed, undelivered, stale, duplicate, and Guard-deferred inputs MUST consume none.
- **FR-011**: The first incorrect valid selection MUST return a `retryable` result, accepted-attempt count one, unchanged progress, one remaining attempt, no learning transition, and no terminal feedback.
- **FR-012**: A correct valid selection on attempt one or two MUST return terminal `passed`, emit `assessment_pass` exactly once, require feedback, report zero remaining attempts, and include terminal feedback for downstream authorization.
- **FR-013**: A second incorrect valid selection MUST return terminal `failed`, emit `assessment_fail` exactly once, require repair, report zero remaining attempts, and include terminal feedback for downstream authorization.
- **FR-014**: Duplicate submissions and submissions against a passed, failed, or exhausted snapshot MUST not increment attempts, emit a learning transition, or create another feedback chain.
- **FR-015**: The learning-progress reducer MUST retain the approved four progress pairs and seven event kinds; the attempt lifecycle MUST gate calls to the reducer rather than changing its matrix.
- **FR-016**: Wrong-answer recovery MUST begin only after terminal failure and MUST require repair and new learner evidence before selecting a different transfer context; an incorrect attempt or terminal failure alone MUST NOT enter Guard.
- **FR-017**: Golden fixtures MUST encode valid and invalid contracts, explanation validation/privacy, parser boundaries, exhaustive grader subsets, rendering boundaries, the unchanged reducer matrix, and correct-first, incorrect-correct, incorrect-incorrect, duplicate, stale, reload/tab-equivalent, and third-submission sequences.
- **FR-018**: Required shared attempt, result, feedback, assessment, and progress types MUST be exported through `tutor-system/src/types/index.ts` for downstream consumers.
- **FR-019**: The deterministic component MUST remain pure with respect to persistence, transactions, authorization, API DTOs, providers, React effects, Supabase migrations/functions, Promptfoo, and browser release behavior.

### Key Entities

- **TutorDecisionV3**: A reason-first structured tutor decision whose assessment mode carries one private transfer item; tutoring requires a real teaching instruction, while Guard accepts `guard` or a real teaching instruction, and both non-assessment modes require null target/assessment.
- **TransferTurnContext**: The turn-scoped input snapshot used to validate target, evidence, current progress, unresolved question, feedback boundary, and stale-state identity.
- **PublicAssessment**: Learner-visible assessment identity/content with no answer key, transfer basis, rationale, or raw model output.
- **PrivateAssessment**: Review/server-side assessment content plus exact correct option IDs, transfer basis, and required `learner_safe_explanation`.
- **ParsedSelection**: Deterministic answer parser result: selection, clarification required with a stable code, or not a selection.
- **TransferAttemptSnapshot**: Server-owned lifecycle input with assessment identity, accepted-attempt count, resolution, and processed answer-message identities.
- **TransferRetryResult**: First-incorrect non-terminal outcome with one remaining attempt, unchanged progress, and no terminal feedback fields.
- **TransferTerminalResult**: Passed or failed outcome with zero remaining attempts, one progress transition, and typed terminal feedback.
- **TransferTerminalFeedback**: Correct option IDs plus the learner-safe explanation; private domain output until component 102 authorizes a role-safe projection.
- **TransferProgress**: The approved status/understanding-level pair: `pending/none`, `partially_covered/basic`, `needs_review/basic`, or `covered/good`.
- **LearningEvent**: A learner-evidence or assessment outcome event with causal message IDs and an explicit classifier.
- **Golden Fixture**: A versioned input/output case with scenario name, contract/policy version, expected disposition, and evidence references.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The reducer test suite exercises all 28 cells in the 4-state by 7-event matrix, with no undocumented transition result.
- **SC-002**: The grader fixture suite evaluates every subset of A-D, including empty and full sets, against representative single and multiple keys and proves that only exact sets pass.
- **SC-003**: Parser and rendering suites pass all documented boundaries, including Unicode/format normalization, ambiguity handling, exact option text, 80 versus 81 word-like segments, and two versus three stem sentences.
- **SC-004**: Contract fixtures prove every accepted assessment decision has a non-empty learner-safe explanation and every unresolved public assessment contains zero key, explanation, transfer-basis, rationale, raw-model, API, or transport fields.
- **SC-005**: 100% of attempt-sequence fixtures produce the canonical outcomes: correct-first passes, incorrect-correct passes, incorrect-incorrect fails, and no sequence consumes more than two attempts.
- **SC-006**: 100% of first-incorrect fixtures preserve progress, emit no transition, report one remaining attempt, and expose no terminal feedback; 100% of terminal fixtures emit exactly one pass/fail transition, report zero remaining attempts, and contain terminal feedback.
- **SC-007**: 100% of duplicate, stale, malformed, assistance, Guard-deferred, reload/tab-equivalent, and third-submission fixtures consume no additional attempt and emit no additional progress transition.
- **SC-008**: The complete deterministic command set and TypeScript check pass without provider credentials, database access, React rendering, browser automation, or feature activation, and report deferred downstream verification separately.

## Assumptions

- The approved policy makes the two-attempt snapshot server-authoritative and persistent across reloads and tabs; component 102 owns persistence, concurrency, and idempotent replay.
- Existing TypeScript, Jest, and CRA test conventions remain the execution environment for deterministic tests.
- Component 102 generates, stores, authorizes, and projects the learner-safe explanation; component 101 defines the private field and deterministic disclosure boundary.
- Component 103 renders the server-returned attempt state. Any local attempt count is display-only and cannot reset the lifecycle.
- Component 104 owns semantic correctness and safety evaluation of generated explanations; component 101 validates structural presence and deterministic privacy only.
- W2 consumes selected targets and evidence classifications from upstream behavior but does not implement evidence detection, persistence transactions, authorization, provider calls, API transport/public projection, UI, or release activation.
- `transfer_v1` is the only new-policy interpretation for this component; legacy checklist records retain their existing meaning.
- The feature flag remains disabled until downstream database, authorization, provider, evaluation, and browser gates pass.
- Tests may use explicit fixture IDs and local values, but they must not imply that mock-only tests prove hosted SQL/RLS or provider behavior.

## Out of Scope

- Supabase migrations, database transactions, RLS, authorization, private key/explanation storage, Edge Function implementation, `transferAssessmentService.ts`, and its API/public projection tests.
- React room integration, teacher editor UI, browser acceptance, Promptfoo evaluation, provider prompts/calls, and feature activation.
- New authentication or sign-in behavior.
- Reinterpreting legacy checklist progress or adding a parallel mastery field.

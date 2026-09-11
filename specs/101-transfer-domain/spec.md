# Feature Specification: W2 Deterministic Transfer Behavior and Golden Fixtures

**Feature Branch**: `101-transfer-domain`  
**Created**: 2026-09-11  
**Status**: Draft  
**Input**: W2 component ownership for deterministic transfer behavior, public contracts, and golden fixtures

## User Scenarios & Testing

### User Story 1 - Resolve a delivered assessment answer once (Priority: P1)

A learner answers a teacher-delivered transfer assessment using explicit option labels. The system distinguishes a valid selection from a clarification request, content help, or unrelated prose, and records the first valid result without requiring an explanation or confidence statement.

**Why this priority**: Deterministic answer resolution is the boundary that protects the validity of transfer evidence and prevents later guesses from changing a learner's result.

**Independent Test**: Feed delivered, undelivered, duplicate, stale, ambiguous, clarification, assistance, correct, and incorrect messages to the pure answer-resolution/orchestrator entry point and verify the returned disposition, progress pair, feedback requirement, and idempotency behavior.

**Acceptance Scenarios**:

1. **Given** an assessment has not been delivered, **When** a learner sends an otherwise recognizable option label, **Then** the answer remains ungraded, progress is unchanged, and no feedback is scheduled.
2. **Given** a delivered single-answer assessment, **When** the learner sends the correct label with an optional explanation, **Then** the first valid answer passes exactly once and the explanation cannot downgrade it.
3. **Given** a delivered multiple-answer assessment, **When** the learner sends the exact correct set in any order with duplicate labels, **Then** the selection passes by exact-set equality.
4. **Given** a delivered assessment, **When** the learner sends an alternative such as `B or D` or asks a content question, **Then** the question remains open and the result is clarification or tutoring help rather than failure.
5. **Given** a delivered assessment, **When** the learner requests content assistance that could coach the answer, **Then** the question is assisted/cancelled without a failing grade.
6. **Given** a question already has a first valid resolution, **When** a duplicate, stale, or later guess arrives, **Then** no second resolution, progress change, or feedback chain is created.

### User Story 2 - Apply transfer progress transitions consistently (Priority: P1)

The learning workflow applies evidence and assessment outcomes to the existing `status` and `understanding_level` pair. It records initial evidence, successful or failed transfer, spontaneous transfer, repair, contradiction, and no-change outcomes without adding a parallel mastery field.

**Why this priority**: Progress state is the durable meaning of the assessment. A single deterministic authority is required so UI, prompts, and persistence cannot disagree about learner progress.

**Independent Test**: Run the complete 4-state by 7-event reducer matrix and stateful golden sequences, verifying accepted pairs, no-change behavior, and rejected invalid transitions.

**Acceptance Scenarios**:

1. **Given** `pending/none`, **When** initial learner evidence is accepted, **Then** progress becomes `partially_covered/basic`.
2. **Given** `partially_covered/basic`, **When** an exact assessment pass occurs, **Then** progress becomes `covered/good` exactly once.
3. **Given** `partially_covered/basic`, **When** an exact assessment fail occurs, **Then** progress becomes `needs_review/basic` and the next assessment is not chained immediately.
4. **Given** a learner demonstrates valid spontaneous transfer in a changed context, **When** the evidence is accepted, **Then** progress becomes `covered/good` without a generated quiz.
5. **Given** `covered/good` or `partially_covered/basic`, **When** a later contradiction is classified, **Then** progress reopens as `needs_review/basic`.
6. **Given** `needs_review/basic` after failure, **When** a repair signal and later learner evidence arrive, **Then** the learner may return to `partially_covered/basic` and a different context may be assessed.

### User Story 3 - Validate and render one inspectable v3 transfer decision (Priority: P1)

A trusted tutor decision produces one reviewable transfer assessment with a known target, cited source evidence, four canonical options, a valid key, a meaningful changed context, and bounded learner-visible text. Learner-facing output omits the private key, transfer basis, and rationale.

**Why this priority**: Stable versioned contracts and bounded rendering let downstream backend, UI, and evaluation components consume the same behavior without relying on copied text or hidden assumptions.

**Independent Test**: Validate golden valid/invalid `TutorDecisionV3` and `TransferTurnContext` payloads, inspect public projection output, and exercise rendering at every stated boundary.

**Acceptance Scenarios**:

1. **Given** an assessment decision, **When** it contains `assessment` mode, `transfer_assess`, one known target, and a valid item, **Then** the v3 contract accepts it and preserves reason-first serialization.
2. **Given** an item, **When** it is rendered, **Then** it has exactly A-D options, the correct single/multiple instruction, at most two stem sentences, and at most 80 learner-visible word-like segments.
3. **Given** an item with 81 word-like segments, three stem sentences, duplicate option text, an invalid key cardinality, or an unknown evidence ID, **When** it is validated, **Then** validation rejects it with a stable error category.
4. **Given** a valid private decision, **When** it is projected for the learner, **Then** only the assessment ID, stem, selection instruction, rendered text, and options are exposed; answer keys, transfer basis, and tutor rationale are absent.
5. **Given** tutoring or Guard mode, **When** the decision is validated, **Then** it cannot carry a transfer assessment payload or create a room-level assessment mode.

### User Story 4 - Sequence feedback and later transfer without chains (Priority: P2)

The transfer assessment service/orchestrator coordinates draft delivery, learner answer handling, feedback-first follow-up, repair, contradiction, spontaneous transfer, duplicate/stale messages, and no-chain behavior while leaving teacher review and persistence boundaries explicit for downstream components.

**Why this priority**: Correct individual functions are insufficient if the lifecycle schedules an assessment at the wrong time or treats an unsent, stale, or already-resolved event as current.

**Independent Test**: Replay the named orchestrator sequences from golden fixtures and verify each observable disposition and next-action boundary without a provider, database, React component, or browser.

**Acceptance Scenarios**:

1. **Given** a valid assessment draft, **When** it is reviewed and delivered, **Then** the learner receives one ordinary tutoring turn carrying an assessment decision and the room does not enter a separate assessment participation mode.
2. **Given** a correct answer, **When** resolution completes, **Then** tutoring feedback is required before another assessment is eligible.
3. **Given** a wrong answer, **When** resolution completes, **Then** the sequence is `needs_review` -> repair -> new learner signal -> different context; a wrong answer alone does not enter Guard.
4. **Given** a clarification, assistance request, spontaneous transfer, contradiction, duplicate message, or stale message, **When** the sequence is replayed, **Then** the result matches the corresponding golden fixture and does not create a second assessment chain.
5. **Given** an explicit rejection or dirty/stale draft, **When** the teacher has not reconfirmed it, **Then** no assessment is delivered or graded and automatic re-proposal is suppressed.

## Edge Cases

- Answer labels may use case differences, full-width Unicode forms, commas, semicolons, `and`, `&`, `+`, a leading answer phrase, or a trailing question mark; normalization must not infer semantic answers.
- Alternatives (`B or D`, `B/D`, `not B`), malformed combinations (`B and`, `BD`), numeric labels, and non-option prose must remain non-passing and use clarification or tutoring-help disposition as appropriate.
- An exact option-text match may select one option, but a semantically similar paraphrase must not select one.
- Multiple-answer grading must ignore order and duplicate labels but reject every non-exact set, including incomplete, over-inclusive, empty, and all-option sets when the key is a proper subset.
- The rendering boundary is inclusive at 80 word-like segments and exclusive at 81; the stem boundary is inclusive at two sentences and exclusive at three.
- Invalid progress pairs, invalid transition events, unknown target IDs, unknown source message IDs, duplicate option IDs/text, invalid key cardinality, and incompatible mode/instruction combinations must be rejected rather than silently repaired.
- A generated or teacher-edited draft that is not delivered is not answerable; a delivered question resolved once is not regraded by a later answer.
- Feedback is a sequencing requirement after resolution, but an independently required protective or Guard response retains priority.
- A later contradiction may reopen covered progress; an ordinary covered target is not routinely reassessed.
- Existing legacy values, including legacy `excellent`/`covered` semantics, are not converted into transfer verification by this component.

## Requirements

### Functional Requirements

- **FR-001**: The component MUST expose a versioned `TutorDecisionV3` contract with explicit `tutoring`, `guard`, and `assessment` mode compatibility, reason-first serialization, known target validation, and a single `transfer_assess` instruction for assessment turns.
- **FR-002**: The component MUST expose a `TransferTurnContext` that carries the selected learner/message/checklist context, progress-policy version, checklist item snapshots, unresolved public assessment, eligible item IDs, feedback boundary, and progress snapshot hash without becoming a second progression authority.
- **FR-003**: A valid transfer item MUST use exactly four canonical A-D options, a `single` key of one option or a `multiple` key of two or three options, and a changed context that tests the same concept through a relevant new situation rather than a cosmetic brand/name substitution or an unstated prerequisite; source evidence IDs MUST be known to the current context.
- **FR-004**: Learner-visible assessment projection MUST omit answer keys, transfer basis, tutor rationale, and raw model output while retaining only the public assessment content required to answer.
- **FR-005**: The answer parser MUST recognize only explicit labels or exact option text, normalize case/Unicode/punctuation/order/deduplication as specified, and classify ambiguous alternatives, content questions, and unrecognized prose without guessing.
- **FR-006**: The grader MUST return pass only for exact set equality after deduplication and order normalization; it MUST return fail for every other selection and MUST require no explanation or confidence value.
- **FR-007**: Rendering and validation MUST enforce exactly four options, the correct selection instruction, a maximum of two stem sentences, and a maximum of 80 word-like segments, with deterministic boundary errors.
- **FR-008**: The learning-progress reducer MUST preserve only the approved `status`/`understanding_level` pairs and implement the complete 4-state by 7-event transition matrix, including initial evidence, repair evidence, spontaneous transfer, contradiction, pass, fail, and no-change.
- **FR-009**: The answer-resolution/orchestrator behavior MUST require delivery before grading, resolve the first valid answer once, preserve clarification as open, treat content assistance as assisted rather than failed, suppress duplicate/stale/no-chain outcomes, and require feedback before a subsequent assessment.
- **FR-010**: Wrong-answer recovery MUST require repair and new learner evidence before selecting a different transfer context; failure alone MUST NOT enter Guard.
- **FR-011**: Golden fixtures MUST encode valid and invalid contracts plus the required parser boundaries, exhaustive grader subsets, rendering boundaries, reducer matrix, and named lifecycle sequences with expected observable outputs.
- **FR-012**: The deterministic component MUST remain pure with respect to providers, databases, React effects, Supabase migrations/functions, Promptfoo, and browser release behavior; those boundaries MUST be represented as downstream integration risks rather than implemented here.

### Key Entities

- **TutorDecisionV3**: A reason-first structured tutor decision whose assessment mode carries one private transfer item and whose tutoring/Guard modes cannot carry an assessment payload.
- **TransferTurnContext**: The turn-scoped input snapshot used to validate target, evidence, current progress, unresolved question, feedback boundary, and stale-state identity.
- **PublicAssessment**: Learner-visible assessment identity/content with no answer key, transfer basis, rationale, or raw model output.
- **PrivateAssessment**: Review/server-side assessment content plus exact correct option IDs and transfer basis.
- **ParsedSelection**: Deterministic answer parser result: selection, clarification required with a stable code, or not a selection.
- **TransferProgress**: The approved status/understanding-level pair: `pending/none`, `partially_covered/basic`, `needs_review/basic`, or `covered/good`.
- **LearningEvent**: A learner-evidence or assessment outcome event with causal message IDs and an explicit classifier.
- **Golden Fixture**: A versioned input/output case with scenario name, contract/policy version, expected disposition, and evidence references.

## Success Criteria

### Measurable Outcomes

- **SC-001**: The reducer test suite exercises all 28 cells in the 4-state by 7-event matrix, with no undocumented transition result.
- **SC-002**: The grader fixture suite evaluates every subset of A-D, including empty and full sets, against representative single and multiple keys and proves that only exact sets pass.
- **SC-003**: Parser and rendering suites pass all documented boundaries, including Unicode/format normalization, ambiguity handling, exact option text, 80 versus 81 word-like segments, and two versus three stem sentences.
- **SC-004**: Contract and public-projection fixtures prove every accepted v3 decision has a valid mode/instruction/payload combination and that no learner-visible payload contains a key, transfer basis, rationale, or raw model output.
- **SC-005**: Orchestrator fixtures cover undelivered, first-valid answer, clarification, assistance, repair, contradiction, spontaneous transfer, duplicate, stale, and no-chain sequences with one stable outcome per question.
- **SC-006**: The complete deterministic W2 command set passes without provider credentials, database access, browser automation, or feature activation, and reports any deferred downstream verification separately.

## Assumptions

- The normative transfer-assessment package and the existing tutor behavior/response-contract documents define product behavior; no new product decision is introduced by this component.
- Existing TypeScript, Jest, and CRA test conventions remain the execution environment for deterministic tests.
- W2 consumes selected targets and evidence classifications from upstream behavior but does not implement evidence detection, persistence transactions, authorization, provider calls, UI, or release activation.
- `transfer_v1` is the only new-policy interpretation for this component; legacy checklist records retain their existing meaning.
- The feature flag remains disabled until downstream database, authorization, provider, evaluation, and browser gates pass.
- Tests may use explicit fixture IDs and local values, but they must not imply that mock-only tests prove hosted SQL/RLS or provider behavior.

## Out of Scope

- Supabase migrations, database transactions, RLS, authorization, private key storage, and Edge Function implementation.
- React room integration, teacher editor UI, browser acceptance, Promptfoo evaluation, provider prompts/calls, and feature activation.
- New authentication or sign-in behavior.
- Reinterpreting legacy checklist progress or adding a parallel mastery field.

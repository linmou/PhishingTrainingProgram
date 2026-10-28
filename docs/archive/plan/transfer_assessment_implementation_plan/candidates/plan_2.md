## Assigned Approach

Use a vertical-slice implementation strategy. Each slice must deliver a complete user-visible path from learner signal through server-authoritative state, persistence, UI behavior, automated verification, and recorded evidence before the next slice begins.

The slices are:

1. Learner-owned checklist initialization and eligible-signal recording.
2. Preparation, review, editing, confirmation, and delivery of one public four-option question.
3. Deterministic grading for correct and wrong answers, including repair and new-context recovery.
4. Guard deferral, stale drafts, retries, reconnects, duplicate tabs, privacy enforcement, and authorization attacks.
5. Promptfoo AI-behavior comparison followed by production-path and browser-release verification.

The implementation must preserve the approach’s tradeoff: shared primitives may be revisited as slices expose integration issues, but each slice must remain complete and independently evidenced. The server remains authoritative for identity, provider keys, idempotency, and progress transitions.

## Assumptions

- The original handoff remains the comparison baseline and is never deleted or silently rewritten.
- The reorganized package is indexed by `final_plan.md`.
- All U01-U15 decisions, D01-D16 defaults, non-goals, ownership boundaries, state transitions, privacy rules, migration requirements, evaluation requirements, browser scenarios, rollback rules, and final-report requirements are binding inputs.
- Existing transfer types, reducer, parser, grader, rendering, response-contract support, migration files, Edge Function facade, and draft editor are reusable starting points.
- Existing legacy tutor/Guard browser evidence is not valid transfer-assessment evidence.
- Existing simplified local identity may continue supporting legacy behavior, but it is never treated as a trusted transfer-assessment principal.
- Transfer assessment requires a real verified principal and server-side provider configuration.
- Hosted database checks may use Supabase Dashboard or MCP. Docker-based database testing is unavailable and must not be introduced as a prerequisite.
- No destructive production migration push, database reset, or unrecorded live-model claim is permitted.
- Missing credentials, provider configuration, hosted access, or product decisions are blockers. They must be recorded at the exact milestone and escalated rather than replaced with a silent fallback.
- The feature flag remains disabled until all release gates and the definition of done in section 19 of the handoff are satisfied.

## Major Decisions

- Reorganize and audit the plan before implementing missing product work. Implementation begins only after the intent-drift gate passes.
- Preserve the original handoff byte-for-byte and record its SHA-256 for comparison.
- Use `final_plan.md` as the concise navigation index, with small files organized by work package and verification gate.
- Maintain a checkbox milestone ledger covering W0-W11, each required verification artifact, release activation, and rollback.
- Treat the server as the sole authority for:
  - verified learner identity;
  - provider configuration and key protection;
  - idempotency;
  - checklist, question, grading, recovery, and progress transitions;
  - authorization and privacy decisions.
- Keep the vertical-slice boundary user-visible. A slice is complete only when its UI, server behavior, persistence, tests, and evidence agree.
- Build on existing transfer primitives before adding new abstractions. Revisit shared code only when a slice exposes a real cross-slice inconsistency.
- Separate deterministic correctness from live-provider behavior:
  - deterministic, unit, integration, authorization, and persistence checks establish product correctness;
  - Promptfoo evaluates AI behavior;
  - production-path and browser checks establish runtime and release readiness.
- Treat every verification result as evidence tied to a milestone. A partial implementation or a test-only result is not release acceptance.
- Keep the feature disabled throughout implementation and verification. Activation is a final gated operation with a documented rollback path.

## Ordered Implementation Steps

1. **Establish the plan baseline and package structure.**
   - Preserve the original handoff unchanged.
   - Compute and record its SHA-256.
   - Decompose the handoff into navigable work-package and verification-gate files.
   - Create `final_plan.md` as the index.
   - Trace every U01-U15 decision and D01-D16 default into the appropriate decomposed file.
   - Preserve the handoff’s non-goals, ownership boundaries, state transitions, privacy requirements, migration requirements, evaluation requirements, browser scenarios, rollback rules, and final-report requirements.
   - Create the W0-W11 checkbox ledger with explicit status and evidence fields.
   - Record the current implementation state, including existing transfer components and missing evidence.

2. **Run the plan intent-drift gate.**
   - Have three independent reviewers compare the decomposed package with the original handoff.
   - Review specifically for omitted decisions, changed defaults, altered authority boundaries, changed privacy behavior, missing migration requirements, and weakened release gates.
   - Run targeted follow-up on disagreements or suspected drift.
   - Correct the decomposed plan before implementation when material drift is found.
   - Record reviewer outputs, corrections, and the gate result.
   - Do not begin the vertical slices until this gate passes.

3. **Complete Slice 1: initialize learner ownership and record an eligible signal.**
   - Connect the learner-facing entry point to a verified server-side principal.
   - Initialize the learner-owned transfer checklist through the server.
   - Record an eligible signal using the defined transfer state transitions.
   - Enforce authorization and privacy rules at the server boundary.
   - Add idempotency handling so retries do not duplicate checklist or signal records.
   - Verify persistence using the available hosted or integration path without requiring Docker.
   - Add deterministic, authorization, and persistence integration evidence.
   - Update the ledger only with the exact commands, outputs, or hosted evidence that demonstrate completion.

4. **Complete Slice 2: prepare and deliver one public four-option question.**
   - Implement the complete flow from question preparation through learner review.
   - Support the required edit and confirmation behavior.
   - Deliver exactly one public four-option question through the defined response contract.
   - Keep draft editing and final delivery state transitions server-authoritative.
   - Protect provider configuration and keys on the server-side path.
   - Verify rendering, option structure, response validation, privacy boundaries, and retry behavior.
   - Add deterministic fixtures and integration coverage for valid, malformed, incomplete, and repeated requests.
   - Record slice-specific evidence before advancing.

5. **Complete Slice 3: grade answers and recover from failure.**
   - Grade correct and wrong answers deterministically.
   - Persist the resulting progress transition through the server.
   - Implement the required repair path after an incorrect answer.
   - Implement new-context recovery without interpreting legacy checklist data as transfer verification.
   - Ensure duplicate submissions and retries are idempotent.
   - Cover invalid answer values, repeated grading, stale state, missing records, and interrupted requests.
   - Add unit, integration, authorization, and persistence evidence for both successful and recovery paths.
   - Update the milestone ledger from those results.

6. **Complete Slice 4: exercise Guard, concurrency, and privacy boundaries.**
   - Verify Guard deferral behavior and its interaction with transfer progress.
   - Exercise stale drafts, retries, reconnects, and duplicate tabs.
   - Verify that concurrent requests cannot create conflicting progress transitions or expose another learner’s data.
   - Test authorization attacks against checklist, question, draft, grading, and recovery operations.
   - Verify that local name or role selection cannot act as trusted authorization.
   - Add golden fixtures for relevant state transitions and failure cases.
   - Run full authorization and persistence integration suites.
   - Record all rejected requests, conflict handling, retry outcomes, and privacy evidence before proceeding.

7. **Complete Slice 5: evaluate AI behavior and verify the release path.**
   - Add the transfer-specific Promptfoo evaluation.
   - Compare the configured AI behavior against the required transfer-assessment criteria.
   - Preserve evaluation inputs, outputs, configuration, metadata, and result interpretation.
   - Run the production-path verification using the required server-side provider configuration.
   - Stop and report a blocker if live credentials or provider configuration are unavailable.
   - Add the dedicated transfer browser acceptance scenarios; do not reuse the existing seven-room legacy browser run as evidence.
   - Verify the complete learner flow in a browser, including initialization, question delivery, answer grading, wrong-answer repair, recovery, and relevant privacy/authorization behavior.
   - Record browser artifacts, environment details, feature-flag state, and any limitations.

8. **Close the implementation and release gates.**
   - Confirm the v3 schema artifact exists and matches the migration and runtime expectations.
   - Confirm deterministic/unit, integration/database, authorization, Promptfoo, production-path, and browser/release artifacts are all present.
   - Confirm every implementable W0-W11 milestone is either completed with evidence or explicitly blocked by a named external dependency.
   - Confirm no partial pass is represented as release acceptance.
   - Produce the final report covering migration status, authentication and key protection, tests, evaluation runs, browser evidence, feature-flag state, rollback path, and remaining gaps.
   - Compare the completed evidence against the section 19 definition of done.
   - Keep the feature disabled if any required gate is incomplete.
   - Enable the feature only after every release gate passes, and record the activation evidence and rollback procedure.

## Risks and Mitigations

- **Cross-slice duplication or inconsistent state authority**
  - Keep identity, keys, idempotency, and progress transitions in server-authoritative services.
  - Review shared primitives after each slice and consolidate only when a concrete inconsistency is demonstrated.

- **Intent drift during plan reorganization**
  - Preserve the original handoff and hash it.
  - Require three independent reviewers and targeted correction before implementation.

- **Legacy behavior being mistaken for transfer evidence**
  - Keep legacy tutor/Guard browser results separate.
  - Require dedicated transfer browser scenarios and transfer-specific evidence.

- **Untrusted local identity being used for authorization**
  - Require a verified server-side principal for every transfer-assessment operation.
  - Add explicit authorization tests for forged, missing, or mismatched principals.

- **Duplicate requests or concurrent tabs corrupting progress**
  - Make all mutations idempotent.
  - Test retries, reconnects, stale drafts, duplicate tabs, and conflicting transitions in the concurrency slice.

- **Privacy leakage across learners**
  - Enforce ownership and access checks server-side.
  - Include cross-learner access attempts in authorization and browser verification.

- **Unavailable Docker or hosted dependencies**
  - Use the available hosted or integration path without Docker.
  - Mark missing credentials, hosted access, or provider configuration as blockers instead of substituting local-only evidence.

- **Unprotected provider keys or incorrect production routing**
  - Keep provider configuration server-side.
  - Verify the Edge Function or equivalent production facade separately from client behavior.

- **Incomplete AI evaluation**
  - Use transfer-specific Promptfoo inputs and preserve result metadata.
  - Do not claim live-model acceptance when the required provider configuration is unavailable.

- **Premature release activation**
  - Keep the feature flag disabled through all slices.
  - Require the section 19 definition-of-done check, final evidence report, and documented rollback path before activation.

## Validation Criteria

- The original handoff is still present, unchanged, and its SHA-256 is recorded.
- `final_plan.md` indexes the decomposed package and states implementation status, gate rules, and feature-flag conditions.
- The milestone ledger covers W0-W11, every required test and evaluation artifact, release activation, and rollback.
- The three-reviewer intent-drift audit passes, or every material correction is recorded before implementation continues.
- Slice 1 proves verified learner ownership, checklist initialization, eligible-signal persistence, authorization, privacy, and idempotency.
- Slice 2 proves preparation, review, editing, confirmation, and delivery of one public four-option question through the required response contract.
- Slice 3 proves deterministic correct and wrong grading, repair behavior, new-context recovery, persistence, and duplicate-submission handling.
- Slice 4 proves Guard deferral, stale-draft handling, retries, reconnects, duplicate-tab behavior, privacy enforcement, and authorization attack resistance.
- Slice 5 includes transfer-specific Promptfoo results, production-path evidence, and dedicated transfer browser acceptance.
- Deterministic/unit, integration/database, authorization, golden-fixture, Promptfoo, production-path, and browser/release evidence are all recorded with commands, outputs, or environment metadata.
- Every milestone is marked completed with evidence or blocked with the exact missing external dependency.
- No legacy checklist data is represented as transfer verification.
- No hosted database, live model, or browser acceptance claim is made without recorded evidence.
- The feature flag remains disabled until the section 19 definition of done passes.
- The final report names migration status, authentication and key protection, test results, evaluation results, browser evidence, feature-flag state, rollback path, and remaining gaps.
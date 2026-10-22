## Assigned Approach

**Traceability First**

- Core strategy: build a requirement-to-file-to-test traceability graph before implementation.
- Primary optimization target: prevent intent drift and make progress auditable.
- Decomposition boundary: one file per authority boundary and one gate ledger.
- Sequencing principle: source comparison, then artifacts, then code, then verification.
- Main tradeoff: slower initial setup.
- Major risk: documentation can become stale unless milestones require evidence links.

The sequence is binding: establish the original baseline, decompose and audit the plan, create the evidence controls, implement only mapped gaps, run verification, and activate the feature only after all release gates pass.

## Assumptions

- `plan/transfer_assessment_implementation_plan.md` is the sole normative source for the exact U01-U15 decisions, D01-D16 defaults, non-goals, ownership boundaries, state transitions, privacy rules, migration requirements, evaluation requirements, browser scenarios, rollback rules, and §19 definition of done.
- The original handoff will remain unchanged. The reorganized package may quote or reference it but must not replace it.
- Existing transfer code is treated as present but unverified. Code presence alone does not satisfy a milestone.
- Exact source-file paths for existing transfer types, reducer, parser, grader, rendering, response-contract support, Edge Function facade, draft editor, and migrations will be recorded during inventory rather than guessed.
- The user-executed Supabase migration is treated as an external fact to verify. No destructive reset, Docker-based database test, or production migration push is assumed to be available.
- Legacy simplified local identity remains usable for legacy behavior but is never treated as a trusted transfer-assessment principal.
- Live transfer assessment requires a real verified principal and server-side provider configuration. Missing credentials or an unanswered product decision blocks the relevant milestone.
- The feature flag remains disabled until the complete §19 release gate passes.
- Evidence records use synthetic or appropriately redacted data and include the command, commit, environment, timestamp, inputs, outputs, and relevant configuration metadata.

## Major Decisions

- Use `plan/transfer_assessment_implementation_plan/milestone_ledger.md` as the single status ledger. `verification_gates.md` defines gate requirements and evidence expectations but does not maintain a second status system.
- Preserve the original handoff and record its SHA-256 in `source_baseline.md` before changing any reorganized-plan artifact.
- Create one non-overlapping work-package file per authority boundary:
  - `work_packages/requirements_and_traceability.md`
  - `work_packages/plan_and_audit.md`
  - `work_packages/transfer_runtime.md`
  - `work_packages/persistence_and_schema.md`
  - `work_packages/authorization_and_provider.md`
  - `work_packages/evaluation.md`
  - `work_packages/browser_and_release.md`
- Create `traceability_graph.md` with one authoritative row or edge set for every U01-U15 item, D01-D16 default, non-goal, boundary, transition, privacy rule, migration requirement, evaluation requirement, browser scenario, rollback rule, and final-report requirement. Each entry maps to its work package, owned source files, tests, evidence artifact, and milestone status.
- Make `final_plan.md` a concise index. It must link every decomposed plan and gate artifact, state the known present/missing/blocked status, and state that implementation and release activation are gated by the audit and §19 evidence.
- Copy requirement wording and defaults from the original handoff into the appropriate work package or traceability entry. Do not paraphrase in a way that could change meaning, and do not duplicate authoritative text across work-package files.
- Treat the three-reviewer intent-drift audit as a hard implementation gate. Any material disagreement or missing requirement must be corrected and re-reviewed before code work proceeds.
- Implement from the traceability graph. Existing modules are changed only when a mapped requirement or verification failure identifies a gap.
- Separate deterministic, integration/database, authorization, Promptfoo, production-path, and browser/release evidence. Evidence from the existing seven-room legacy browser run cannot satisfy transfer-assessment acceptance.
- Enforce authorization at the server boundary using a verified principal and server-side provider configuration. No client-side identity choice or provider secret may authorize or execute live transfer assessment.
- Use explicit status values such as `not_started`, `in_progress`, `passed`, and `blocked`. A partial implementation or unavailable dependency is not recorded as `passed`.
- Keep the feature disabled on any failed or blocked gate, and document the exact rollback path before activation.

## Ordered Implementation Steps

1. **W0: Establish the immutable source baseline**

   - **Source requirement:** Source-of-truth rules and acceptance criterion 1; Traceability First sequencing.
   - **Owned files:** `source_baseline.md`; original `plan/transfer_assessment_implementation_plan.md` as a read-only comparison source.
   - **Tests/checks:** Calculate and record the original handoff SHA-256; verify the source file remains unchanged after plan reorganization.
   - **Evidence artifact:** `evidence/W0-source-baseline.md` containing the absolute source path, SHA-256, timestamp, repository commit, and comparison result.

2. **W1: Build the navigable plan package and traceability graph**

   - **Source requirement:** In-scope reorganization requirements, acceptance criteria 2 and 3, and the selected approach’s decomposition boundary.
   - **Owned files:** `request.md`, `final_plan.md`, all seven `work_packages/*.md` files, `traceability_graph.md`, `milestone_ledger.md`, and `verification_gates.md`.
   - **Tests/checks:** Confirm every required category is represented exactly once in the traceability graph; verify every work package has a clear authority boundary; verify every milestone has a source requirement, owned files, tests, and evidence artifact; verify no placeholder status is presented as completion.
   - **Evidence artifact:** `evidence/W1-plan-package-check.md` with the package inventory, requirement-count check, ownership map, and initial status derived from the known repository state.

3. **W2: Run the independent intent-drift audit**

   - **Source requirement:** Acceptance criterion 4 and the requirement to preserve all U01-U15, D01-D16, non-goals, boundaries, transitions, privacy rules, migrations, evaluations, browser scenarios, rollback rules, and final-report requirements.
   - **Owned files:** Three independent audit reports under `audits/intent_drift_reviewer_1.md`, `audits/intent_drift_reviewer_2.md`, and `audits/intent_drift_reviewer_3.md`.
   - **Tests/checks:** Each reviewer independently compares the decomposed package against the original handoff. Review coverage must include exact decisions/defaults, exclusions, ownership, state behavior, privacy, migration, evaluation, browser, rollback, and final-report requirements.
   - **Evidence artifact:** `evidence/W2-intent-drift-audit.md` linking all three reviews and recording each finding, disagreement, missing mapping, or explicit no-drift conclusion.

4. **W3: Resolve audit findings and authorize implementation**

   - **Source requirement:** Acceptance criteria 4 and 5, the constraint to stop for unresolved decisions or dependencies, and the selected approach’s stale-documentation risk.
   - **Owned files:** Corrected work-package files, `traceability_graph.md`, `final_plan.md`, `verification_gates.md`, and `milestone_ledger.md`.
   - **Tests/checks:** Apply targeted follow-up review for every material audit finding; confirm each correction maps back to the original handoff; confirm all implementable milestones have an owner, source requirement, test, and evidence destination; confirm the feature flag is still disabled.
   - **Evidence artifact:** `evidence/W3-plan-reorganization-gate.md` marked `passed` only after all material findings converge, or `blocked` with the exact unresolved issue and required external decision.

5. **W4: Complete deterministic domain verification and golden fixtures**

   - **Source requirement:** The exact U01-U15 and D01-D16 mappings for transfer behavior, state transitions, grading, parsing, rendering, response contracts, privacy, and non-goals; known missing deterministic/unit and golden-fixture evidence.
   - **Owned files:** Existing transfer type, reducer, parser, grader, rendering, response-contract, and draft-editor files mapped in `traceability_graph.md`; nearest existing test directories; transfer golden fixtures and their manifest.
   - **Tests/checks:** Add or complete deterministic tests for valid, empty, malformed, boundary, and unexpected inputs; every reducer transition and terminal state; grading boundaries; rendering states; response-contract failures; privacy-sensitive fields; and repeated-run determinism. Reuse present implementation where it already passes the mapped requirements.
   - **Evidence artifact:** `evidence/W4-deterministic-suite/` containing test output, fixture manifest, hashes, coverage information, and representative input-output pairs.

6. **W5: Verify schema, migration, and persistence behavior**

   - **Source requirement:** Migration requirements, privacy rules, state persistence requirements, acceptance criterion 5, and the missing v3 schema and persistence-integration evidence.
   - **Owned files:** Existing mapped Supabase migration files, the v3 schema artifact, persistence-related transfer code, and database/integration tests.
   - **Tests/checks:** Verify the v3 schema artifact matches the migration and application contract; verify the user-executed hosted migration status without pushing a new production migration; exercise non-destructive create, read, update, resume, submit, and isolation paths against the available hosted environment; explicitly record the Docker limitation rather than substituting an unclaimed local database result.
   - **Evidence artifact:** `evidence/W5-persistence/` containing the schema comparison, migration-status evidence, database test output, RLS/persistence results, environment metadata, and any external-dependency block.

7. **W6: Enforce verified-principal authorization and provider key protection**

   - **Source requirement:** Security constraints, the non-goal of adding a sign-in product, the rule that local identity selection is not trusted authorization, and the requirement for server-side provider configuration.
   - **Owned files:** Edge Function facade, authorization/RLS integration points, server-side provider configuration, related client call sites, and authorization tests identified in the graph.
   - **Tests/checks:** Verify positive access for a real verified principal; reject missing, unverified, malformed, or mismatched principals; reject cross-user or cross-resource access; verify local name/role selection cannot grant transfer access; verify provider keys are absent from client bundles, responses, and logs; verify server-side configuration failure is explicit.
   - **Evidence artifact:** `evidence/W6-authorization/` containing authorization integration results, redacted request/response logs, key-exposure checks, principal/configuration metadata, and a blocked status when required credentials are unavailable.

8. **W7: Complete the application production path**

   - **Source requirement:** Mapped U01-U15/D01-D16 behavior, ownership boundaries, state transitions, privacy rules, and the known partial state of the transfer runtime and draft editor.
   - **Owned files:** The mapped page, context, hook, service, component, Edge Function, draft-editor, and transfer-domain files; corresponding integration tests.
   - **Tests/checks:** Exercise the complete transfer lifecycle through the application boundary: authorized entry, loading, draft creation/editing, persistence, resume, submission, grading, response rendering, terminal states, error handling, and privacy-preserving display. Verify legacy tutor/Guard behavior remains outside the transfer authorization path.
   - **Evidence artifact:** `evidence/W7-application-integration/` containing integrated test output, state-transition coverage, contract results, and links to the exact source files changed.

9. **W8: Add and run transfer-specific Promptfoo evaluation**

   - **Source requirement:** Evaluation requirements, response-contract requirements, grading expectations, and the requirement that live model/provider configuration be server-side.
   - **Owned files:** The Promptfoo configuration, transfer evaluation prompts/dataset, expected-output or assertion definitions, and evaluation documentation mapped in the graph.
   - **Tests/checks:** Run transfer-specific cases, including contract-valid responses, malformed responses, ambiguous or adversarial inputs, grading boundaries, and required failure behavior. Pin or record prompt, dataset, configuration, model/provider, version, seed, and environment. Preserve complete input-output pairs and raw results.
   - **Evidence artifact:** `evidence/W8-promptfoo/<run-id>/` containing configuration hashes, dataset hashes, model/provider metadata, raw evaluation results, aggregate scores, failures, and the exact threshold comparison from the original handoff. Missing live credentials produce `blocked`, not a substitute pass.

10. **W9: Verify the hosted production path**

    - **Source requirement:** Real verified principal, server-side provider configuration, key protection, hosted-check allowance, no Docker requirement, and no claim of live acceptance without evidence.
    - **Owned files:** Deployment/configuration changes for the Edge Function facade and production-path verification artifacts; no production migration push.
    - **Tests/checks:** Execute a non-destructive hosted request through the actual production-shaped path using approved server configuration and a verified principal; confirm authorization, persistence, provider invocation, response-contract handling, error propagation, and absence of secrets from client-visible output.
    - **Evidence artifact:** `evidence/W9-production-path/` containing endpoint/environment identifiers, request IDs, redacted logs, migration status reference, provider configuration source without secrets, and all observed failures. If the hosted dependency is unavailable, record the exact block.

11. **W10: Run dedicated transfer browser acceptance and release checks**

    - **Source requirement:** Transfer-specific browser scenarios, release gates, feature-flag rules, rollback rules, and the explicit exclusion of the existing seven-room legacy browser run as transfer evidence.
    - **Owned files:** Dedicated transfer browser scenarios, browser/release test configuration, `evidence/W10-browser-release/`, and the release checklist.
    - **Tests/checks:** Run every transfer browser scenario against the production-shaped path with a verified principal; cover the required navigation, draft, persistence, resume, submit, grading, rendering, error, privacy, and authorization behavior from the original handoff. Record the test environment, browser/runtime version, commit, feature-flag state, screenshots or traces, console/network results, and cleanup status.
    - **Evidence artifact:** `evidence/W10-browser-release/` with scenario-by-scenario results. The legacy seven-room run is linked only as legacy evidence and cannot satisfy these checks.

12. **W11: Apply the definition of done, publish the report, and decide activation**

    - **Source requirement:** Acceptance criteria 5 and 6, the original handoff’s §19 definition of done, required final evidence, and rollback rules.
    - **Owned files:** `milestone_ledger.md`, `final_plan.md`, `final_report.md`, and the release/rollback record.
    - **Tests/checks:** Verify every W0-W11 milestone and every required deterministic/unit, integration/database, authorization, Promptfoo, production-path, and browser/release artifact is linked and marked `passed` or `blocked`; verify the original SHA-256; verify no partial pass is represented as release acceptance; verify the rollback path is documented and tested or explicitly blocked.
    - **Evidence artifact:** `final_report.md` naming migration status, authorization and key protection, test results, evaluation runs, browser evidence, feature-flag state, rollback path, and remaining gaps. Enable the feature only if every §19 gate passes. Otherwise leave it disabled and record the exact blocker.

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Decomposition changes the product intent | Preserve the original handoff, record its SHA-256, copy exact requirement text, and require three independent drift reviews before implementation. |
| Work-package documentation becomes stale | Make every milestone update the traceability graph and milestone ledger with command-linked evidence; do not mark completion from code presence. |
| Existing implementation is mistaken for completed work | Inventory each present module, map it to requirements, and require deterministic or integration evidence for every claimed behavior. |
| Local identity is treated as authorization | Enforce verified-principal checks at the server boundary and include negative authorization tests for forged, missing, and cross-resource identities. |
| Provider secrets reach the browser or logs | Keep provider configuration server-side, inspect client artifacts and responses, redact evidence, and fail the gate on exposure. |
| Hosted Supabase or live model access is unavailable | Record the exact external dependency and mark the milestone `blocked`; do not replace it with Docker, pattern matching, or an unrecorded substitute. |
| Migration/schema drift | Produce the v3 schema artifact, compare it with the migration and runtime contract, and record hosted migration status without pushing a production migration. |
| Legacy browser evidence is reused incorrectly | Maintain a separate transfer browser suite and evidence directory; explicitly exclude the seven-room legacy run from transfer acceptance. |
| Non-deterministic evaluation results obscure regressions | Pin and hash prompts, datasets, configurations, and fixtures; preserve raw input-output pairs and record model/provider metadata for every run. |
| Partial gates lead to premature release | Use explicit `passed`/`blocked` statuses, require all §19 evidence, and keep the feature flag disabled until the final release check passes. |
| An unanswered product decision is silently invented | Stop at the affected milestone, record the exact question and impact in the ledger, and request the user’s decision. |
| Reorganization accidentally rewrites the baseline or unrelated work | Treat the original handoff as read-only and limit changes to the transfer plan package and mapped implementation files. |

## Validation Criteria

- The original handoff exists unchanged, and its recorded SHA-256 matches the comparison evidence.
- `final_plan.md` indexes every decomposed plan, the traceability graph, the milestone ledger, the verification gates, all audit reports, the evidence directories, and the final report.
- The traceability graph covers U01-U15, D01-D16, non-goals, ownership boundaries, state transitions, privacy rules, migration requirements, evaluation requirements, browser scenarios, rollback rules, and final-report requirements without unowned or unmapped entries.
- Each W0-W11 milestone names its source requirement, owned files, tests or checks, and evidence artifact.
- Three independent intent-drift reviews are present. Every material finding is corrected and re-reviewed, or implementation is stopped with the unresolved finding recorded.
- Deterministic/unit tests and golden fixtures cover both success and edge/failure behavior for the transfer domain, state machine, parser, grader, renderer, draft editor, and response contract.
- Persistence and database evidence verifies the v3 schema, migration status, privacy behavior, isolation, and required lifecycle operations in an available hosted environment.
- Authorization evidence proves that only a real verified principal can use transfer assessment and that local identity selection cannot authorize access.
- Provider configuration and keys remain server-side, and client artifacts, responses, and logs contain no secrets.
- Transfer-specific Promptfoo evidence includes complete run metadata, raw results, input-output pairs, and the original handoff’s threshold comparison.
- Production-path evidence demonstrates the hosted Edge Function flow, persistence, provider invocation, authorization, response handling, and explicit failure behavior.
- Dedicated transfer browser evidence covers every required scenario and clearly separates itself from the legacy seven-room run.
- The final report names all required evidence, the migration and auth/key status, feature-flag state, rollback path, and remaining gaps.
- The feature flag is enabled only when every §19 definition-of-done item is evidenced as `passed`; otherwise the final state is `blocked` or `not_started` with the flag disabled.
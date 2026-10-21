# Independent judgement 04

Intent: rank the four implementation plans against the approved request, using only the supplied request, candidates, and diversity check. Scores assess prospective plans, not verified implementation results.

## Full Ranking

1. plan_1.md
2. plan_2.md
3. plan_3.md
4. plan_4.md

## Rubric Scores

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plan_1.md | 5 | 4 | 5 | 5 | 4 | 5 | 28 |
| plan_2.md | 5 | 4 | 4 | 5 | 4 | 5 | 27 |
| plan_3.md | 5 | 4 | 3 | 5 | 4 | 5 | 26 |
| plan_4.md | 5 | 3 | 3 | 5 | 4 | 5 | 25 |

## Ranking Reasons

1. **plan_1.md:** The best match to the request's simplicity constraint. Major Decision 6 retains the established workflow, while Steps 3–5 explicitly address server authorization, atomic approval, authoritative subject routing, and consistent stored character identity. Step 4 names the existing checklist, legacy analyzer, readiness, and transfer-candidate integration points highlighted in request E3; its generation branch also precedes the phishing policy assembly implicated in E6. Steps 7–8 separate initial staging acceptance from exact integrated staging and production acceptance. Inference: this limits the change surface while covering the required behavior more directly than introducing another orchestration boundary. Its weakness is accumulated branching inside a controller already carrying implicit phishing behavior.
2. **plan_2.md:** Strong policy separation and the most explicit preparation for extracting existing behavior: Step 1 characterizes ordinary and transfer paths, and Step 2 verifies the phishing adapter before adding Cyberbullying. Major Decision 3 also acknowledges frontend/Edge contract parity instead of assuming one shared module can cross build boundaries. Step 4 supplies an existing-member progress repair path and an explicit response to history-size limits. It ranks below plan 1 because extraction of phishing generation and analysis policies is an additional change to preserved behavior; the request establishes coupling but does not establish that a typed adapter is necessary to resolve it.
3. **plan_3.md:** The dedicated controller directly addresses E3/E6's orchestration coupling and has a particularly clear R1–R12 acceptance table. Steps 3–5 preserve shared server contracts, projections, learner progress, and stored ratings. Step 4 explicitly preserves saved learner messages on downstream failure and rejects delayed results. Inference: isolating the new sequence is useful, but extracting shared UI primitives and maintaining two orchestration paths adds lifecycle divergence risk. The plan acknowledges that tradeoff; the supplied evidence does not yet show that the existing primitives can be reused without substantial extraction.
4. **plan_4.md:** Strongest concentration of authority: Major Decisions 1 and 4 specify authenticated operations and persisted proposal ownership, revision, provenance, and status. Steps 2–4 include direct-call security, atomic approval, retries, and explicit context-size failures. It still meets the requested functional and release coverage. It ranks last because the new `practice-turn` API owns nearly the entire operation sequence and introduces a wider backend integration surface. Inference: concentrating these responsibilities adds implementation and release work beyond extending existing guarded handlers and the existing approval RPC; the request does not establish that this consolidation is required.

The diversity check corroborates genuinely different ownership boundaries. It is supporting evidence for comparing alternatives, not evidence that any particular boundary is correct.

## Risks and Tradeoffs

- **Plan 1:** Minimal structural work leaves multiple entry points requiring coordinated dispatch. Its operation-to-handler inventory and request-contract tests are essential for catching regeneration or analyzer paths that still construct phishing policy. Its full-history requirement would benefit from a defined size-limit failure outcome.
- **Plan 2:** Policy isolation costs a phishing refactor before the new feature can proceed. Its characterization gate mitigates this, but the adapter interface must remain limited to demonstrated differences. The proposed target-key spellings differ from plans 1 and 4; each is individually consistent with the request, which does not prescribe literal keys.
- **Plan 3:** Separate controllers can drift in retry, review, and rating behavior even when database contracts are shared. Shared projections and common contract fixtures mitigate presentation drift, but do not alone prove equivalent lifecycle behavior. Its Step 6 browser execution is explicitly deferred until Step 7 staging deployment; implementation should preserve that order.
- **Plan 4:** Persisted proposals improve server enforcement but add schema and operation lifecycle obligations. The proposal uniqueness and revision semantics need to remain integrated with `send_reviewed_tutor_response`, not develop into a competing publication transaction. Its thin-client transition also needs regression evidence for shared phishing operations.
- **All plans:** Live schema drift, historical Riley conversion, Guard replay semantics, and upstream asset fidelity remain investigation gates. All correctly require direct live inspection and production acceptance. None of their planned checks is current verification evidence.

## Recommended Backbone

Use **plan_1.md Steps 1–8**. Preserve its existing-controller approach, coordinated migration, and separate initial-staging/integrated-release gates. Make the Step 1 operation-to-handler table the bounded decision gate: each supported operation must identify its authoritative room lookup, permission check, prompt/config path, persistence boundary, and test. Introduce a helper only where that inventory demonstrates a concrete duplicated policy or unsafe coupling.

Before implementation, sharpen three existing contracts rather than add another architecture: full-history overflow behavior, idempotent initialization for existing eligible members, and rejection of delayed generation results after a draft/context revision changes.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in the recommended backbone |
| --- | --- | --- |
| plan_2.md, Step 1 | Characterization fixtures explicitly cover ordinary and transfer generation, Guard, approval, and quick-adjust persistence before moving shared behavior. | plan_1.md Step 1, following its operation-to-handler inventory; carry the fixtures into Step 6 regression acceptance. |
| plan_2.md, Step 4 | Explicit context-size failure preserves the full-history contract when transport bounds are exceeded. | plan_1.md Step 4, immediately after assembling saved attributed history; add the failure case to that step's integration evidence. |
| plan_2.md, Step 4 | Existing-member repair plus concurrent initialization tests closes the enrollment-only progress initialization gap. | plan_1.md Step 4, immediately after idempotent target initialization; place necessary database uniqueness in Step 3. |
| plan_3.md, Step 4 | Saved learner messages survive analysis/generation failure, and delayed generation cannot replace a current proposal. | plan_1.md Step 4 failure handling and Step 5 versioned review acceptance. |
| plan_4.md, Major Decision 4 and Step 3 | Server-checked proposal owner, revision, status, and context linkage make unpublished/stale/rejected proposal protections concrete. | plan_1.md Step 2 proposal contract and Step 3 atomic approval validation, reusing existing storage where sufficient. |
| plan_3.md, Validation Criteria | A separate acceptance row for every R ID makes missing evidence easier to identify than grouped criteria. | Replace plan_1.md's grouped final validation bullets with an R1–R12 evidence table linked to its existing steps. |

## Incompatibilities

- The four orchestration boundaries are alternatives. Combining the inline controller, mandatory adapter extraction, separate Cyberbullying controller, and all-operation server API would expand rather than simplify the implementation. Reuse the specific safeguards above without importing their host architecture.
- Plan 2's target keys and plans 1/4's keys are alternative spellings for the same five definitions. Select one canonical set before migration, fixtures, and prompt contracts are written; do not combine them into additional targets.
- Plan 4's server-owned proposal design cannot be layered mechanically over client draft lifecycle. Resolve which existing stored fields and checks satisfy the contract first, then add only missing authoritative state.
- Plan 3's dedicated room route assumes component/controller separation, while plan 1 retains shared room orchestration. Its failure and attribution checks are reusable; its new room container is not a drop-in addition to the recommended backbone.

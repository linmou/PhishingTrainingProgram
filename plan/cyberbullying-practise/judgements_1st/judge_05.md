# Independent judgement 05

Intent: rank the four proposed execution plans against the supplied request. This assessment uses only the request, candidates, and diversity check; implementation feasibility remains an inference from those inputs.

## Full Ranking

1. plan_1.md
2. plan_2.md
3. plan_3.md
4. plan_4.md

## Rubric Scores

Scores use 1 (weak) through 5 (strong). Totals are unweighted sums.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plan_1.md | 5 | 5 | 5 | 5 | 4 | 5 | 29 |
| plan_2.md | 5 | 4 | 4 | 5 | 5 | 5 | 28 |
| plan_3.md | 5 | 4 | 3 | 5 | 4 | 5 | 26 |
| plan_4.md | 5 | 3 | 2 | 5 | 5 | 5 | 25 |

## Ranking Reasons

1. **plan_1.md:** Best match for the request's small-module, simple-architecture constraint. Steps 1–3 establish live contracts, pinned content, and one proven migration before extending existing orchestration. Step 4 identifies the actual checklist, fallback, readiness, and transfer-candidate coupling from E3, while Steps 4–5 explicitly route generation and regeneration before phishing policy assembly from E6/E10. Its eight steps carry dependencies, deliverables, and acceptance evidence through integrated staging and production. Inference: retaining existing boundaries has the smallest implementation surface, provided every identified entry point is tested.
2. **plan_2.md:** Strongest alternative if investigation shows repeated subject branches would be difficult to contain. Step 2 characterizes and extracts phishing policy before adding Cyberbullying; the two-case adapter and separate server authority are explicit. Step 4 improves treatment of history size and existing-member progress initialization. It ranks below plan 1 because extracting working phishing behavior is a prerequisite for the feature, introducing extra regression work without evidence that a shared adapter is necessary yet.
3. **plan_3.md:** Provides clear separation from the implicit phishing hooks and a useful explicit controller sequence. Step 4 preserves saved comments after analysis/generation failures and rejects delayed stale results. It shares projections and persistence and covers every requirement in its validation matrix. However, it proposes a new container/controller and extraction of component props from RoomContext; inference: this duplicates workflow coordination and increases the chance that approval, Guard, or reconnect behavior diverges even when storage remains shared.
4. **plan_4.md:** Most explicit trusted context and proposal ownership design. Steps 2–4 specify authorization, revisions, unpublished proposal status, transaction boundaries, and server-loaded history. Those are valuable responses to R6–R9 and E9. It ranks last because a new practice-turn operation API covering the entire conversation lifecycle is the widest architectural addition. The supplied evidence establishes the need for authoritative server checks, but does not establish that comment saving, ratings, continuation, and shared operation dispatch require a new orchestration endpoint. Inference: this increases backend integration and deployment work compared with targeted extensions to existing handlers.

The diversity check supports that the candidates use different ownership boundaries. It does not establish which boundary is simplest or most feasible; those judgements above follow the request and each candidate's proposed changes.

## Risks and Tradeoffs

- **Plan 1:** Lowest structural change, but branches in the already coupled controller can miss regeneration or legacy entry points. Its operation-to-handler inventory mitigates this; a concrete negative-path test per entry point should be required before accepting routing coverage.
- **Plan 2:** Better policy isolation at the cost of first refactoring both legacy and transfer phishing paths. Frontend/Edge parity is explicitly tested, but maintaining the adapter boundary remains additional work.
- **Plan 3:** Strong workflow isolation, with ongoing risk of two controllers implementing slightly different recovery, Guard, and review timing. Shared persisted projections address identity drift more directly than orchestration drift.
- **Plan 4:** Strong authority and provenance, with a larger API and persisted proposal lifecycle to integrate. Its narrow-reuse intention reduces scope, but the exact amount of phishing dispatch moved behind the new API needs resolution before implementation.

All candidates correctly defer unknown live-schema, historical-conversion, and model-fidelity facts to inspection and acceptance gates. Their migration and release instructions are prospective evidence requirements, not demonstrated success. No candidate has a decisive stated functional omission; ranking primarily reflects architectural cost and exposure to regressions.

## Recommended Backbone

Use **plan_1.md**, retaining its inventory → contracts → migration → shared-controller slice → presentation → cleanup → staging → integrated production sequence. Treat its operation-to-handler table as a release-blocking coverage ledger: each supported operation must identify authoritative server validation, client entry points, failure behavior, and deterministic evidence. Reconsider the boundary only if Step 1 discovers specific shared-controller coupling that cannot be isolated with small helpers.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in recommended backbone |
| --- | --- | --- |
| plan_2.md, Step 4 | Explicitly measures transport bounds and surfaces context-size failures, protecting R5's full saved history from accidental truncation. | Plan 1 Step 4, immediately after full-history construction; add an oversized-history failure fixture to its acceptance evidence. |
| plan_2.md, Step 4 | Initializes targets concurrently/idempotently and includes a repair path for existing members encountered during rollout. | Plan 1 Step 3 progress initialization contract and Step 4 join/reload tests. |
| plan_3.md, Step 4 | Preserves the learner's saved comment when subsequent analysis/generation fails and blocks delayed generation results from replacing newer proposals. | Plan 1 Step 4 failure recovery and Step 5 proposal-version integration tests. |
| plan_4.md, Major Decision 4 and Step 3 | Makes proposal owner, revision, generation status, context linkage, and terminal review outcomes explicit, with typed conflict/failure results. | Plan 1 Step 2 draft contract and Step 3 approval checks, reusing existing fields first as plan 1 requires. |
| plan_2.md, Step 1 | Characterizes both ordinary and transfer phishing paths before changing their policy integration. | Plan 1 Step 1 baseline manifest and Step 6 regression suite selection. |

## Incompatibilities

- Plan 2's mandatory extraction-first adapter sequence should not be combined wholesale with plan 1's inline dispatcher. Choose one policy ownership boundary; use its characterization tests independently.
- Plan 3's dedicated controller conflicts with retaining all conversation orchestration in RoomContext. Borrow its recovery requirements without introducing a second controller into the chosen backbone.
- Plan 4's server-owned lifecycle conflicts with plan 1's existing client orchestration if both coordinate the same operation. Reuse its proposal and authorization contracts at existing server boundaries rather than installing competing workflow owners.
- Plan 2 spells several target keys differently from plans 1 and 4; plan 3 leaves exact spelling to definition work. The request fixes shared meanings and stability, not those spellings. Select one canonical five-key set before SQL, fixtures, and exports are written; do not combine competing key sets.

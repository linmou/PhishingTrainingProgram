# Independent judgement 01

Intent: rank the four execution candidates against the approved request, using only the request, candidates, and supporting diversity check. Date: 2026-10-21. Scores assess prospective plans, not implementation results.

## Full Ranking

1. plan_1.md
2. plan_2.md
3. plan_3.md
4. plan_4.md

## Rubric Scores

Scores use 1 (weak) through 5 (strong). Total is the sum of the six criteria.

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plan_1.md | 5 | 5 | 5 | 5 | 4 | 4 | 28 |
| plan_2.md | 5 | 4 | 3 | 5 | 5 | 5 | 27 |
| plan_3.md | 5 | 4 | 3 | 5 | 4 | 5 | 26 |
| plan_4.md | 5 | 3 | 2 | 5 | 5 | 5 | 25 |

## Ranking Reasons

1. **plan_1.md** gives the strongest fit to the request's simple architecture and reuse requirements. Steps 1–3 establish live evidence, contracts, and one coordinated migration; steps 4–5 identify the actual integration points implicated by E3, E6, E9, and E10. The entry-point inventory and explicit branches address generation, regeneration, analysis, approval, and direct invocation rather than treating prompt replacement as sufficient. Steps 7–8 retain the complete staging, integrated staging, and production gates. Inference: retaining existing orchestration produces the smallest implementation surface among these candidates. Its main weakness is less explicit characterization before modifying the shared controller and less explicit context-limit handling than plan 2.
2. **plan_2.md** provides the strongest policy-isolation approach while preserving shared workflow ownership. Step 2 characterizes both phishing paths before extracting them, and steps 4–5 explicitly handle context-size failure, enrollment repair, delayed results, and proposal revisions. These are valuable protections for R4–R7. However, extracting existing phishing policy before Cyberbullying implementation introduces a prerequisite refactor across three coupled files. Inference: this adds regression and delivery work beyond the inline approach; the request demonstrates policy differences but does not yet establish that an adapter interface is necessary.
3. **plan_3.md** directly isolates the phishing hooks identified in E3/E6 with a dedicated room composition and concrete shared projection contracts. Step 4 explicitly preserves saved comments when downstream analysis or generation fails. Its requirement-to-evidence table is particularly easy to audit. However, its stated acceptance of limited orchestration duplication creates two places to maintain workflow sequencing. Inference: sharing chat/review primitives may require more extraction than the proposed controller boundary suggests because the plan itself calls out props coupled to RoomContext. This increases future drift risk for R7–R9 despite strong tests.
4. **plan_4.md** gives the clearest trusted operation boundary and durable unpublished-proposal lifecycle. Steps 2–4 strongly cover direct authorization, revision/idempotency, transaction rollback, and context provenance. It nonetheless adds a new Edge API for the complete supported operation set and routes server orchestration through it before client integration. E9 already establishes an atomic shared approval RPC and E6 a server transport; the request requires extending those guarantees but does not establish that a new general operation endpoint is needed. Inference: its larger backend and deployment surface makes it the costliest route to the same acceptance criteria.

All four candidates preserve the five targets, five role values, unknown Guard provenance, historical Riley content, shared approval, and exact-artifact release requirements at planning level. The diversity check supports their distinctness; it is not evidence that any implementation boundary is already validated.

## Risks and Tradeoffs

- **Inline branching:** plan 1 trades isolation for a small change surface. E3/E6 show several implicit phishing entry points, so the operation-to-handler table must become executable coverage before branch changes. A missed regeneration or legacy-analysis path would undermine R5/R6.
- **Adapter extraction:** plan 2 reduces policy mixing but moves working phishing behavior first. Its own characterization gate is essential, including ordinary and transfer paths and quick-adjust persistence. Frontend/Edge parity remains a separate concern even with the adapter.
- **Separate room composition:** plan 3 reduces exposure to phishing orchestration but accepts duplicated sequencing. Shared database/projection contracts do not alone guarantee identical retry, rejection, and rating behavior in two controllers; its identical fixtures across compositions should remain a release gate.
- **Server orchestration:** plan 4 concentrates authority but introduces another API contract and operation lifecycle. Its security advantages can largely inform existing handlers and RPCs without assuming that every operation must move behind a new endpoint.
- **Shared uncertainty:** all plans correctly gate conversion on direct live inspection and provider fidelity on real runs. Historical Riley shapes, stage/prod drift, and analyzer/replay suitability remain unresolved under A2/A5; none of these candidates supplies completed evidence. The native database baseline and complete journeys are substantial execution dependencies, not paperwork.

## Recommended Backbone

Use **plan_1.md** steps 1–8 as the execution backbone. Preserve its inventory-first sequencing, existing controller/service/RPC boundary, one migration, and separated staging/integration/production gates. Strengthen the controller modification gate with plan 2's characterization and context handling, and make unpublished draft lifecycle expectations explicit using plan 4's contract detail. These are bounded additions to the existing boundary; adopting a second orchestration architecture would undermine the simplicity advantage.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in recommended backbone |
| --- | --- | --- |
| plan_2.md, steps 1–2 | Characterize ordinary and transfer phishing paths, Guard, approval, target readiness, and quick-adjust persistence before changing shared orchestration. This makes preservation measurable before implementation. | plan_1.md step 1 deliverables, with passing characterization required before step 4. |
| plan_2.md, step 4 | Measure transport bounds and return explicit context-size failures while retaining full saved history; initialize progress with concurrent-enrollment coverage and repair for eligible existing members. | plan_1.md step 4 generation and initialization paragraphs and their acceptance tests. |
| plan_3.md, step 4 | Preserve a saved learner comment across analysis/generation failures and safely retry; prevent delayed generation results from replacing the current proposal. | plan_1.md step 4 end-to-end failure tests and step 5 versioned-review controls. |
| plan_4.md, major decision 4 and step 3 | Make unpublished proposal ownership, revision, context linkage, generation status, and terminal review state explicit, with consistent conflict/failure behavior. | plan_1.md step 2 proposal contracts and step 3 approval persistence checks, implemented through existing boundaries where sufficient. |
| plan_3.md, Validation Criteria | One row per R ID makes omissions easier to detect than grouped criteria. | Expand plan_1.md final Validation Criteria into an R1–R12 ledger linked to the existing step evidence. |

## Incompatibilities

- Plan 2's adapter-first extraction, plan 3's dedicated room controller, and plan 4's server-owned operation API are alternative ownership boundaries. Combining them wholesale with plan 1 would create multiple dispatch and orchestration layers without a demonstrated need.
- Plan 2 spells three target keys differently from plans 1 and 4; plan 3 leaves exact keys to definition work. R4 requires one canonical shared set. Select and record one set before fixtures, migration, and prompt contracts are authored; copied contributions must use that set consistently.
- Plan 3 explicitly regenerates using an edited character selection, while the request requires preserving role-selection strategies and proposal-local overrides. Inference: regeneration semantics need a bounded contract decision—when an edited character constrains the regeneration and when selection runs again—without carrying a proposal override into future responses.
- Plan 4's durable proposal model is useful contract detail, but its proposed new API and persistence design should not be imported automatically. Plan 1 step 2 first checks which existing fields can satisfy the contract, consistent with the request's reuse requirement.

# Independent judgement 03

Intent: rank the four proposed implementation plans against the approved request. This assessment uses only the request, the four candidates, and the supporting diversity check. Scores assess proposed work, not completed verification.

## Full Ranking

1. plan_1.md
2. plan_2.md
3. plan_3.md
4. plan_4.md

## Rubric Scores

| Plan | Requirement Fit | Feasibility | Simplicity | Assumption Discipline | Risk Handling | Validation Quality | Total |
| --- | --- | --- | --- | --- | --- | --- | --- |
| plan_1.md | 5 | 5 | 5 | 5 | 4 | 5 | 29 |
| plan_2.md | 5 | 4 | 4 | 5 | 5 | 5 | 28 |
| plan_3.md | 5 | 4 | 3 | 4 | 4 | 5 | 25 |
| plan_4.md | 5 | 3 | 2 | 4 | 5 | 5 | 24 |

## Ranking Reasons

**plan_1.md** best balances the complete requirement set with the request's simple architecture constraint. Steps 1–3 establish live contracts, scenario assets, conversion mappings, and database approval enforcement before modifying the existing workflow. Step 4 names the actual coupling points identified by E3/E6: checklist initialization, analyzer fallback, target readiness, transfer candidate preparation, and phishing prompt assembly. Steps 5–8 cover direct calls, consistent identity, cleanup, separate behavioral acceptance, and exact integrated delivery. Its minimum-change claim is credible as a proposed strategy because E9 already supplies the atomic approval foundation. Inference: extending these existing seams should require less implementation and release surface than the other candidates. Its principal weakness is future branch accumulation, rather than missing scope.

**plan_2.md** is a close second. Its fixed two-adapter boundary directly addresses repeated policy coupling in E3/E6/E10, and Step 2 requires phishing characterization before extraction. It is particularly explicit about frontend/Edge contract parity, current-context invalidation, context-size failure, concurrent progress initialization, and rollout repair for existing members. However, extracting phishing generation and policy construction before implementing Cyberbullying adds a substantial prerequisite. Inference: that refactor increases immediate regression exposure relative to plan 1; the request demonstrates coupling but does not establish that an adapter extraction is necessary to resolve it.

**plan_3.md** is complete and reasonably bounded, with strong identity and historical-rendering protections. Its dedicated controller avoids the specific phishing prerequisites in E3. The price is a second orchestration path and incremental extraction of shared UI props from existing RoomContext consumers. The plan itself acknowledges orchestration duplication and reused hooks retaining phishing assumptions. Inference: the amount of extraction needed to make those primitives independently usable is not yet established by supplied evidence, so feasibility and simplicity are weaker than the first two plans. The explicit R-by-R acceptance table is useful.

**plan_4.md** provides the strongest centralized authority and proposal lifecycle design: authenticated server context, persisted revisions, operation idempotency, and database-enforced publication. It nevertheless adds a new `practice-turn` API, client service, operation contracts, context loader, and server-owned proposal lifecycle. E9 supports extending existing persistence, while the request does not establish a need to move the entire Cyberbullying operation sequence behind a new endpoint. Inference: this is the largest new operational surface and has the highest integration burden. Its security and validation detail is valuable, but does not outweigh the simplicity cost for this request.

The diversity check supports that these are distinct ownership boundaries. It is not evidence that any boundary is implemented or validated, and it does not determine this ranking.

## Risks and Tradeoffs

- Plan 1 relies on an exhaustive entry-point inventory. A missed regeneration or fallback branch could retain phishing policy; its operation-to-handler table and request-contract tests should be mandatory gates.
- Plan 2 reduces policy scattering but first changes existing phishing code. Characterization must cover both legacy and transfer paths before accepting extraction parity.
- Plan 3 isolates workflow hooks but must prevent two controllers from diverging in retries, review state, and publication. Shared persisted contracts help, but do not establish shared orchestration correctness by themselves.
- Plan 4 concentrates trusted decisions but must prove existing endpoints and direct database paths enforce the same contracts. Adding an authenticated endpoint alone cannot establish that coverage; the plan correctly also calls for database-boundary tests.
- All four properly treat live drift, historical conversions, provider fidelity, and production verification as future gates. None supplies implementation evidence. All retain unknown Guard provenance and separate deterministic checks from behavioral acceptance.

## Recommended Backbone

Use plan_1.md's eight-step sequence and existing controller/service/RPC boundary. Preserve its live inventory, pinned contracts, single migration, complete vertical flow, and separate staging/integrated-production gates. Strengthen the existing entry-point and proposal contracts with the bounded contributions below. Reconsider the adapter boundary only if the first inventory demonstrates that explicit branches cannot keep subject policy coherent; that is a future evidence-based decision, not an assumed requirement.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in recommended backbone |
| --- | --- | --- |
| plan_2.md, Step 4 | Explicitly initialize existing eligible memberships during rollout and test concurrent initialization. This closes a concrete transition case beyond ordinary joins. | plan_1.md, Step 4, learner-progress initialization and its integration fixtures. |
| plan_2.md, Major Decision 3 and Step 4 | Test frontend/Edge contract parity where build boundaries prevent shared contracts; surface context-size failures explicitly while retaining complete saved history. | plan_1.md, Step 2 contract acceptance and Step 4 request construction/failure tests. |
| plan_3.md, Major Decision 3 and Step 4 | Distinguish stable persona identity from role/display name and human author; protect saved learner comments when downstream analysis or generation fails. | plan_1.md, Step 2 identity contracts and Step 4 failure/retry journey. |
| plan_4.md, Major Decision 4 and Step 3 | Define proposal revision, terminal decision, recoverable generation status, and operation replay identity explicitly. This makes stale/concurrent/failure behavior reviewable. | plan_1.md, Steps 2–3 proposal and atomic approval contracts, reusing existing storage where sufficient. |

## Incompatibilities

- Do not combine plan 1's inline orchestration with plan 2's mandatory phishing extraction as simultaneous backbone decisions. They assign policy ownership differently; choose a boundary based on the initial inventory.
- Plan 3's dedicated controller conflicts with keeping Cyberbullying orchestration in the shared RoomContext. Its identity and failure requirements can transfer without adopting that controller.
- Plan 4's server-owned operation sequence conflicts with retaining orchestration at existing client integration points. Its lifecycle invariants can strengthen existing server enforcement without requiring the new API.
- Plan 2 uses different target-key spellings from plans 1 and 4. The request fixes the five definitions, not those proposed spellings. Select one canonical set before migration and fixtures; mixing sets would violate the shared-target contract.

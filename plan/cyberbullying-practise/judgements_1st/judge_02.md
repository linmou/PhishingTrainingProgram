# Independent Judge 02

Intent: rank the four implementation plans against request R1–R12 using only the request, candidates, and supporting diversity check. These are prospective design judgments, not repository verification.

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
| plan_3.md | 5 | 4 | 3 | 5 | 4 | 5 | 26 |
| plan_4.md | 5 | 3 | 3 | 4 | 5 | 5 | 25 |

## Ranking Reasons

- **plan_1.md:** Best match for the request's simple architecture and reuse constraints. Steps 1–3 inventory the actual boundaries, define contracts, and prove the coordinated migration; steps 4–5 name the E3/E6 integration points where subject routing must precede phishing preparation. This makes the smallest proposed structural change while retaining database authorization, atomic approval, and complete release gates. Its advantage is architectural economy, not weaker server enforcement. Inference: modifying existing dispatch points should require less integration work than extracting or replacing orchestration, although controller coupling remains a material risk.
- **plan_2.md:** Strongest explicit policy separation. Step 2 characterizes both phishing paths before extracting policy, and step 4 handles context bounds and existing-member initialization explicitly. This addresses demonstrated E3/E6 coupling with a fixed two-case interface rather than an open framework. It ranks second because extracting working phishing code is a required predecessor to Cyberbullying delivery, adding refactor scope where the request asks to preserve existing behavior. Inference: the interface may pay off, but the supplied evidence does not establish that its benefit exceeds the smaller inline change.
- **plan_3.md:** A credible workflow-isolation alternative, with especially concrete delayed-generation handling in step 4 and per-requirement acceptance criteria. Dedicated composition avoids entering the documented phishing hooks. However, its assigned approach accepts orchestration duplication and step 4 must detach shared primitives from existing RoomContext dependencies. Inference: that combination creates more maintenance and integration work than either a small inline slice or a shared controller with two policy implementations. The plan recognizes identity/rating drift but cannot yet demonstrate the extraction cost.
- **plan_4.md:** Thorough authority, provenance, and retry design. Steps 2–4 provide concrete proposal persistence, authenticated context loading, direct-call tests, and atomic publication. Its lower rank reflects expansion to a new practice-turn API and operation handlers before UI integration, rather than a requirement omission. E9 establishes a reusable atomic approval RPC, and E6 establishes shared server transport; neither establishes that a new orchestration endpoint is necessary. Inference: committing to that additional boundary before inventory is less economical and less assumption-disciplined than extending existing boundaries.

All four cover immutable practice identity, five shared targets and roles, Guard provenance, historical preservation, approval/rating attribution, and staged exact-artifact production delivery. The diversity check supports treating them as genuinely different ownership boundaries; it does not establish correctness or decide this ranking.

## Risks and Tradeoffs

- **Inline branching:** plan_1 step 4 retains the controller whose E3 branches already couple checklist readiness, legacy analysis, and transfer preparation. Its entry-point table and regressions are essential gates. A missed regeneration or fallback branch could still inject phishing policy.
- **Policy extraction:** plan_2 limits adapter scope sensibly, but frontend/Edge build boundaries may require mirrored contracts. Major Decision 3 acknowledges this and requires parity tests. Its step 2 also precedes the migration that establishes persisted practice identity; characterization must distinguish pre-migration phishing fixtures from post-migration authoritative routing evidence.
- **Separate composition:** plan_3 shares persisted projections but duplicates workflow sequencing. Shared review components may depend on context behavior beyond their visible props; step 4 must resolve that dependency before claiming isolation. This is an inference from its planned primitive adaptation, not an inspected code finding.
- **Server orchestration:** plan_4 centralizes trusted context and proposal state, but introduces another deployed function and a broader authenticated operation surface. Existing phishing dispatch reuse needs careful boundary tests to avoid inadvertently moving its behavior. The new endpoint's necessity remains an architectural choice, not a verified prerequisite.
- **Common execution risk:** all candidates correctly defer unknown live drift, historical conversion, analyzer suitability, and provider fidelity to investigation and acceptance gates. Their migration and release procedures remain prospective. No score treats the prior 35-test baseline as validation of these changes.

## Recommended Backbone

Use plan_1.md's eight-step sequence and existing-controller boundary. Retain its operation-to-handler inventory as the controlling artifact: every R6 UI action and direct call must identify its authoritative subject lookup, capability check, persistence boundary, and tests. Preserve its step 3 database transaction guarantees and separate staging/integrated-staging/production gates.

At step 1, assess whether the inventoried policy branches can remain small and auditable. If extraction is justified by concrete shared-policy duplication, use plan_2's narrow helper/interface idea locally; do not automatically make a full phishing adapter extraction a prerequisite. This is a recommendation inferred from the request's simplicity constraint and E3/E6 coupling evidence.

## Reusable Contributions

| Source plan | Exact advantage | Insertion point in plan_1.md |
| --- | --- | --- |
| plan_2.md, step 4 | Explicit context-size failure preserves the full-history contract instead of allowing unnoticed truncation. | Step 4, immediately after configuring transport size/model limits; add over-limit acceptance evidence. |
| plan_2.md, step 4 | Initialization repair for existing eligible members and concurrent initialization coverage closes rollout gaps beyond normal join/reload. | Step 4, learner-owned target initialization paragraph and integration evidence. |
| plan_2.md, step 2 | Characterization of both legacy and transfer generation payloads before policy movement makes phishing regression evidence more precise. | Step 1 baseline/entry-point inventory, with execution in step 6 regressions. |
| plan_3.md, step 4 | Explicitly retains saved learner comments after downstream failure and prevents delayed generation from replacing newer proposals. | Step 4 recoverable-generation handling and step 5 versioned review tests. |
| plan_4.md, step 3 | Typed conflict/failure responses and API-to-database tests expose ownership and retry behavior at actual operation boundaries. | Step 2 contract examples and step 5 direct-call tests, using existing handlers. |
| plan_4.md, Major Decision 4 | Generation status, revision, and original input linkage make unpublished proposal provenance concrete. | Step 2 draft contract inventory; extend existing storage only where missing fields are demonstrated. |

## Incompatibilities

- plan_1's inline controller, plan_2's mandatory phishing extraction, plan_3's dedicated controller, and plan_4's server-owned orchestration are alternative ownership choices. Combining all four would create competing workflow owners and defeat the request's simplicity objective.
- plan_2 uses different literal target keys from plans 1 and 4; plan_3 leaves key spelling to definition work. The request fixes five shared definitions, not one supplied spelling. Select one canonical set before migration and use it consistently across fixtures, prompts, persistence, and exports; do not combine the candidate spellings into extra targets.
- plan_3 says regeneration uses the edited character selection; plans 1, 2, and 4 stress proposal-local choice and future role selection. Define explicitly whether regeneration retains the current proposal's selected character, while the next conversation proposal resumes the scenario strategy. These can coexist, but their scope must be written into the contract before implementation.
- Importing plan_4's proposal-state precision does not require importing its new API. The existing atomic approval and server handlers should remain the chosen authority unless the initial inventory demonstrates a concrete gap they cannot reasonably address.

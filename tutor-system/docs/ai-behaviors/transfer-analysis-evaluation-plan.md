# Transfer analysis evaluation plan

Intent: preserve the production-baseline classification plan and define routing checks for the revised final-assessment policy.

Updated: 2026-10-13. The baseline configuration and its historical results remain unchanged; the revision checks below require separate execution and cannot inherit a baseline acceptance result.

## Final assessment revision checks

Authority: [T09.1](tutor-behavior-specification.md#t09-transfer-assessment-and-verification-lifecycle) and the [Partial-only contract](transfer-status-response-contract.md#assessment-after-full-understanding), which trace the rule to P2/P3 and the user's decision. Assess developed understanding; avoid a redundant quiz for knowledge demonstrated directly from Pending.

For a revision run, retain the classification and safety-flag metrics below and replace the historical `assessment_route` oracle with accepted Partial → Covered `demonstrated_understanding` plus the outstanding assessment lifecycle. Freeze the actual revised handler and SQL used for that run through Git and record its own inputs, outputs, labels, and validation results. The changed factors are assessment routing, completion semantics, and terminal progress handling; per-target model calls and the `events` contract remain in force.

The executable comparison uses one fresh real model generation per case/repetition and replays that exact response through the frozen production and candidate handlers. Both old and revised routing decisions are compared with the revised gold expectation. Requests and resulting analysis states must match; disagreement fails execution instead of silently attributing a model change to routing. Retain all 51 historical cases and their classification/flag/validity assertions; four added cases isolate Pending versus Partial on identical words, repair-first behavior, and repeated understanding on Covered. The applicability audit records the changed routing assertion for every retained case. Historical holdouts are exposed regression cases. An independent agent authors six fresh synthetic holdouts from constitution/spec/contract only, without production prompt or development examples; freeze and compare both variants on that same set before inspecting its results.

Classification and routing use deterministic gold labels, as the user requested for the existing evaluation. Free-text explanation quality is outside this scorecard; no semantic judge is substituted with text matching. Individual human label review remains pending, so results are diagnostic and cannot establish benchmark acceptance. Preserve the existing 80% overall/per-suite/per-partition behavior thresholds, 100% safety/validity/pair gates, two repetitions, and zero-error/missing-result gate. Exact state/lifecycle checks require 100% in the separate integrated SQL/domain verification. Existing-metric non-regression is checked on identical generations and common cases; no new prompt factor is introduced.

### Evidence-backed prompt clarification

The first routing comparison exposed a repeatable dependency: independent changed-context application was classified as `demonstrated_understanding`, making an assessment due when `spontaneous_transfer` should bypass it. The next candidate adds only an explicit context-comparison decision before selecting the full-coverage event; the response shape, thresholds, model settings, and existing cases/assertions stay fixed. This is clarification of TA04's existing exception, not a new requirement.

For this prompt comparison, both baseline and candidate use the revised Partial-only route. Generate fresh baseline and candidate responses separately on the same complete expanded set; propagate each variant's observed sequence states independently. The original production prompt is the baseline. The first six new holdouts, including the observed failure, become exposed regression cases. An independent author prepares six replacement holdouts using only the frozen policy documents, before candidate output inspection. Freeze both prompts and all cases before execution, retain every response and failed check, and apply per-suite/per-partition non-regression to every metric. A focused improvement cannot replace the full-suite verdict or waive unrelated hard-check failures.

If the first clarification introduces collateral regression, test one shorter clarification limited to choosing between the two full-coverage event kinds after sufficiency has been judged. Preserve every earlier case, mark used holdouts exposed, and add six further independent holdouts. Keep the original prompt if this narrower candidate cannot preserve the regression gates; do not expand this scheduling change into a redesign of unrelated analysis behavior.

Required routing and lifecycle boundaries:

- Initial and post-repair signals leave the item partial and continue tutoring.
- Partial → Covered demonstrated understanding makes an assessment due; Pending → Covered demonstrated understanding and spontaneous transfer complete without one.
- A covered pair alone is insufficient. The qualifying event's prior state and unresolved assessment requirement determine eligibility.
- Protection, correction, Guard, another open assessment, and required feedback defer an existing requirement; a later eligible request prepares it without a repeated understanding event. Contradiction invalidates readiness.
- Pass from covered records terminal evidence/history once and retains covered progress. First wrong leaves it covered/open; second wrong moves it to review. Results from other progress states are rejected.
- Repair to Partial does not reassess immediately; later full understanding must establish a new covered cycle. Replays and resolved cycles do not generate another assessment.

Use stateful integration checks for these lifecycle boundaries, including deferred preparation and grading replay. A single-target eligibility projection cannot establish persistence, concurrency, or whole-room routing behavior. Preserve historical labels and scores under their original policy; do not relabel an executed baseline as evidence for this revision.

## Historical production baseline plan

Plan ID: `transfer_analysis_20261013`; status: draft until the run's immutable freeze manifest is created. Prepared: 2026-10-13. Scope: unchanged production baseline evaluation; no candidate refinement or release verification.

Behavior source at baseline preparation: TA01–TA05 under [T02](tutor-behavior-specification.md#t02-analysis-responsibilities) and the then-current transfer status response contract. The links now contain revised policy; use the baseline's frozen source snapshot to interpret its results. Constitution: adopted version 1.0 and its embedded human decision record. Grounding review: resolved against the baseline rules; the recovery exception and legacy item-type mismatch remain explicit boundaries.

| Requirements | Metric / check | Method | Evidence and applicability | Threshold |
| --- | --- | --- | --- | --- |
| TA01–TA04 | `raw_event` | deterministic | Raw model kind versus predeclared supported label for every case | 80% overall, each suite and each evidence partition |
| TA01–TA04 | `applied_state` | deterministic | Actual production handler filtering plus shared reducer versus expected semantic state; same generation as raw_event | 80% overall, each suite and each evidence partition |
| TA05 | `safety_flags` | deterministic | Protection/correction booleans versus expected set for all cases | 100% |
| T09 dependency | `assessment_route` | deterministic | Isolated target eligibility projection, using the live SQL's partial state, current initial/repair event, and flag blockers; compare expected disposition | 80% overall, each suite and evidence partition |
| Contract | `validity` | supporting deterministic | Production handler accepts valid scope/JSON/quotes/types; malformed response remains visible as error | 100% |
| Coverage | `manifest_coverage`, `semantic_pairs` | deterministic | All declared cases/checks/repetitions exist; each pair passes both members' checks | 100% |

`raw_event` evaluates model interpretation. `applied_state` evaluates its consumer consequence. Their shared property is intentional: disagreements locate filtering/typing effects and are never averaged into one score. Eligibility projection evaluates only one target with other lifecycle blockers held false; it is not a live database or whole-room routing test. The live SQL snapshot pins that limitation.

Sources: ten purposively selected production rooms from April 2026, spanning six scenario families, exported read-only through Supabase MCP. Exclude recent QA/demo rooms from the ecological slice. Keep spelling, uncertainty, disagreement, repetition, and complete prior dialogue through the focus message. Student IDs are pseudonymized. Scenario setup names are fictional product characters. Historical messages are replayed against the exported pending targets; this is not a reconstruction of original model calls. Synthetic cases imitate observed tone and reasoning patterns but retain synthetic provenance. Record legacy target/configuration mismatches rather than correcting them silently. No target is invented in an ecological case.

Cases: `evals/promptfoo/transfer-analysis/development.json` plus independent `holdouts.json`. Twenty ecological selections and ten production-style synthetic cases; independent agent authors sixteen holdouts from spec/contract only. Full generated manifest records inputs, provenance, expected labels, rationale, pair IDs, and requirements. Add a stateful sequence linking the existing partial/full/contradiction/repair/transfer cases with explicit state propagation and no revised target text. Audit existing harness cases before execution; old assertions remain untouched. Human label review is recorded separately; ambiguous labels block acceptance and may be exercised diagnostically.

Target: production Edge `assessment-api` version 9 source retrieved via MCP. Use its actual handler to construct each request and apply its validation/filtering. Target model `qwen3.5-flash`, temperature 0, max_tokens 600, enable_thinking false, JSON object response. No target format/semantic retry; record truncation as a validity error. Two repetitions, no seed supplied, no best-run selection. Worker count is CLI-configurable, default four. Resume preserves completed requests and errors rather than resampling.

Evaluator: on 2026-10-13 the user clarified that this is a classification task and asked to build correct answers. Compare emitted event and flags directly with gold labels; no model judge is needed for the scoped classification outcome. Label provenance and policy rationale are preserved, with human-review status explicit. Validate exact comparisons, malformed output handling, coverage, and gates before baseline. Semantic quality of free-text explanations is outside this scorecard. The earlier draft grounding rubric is retained as unused preparation, not an executed metric. Credentials use existing local provider configuration and are excluded from artifacts.

Joint analysis: join raw_event with applied_state on case/repetition/generation. Report four pass/fail cells plus unevaluable, separately by suite. Full-understanding cases also join applied_state and assessment_route. Pair gate uses all expected checks. Stateful checks compare each propagated state with the declared state path. No baseline-to-candidate non-regression verdict is applicable to this standalone baseline; preserve failures for subsequent comparisons.

Readiness: production export and source snapshot available; label review, calibration, harness validation, applicability audit, independent holdouts, and immutable freeze must be completed or explicitly recorded as pending before a diagnostic run. A pending gate cannot produce acceptance. The separate run record will report all results and remaining gaps.

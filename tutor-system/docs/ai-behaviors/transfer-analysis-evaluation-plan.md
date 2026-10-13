# Transfer analysis evaluation plan

Intent: evaluate current production learner-evidence classification using natural production conversation patterns and independently authored boundary cases.

Plan ID: `transfer_analysis_20261013`; status: draft until the run's immutable freeze manifest is created. Prepared: 2026-10-13. Scope: unchanged production baseline evaluation; no candidate refinement or release verification.

Behavior source: TA01–TA05 under [T02](tutor-behavior-specification.md#t02-analysis-responsibilities). Contract: [transfer status response contract](transfer-status-response-contract.md). Constitution: adopted version 1.0 and its embedded human decision record. Freeze actual content hashes with each run. Grounding review: resolved against the adopted rules; the recovery exception and legacy item-type mismatch remain explicit boundaries.

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

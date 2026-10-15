# Transfer analysis evaluation plan

Intent: define the current item-event scorecard and preserve the provenance of historical evaluation results.

Updated: 2026-10-15. Source baseline: `8dc7271`; added cases: `af86353`. Current policy follows the user's approved removal of analysis flags and their assessment blockers. Historical results retain their original frozen contract and metrics.

## Added-case continuation and subsequent full suites

The user requested the 40 branch additions for the current candidates after completing the tutor runs, reusing saved evidence. `current.cjs freeze DIR --coverage added` freezes only those cases against the current transfer handler/reducer. This component is identical across the tutor candidates; one transfer run supplies shared component evidence. Older transfer runs use different prompts and remain historical evidence.

Imported files preserve learner text, targets, histories and event labels. Case/pair IDs use an `af86353_` namespace; new synthetic inputs use shared identities. Existing inputs retain historical identities. Historical flag labels remain in provenance; current checks follow TA01–TA04 and T09.1. All additions are exposed regression material, including former branch holdouts. Human label review remains pending, so this diagnostic cannot establish acceptance or unseen generalization.

Freeze three independent generations per distinct input, indexed 1–3, with existing model/sampling settings and no seed or semantic retry. Macro-F1 averages reference-supported classes; zero-denominator precision/recall/F1 is zero. Individual and pooled macro-F1 require at least 70%; fixed three-member majority must strictly exceed 90% overall, per suite and per evidence partition. No-event recall requires 90% wherever supported. Two-member votes are diagnostic; ties abstain and count as misses. Invalid/missing members block acceptance even when other members agree. Preserve the existing 80% raw-event/state/route and 100% validity/pair gates.

Two surface-reference cases exactly duplicate other added inputs and gold. Freeze aliases before execution; reuse corresponding repetitions: 38 unique inputs, 114 provider calls, 120 logical records. Report aliases as dependent observations and retain a unique-input classification diagnostic. Resume retains successes and failures. `--num_workers 16` raises four-worker concurrency fourfold, changing scheduling only; monitor progress and resources throughout execution. Use the configured `OAI_API_KEY`, `OAI_BASE_URL` and `OAI_MODEL`.

Any next refinement uses `--coverage full`: all 73 prior cases plus all 40 additions. Five original sequence steps use fixed prior states for classification; five additional `sequence_replay` cases preserve actual output propagation and transition checks, excluded from ensembles. This gives 118 logical cases and 354 records. Keep the original-case classification slice visible. Compare future baseline/candidate results on identical inputs, contracts, settings and gates; reuse unchanged component evidence. Changed tutor prompts additionally require the full tutor suite.

Changed measurement factors: additions, three repetitions, classification/ensemble reporting, new-case identity normalization and concurrency. Current transfer prompt, handler, event policy, sampling parameters and existing thresholds are fixed. The two-repetition entry point described below remains the historical comparison workflow.

## Current analysis and assessment checks

Authority: TA01–TA04 and [T09.1](tutor-behavior-specification.md#t09-transfer-assessment-and-verification-lifecycle), with the [Partial-only contract](transfer-status-response-contract.md#assessment-after-full-understanding). The model returns item-level `events` and an overall `explanation`. The server validates each target independently and combines accepted events for one database application.

| Requirements | Metric | Method | Threshold |
| --- | --- | --- | --- |
| TA01–TA04 | `raw_event` | Raw model event kind versus the declared gold label | 80% overall, each suite and evidence partition |
| TA01–TA04 | `applied_state` | Actual handler filtering and shared reducer versus expected progress | 80% overall, each suite and evidence partition |
| T09.1 | `assessment_route` | Accepted Partial → Covered `demonstrated_understanding` versus expected readiness | 80% overall, each suite and evidence partition |
| Contract | `validity` | Handler accepts the response's JSON, evidence scope, quotes, types, and explanations | 100% |

Manifest completeness and semantic pairs require 100%; errors or missing results prevent acceptance. Keep two repetitions, model `qwen3.5-flash`, temperature 0, max_tokens 600, enable_thinking false, JSON object output, and no semantic retry. No free-text explanation judge is used. Human gold-label review remains a separate pending gate.

Changed factors for this revision: the analysis prompt/output shape, Edge and SQL validation, assessment blocker logic, the metric inventory, and assessment-route gold expectations. Learner text, targets, histories, event labels, event transitions, model settings, and behavioral thresholds are retained. Cases H16, N06, R06, and V06 demonstrate accurate narrow-target understanding alongside an unrelated unsafe choice; Partial → Covered makes an assessment due in those cases.

The current case files contain event labels and optional explicit assessment expectations. Historical freezes and run records retain their original fields and results. Existing cases are exposed regression material, including holdouts authored for earlier runs; editing expected output fields does not make them unseen again.

The default freeze includes all 73 existing cases, including both refinement rounds (R01–R06 and V01–V06). Previously evaluated holdouts are marked as exposed regression cases. `--fresh_holdouts` adds a separately authored set and rejects IDs already present in the default cases; the author must still establish that new cases have not been exposed.

Use `evals/promptfoo/transfer-analysis/evaluate.cjs freeze <new-run-directory> --comparison prompt` to freeze the historical production snapshot and current working-tree handler, their prompts, revised cases, settings, metric thresholds, and source hashes. Prompt comparison is the default because this revision changes the prompt and consumer contract. Generate separate fresh baseline and candidate responses on identical inputs/settings, propagate each variant's observed sequence state independently, and preserve every input, raw response, applied result, error, and score. Resume completed generations without resampling them; CLI `--num_workers` controls concurrency. Historical production snapshots and ecological exports must be available before freezing. A run is diagnostic until labels are reviewed.

Required routing and lifecycle boundaries:

- Initial and post-repair signals leave the item partial and continue tutoring.
- Partial → Covered demonstrated understanding makes an assessment due; Pending → Covered demonstrated understanding and spontaneous transfer complete without one.
- A covered pair alone is insufficient. The accepted event's prior state and outstanding assessment lifecycle determine eligibility.
- Guard, another open assessment, and required feedback defer readiness; a later eligible request prepares it without a repeated understanding event. Contradiction invalidates readiness.
- Correct on either attempt records one terminal pass and retains Covered. First wrong leaves Covered/open; second wrong moves to Review. Results from other progress states are rejected.
- Repair to Partial continues tutoring; later full understanding establishes a new covered cycle. Replays and resolved cycles do not generate another assessment.

Use stateful SQL integration tests for blocker persistence, delivery, grading, recovery, replay, and permission boundaries. The single-target evaluation projection holds other lifecycle blockers false; it does not establish whole-room routing, concurrency, model quality, or hosted release conformance.

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

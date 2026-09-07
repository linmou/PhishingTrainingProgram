# Promptfoo and phishing tutor integration

Intent: apply the skill to an existing Promptfoo harness without duplicating product prompts or losing regression coverage.

Method source: `evals/promptfoo/AI_BEHAVIOR_EVALUATION_GUIDE.md` at baseline `41a52d5`, adapted to the user's spec-first order and baseline regression comparison. This records provenance; using the skill elsewhere does not depend on that repository.

## Any Promptfoo project

Inspect config, provider/judge settings, case imports/exporter, report format, commands, and the executable gate. Apply [the evaluation contract](evaluation-contract.md); the following checks address harness integration:

- Reconcile declared applicability with each case's actual `assert` list and report components. Zero-component failed results still belong to the manifest.
- Carry each metric's declared method from assertions through raw exports, summaries, gates, and viewers. `llm-rubric` denotes LLM judgment; inspect custom JavaScript/Python assertions before classifying them, since code can also call a model. Use component pass results and manifest counts, not named-score sums as pass rates. Supporting checks need not be named behavior metrics.
- Render a representative target request and inspect template variables for leaked expected answers, covered/eligible sets, pair labels, or grading metadata.
- Join baseline/candidate reports on case ID/version, metric/assertion version, suite/partition, and repetition when applicable.
- Verify the executable gate with mixed-method reports: pass, below-threshold, missing case/assertion/metric/suite, zero-component error, above-threshold regression, and applicable pair failure. Check metric-specific thresholds and that an unavailable judge cannot disappear behind passing deterministic results.
- Preserve baseline exports separately from current-prompt exports. Inspect command side effects and keep run artifacts out of public distribution unless publication is requested.

## PhishingTrainingProgram conventions

Use these paths only when working in this repository; inspect their current contents rather than assuming they remain unchanged:

| Purpose | Project path |
| --- | --- |
| Shared behavior constitution | `tutor-system/claude_docs/ai-behaviors/constitution.md` |
| Canonical tutor specification | `tutor-system/claude_docs/ai-behaviors/tutor-behavior-specification.md` |
| Response contract and evaluation plan | `tutor-system/claude_docs/ai-behaviors/tutor-response-contract.md`, `tutor-behavior-evaluation-plan.md` |
| Documentation index and update records | `tutor-system/claude_docs/README.md`, `tutor-system/claude_docs/doc_update_record/` |
| Existing evaluation guide | `evals/promptfoo/AI_BEHAVIOR_EVALUATION_GUIDE.md` |
| Evaluation configuration, rubrics, cases | `evals/promptfoo/promptfooconfig.yaml`, `rubrics/`, `cases/` |
| Blocking gate | `tutor-system/scripts/check-promptfoo-quality-gate.js` |
| Ecological product fixtures | `tutor-system/src/services/demoRoomTemplates.ts` |
| Script entry points | `tutor-system/package.json` |
| Model configuration examples | `tutor-system/.env.example` or the actual checked-in example |
| Immutable evaluation runs | `evals/promptfoo/results/<model>/<run-id>/` |
| Production behavior test | `tutor-system/src/__tests__/tutor_behavior_e2e.test.ts` |
| Browser consumer test | `tutor-system/scripts/browser-demo-tutor-behavior.js` |

Keep the guide as workflow documentation, the constitution as shared principles/priorities, the behavior design as contextual requirements, the response contract as consumer/schema ownership, the plan as experimental preparation, and executed-run records as evaluation evidence. Its historical one-metric/one-spec advice does not require splitting a cohesive behavior merely to use both evaluation methods; follow this skill's many-checks-per-spec contract. Changing the guide is a separate requested edit. Verify product source records and saved AI configuration where needed; seeding Supabase or creating demo rooms requires authorization beyond local fixture export.

Discover the active model/configuration and compare production request packaging with Promptfoo. Verify historical report versions and coverage before using them as current evidence.

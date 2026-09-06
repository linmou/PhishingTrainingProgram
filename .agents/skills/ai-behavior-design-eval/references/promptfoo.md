# Promptfoo and phishing tutor integration

Intent: apply the skill to an existing Promptfoo harness without duplicating product prompts or losing regression coverage.

Method source: `evals/promptfoo/AI_BEHAVIOR_EVALUATION_GUIDE.md` at baseline `41a52d5`, adapted to the user's spec-first order and baseline regression comparison. This records provenance; using the skill elsewhere does not depend on that repository.

## Any Promptfoo project

Inspect config, provider/judge settings, case imports/exporter, report format, commands, and the executable gate. Apply [the evaluation contract](evaluation-contract.md); the following checks address harness integration:

- Reconcile declared applicability with each case's actual `assert` list and report components. Zero-component failed results still belong to the manifest.
- Render a representative target request and inspect template variables for leaked expected answers, covered/eligible sets, pair labels, or grading metadata.
- Join baseline/candidate reports on case ID/version, metric/assertion version, suite/partition, and repetition when applicable.
- Verify the executable gate with saved pass, below-threshold, missing case/assertion/metric/suite, error, above-threshold regression, and applicable pair-failure reports.
- Preserve baseline exports separately from current-prompt exports. Inspect command side effects and keep run artifacts out of public distribution unless publication is requested.

## PhishingTrainingProgram conventions

Use these paths only when working in this repository; inspect their current contents rather than assuming they remain unchanged:

| Purpose | Project path |
| --- | --- |
| Canonical behavior documents | `tutor-system/claude_docs/ai-behaviors/<behavior_id>.md` |
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

Keep the guide as workflow documentation and the behavior record as the spec. Changing the guide is a separate requested edit. Verify product source records and saved AI configuration where needed; seeding Supabase or creating demo rooms requires authorization beyond local fixture export.

Discover the active model/configuration and compare production request packaging with Promptfoo. Verify historical report versions and coverage before using them as current evidence.

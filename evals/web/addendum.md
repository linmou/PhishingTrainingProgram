# Addendum: Prompt Evaluation Review Workspace

Intent: capture product rationale and technical-shape notes that should inform UX and architecture without bloating the main PRD.

## Brainstorming Source

The PRD refactor was informed by the BMad brainstorming session at:

- `_bmad-output/brainstorming/brainstorming-session-2026-06-20-000000.md`

Key accepted design direction:

- New Eval Run is the starting surface when the user needs to create the next measurement run.
- Evaluation Lineage is the home surface for existing runs and completed run comparison.
- A/B Changed Case Inspector is the case-level drill-down.
- Starred runs are neutral bookmarks in this version.
- Promptfoo remains the source of truth.
- Rich promptfoo metadata should be visualized as readable evidence before exposing raw YAML or JSON.

## Comparison View Model Notes

The implementation can normalize two Evaluation Runs into these view-model concepts:

- Comparison Summary
- Rubric Delta Summary
- Changed Case Summary
- Changed Case Detail
- Review Decision

These names are not mandatory API contracts yet. They are a useful architecture starting point for keeping UI code from coupling directly to raw Promptfoo artifacts.

## Product Spine Update

The stronger spine is:

```text
New Eval Run
→ Evaluation Lineage
→ Run Detail
→ Diagnosis Notebook
→ Prompt Versions
→ A/B Changed Case Inspector
→ Case Evidence View
→ Decision / Export
```

The reason is simple: users need to understand how the evaluation system evolved before they can choose a meaningful comparison. They should choose that comparison directly from Evaluation Lineage by selecting two run cards; a separate Comparison Setup page is unnecessary.

The generic Artifact Draft Builder page was deliberately removed from the primary spine. Its useful parts are guardrails: choose the target artifact, keep one artifact role per experiment step, label AI-assisted drafts, and prevent silent source mutation. Those guardrails should appear inside the artifact-specific surfaces:

- Prompt Versions for prompt version selection and source-level git diff review.
- Dataset Distribution for built-in Evaluation Set dimensions and deterministic n-gram analysis.
- Rubric Inspect for rubric version selection, changed-file review, selected-file diff, and selected-file draft editing.
- Run Detail or Diagnosis Notebook for compact model/evaluator config drafts.

## 2026-06-23 UX Correction: Source Diffs Over Fragile Structure

Prompt and rubric artifacts should be compared as source artifacts first.

Prompt files may not have a stable internal section structure. The product should not infer prompt composition or section meaning unless that structure is explicit in the source data. The Prompt Versions page should provide:

- prompt version log
- base/compare version selection
- source-level git diff
- prompt draft editor
- linked Evaluation Runs and Diagnoses
- warning when selected prompt versions were not evaluated under comparable measurement

Rubrics may span many files. The Rubric Inspect page should provide:

- rubric version log
- base/compare rubric version selection
- file tree of rubric files
- file-level change states
- source-level git diff for the selected rubric file
- rubric draft editor for the selected rubric file
- no secondary rubric diff panel; switching files changes the selected file diff
- measurement-sensitive comparison warnings when rubric versions differ

Behavior improvement must be argued from Evaluation Runs and Changed Case evidence, not from source diffs alone.

## Canonical Object: Evaluation Run

Evaluation Run is the central object. Prompt versions matter, but a prompt version alone is not evidence. Evidence exists only when a subject configuration is evaluated under a measurement configuration.

Suggested shape:

```text
EvaluationRun
├── run_id
├── created_at
├── subject
│   ├── prompt_version_id
│   └── model_config_version_id
├── measurement
│   ├── evaluation_set_version_id
│   ├── rubric_version_id
│   └── evaluator_config_version_id
├── result_summary
├── case_level_results
├── status
└── linked_experiment_thread_id
```

## Artifact Role Distinction

The artifacts are not equal.

- Subject Artifacts are optimized: prompt version and model config.
- Measurement Artifacts define the measuring instrument: Evaluation Set Version, Rubric Version, and evaluator config.

This distinction drives the whole UX. A score increase after prompt change can be prompt improvement if measurement is stable. A score change after rubric or Evaluation Set change is measurement movement, not proof of tutor improvement.

## Anchors

The lineage view needs two anchors:

- Current Baseline Anchor: the prompt/model config currently used as the comparison baseline.
- Trusted Measurement Anchor: the Evaluation Set, rubric, and evaluator config currently trusted for evaluation review.

The UI must not treat latest as the current baseline.

## Experiment Threads

Experiment Threads keep the timeline readable by showing Evaluation Runs as the only cards in the lineage. Diagnosis, artifact versions, and review status are summarized inside each run card. The lineage page should not split the same story into separate run cards, diagnosis cards, artifact lanes, and recommendation panels; that is too much surface area before the user has chosen a run.

Example:

```text
Thread: Improve beginner safety guidance
├── run_001
│   Prompt prompt_v12, measurement dataset_v5 / rubric_v3
│   Diagnosis summary: safety weak in beginner phishing-link cases
│   Starred: no
├── run_002
│   Prompt prompt_v13, measurement unchanged
│   Diagnosis summary: too direct before guided inspection
│   Starred: no
└── run_003
    Prompt prompt_v14, measurement unchanged
    Status: needs review, 14 changed cases, 2 safety regressions
    Starred: yes
```

Clicking one run card opens Run Detail. Selecting two run cards opens a compact comparison tray on Evaluation Lineage, where the user can see Comparison Type and route to changed-case evidence. The run cards themselves show only run identity, artifact versions, diagnosis summary, score summary, and starred state. Full Diagnosis editing and artifact draft creation still happen after opening Run Detail.

## Diagnosis Notes

Diagnosis should be structured, not just a free-text note.

Suggested fields:

- observed issue
- evidence links
- suspected cause
- target artifact
- reflection
- next experiment hypothesis
- success expectation

The target artifact is especially important because it separates prompt changes from measurement changes.

## Mixed-Change Guardrail

If a user changes both Subject Artifacts and Measurement Artifacts before the next run, the product should warn:

```text
You changed the thing being tested and the measuring stick.
This comparison cannot prove prompt improvement.
```

The default workflow should encourage one artifact role per iteration.

## Artifact Version Notes

Artifact Version should be logical, not tied to current file layout.

Examples:

- `rubric_v3` may reference `evals/promptfoo/rubrics/main.yaml`.
- `rubric_v4` may reference several files such as `helpfulness.yaml`, `safety.yaml`, and `socratic_guidance.yaml`.

Evaluation Run should reference the Artifact Version, not assume how the artifact is physically stored.

## A/B Changed Case Inspector Notes

Suggested page structure:

```text
A/B Comparison
├── Summary matrix
├── Changed case filters
├── Changed case list
└── Case inspector
    ├── Plain-English summary
    ├── Promptfoo metadata fact sheet
    ├── A/B multi-turn transcript comparison
    ├── Rubric delta strip
    ├── Evaluator rationale
    └── Reviewer decision
```

Core rule:

- Show changed cases first.
- Hide unchanged cases by default.
- Make regressions and mixed tradeoffs easy to filter.
- Treat Case Evidence as the selected-case detail state of A/B Changed Case Inspector. It must always preserve the selected Run A, Run B, and Case ID context.

## Starred Run Notes

For this version, a star is a bookmark, not a decision state. A reviewer can star an Evaluation Run to make it easy to find later during review.

Example:

```text
Starred
Source run: run_003
Subject: prompt_v14 / model_config_v2
Measurement: dataset_v5 / rubric_v3 / judge_v1
Note: Revisit after safety regressions are resolved.
```

## Dataset Distribution N-Gram Notes

Dataset Distribution should stay simple. Reviewers need a quick deterministic view of common language in the Evaluation Set, not an inferred-label workflow.

N-gram workflow:

- Show top 1-grams, 2-grams, and 3-grams from case title or learner situation text.
- Show counts or proportional bars for each phrase.
- Keep built-in coverage dimensions separate from n-gram analysis.
- Do not add an LLM variable builder, AI-inferred labels, confidence review queues, or provider configuration to this page.

Dataset proposal guardrail:

- Show distribution impact before accepting a dataset draft into the workspace.
- Dataset Distribution must use deterministic text analysis only. It should not require model, API key, base URL, or provider settings.

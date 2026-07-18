---
title: Prompt Evaluation Review Workspace
status: draft
created: 2026-06-21
updated: 2026-06-23
---

# PRD: Prompt Evaluation Review Workspace

## 0. Document Purpose

This PRD defines the next product direction for `evals/web`: a non-technical, evidence-guided improvement loop for AI Tutor prompt evaluation. It is written for product, UX, engineering, and evaluation owners extending the current standalone Promptfoo review website. The main document defines user-visible product requirements; implementation rationale and data-shape notes live in [addendum.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/evals/web/addendum.md).

## 1. Vision

Prompt Evaluation Review Workspace helps reviewers improve AI Tutor behavior and improve the measurement system used to judge that behavior. The workspace must show how Evaluation Runs evolve over time, anchor them against a current baseline and trusted measurement baseline, help reviewers diagnose what should change next, and turn each diagnosis into a traceable new prompt, evaluation set, or rubric draft.

The product thesis is: prompt evaluation is useful only when the improvement loop is visible. A reviewer needs to see the current baseline anchor, the trusted measurement anchor, the lineage of Evaluation Runs, the diagnosis that motivated each artifact change, and the evidence from later comparisons. A higher score is not enough. The product must distinguish tutor-behavior improvement from measurement improvement.

The current `evals/web` site already proves the basic standalone local review surface: prompt composition, draft case generation, saved before/after comparison, and heuristic preview. This PRD refactors the roadmap around the broader workflow: **orient → diagnose → reflect → revise one artifact → evaluate → compare → decide → repeat**.

## 2. Target Users

### 2.1 Jobs To Be Done

- As a curriculum or learning-design reviewer, understand whether a later prompt improves the learner-facing tutor without unacceptable regressions.
- As a prompt engineer, identify which tutor behavior changed, what diagnosis motivated the change, and which prompt section should be revised next.
- As an evaluation dataset curator, improve measurement coverage when the eval set misses important learner situations or overrepresents narrow cases.
- As a rubric owner, improve measurement judgment while making score comparability risks explicit.
- As an evaluation owner, inspect comparison evidence and preserve a traceable review record.

### 2.2 Non-Users for MVP

- Learners using the Tutor System.
- General analytics users looking for classroom progress dashboards.
- Multi-project evaluation administrators.
- Users who need browser-based live LLM provider execution.
- Users who need a replacement for Promptfoo CLI or Git.

### 2.3 Key User Journeys

- **UJ-0. Dev starts a new eval run.**
  - **Persona:** Dev, the engineer or evaluator preparing the next measurement run.
  - **Path:** Dev opens New Eval Run, names the run, selects the prompt version, evaluation dataset, rubric version, evaluator config, model, case count, and output path, reviews the deterministic command preview, then starts the eval.
  - **Resolution:** The workspace creates the run record and routes Dev to Run Detail for live or completed run inspection; if launch fails, the selected inputs remain editable instead of being lost.

- **UJ-1. Maria follows an improvement thread across Evaluation Runs.**
  - **Persona + context:** Maria is a curriculum reviewer who understands phishing training goals but does not edit Promptfoo files.
  - **Entry state:** She opens the workspace and sees the Current Baseline Anchor, Trusted Measurement Anchor, and active Experiment Threads.
  - **Path:** She opens the thread "Improve beginner safety guidance," sees the earlier Evaluation Run, reads the prior Diagnosis, compares a later Evaluation Run with it, and inspects changed-case evidence.
  - **Climax:** She sees that the later run improved helpfulness but still has unresolved beginner safety regressions.
  - **Resolution:** She records a Review Decision and a new Diagnosis requesting a prompt revision.

- **UJ-2. Dev reviews prompt source changes from a diagnosis.**
  - **Persona + context:** Dev is a prompt engineer responsible for improving the AI Tutor prompt.
  - **Entry state:** A reviewer has written a Diagnosis that safety regressed because the tutor became too direct before guided inspection.
  - **Path:** Dev opens the linked Changed Cases, inspects side-by-side outputs and rubric deltas, opens Prompt Versions, selects two prompt versions, and reviews the source-level git diff.
  - **Climax:** Dev can explain the intended change as a hypothesis: restore one guided observation step before direct correction.
  - **Resolution:** Dev records or verifies the prompt change hypothesis and links the selected prompt version pair to the next Evaluation Run. The workspace does not parse prompt composition when the prompt has no stable structure.

- **UJ-3. Lena improves dataset distribution understanding instead of changing the prompt.**
  - **Persona + context:** Lena maintains the Evaluation Set and wants more realistic multi-turn coverage.
  - **Entry state:** The Dataset Distribution page shows built-in coverage dimensions and simple n-gram analysis.
  - **Path:** Lena writes a Diagnosis that the measurement system is weak, inspects top 1-gram, 2-gram, and 3-gram patterns across case titles or learner situations, and identifies obvious overrepresented or missing topic language.
  - **Climax:** The workspace shows whether the dataset is dominated by repeated phrases such as account, reset password, or bank account.
  - **Resolution:** Lena records the coverage concern. If new Evaluation Cases are later drafted, they are labeled as measurement changes, not prompt improvements.

- **UJ-4. Omar reviews rubric source changes without corrupting prompt comparison.**
  - **Persona + context:** Omar owns rubric quality and wants clearer scoring criteria.
  - **Entry state:** A rubric ambiguity is diagnosed from several changed cases.
  - **Path:** Omar opens Rubric Inspect, selects a base rubric version and compare rubric version from the rubric version log, reviews the changed rubric file list, selects one rubric file at a time, inspects that file's git diff, and edits the selected rubric draft when needed.
  - **Climax:** Omar recognizes that score movement after rubric source changes cannot be treated as pure prompt movement.
  - **Resolution:** The inherited rubric comparison is preserved as source-level evidence, and comparisons using changed rubrics route through measurement-review warnings without making Omar repeatedly pick rubric versions.

## 3. Glossary

- **A/B Changed Case Inspector** — Drill-down view that shows only Evaluation Cases where one or more rubric scores changed between two Evaluation Runs.
- **Artifact Version** — Immutable logical version of a prompt, model config, evaluation set, rubric, or evaluator config. It can reference one source file or many source files.
- **Case Evidence View** — Per-case comparison detail for a specific A/B run pair, showing Promptfoo metadata, transcript, outputs, rubric deltas, evaluator rationale, and Review Decision.
- **Changed Case** — Evaluation Case where at least one rubric score differs between two compared Evaluation Runs.
- **Comparison Type** — Classification of whether a comparison is clean prompt A/B, measurement change, mixed change, cautionary, or not directly comparable.
- **Current Baseline Anchor** — The prompt and model config currently used as the comparison baseline for this evaluation workspace.
- **Diagnosis** — Structured human interpretation of a run or comparison, including observed issue, evidence links, suspected cause, target artifact, reflection, and next experiment hypothesis.
- **Evaluation Case** — A Promptfoo test case, including variables, applicable rubric assertions, expected behavior focus, and optional multi-turn conversation context.
- **New Eval Run** — Starting surface for naming a run, selecting prompt/dataset/rubric/evaluator/model inputs, reviewing the command preview, and launching the next eval run.
- **Evaluation Lineage** — Reviewer-friendly timeline of Experiment Threads and Evaluation Run cards anchored by current baseline and trusted measurement.
- **Evaluation Run** — Canonical observation event: saved result set produced by Promptfoo or a compatible evaluator for one subject configuration under one measurement configuration.
- **Evaluation Set Version** — Measurement Artifact Version containing the cases used to evaluate tutor behavior.
- **Experiment Thread** — Focused improvement attempt that groups Diagnoses, artifact drafts, Evaluation Runs, comparisons, and final outcome around one goal.
- **Measurement Artifact** — Artifact used to measure behavior: Evaluation Set Version, Rubric Version, and evaluator config.
- **Lineage Comparison Tray** — Compact panel on Evaluation Lineage that appears after two Evaluation Runs are selected and classifies the Comparison Type.
- **Prompt Versions** — Prompt version log and source-level git diff view for selecting and comparing two prompt versions.
- **Review Decision** — Human decision recorded against a Changed Case, such as accept tradeoff, request prompt revision, request rubric review, or request dataset review.
- **Rubric Inspect** — Focused rubric inspection view with rubric version log, base/compare version selection, changed rubric files, one selected-file diff, and one selected-file draft editor.
- **Starred Run** — Neutral bookmark marker on an Evaluation Run used to highlight a run for follow-up. It does not imply any downstream workflow state.
- **Subject Artifact** — Artifact being optimized for tutor behavior: prompt version and model config version.
- **Trusted Measurement Anchor** — Evaluation Set Version, Rubric Version, and evaluator config currently trusted for evaluation review.

## 4. Product Story and Information Architecture

### 4.1 Over-Arching Story

The workspace should tell one line:

```text
First understand the evolution.
Then choose one run to inspect or two runs to compare.
Then diagnose what changed.
Then revise one artifact.
Then run again.
Then decide whether tutor behavior improved or measurement improved.
```

### 4.2 Primary Page Order

**2026-06-23 IA update:** The primary page order is now:

1. **New Eval Run** — run setup and launch.
2. **Evaluation Lineage** — timeline and Experiment Threads anchored by Current Baseline and Trusted Measurement.
2. **Run Detail** — one Evaluation Run, its artifact versions, result summary, linked Diagnoses, provenance, starred state, and routes to evidence.
3. **Diagnosis Notebook** — structured reflections and hypotheses that choose the next artifact to inspect or change.
4. **Prompt Versions** — prompt version log and source-level git diff view for selecting and comparing two prompt versions.
5. **A/B Changed Case Inspector** — changed cases, rubric deltas, filters, and tradeoffs for one selected Evaluation Run pair.
6. **Case Evidence View** — detail view for one Changed Case inside the selected A/B comparison, including Review Decision.
7. **Dataset Distribution** — measurement coverage and simple n-gram distribution review.
8. **Rubric Inspect** — rubric version log and selected-file rubric inspection with diff and editor.
9. **Provenance and Export** — review packet, source provenance, and draft exports.

1. **New Eval Run** — run setup and launch.
2. **Evaluation Lineage** — timeline and Experiment Threads anchored by Current Baseline and Trusted Measurement.
2. **Run Detail** — one Evaluation Run, its artifact versions, result summary, linked Diagnoses, and status.
3. **Diagnosis Notebook** — structured reflections and hypotheses that choose the next artifact to change.
4. **Prompt Composition and Version Log** — prompt section review, prompt draft editing, and prompt history linked to Diagnoses and Evaluation Runs.
5. **A/B Changed Case Inspector** — changed cases, rubric deltas, filters, and tradeoffs.
6. **Case Evidence View** — exact behavior evidence and Review Decision for a selected Changed Case inside the selected A/B comparison.
7. **Dataset Distribution** — measurement coverage and deterministic n-gram analysis.
8. **Rubric Inspect** — rubric version selection followed by selected rubric file inspection.
9. **Provenance and Export** — review packet, source provenance, and draft exports.

### 4.3 Page Responsibility Boundaries

Each primary page must have one clear job. The workspace must not create a generic artifact-drafting page in MVP.

**2026-06-23 boundary update:**
- Prompt Versions owns prompt version selection and source-level git diff inspection only. It must not parse prompt composition when source prompts have no stable structure.
- A/B Changed Case Inspector owns the comparison-level queue. Case Evidence View is its selected-case detail state and must always preserve the selected run-pair context.
- Dataset Distribution owns built-in distribution dimensions and deterministic n-gram analysis. It does not include an LLM variable builder in the clean MVP.
- Rubric Inspect owns selected-file source inspection for rubric changes. Rubric meaning interpretation may be recorded as reviewer annotation, but source diff is the primary evidence.

**Page boundaries:**
- Evaluation Lineage orients the reviewer and supports one-run inspection or two-run comparison selection.
- Run Detail explains one Evaluation Run and links to its Diagnosis, evidence, provenance, and starred state.
- Diagnosis Notebook records interpretation, target artifact, and next hypothesis.
- Prompt Composition and Version Log owns prompt review, prompt draft editing, and prompt version history.
- A/B Changed Case Inspector owns comparison-level changed-case triage.
- Case Evidence View owns one changed case and its Review Decision inside a selected A/B comparison.
- Dataset Distribution owns Evaluation Set distribution review through built-in dimensions and n-gram analysis.
- Rubric Inspect owns selected-file rubric source inspection and optional reviewer annotations.
- Provenance and Export owns review packets and draft export.

**Action rule:** A visible primary action must either open the next evidence object or save/export the current work. Status labels, filter names, and Review Decision values must not be styled as primary action buttons.

## 5. Features

### 5.0 Existing Baseline to Preserve

**Description:** The current standalone site already provides a local browser review surface. The refactor must build on that baseline instead of regressing it.

#### Baseline Requirement: Preserve current standalone review baseline

The workspace must preserve the existing ability to run locally outside `tutor-system`, inspect prompt composition, edit prompt sections as drafts, inspect migrated Evaluation Cases, generate deterministic draft cases, export draft JSON, view parameter coverage, distinguish heuristic draft preview from saved Promptfoo results, and run core service tests without network calls.

**Consequences:**
- `cd evals/web && npm start` remains the expected local run path unless replaced by an explicitly documented successor.
- `cd evals/web && npm test` remains a required verification path for core deterministic logic.
- Existing heuristic preview labels must remain clear when new lineage, diagnosis, comparison, and review-decision views are added.

### 5.1 Evaluation Lineage and Experiment Threads

**Description:** Evaluation Lineage is the workspace home. It shows how Evaluation Runs and artifact changes evolved over time without forcing non-technical users into raw Git concepts. It realizes UJ-1.

#### FR-1: Current Baseline and Trusted Measurement Anchors

The workspace must show separate anchors for the current subject baseline and the trusted measurement baseline.

**Consequences:**
- Current Baseline Anchor shows the prompt version and model config used as the comparison baseline.
- Trusted Measurement Anchor shows the Evaluation Set Version, Rubric Version, and evaluator config trusted for evaluation review.
- The UI must not use `latest` as a synonym for `baseline`.
- If an anchor is unknown, the workspace displays `not set` and asks the user to document the baseline before comparing.

#### FR-2: Run-card Evaluation Lineage

The workspace must show a clean timeline of Evaluation Runs in a reviewer-friendly lineage view.

**Consequences:**
- The lineage shows only Evaluation Run cards as timeline nodes inside each Experiment Thread.
- Each Evaluation Run card summarizes the key Run Detail information needed for scanning: run status, prompt version, model config version, Evaluation Set Version, Rubric Version, evaluator config version, score summary, and latest Diagnosis summary if one exists.
- Artifact changes must be shown inside the relevant Evaluation Run card, not as separate artifact lanes on the lineage page.
- Diagnoses and Review Decisions must be summarized inside the relevant Evaluation Run card, not shown as separate timeline cards on the lineage page.
- Selecting an Evaluation Run card opens the Run Detail page, where users can inspect full evidence, write or edit a Diagnosis, and continue to comparison or draft workflows.
- The lineage page must avoid a `next recommended step` panel so the home view stays focused on orientation and run selection.

#### FR-3: Experiment Thread grouping

The workspace must group related work into Experiment Threads.

**Consequences:**
- Each Experiment Thread has a goal, linked Evaluation Runs, linked Diagnoses, status, and outcome.
- Thread status includes active, needs review, blocked, and archived.
- The user can scan a thread as a sequence of Evaluation Run cards. Cards show run identity, artifact versions, diagnosis summary, score summary, and whether the run is starred.
- Thread-level controls are limited to filtering, collapsing, and opening runs; diagnosis and artifact-draft actions belong downstream of Run Detail.

### 5.2 Evaluation Run Canonical Object

**Description:** Evaluation Run is the canonical object because it is the observation tying a subject configuration to a measurement configuration and result evidence.

#### FR-4: Evaluation Run identity

The workspace must represent Evaluation Run as the central evidence object.

**Consequences:**
- Each Evaluation Run references one subject configuration: prompt Artifact Version and model config Artifact Version.
- Each Evaluation Run references one measurement configuration: Evaluation Set Version, Rubric Version, and evaluator config Artifact Version.
- Each Evaluation Run shows timestamp, run status, result summary, case-level results, data provenance, and linked Experiment Thread.
- Comparison, diagnosis, and changed-case workflows reference Evaluation Runs rather than prompt versions alone.

#### FR-5: Subject vs measurement artifact roles

The workspace must distinguish artifacts being optimized from artifacts used to measure optimization.

**Consequences:**
- Prompt and model config are labeled Subject Artifacts.
- Evaluation Set, rubric, and evaluator config are labeled Measurement Artifacts.
- Score movement after Subject Artifact changes may be interpreted as tutor-behavior movement when measurement is stable.
- Score movement after Measurement Artifact changes must be interpreted as measurement movement or cautionary comparison, not prompt improvement.

### 5.3 Diagnosis Notebook and Reflection Loop

**Description:** Diagnosis captures the reviewer’s interpretation and hypothesis so the improvement loop is not just charts followed by random edits. It realizes UJ-1, UJ-2, UJ-3, and UJ-4.

#### FR-6: Structured Diagnosis

The workspace must let users write structured Diagnoses linked to an Evaluation Run or comparison.

**Consequences:**
- Diagnosis fields include observed issue, evidence links, suspected cause, target artifact, reflection, next experiment hypothesis, and success expectation.
- Suspected cause options include prompt, model config, Evaluation Set, rubric, evaluator config, and unclear.
- Target artifact options include prompt, model config, Evaluation Set, rubric, and evaluator config.
- Free-text reflection is supported but cannot replace the structured target-artifact choice.

#### FR-7: Diagnosis-to-draft trace

The workspace must link artifact drafts to the Diagnosis that motivated them.

**Consequences:**
- New prompt, Evaluation Set, rubric, model config, or evaluator config drafts can reference a source Diagnosis.
- Draft records show whether they were manual, AI-proposed, or AI-assisted.
- The draft requires a change hypothesis before it can be marked prepared for evaluation.
- A later Evaluation Run can trace back to the Diagnosis and draft that created its changed artifact.

### 5.4 Draft Creation Guardrails

**Description:** Draft creation is a guardrail pattern used by artifact-specific pages, not a standalone primary page. The workspace creates new versions of one chosen artifact at a time, manually or with AI assistance, while keeping measurement changes separate from prompt changes.

#### FR-8: Change-target routing

The workspace must require the user to choose what kind of improvement they are attempting before creating a draft, then route them to the artifact-specific page that owns that draft.

**Consequences:**
- Diagnosis Notebook captures the target artifact and hypothesis before draft creation.
- Tutor behavior routes to Prompt Versions for source diff review and linked run selection.
- Model behavior routes to model config draft creation from Run Detail or Diagnosis Notebook. [ASSUMPTION: MVP may expose model config draft as a compact form rather than a full page.]
- Measurement coverage routes to Dataset Distribution.
- Measurement judgment routes to Rubric Inspect.
- Evaluator behavior routes to evaluator config draft creation from Run Detail or Diagnosis Notebook. [ASSUMPTION: MVP may expose evaluator config draft as a compact form rather than a full page.]
- The workspace must not route users through a generic `Artifact Draft Builder` page.

#### FR-9: One-artifact draft guardrail

The workspace must warn when a user tries to change Subject Artifacts and Measurement Artifacts in the same experiment step.

**Consequences:**
- The default draft workflow changes one artifact role per iteration.
- If multiple artifact roles change, the workspace labels the next comparison as mixed change or not directly comparable.
- The warning explains that changing the thing being tested and the measuring stick at the same time can produce misleading score movement.
- The warning appears in the artifact-specific draft surface where the second artifact change is attempted.

#### FR-10: AI-assisted draft labeling

The workspace must label AI-assisted artifact creation clearly.

**Consequences:**
- Drafts show whether they were manual, AI-proposed, or AI-assisted.
- AI-assisted drafts remain drafts until reviewed.
- The UI must not silently mutate Promptfoo source files.
- Draft creation controls live on Dataset Distribution, Rubric Inspect annotations, Run Detail, or Diagnosis Notebook depending on target artifact. Prompt Versions is a comparison/review page, not a prompt composition editor.
- Any future LLM-backed draft workflow must run outside browser code or through a reviewed backend/offline path; browser provider secrets are not allowed.

### 5.5 Lineage-Based Comparison Selection

**Description:** Comparison selection belongs on Evaluation Lineage. Users can select one Evaluation Run card to inspect Run Detail or select two Evaluation Run cards to compare. A separate Comparison Setup page is not part of the MVP because it duplicates the natural action users already take while reading lineage.

#### FR-11: Two-run comparison selection

The Evaluation Lineage page must let the user select two Evaluation Runs for comparison without assigning durable comparison-role labels to run cards.

**Consequences:**
- Selecting one run opens Run Detail.
- Selecting two runs opens a compact comparison tray on the Lineage page.
- Run cards support selection, but the visible comparison tray exposes only one action: `Inspect run`.
- Experiment Thread cards show only whether each run is starred; comparison roles belong only in the temporary comparison tray.
- The comparison tray shows the selected runs' subject and measurement artifact versions side by side.
- Comparison Type is shown as passive context, not as a competing action.
- If multiple runs use the same prompt version, the user compares runs, not prompt versions alone.
- The workspace must not require a separate Comparison Setup page before changed-case inspection.

#### FR-12: Comparison Type classification

The workspace must classify selected run pairs on the Lineage page before showing comparison evidence.

**Consequences:**
- If only the prompt Artifact Version changed and measurement is stable, label the pair clean prompt A/B.
- If only model config changed and measurement is stable, label the pair model config comparison.
- If Evaluation Set, rubric, or evaluator config changed, label the pair measurement change or cautionary comparison.
- If Subject Artifacts and Measurement Artifacts changed together, label the pair mixed change or not directly comparable.
- The UI explains what the label means in plain language.

#### FR-13: Comparison routing

The workspace must route users from the Lineage comparison tray based on Comparison Type.

**Consequences:**
- Inspecting a clean prompt A/B comparison opens the comparison evidence view.
- Measurement change routes to Dataset Distribution, Rubric Inspect, or evaluator config review before interpreting score movement.
- Mixed change shows a warning and recommends selecting runs with stable measurement or splitting the experiment.
- Not directly comparable comparisons do not show a simple winner.

### 5.6 Starred Run Marker

**Description:** Starred Run is a lightweight bookmark marker for keeping important Evaluation Runs visible during review. It is not a decision, status, or workflow gate.

#### FR-14: Star or unstar a run

The workspace must let a reviewer star or unstar an Evaluation Run.

**Consequences:**
- The star appears on Evaluation Lineage and Run Detail.
- The star records the source Evaluation Run, reviewer identity placeholder, timestamp, and optional short note.
- The UI labels the marker as `Starred`.
- Multiple Evaluation Runs may be starred at the same time.

#### FR-15: Star context

The workspace must show enough context around a starred run that reviewers understand why it was bookmarked.

**Consequences:**
- A starred run still shows unresolved regressions, unresolved Review Decisions, and Comparison Type where applicable.
- If Measurement Artifacts changed, the run still shows the measurement-change warning.
- Starred state must never hide cautionary evidence or unresolved case work.

#### FR-16: Star filtering

The workspace must make starred runs easy to find without turning the star into workflow state.

**Consequences:**
- Reviewers can filter Lineage and Run Detail lists to starred runs.
- Star state is visible in Provenance and Export.
- Removing a star does not delete the underlying Evaluation Run, artifact version, Diagnosis, or Review Decisions.

### 5.7 A/B Changed Case Inspector

**Description:** The A/B Changed Case Inspector helps reviewers inspect only meaningful case changes instead of reading every evaluation row. It realizes UJ-1 and UJ-2.

#### FR-17: Changed-case-only default

The inspector must default to showing Changed Cases, not all Evaluation Cases.

**Consequences:**
- A case appears when at least one rubric score changed between the compared Evaluation Runs.
- Unchanged cases are hidden by default but can be shown through an explicit control.
- The case list shows case title or ID, scenario tags, learner level when available, dialog type, changed rubrics, change direction, priority, and Review Decision status.

#### FR-18: Rubric delta summary matrix

The inspector must show a rubric-level matrix before the case list.

**Consequences:**
- For each rubric, the matrix shows improved case count, regressed case count, unchanged case count, net score movement, and critical-regression flag.
- The matrix supports mixed movement where one rubric improves while another regresses.
- Rubric movement uses text labels in addition to color.

#### FR-19: Changed-case filters

The inspector must support filters for practical review workflows.

**Consequences:**
- Filters include regression only, mixed tradeoff, critical rubric regression, large movement, rubric name, scenario tag, learner level, and multi-turn only.
- Applying a filter updates the visible count and does not erase existing Review Decisions.
- The reviewer can jump directly from a comparison summary to the matching filtered case list.

### 5.8 Case Evidence View

**Description:** The Case Evidence View translates rich Promptfoo case data into a readable comparison story for one selected Changed Case inside one selected A/B run comparison. Behavior comes first; prompt diff and raw data are secondary drill-downs. It realizes UJ-1 and UJ-2.

**2026-06-23 update:** Case Evidence is a child/detail state of A/B Changed Case Inspector. It is not a meaningful standalone workspace without selected Run A, selected Run B, and selected Case ID.

#### FR-20: Human-readable case summary

The workspace must render each Changed Case as a plain-English summary before raw fields.

**Consequences:**
- The summary explains what the case tests, the learner situation, and the expected tutor behavior.
- Promptfoo variables are shown as labeled facts rather than raw YAML first.
- Raw Promptfoo references remain accessible in a technical details section.

#### FR-21: Side-by-side A/B output comparison

The workspace must show Version A and Version B outputs side by side.

**Consequences:**
- Multi-turn conversations render as transcript-style turns.
- Important changed tutor lines are highlighted when the data supports it.
- Reviewers can switch between `show only changed turns` and `show full conversation`.

#### FR-22: Per-case rubric delta and rationale

The workspace must explain score movement at the case level.

**Consequences:**
- Each changed rubric shows A score, B score, delta, direction, and readable label.
- Evaluator rationale is displayed beside the changed rubric when available.
- The view supports plain-English summaries such as `Version B became more helpful but skipped a safety check`.

#### FR-23: Case-level Review Decision

The workspace must let reviewers resolve each Changed Case.

**Consequences:**
- Decision options include accept tradeoff, needs prompt revision, needs rubric review, needs dataset review, and send to technical reviewer.
- The decision requires a short note for regressions and mixed tradeoffs.
- Case-level decisions can seed a Diagnosis and can inform whether a reviewer stars or unstars a run for follow-up.

#### FR-24: Prompt diff as secondary drill-down

The workspace must provide prompt diff access without making it the first thing non-technical users see.

**Consequences:**
- Case detail defaults to outputs, rubric deltas, and rationale.
- Prompt diff, parameter diff, and technical metadata are available behind an expandable panel or secondary tab.
- Prompt diff labels should map prompt sections to behavior where possible. [ASSUMPTION: MVP may show section-level diff without automatically attributing causality.]

### 5.9 Prompt Versions and Git Diff View

**Description:** Reviewers need to understand which prompt versions changed and inspect exact source-level changes. The workspace must not attempt prompt composition analysis when source prompts do not have reliable structure.

**2026-06-23 update:** Prompt comparison is git-diff based. Prompt section parsing, composition analysis, local prompt editing, and heuristic prompt-impact analysis are removed from the required MVP scope for this page.

#### FR-25: Prompt version selection and git diff

The workspace must provide a primary Prompt Versions page for selecting two prompt versions and inspecting their source-level git diff.

**Consequences:**
- The page shows a prompt version log with version ID, source reference, timestamp when available, linked Evaluation Runs, linked Diagnosis when available, and status.
- The user can select a base prompt version and a compare prompt version.
- The page shows a source-level git diff as the primary comparison view.
- The diff view supports split or unified mode, file/source label, added and removed line counts, search, and collapsed unchanged context when implemented.
- The page may show linked run and diagnosis metadata, but it must not infer prompt sections unless structure is explicit in source data.
- The page must not claim behavior improvement from prompt text changes alone; behavior evidence belongs to Evaluation Runs and A/B Changed Case Inspector.

#### FR-26: Prompt version log

The workspace must show prompt versions linked to Evaluation Runs and Diagnoses so reviewers can choose which two prompt versions to compare.

**Consequences:**
- Each prompt version shows ID, title or summary when available, source reference, created time when available, author placeholder when available, change reason when available, source Diagnosis when available, status, and linked Evaluation Runs.
- A version can be marked draft, evaluated, needs review, or archived.
- The log is used for prompt version pair selection.
- The page distinguishes prompt source history from Evaluation Lineage: prompt history explains source changes; Evaluation Lineage explains evidence from Evaluation Runs.

### 5.10 Dataset Distribution and AI-Inferred Variables

**Description:** The Evaluation Set must be visible as a Measurement Artifact, not a hidden fixture. Reviewers need built-in coverage dimensions and a simple deterministic n-gram view for spotting repeated or missing case language. This realizes UJ-3 without adding an LLM labeling workflow.

#### FR-27: Dataset Distribution

The workspace must visualize Evaluation Case distribution across built-in and saved reviewer-defined variables.

**Consequences:**
- Dimensions include learner level, phishing scenario, misconception type, dialog length, single-turn vs multi-turn, emotional tone, safety-sensitive cases, expected tutor strategy, and applicable rubrics when available.
- The page warns about underrepresented, overrepresented, duplicate, or near-duplicate case groups when the data supports detection.
- The page links distribution segments to matching cases.
- Missing metadata is labeled as missing or inferred; it is not silently treated as source truth.
- N-gram analysis appears beside built-in coverage dimensions with clear counts or proportional bars.

#### FR-28: A/B segment movement

The workspace must connect comparison movement to dataset segments.

**Consequences:**
- A/B Changed Case Inspector can show where regressions cluster, such as beginner learners or long conversations.
- Segment movement can be used as a filter.
- Segment summaries must distinguish observed evidence from inference.

#### FR-29: N-gram dataset analysis

The workspace must let reviewers inspect common 1-gram, 2-gram, and 3-gram patterns across Evaluation Set case titles or learner situation text.

**Consequences:**
- The view shows separate lists for top 1-grams, 2-grams, and 3-grams.
- The view uses deterministic text analysis only; no model/provider configuration is required.
- Supported output types include categorical, binary, numeric score, and multi-label when feasible.
- The user can provide optional positive and negative examples.
- The labeling run records model, provider/base URL or runtime config, prompt/version, timestamp, dataset version, and variable version.
- The user can see counts or proportional bars for each phrase.
- The page does not create saved inferred variables, confidence scores, rationales, or manual override queues.
- Human overrides are stored separately from AI labels.
- Saved AI-inferred variables can be used as filters in A/B Changed Case Inspector, with an `AI-inferred` label.
- If `.env.example` does not define the required LLM API key, base URL, model, or provider parameters, implementation must ask the project owner for them instead of replacing the workflow with pattern matching.

#### FR-30: Natural-language dataset proposal

The workspace must allow reviewers to draft case additions or updates from natural language.

**Consequences:**
- Entry points include `Add cases like this` from Case Evidence View and `Fill this gap` from Dataset Distribution.
- Proposed cases are drafts until exported or accepted into the workspace.
- The workspace shows a distribution impact preview before the draft is accepted into the workspace.
- The generated or updated case must preserve applicable rubric alignment.
- Dataset improvements are labeled as measurement improvements, not tutor improvements.

### 5.11 Rubric Inspect

**Description:** Rubric source changes alter measurement and must be reviewed as file-level source diffs. The workspace must show git diffs per rubric file before any reviewer interpretation. This realizes UJ-4.

#### FR-31: Rubric version selection and file-by-file git diffs

The workspace must let reviewers select two rubric versions and inspect source-level git diffs for every rubric file that changed.

**Consequences:**
- The page shows a rubric version selector with base version, compare version, swap action, and linked Evaluation Runs.
- The page shows a rubric file tree with one row per rubric file.
- Each rubric file row shows path, change type, added and removed line counts, and whether the file is used by the selected run or comparison when known.
- The primary detail pane shows the selected file's git diff in split or unified mode.
- The UI supports added, modified, deleted, renamed, and unchanged file states.
- If a rubric version changed between two Evaluation Runs, the comparison is labeled measurement-sensitive.
- If prompt and rubric versions both changed, the comparison is labeled mixed change or not directly comparable.

#### FR-32: Rubric review annotations

The workspace may let reviewers annotate rubric diffs, but reviewer annotation must not replace the source diff as primary evidence.

**Consequences:**
- Annotation options may include wording-only, scoring-changing, needs rubric owner review, or custom note.
- The UI must not claim a rubric change is meaning-preserving unless a reviewer explicitly records that interpretation.
- Rubric improvements are labeled as measurement-judgment improvements, not tutor improvements.

### 5.12 Provenance, Export, and Promptfoo Authority

**Description:** The workspace should make review easier while preserving Promptfoo as the authoritative evaluator.

#### FR-33: Data provenance labels

The workspace must label where each result or preview comes from.

**Consequences:**
- Saved comparison results are labeled as coming from Promptfoo artifacts or compatible saved evaluator output.
- Local draft-impact preview is labeled heuristic.
- Technical details show source paths or source references for artifacts.

#### FR-34: Draft export

The workspace must export reviewable drafts rather than silently writing source files.

**Consequences:**
- Exportable drafts include prompt changes, Evaluation Set case proposals, rubric proposals, Diagnoses, and Review Decisions.
- Export format must be readable by developers or future automation.
- The UI explains that source changes still require review outside the browser in MVP.

#### FR-35: No browser provider secrets

The workspace must not require or expose provider credentials in browser code.

**Consequences:**
- Live LLM calls from browser code are out of scope for MVP.
- Any future live evaluation or AI-assisted artifact drafting must run outside browser code with explicit secret handling.
- The UI must not ask non-technical reviewers to paste provider API keys.

## 6. Non-Goals

- The workspace will not replace Promptfoo as the authoritative evaluator.
- The workspace will not replace Git or become a custom version-control system.
- The workspace will not run live provider calls from browser code in MVP.
- The workspace will not silently write prompt, rubric, or Evaluation Set changes back to source files in MVP.
- The workspace will not treat aggregate score improvement as sufficient evidence of tutor improvement.
- The workspace will not require non-technical reviewers to read raw YAML or JSON before understanding a result.
- The workspace will not treat Measurement Artifact changes as tutor-behavior improvements.
- The workspace will not manage multiple unrelated projects in MVP.

## 7. MVP Scope

### 7.1 In Scope

- Evaluation Lineage with Current Baseline Anchor and Trusted Measurement Anchor.
- Experiment Threads grouping runs, Diagnoses, and artifact revisions.
- Evaluation Run canonical object views.
- Diagnosis Notebook and diagnosis-to-draft trace.
- Draft Creation Guardrails with one-artifact routing.
- Lineage-based two-run comparison selection and Comparison Type routing.
- Starred Run marker.
- A/B Changed Case Inspector.
- Case Evidence View.
- Prompt Versions.
- Dataset Distribution.
- Rubric Inspect.
- Natural-language draft workflows for Evaluation Set and rubric proposals.
- Review Decisions that can seed Diagnoses and inform starred-run notes.
- Clear provenance labels for Promptfoo results and heuristic previews.

### 7.2 Out of Scope for MVP

- Authenticated user accounts and permissions. [NOTE FOR PM: revisit before shared deployment.]
- Live Promptfoo execution from the web UI.
- Browser-side provider API keys.
- Automatic source-file mutation.
- Multi-project management.
- Cloud deployment.
- Full statistical experiment platform behavior beyond the comparison summaries needed for review.
- Full Git integration UI; the lineage may be Git-like but must stay reviewer-friendly.

## 8. Cross-Cutting Requirements

### 8.1 Non-Technical Language

UI copy must explain results in plain language before exposing raw technical details.

**Requirements:**
- Verdicts and warnings use review language, not only metric names.
- Technical terms such as Promptfoo, YAML, model config, evaluator config, hash, and source path are available in details but not required to understand the main decision.
- Color-coded status always has text labels.
- Git-like lineage visuals use reviewer-facing terms such as Evaluation Lineage, Experiment Thread, current baseline, Diagnosis, and run.

### 8.2 Evaluation Integrity

The workspace must prevent misleading comparison interpretation.

**Requirements:**
- Comparisons must identify changed Artifact Versions.
- Subject Artifact and Measurement Artifact changes must be separated.
- Rubric and Evaluation Set changes must be visible in comparison context.
- Rubric meaning changes must warn that historical scores may not be directly comparable.
- Natural-language edits must produce reviewable drafts.
- Prompt overfitting warnings appear when repeated prompt revisions are evaluated against the same narrow Evaluation Set without holdout or coverage review.

### 8.3 Accessibility and Usability

The workspace must be usable by reviewers who are not developers.

**Requirements:**
- Main workflows should be navigable without editing files.
- Dense evidence views should support filtering, collapsing, and drill-down.
- Multi-turn conversations should render as readable transcripts.
- Tables must not be the only way to understand the result.

### 8.4 Security

The workspace must avoid secret exposure.

**Requirements:**
- No API keys, tokens, passwords, or provider credentials in browser seed data.
- No hidden network call requiring credentials from the browser.
- Exported artifacts must not include secrets.

### 8.5 Testability

Core behavior must be testable without external services.

**Requirements:**
- Evaluation Run comparison, lineage grouping, changed-case filtering, rubric delta summaries, starred-run state, Diagnosis validation, and export generation must have deterministic tests.
- Heuristic preview behavior must be tested separately from saved Promptfoo result rendering.
- UI smoke checks should cover Evaluation Lineage comparison selection, starred-run marking, A/B Changed Case Inspector, and Case Evidence View.

## 9. Success Metrics

### Primary

- **SM-1:** Reviewers can identify Current Baseline Anchor, Trusted Measurement Anchor, and latest Evaluation Run within 60 seconds. Validates FR-1, FR-2, FR-3.
- **SM-2:** Reviewers can select two Evaluation Runs from Evaluation Lineage and understand Comparison Type before inspecting changed cases. Validates FR-11, FR-12, FR-13.
- **SM-3:** Reviewers can write a structured Diagnosis that identifies observed issue, suspected cause, target artifact, and next hypothesis. Validates FR-6, FR-7.
- **SM-4:** Reviewers can star, unstar, filter, or inspect a starred run with source run, optional note, timestamp, and reviewer placeholder. Validates FR-14, FR-15, FR-16.
- **SM-5:** Reviewers can inspect all Changed Cases without reading unchanged cases by default. Validates FR-17, FR-18, FR-19.
- **SM-6:** The system flags cautionary or not-directly-comparable comparisons when Measurement Artifacts changed. Validates FR-5, FR-12, FR-13.

### Secondary

- **SM-7:** Dataset curators can identify at least three distribution dimensions and create a draft case proposal with impact preview. Validates FR-27, FR-28, FR-29.
- **SM-8:** Rubric owners can see whether a rubric draft is meaning-changing before accepting it. Validates FR-30, FR-31.
- **SM-9:** Developers can export prompt, Evaluation Set, rubric, Diagnosis, and Review Decision drafts without copying from browser internals. Validates FR-32, FR-33.

### Counter-Metrics

- **SM-C1:** Do not optimize for aggregate score alone; starred runs with unresolved critical regressions must still show those regressions.
- **SM-C2:** Do not optimize for case volume alone; generated cases that skew Evaluation Set distribution should be flagged.
- **SM-C3:** Do not optimize for hiding technical details; raw provenance must remain available behind readable summaries.
- **SM-C4:** Do not optimize for fast iteration by allowing prompt and measurement changes to blur into one "improvement" score.

## 10. Risks and Mitigations

### Risk: Reviewers overtrust a higher aggregate score

Mitigation: A/B Changed Case Inspector and the Lineage comparison tray must elevate regressions, mixed tradeoffs, and critical rubric movement before a reviewer records a decision.

### Risk: Users change the tutor and the measuring stick together

Mitigation: Draft Creation Guardrails enforce change-target routing, artifact-specific draft pages warn on mixed artifact changes, and the Lineage comparison tray blocks simple winner language for mixed changes.

### Risk: Rubric edits make old and new runs incomparable

Mitigation: Rubric Inspect must keep the comparison path explicit: select rubric versions first, select one changed file second, then inspect that file's source diff and edit only that selected rubric draft.

### Risk: Natural-language Evaluation Set editing skews measurement

Mitigation: Dataset proposals must show distribution impact before acceptance and label measurement changes separately from tutor changes.

### Risk: The product hardcodes today’s Promptfoo file layout

Mitigation: Version logical Artifact Versions with flexible source paths.

### Risk: Static seed data becomes stale

Mitigation: Keep provenance visible and prioritize a regeneration workflow in implementation planning.

### Risk: Users mistake heuristic previews for real model evaluations

Mitigation: Label local draft previews as heuristic and keep Promptfoo artifacts authoritative.

### Risk: Git-like lineage confuses non-technical reviewers

Mitigation: Use Git-like visual structure but reviewer-facing language. Hide raw source paths, hashes, and branch-like details behind technical detail drawers.

### Risk: Reflection quality becomes vague and unusable

Mitigation: Diagnosis requires structured fields for observed issue, evidence, suspected cause, target artifact, and next hypothesis instead of relying on free text alone.

### Risk: Prompt overfits to a narrow Evaluation Set

Mitigation: Warn when repeated prompt revisions are evaluated against the same narrow case set without holdout cases or coverage review.

### Risk: Current Baseline Anchor drifts or is confused with latest run

Mitigation: Separate Current Baseline Anchor, latest Evaluation Run, and Trusted Measurement Anchor in the UI.

## 11. Open Questions

1. What exact reviewer identity mechanism is acceptable before authenticated accounts exist?
2. Which rubrics count as critical blockers by default?
3. What statistical confidence display is appropriate for small Promptfoo datasets?
4. What source format should exported prompt, Evaluation Set, rubric, Diagnosis, and Review Decision drafts use first?
5. Should near-duplicate case detection be deterministic only in MVP, or may it use an offline LLM-assisted workflow?
6. What minimum metadata is required on existing Promptfoo cases to support learner level, dialog type, emotional tone, and expected tutor strategy?
7. Should a comparison with model config changes always require technical review before interpretation?
8. Who is allowed to set or update Current Baseline Anchor and Trusted Measurement Anchor before authenticated accounts exist?
9. Should Experiment Threads be manually created, inferred from Diagnoses, or both?
10. What threshold should trigger prompt-overfitting warnings?

## 12. Assumptions Index

- FR-14: [ASSUMPTION: MVP can use a local reviewer name field rather than authenticated accounts.]
- FR-24: [ASSUMPTION: MVP may show section-level diff without automatically attributing causality.]
- FR-8: [ASSUMPTION: MVP may expose model config draft as a compact form rather than a full page.]
- FR-8: [ASSUMPTION: MVP may expose evaluator config draft as a compact form rather than a full page.]

---
title: Prompt Evaluation Review Workspace Page Feature Spec
status: draft
created: 2026-06-22
updated: 2026-06-22
sources:
  - /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/evals/web/PRD.md
  - /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/_bmad-output/planning-artifacts/ux-designs/ux-PhishingTrainingProgram-2026-06-22/DESIGN.md
  - /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/_bmad-output/planning-artifacts/ux-designs/ux-PhishingTrainingProgram-2026-06-22/EXPERIENCE.md
---

# Page Feature Spec: Prompt Evaluation Review Workspace

Intent: define exactly which pages should be built, what each page owns, which features belong on each page, and how PRD requirements trace to UX surfaces. This document is the implementation-facing page contract; `DESIGN.md` owns visual language and `EXPERIENCE.md` owns interaction behavior.

## 1. Page Inventory

| Page ID | Page | Primary Job | Build Priority |
|---|---|---|---|
| P1 | Evaluation Lineage | Orient reviewers in Evaluation Run history and support one-run/two-run selection. | MVP |
| P2 | Run Detail | Explain one Evaluation Run as the canonical evidence object. | MVP |
| P3 | Diagnosis Notebook | Capture structured interpretation and target artifact for the next experiment. | MVP |
| P4 | Prompt Composition and Version Log | Review prompt sections, edit prompt drafts, and inspect prompt version history. | MVP |
| P5 | A/B Changed Case Inspector | Triage only cases where rubric scores changed between two selected runs. | MVP |
| P6 | Case Detail Evidence View | Inspect one changed case and record a Review Decision. | MVP |
| P7 | Dataset Coverage Map | Review Evaluation Set distribution and draft dataset case proposals. | MVP |
| P8 | Rubric Meaning Diff | Review rubric wording/meaning changes and draft rubric proposals. | MVP |
| P9 | Provenance and Export | Package review artifacts and provenance without mutating source files. | MVP |

## 2. Page Specifications

### P1. Evaluation Lineage

**Purpose:** Home surface. Shows how Evaluation Runs evolved over time.

**Owns:**
- Current Baseline Anchor.
- Trusted Measurement Anchor.
- Experiment Thread list.
- Evaluation Run cards.
- Starred state display.
- One-run selection.
- Two-run comparison selection.
- Compact comparison tray.

**Must show:**
- Current Baseline Anchor: prompt version and model config.
- Trusted Measurement Anchor: Evaluation Set Version, Rubric Version, evaluator config.
- Experiment Threads as groups of Evaluation Run cards.
- Each run card: run ID, sequence/timestamp, prompt version, model config version, Evaluation Set Version, Rubric Version, evaluator config, score summary, latest Diagnosis summary, starred state.
- After two selected runs: comparison tray with Run A/Run B IDs, changed/stable artifact groups, passive Comparison Type, and one action: `Inspect run`.

**Must not show:**
- Baseline/candidate badges on run cards.
- Artifact lanes.
- Separate Diagnosis timeline cards.
- Next recommended step panel.
- Readiness, release, approval, deployment, or production promotion logic.
- Multiple competing tray actions.

**Primary action:**
- `Inspect run` in comparison tray.

**Secondary interactions:**
- Click one run card opens Run Detail.
- Select two run cards opens comparison tray.
- Starred filter may be available, but star editing belongs primarily on Run Detail.

**Key states:**
- No runs.
- Anchor missing.
- One run selected.
- Two runs selected.
- Not directly comparable pair.
- Starred runs filtered.

### P2. Run Detail

**Purpose:** Explain one Evaluation Run as a complete evidence object.

**Owns:**
- Subject configuration summary.
- Measurement configuration summary.
- Result summary.
- Linked Diagnosis summary.
- Provenance summary.
- Star/unstar control and optional star note.

**Must show:**
- Run ID, timestamp, status, linked Experiment Thread.
- Subject Artifacts: prompt Artifact Version and model config Artifact Version.
- Measurement Artifacts: Evaluation Set Version, Rubric Version, evaluator config Artifact Version.
- Score summary and case-level result summary.
- Linked Diagnoses and draft artifacts if present.
- Starred state and optional note.
- Technical details drawer for raw Promptfoo/source references.

**Primary action:**
- If no Diagnosis exists: `Write diagnosis`.
- If Diagnosis exists: `Review diagnosis`.

**Secondary actions:**
- Star/unstar run.
- Open technical details.
- Navigate to linked comparison/case evidence.

**Key states:**
- No linked Diagnosis.
- Existing Diagnosis.
- Starred with note.
- Measurement changed warning.
- Missing provenance fields.

### P3. Diagnosis Notebook

**Purpose:** Capture reviewer interpretation before artifact changes.

**Owns:**
- Structured Diagnosis.
- Evidence links.
- Suspected cause.
- Target artifact.
- Reflection.
- Next hypothesis.
- Success expectation.
- Draft routing.

**Must show fields:**
- Observed issue.
- Evidence links.
- Suspected cause: prompt, model config, Evaluation Set, rubric, evaluator config, unclear.
- Target artifact: prompt, model config, Evaluation Set, rubric, evaluator config.
- Reflection.
- Next experiment hypothesis.
- Success expectation.

**Primary actions are target-specific:**
- Prompt target: `Create prompt draft`.
- Evaluation Set target: `Draft dataset cases`.
- Rubric target: `Draft rubric change`.
- Model config target: `Draft model config`.
- Evaluator config target: `Draft evaluator config`.

**Must not:**
- Become a generic artifact editor.
- Allow free text to replace target artifact selection.

**Key states:**
- Draft Diagnosis.
- Missing target artifact.
- Missing evidence.
- Linked from changed case.
- Linked from run-level review.

### P4. Prompt Composition and Version Log

**Purpose:** Prompt-specific review and draft surface.

**Owns:**
- Prompt section review.
- Prompt draft editing.
- Composed prompt preview.
- Prompt version history.
- Diagnosis-to-prompt trace.
- Prompt-only draft guardrails.

**Must show:**
- Current prompt version.
- Draft prompt version if active.
- Source Diagnosis and hypothesis when draft is diagnosis-driven.
- Prompt sections, such as role/voice, response pattern, encouragement, correction/safety, simplification, scenario red flags, safe actions.
- Section-level edits and composed preview.
- Plain-English change summary.
- Linked Evaluation Runs per prompt version.
- Draft mode: manual, AI-proposed, AI-assisted.
- Guardrail that dataset and rubric remain unchanged for clean prompt comparison.

**Primary action:**
- `Save draft`.

**Secondary actions:**
- Open version history row.
- Open linked Evaluation Run.
- Export prompt draft through Provenance and Export.
- Open technical/source details.

**Must not:**
- Edit dataset or rubric content.
- Mutate source files silently.
- Claim draft is evaluated before a new Evaluation Run exists.

**Key states:**
- No active draft.
- Draft dirty.
- AI-assisted draft awaiting review.
- Mixed-change warning if user attempts measurement changes.

### P5. A/B Changed Case Inspector

**Purpose:** Comparison-level triage of changed cases only.

**Owns:**
- Rubric delta matrix.
- Changed-case-only default.
- Changed-case filters.
- Changed-case queue.
- Segment movement summary where available.

**Must show:**
- Compared run IDs.
- Comparison Type context.
- Rubric delta matrix: improved, regressed, unchanged, net movement, critical flag.
- Filters: regression only, mixed tradeoff, critical rubric regression, large movement, rubric, scenario tag, learner level, multi-turn only.
- Changed case list with case ID/title, tags, changed rubrics, direction, priority, Review Decision status.

**Primary navigation:**
- Click case row opens Case Detail Evidence View.

**Must not:**
- Show all cases by default.
- Hide mixed rubric movement behind aggregate score.
- Present a simple winner for cautionary/mixed comparisons.

**Key states:**
- No changed cases.
- Empty filter result.
- Critical regressions present.
- Measurement changed warning.
- Unresolved Review Decisions.

### P6. Case Detail Evidence View

**Purpose:** Evidence view for one changed case.

**Owns:**
- Human-readable case summary.
- Promptfoo facts.
- Side-by-side output comparison.
- Multi-turn transcript rendering.
- Per-case rubric deltas.
- Evaluator rationale.
- Review Decision.
- Secondary prompt diff / technical details.

**Must show:**
- What the case tests.
- Learner situation and expected tutor behavior.
- Version A and Version B outputs.
- Changed tutor lines when supported.
- Rubric deltas with A score, B score, delta, direction, readable label.
- Evaluator rationale when available.
- Review Decision control.
- Short note field for regressions and mixed tradeoffs.

**Primary action:**
- `Save decision`.

**Review Decision options:**
- Accept tradeoff.
- Needs prompt revision.
- Needs rubric review.
- Needs dataset review.
- Send to technical reviewer.

**Secondary actions:**
- Show full conversation / show changed turns.
- Open prompt diff.
- Open raw Promptfoo details.
- Seed Diagnosis.

**Key states:**
- Regression.
- Mixed tradeoff.
- Missing evaluator rationale.
- Decision unsaved.
- Note required.

### P7. Dataset Coverage Map

**Purpose:** Measurement coverage review and dataset proposal surface.

**Owns:**
- Evaluation Case distribution.
- Coverage gaps.
- Overrepresented groups.
- Duplicate or near-duplicate warnings when available.
- Dataset case proposal drafting.
- Distribution impact preview.

**Must show dimensions where metadata exists:**
- Learner level.
- Phishing scenario.
- Misconception type.
- Dialog length.
- Single-turn vs multi-turn.
- Emotional tone.
- Safety-sensitive cases.
- Expected tutor strategy.
- Applicable rubrics.

**Primary action:**
- `Generate draft cases`.

**Secondary actions:**
- Open segment cases.
- Accept draft proposal.
- Export dataset proposal.

**Must not:**
- Present dataset improvement as tutor improvement.
- Treat inferred metadata as source truth.
- Accept generated cases without distribution impact preview.

**Key states:**
- Missing metadata.
- Coverage gap.
- Overrepresented segment.
- Draft cases generated.
- Distribution skew warning.

### P8. Rubric Meaning Diff

**Purpose:** Measurement judgment review and rubric proposal surface.

**Owns:**
- Before/after rubric wording.
- Meaning-change classification.
- Comparability warning.
- Rubric draft proposal.

**Must classify changes as:**
- Wording-only.
- Clarification.
- Threshold change.
- New criterion.
- Removed criterion.
- Meaning-changing.

**Must show:**
- Before rubric text.
- After rubric draft text.
- Changed criteria and examples where available.
- Plain-English comparability warning.
- Which future comparisons become measurement-change or cautionary comparisons.

**Primary action:**
- `Save rubric draft`.

**Secondary actions:**
- Confirm meaning-changing edit.
- Export rubric proposal.
- Open linked cases that motivated the rubric change.

**Must not:**
- Let meaning-changing edits look like prompt improvement.
- Save a meaning-changing draft without explicit acknowledgement.

**Key states:**
- Wording-only.
- Meaning-changing.
- Confirmation required.
- Linked changed cases present.

### P9. Provenance and Export

**Purpose:** Package review artifacts for developer/future automation review.

**Owns:**
- Review packet.
- Draft export.
- Provenance summary.
- Source labels.
- Heuristic-vs-Promptfoo authority labels.

**Must export:**
- Diagnoses.
- Prompt draft proposals.
- Evaluation Set case proposals.
- Rubric proposals.
- Review Decisions.
- Source provenance references.
- Starred-run notes when relevant.

**Primary action:**
- `Download JSON packet`.

**Secondary actions:**
- Preview each export section.
- Open source/provenance details.

**Must not:**
- Silently write source files.
- Include provider secrets.
- Present heuristic previews as saved Promptfoo results.

**Key states:**
- Nothing to export.
- Draft packet prepared.
- Missing provenance warning.
- Export downloaded.

## 3. Feature Trace Matrix

| PRD ID | Requirement Summary | Primary Page(s) | Supporting Page(s) | Notes |
|---|---|---|---|---|
| FR-1 | Current Baseline and Trusted Measurement Anchors | P1 | P2, P9 | Separate subject and measurement anchors. |
| FR-2 | Run-card Evaluation Lineage | P1 | P2 | Lineage shows only Evaluation Run cards. |
| FR-3 | Experiment Thread grouping | P1 | P2 | Thread controls limited to filtering/collapsing/opening runs. |
| FR-4 | Evaluation Run identity | P2 | P1, P5, P9 | Evaluation Run is canonical evidence object. |
| FR-5 | Subject vs measurement artifact roles | P1, P2 | P4, P7, P8, P9 | Must shape comparison interpretation everywhere. |
| FR-6 | Structured Diagnosis | P3 | P2, P6 | Diagnosis can be linked to run or comparison/case. |
| FR-7 | Diagnosis-to-draft trace | P3 | P4, P7, P8, P9 | Drafts reference source Diagnosis. |
| FR-8 | Change-target routing | P3 | P4, P7, P8, P2 | No generic draft-builder page. |
| FR-9 | One-artifact draft guardrail | P4, P7, P8 | P2, P3 | Guardrail appears where draft is attempted. |
| FR-10 | AI-assisted draft labeling | P4, P7, P8 | P9 | Applies to all AI-assisted artifact drafts. |
| FR-11 | Two-run comparison selection | P1 | P5 | Tray has one visible action: `Inspect run`. |
| FR-12 | Comparison Type classification | P1 | P5, P7, P8 | Passive context, not a competing CTA. |
| FR-13 | Comparison routing | P1 | P5, P7, P8 | Clean prompt A/B routes to comparison evidence; measurement changes route to measurement pages. |
| FR-14 | Star or unstar a run | P2 | P1, P9 | Lineage displays star; Run Detail edits star/note. |
| FR-15 | Star context | P2 | P1, P5, P9 | Star never hides unresolved evidence. |
| FR-16 | Star filtering | P1 | P2, P9 | Filter starred runs without workflow-state meaning. |
| FR-17 | Changed-case-only default | P5 | P6 | Changed cases only by default. |
| FR-18 | Rubric delta summary matrix | P5 | P6 | Must support mixed rubric movement. |
| FR-19 | Changed-case filters | P5 | P7 | Segment filters connect to dataset dimensions. |
| FR-20 | Human-readable case summary | P6 | P5 | Behavior first, raw fields later. |
| FR-21 | Side-by-side A/B output comparison | P6 | P5 | Multi-turn transcript support. |
| FR-22 | Per-case rubric delta and rationale | P6 | P5 | Includes evaluator rationale where available. |
| FR-23 | Case-level Review Decision | P6 | P3, P9 | Decisions can seed Diagnosis and export. |
| FR-24 | Prompt diff as secondary drill-down | P6 | P4 | Prompt diff is not the first view for non-technical users. |
| FR-25 | Prompt Composition Review | P4 | P3, P6 | Prompt drafts from Diagnosis open here. |
| FR-26 | Prompt version log | P4 | P1, P2, P9 | Prompt history is distinct from Evaluation Lineage. |
| FR-27 | Dataset Coverage Map | P7 | P5 | Coverage dimensions and warnings. |
| FR-28 | A/B segment movement | P5, P7 | P6 | Regressions can be clustered by segment. |
| FR-29 | Natural-language dataset proposal | P7 | P6, P9 | Entry points include coverage gaps and case detail. |
| FR-30 | Rubric Meaning Diff | P8 | P6 | Meaning-change classification. |
| FR-31 | Natural-language rubric draft workflow | P8 | P9 | Requires comparability warning before accepting draft. |
| FR-32 | Data provenance labels | P9 | P2, P4, P5, P6, P7, P8 | Provenance visible wherever evidence/drafts appear. |
| FR-33 | Draft export | P9 | P3, P4, P7, P8 | Exports reviewable drafts; no silent source writes. |
| FR-34 | No browser provider secrets | P9 | P4, P7, P8 | Applies to future live/AI-assisted workflows. |

## 4. Page-to-Feature Matrix

| Page | Owns FRs | Supports FRs |
|---|---|---|
| P1 Evaluation Lineage | FR-1, FR-2, FR-3, FR-11, FR-12, FR-13, FR-16 | FR-4, FR-5, FR-14, FR-15 |
| P2 Run Detail | FR-4, FR-14, FR-15 | FR-1, FR-3, FR-5, FR-6, FR-8, FR-16, FR-32 |
| P3 Diagnosis Notebook | FR-6, FR-7, FR-8 | FR-23, FR-33 |
| P4 Prompt Composition and Version Log | FR-9, FR-10, FR-25, FR-26 | FR-5, FR-7, FR-24, FR-32, FR-33, FR-34 |
| P5 A/B Changed Case Inspector | FR-17, FR-18, FR-19 | FR-4, FR-5, FR-12, FR-13, FR-15, FR-28, FR-32 |
| P6 Case Detail Evidence View | FR-20, FR-21, FR-22, FR-23, FR-24 | FR-6, FR-19, FR-29, FR-30, FR-32 |
| P7 Dataset Coverage Map | FR-27, FR-28, FR-29 | FR-5, FR-8, FR-9, FR-10, FR-13, FR-19, FR-32, FR-33, FR-34 |
| P8 Rubric Meaning Diff | FR-30, FR-31 | FR-5, FR-8, FR-9, FR-10, FR-13, FR-23, FR-32, FR-33, FR-34 |
| P9 Provenance and Export | FR-32, FR-33, FR-34 | FR-7, FR-10, FR-14, FR-16, FR-23, FR-25, FR-26, FR-29, FR-31 |

## 5. Removed or Forbidden Pages

| Page / Concept | Decision |
|---|---|
| Readiness page | Do not build. Replaced by evidence review and neutral starred-run bookmark. |
| Release page | Do not build. This product version has no release workflow. |
| Comparison Setup page | Do not build. Two-run selection belongs on Evaluation Lineage. |
| Generic Artifact Draft Builder page | Do not build. Draft guardrails belong inside artifact-specific pages. |
| Artifact lanes on Lineage | Do not build. Artifact versions appear inside Evaluation Run cards and Run Detail. |
| Diagnosis cards on Lineage | Do not build. Diagnosis is summarized inside Run cards and edited downstream. |

## 6. Button and Action Contract

| Surface | Primary Action Rule |
|---|---|
| Evaluation Lineage | No global hero CTA. Comparison tray has only `Inspect run`. |
| Run Detail | `Write diagnosis` or `Review diagnosis`. |
| Diagnosis Notebook | Target-specific draft action, such as `Create prompt draft`. |
| Prompt Composition and Version Log | `Save draft`. |
| A/B Changed Case Inspector | No hero CTA. Case rows drive navigation. |
| Case Detail Evidence View | `Save decision`. |
| Dataset Coverage Map | `Generate draft cases`. |
| Rubric Meaning Diff | `Save rubric draft`. |
| Provenance and Export | `Download JSON packet`. |

Status labels, filter chips, Review Decision values, and Comparison Type labels must not be styled as primary action buttons.

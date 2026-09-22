---
name: Prompt Evaluation Review Workspace
status: draft
sources:
  - /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/evals/web/PRD.md
updated: 2026-06-22
---

# Prompt Evaluation Review Workspace — Experience Spine

## Foundation

Single-surface responsive web app, desktop-first. The primary user is a non-technical evaluation reviewer inspecting dense evidence: Evaluation Runs, changed cases, rubric movement, transcripts, diagnoses, and artifact drafts. The product must remain usable by prompt engineers and dataset/rubric owners, but it should not assume users read Promptfoo YAML first.

`DESIGN.md` is the visual identity reference. This document owns information architecture, behavior, interaction rules, state handling, and flows.

The experience principle is:

```text
Orient in lineage.
Inspect evidence.
Diagnose cause.
Change one artifact.
Run again outside the browser.
Compare again.
```

## Information Architecture

| Surface | Reached From | Purpose |
|---|---|---|
| Evaluation Lineage | App open, sidebar | Home surface. Shows Current Baseline Anchor, Trusted Measurement Anchor, Experiment Threads, Evaluation Run cards, starred state, and two-run selection. |
| Run Detail | One run selected from Lineage, case/comparison back-links | Explains one Evaluation Run: subject config, measurement config, result summary, linked Diagnosis, provenance, starred note. |
| Diagnosis Notebook | Run Detail, Case Detail, comparison evidence | Records structured interpretation: observed issue, evidence, suspected cause, target artifact, hypothesis, success expectation. |
| Prompt Composition and Version Log | Diagnosis target = prompt, sidebar | Reviews prompt sections, edits prompt drafts, shows prompt version history linked to runs and diagnoses. |
| A/B Changed Case Inspector | Two runs selected from Lineage | Shows only cases where rubric scores changed, plus rubric delta matrix and filters. |
| Case Detail Evidence View | Changed Case row | Shows one case’s human summary, Promptfoo facts, side-by-side tutor outputs, rubric deltas, evaluator rationale, and Review Decision. |
| Dataset Coverage Map | Diagnosis target = Evaluation Set, sidebar | Reviews distribution coverage and drafts Evaluation Set case proposals. |
| Rubric Meaning Diff | Diagnosis target = rubric, sidebar | Reviews rubric wording/meaning changes and drafts rubric proposals with comparability warnings. |
| Provenance and Export | Sidebar, export affordances | Packages diagnoses, draft artifacts, review decisions, and provenance without mutating source files. |

Navigation is persistent on desktop. On narrow screens, navigation may collapse into a drawer, but the product remains desktop-first. Evidence tables may stack, but no primary workflow may become hidden behind hover-only controls.

## Voice and Tone

Microcopy should sound like a careful reviewer, not an automation platform.

| Do | Don't |
|---|---|
| "2 safety regressions remain." | "Candidate is not ready." |
| "Measurement changed; compare with caution." | "Invalid comparison." |
| "Starred for follow-up." | "Approved" or "Released" |
| "Dataset coverage improved. This is measurement movement." | "Tutor improved." |
| "Write the diagnosis before drafting a change." | "You must complete Step 3." |
| "No changed cases under this filter." | "Nothing to show!" |

Warnings should explain interpretation risk in one sentence. Avoid scolding. Avoid celebratory copy.

## Component Patterns

| Component | Used On | Behavioral Rules |
|---|---|---|
| Run card | Evaluation Lineage | Click opens Run Detail. Multi-select supports comparison. Shows starred state only; no baseline/candidate role badges. |
| Anchor summary | Evaluation Lineage | Current Baseline and Trusted Measurement are separate. Unknown anchors show `not set` and prompt documentation before comparison. |
| Comparison tray | Evaluation Lineage | Appears only after two runs are selected. Shows artifact changed/stable summary, passive Comparison Type, and one primary action: `Inspect run`. |
| Artifact delta group | Comparison tray, Run Detail | Groups Subject Artifacts separately from Measurement Artifacts. Stable/changed labels are text-first. |
| Diagnosis form | Diagnosis Notebook | Structured fields are required for target artifact and hypothesis. Free text cannot replace target selection. |
| Draft guardrail | Prompt/Dataset/Rubric surfaces | Warns when a second artifact role is changed in the same experiment step. Explains why mixed changes weaken interpretation. |
| Rubric delta matrix | A/B Changed Case Inspector | Summarizes improved/regressed/unchanged counts per rubric. Mixed movement must be visible without color reliance. |
| Filter chip | A/B Changed Case Inspector | Toggles filter state. Chips are not primary CTAs. Active filters show visible count impact. |
| Case row | A/B Changed Case Inspector | Opens Case Detail. Decision status is shown as label, not action. |
| Review Decision control | Case Detail Evidence View | Segmented control or select menu with options: accept tradeoff, needs prompt revision, needs rubric review, needs dataset review, send to technical reviewer. `Save decision` is the action. |
| Transcript pair | Case Detail Evidence View | Two columns on desktop, stacked on smaller screens. Changed lines highlighted softly. Toggle between changed turns and full conversation. |
| Prompt section editor | Prompt Composition and Version Log | Section list plus composed preview. Drafts are visibly drafts until exported/evaluated. |
| Technical details drawer | Evidence pages | Collapsed by default. Opens raw Promptfoo metadata, source paths, hashes, and technical fields. |
| Star control | Run Detail primarily | Star/unstar with optional note. Lineage shows starred state, but does not clutter every card with edit controls. |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Cold load | All | Skeletons match final layout shape. Do not show fake scores. |
| No Experiment Threads | Evaluation Lineage | Explain that no saved Evaluation Runs are available. Offer import/regeneration guidance if supported. |
| Anchor missing | Evaluation Lineage | Show `not set` on the missing anchor. Disable comparison until user documents enough context or explicitly proceeds with warning. |
| One run selected | Evaluation Lineage | Show subtle selected state. No tray yet. Click again or Escape clears selection. |
| Two runs selected | Evaluation Lineage | Show comparison tray. Additional run click replaces the older selected run unless modifier behavior is implemented. |
| Not directly comparable | Comparison tray | Show cautionary Comparison Type and explain which artifact roles changed. No simple winner language. |
| No changed cases | A/B Changed Case Inspector | State: "No rubric scores changed between these runs." Offer `Show all cases` as secondary. |
| Filter returns empty | A/B Changed Case Inspector | State: "No changed cases match these filters." Keep filters visible and removable. |
| Unresolved regression | Case Detail / A/B Cases | Show warning label and require a note before saving a Review Decision. |
| Draft unsaved | Prompt/Dataset/Rubric surfaces | Show draft dirty state. Leaving surface asks to discard, keep draft, or export packet. |
| Mixed artifact change attempted | Prompt/Dataset/Rubric surfaces | Show Draft Guardrail Banner; user may continue only after explicit note. |
| Heuristic preview | Draft surfaces | Label as heuristic, never as Promptfoo result. |
| Raw data unavailable | Technical drawer | Say which field is missing. Do not infer silently. |

## Interaction Primitives

Mouse/touch:

- Click row/card to open its detail.
- Use checkboxes or selection affordances for two-run comparison; do not rely on drag.
- Filters are toggles, not buttons that navigate away.
- Primary buttons are singular per surface region.

Keyboard:

- `Esc` clears current selection or closes the top overlay.
- `/` focuses search/filter on list-heavy pages.
- Arrow keys move through run cards or changed-case rows when a list has focus.
- `Enter` opens the focused run/case.
- `s` toggles star only on Run Detail, not globally.

Banned in MVP:

- Hover-only actions for critical workflows.
- Drag-to-reorder or drag-to-compare.
- Multi-step modals stacked on top of modals.
- Global `Export` button on every page.
- Generic artifact-drafting page.
- Release, approval, deployment, or production promotion language.

## Accessibility Floor

- WCAG 2.2 AA for contrast, keyboard access, focus order, and text alternatives.
- Color-coded status must always include text labels.
- Tables and matrices need row/column headers understandable by screen readers.
- Transcript comparisons must preserve reading order: Version A turn, Version B turn, rubric explanation.
- Focus rings must be visible against `{colors.surface-base}` and `{colors.surface-raised}`.
- Dynamic text resizing must not cause buttons, chips, or artifact IDs to overlap.
- Touch targets must be at least 44px high where touch interaction is expected.
- Technical drawers and comparison trays must announce open/closed state.

## Product-Specific UX Rules

### Evaluation Integrity

The UI must constantly separate two questions:

```text
Did tutor behavior improve?
Did the measurement system change?
```

Subject Artifacts and Measurement Artifacts should be visually grouped wherever artifact versions appear. If Measurement Artifacts changed, the UI must not imply that score movement is pure tutor improvement.

### Lineage Cleanliness

Evaluation Lineage is a map, not a dashboard. It shows runs and orientation. It does not show artifact lanes, diagnosis cards, recommendation panels, or release logic.

Run cards contain:

- Evaluation Run ID.
- Time or sequence.
- Prompt and model config version.
- Evaluation Set, rubric, and evaluator config version.
- Score summary.
- Latest Diagnosis summary.
- Starred state.

Run cards do not contain:

- Baseline/candidate badges.
- Release state.
- Full prompt diffs.
- Full diagnosis forms.
- Next-step recommendations.

### Draft Creation

Draft creation happens where the artifact is understood:

- Prompt drafts happen on Prompt Composition and Version Log.
- Dataset proposals happen on Dataset Coverage Map.
- Rubric proposals happen on Rubric Meaning Diff.
- Model/evaluator config drafts may be compact forms from Run Detail or Diagnosis Notebook.

Diagnosis provides the reason and target. Artifact pages provide the draft.

## Key Flows

### Flow 1 — Maria finds a mixed prompt tradeoff

1. Maria opens Evaluation Lineage.
2. She sees Current Baseline Anchor and Trusted Measurement Anchor separately.
3. In the "Improve beginner safety guidance" thread, she sees three Evaluation Run cards. Only `run_003` is starred; no card is labeled baseline or candidate.
4. She selects `run_001` and `run_003`.
5. The comparison tray appears: prompt changed, model stable, measurement stable, Comparison Type shown as clean prompt A/B.
6. She clicks `Inspect run`.
7. A/B Changed Case Inspector opens with changed cases only.
8. She filters to critical safety regressions.
9. She opens `eval_024`.
10. Case Detail shows Version B is more helpful but skipped a safety check.
11. **Climax:** Maria records `needs prompt revision` with a short note. The decision can seed a Diagnosis without making her read raw YAML first.

Failure: If the selected runs have changed rubric versions, the tray explains measurement changed and routes Maria to rubric/dataset review instead of showing a simple winner.

### Flow 2 — Dev creates a prompt draft from diagnosis

1. Dev opens a Diagnosis linked from Run Detail.
2. The Diagnosis target artifact is `Prompt version`.
3. Dev clicks `Create prompt draft`.
4. Prompt Composition and Version Log opens with the source Diagnosis pinned in context.
5. Dev edits the safety and correction section.
6. The composed preview updates.
7. A guardrail confirms dataset and rubric are unchanged for the next run.
8. **Climax:** Dev saves a prompt draft with a clear behavior hypothesis: restore one guided observation before direct correction.

Failure: If Dev also tries to change rubric text in the same experiment step, the Draft Guardrail Banner explains that changing the tutor and measuring stick together weakens comparison.

### Flow 3 — Lena improves dataset coverage

1. Lena opens Dataset Coverage Map.
2. She sees long beginner dialogs and emotional-resistance cases are underrepresented.
3. She opens the matching segment.
4. The page shows related cases and changed-case movement from prior comparisons.
5. Lena chooses `Generate draft cases`.
6. The distribution impact preview shows beginner coverage increasing and warns that this is measurement improvement, not tutor improvement.
7. **Climax:** Lena accepts a draft Evaluation Set proposal without claiming the tutor improved.

Failure: If generated cases over-concentrate one phishing scenario, the page flags skew before accepting the draft.

### Flow 4 — Omar changes rubric wording safely

1. Omar opens Rubric Meaning Diff from a Diagnosis or Case Detail.
2. He reviews current rubric wording beside proposed wording.
3. The diff labels the change as wording-only, clarification, threshold change, new criterion, removed criterion, or meaning-changing.
4. A comparability warning explains how future comparisons should be interpreted.
5. **Climax:** Omar saves a rubric draft knowing that later runs using it must be labeled as measurement-change comparisons.

Failure: If Omar attempts a meaning-changing rubric edit without confirmation, save is blocked until he acknowledges comparability impact.

## Responsive & Platform

| Breakpoint | Behavior |
|---|---|
| `>= 1200px` | Persistent sidebar. Evidence pages may use two-column or matrix layouts. |
| `900px-1199px` | Sidebar remains but content stacks dense comparison areas earlier. |
| `< 900px` | Navigation collapses. Run cards stack. Transcript pairs stack. Matrices become horizontally scrollable only when accessible labels remain intact. |
| `< 640px` | Review-only posture. Editing forms remain usable, but dense comparison work should recommend desktop when needed. |

## Inspiration & Anti-Patterns

Useful inspiration:

- Linear-style clarity for dense operational lists, but without keyboard-only assumptions.
- Git history as a visual metaphor, but with reviewer-facing language.
- Observable-style evidence notebooks, but without making users code.

Rejected:

- Release dashboards.
- Readiness scoring.
- Generic artifact builder pages.
- Wizard flows that hide evidence.
- Marketing dashboard visuals.
- Raw Promptfoo-first layouts.
- Multiple primary CTAs in one tray.

## Mockup Coverage Recommendation

The load-bearing screens that deserve visual mocks are:

1. Evaluation Lineage with two selected runs and one starred run.
2. A/B Changed Case Inspector with mixed rubric movement.
3. Case Detail Evidence View with side-by-side multi-turn outputs.
4. Prompt Composition and Version Log with source Diagnosis pinned.
5. Dataset Coverage Map with distribution impact preview.
6. Rubric Meaning Diff with comparability warning.

Run Detail, Diagnosis Notebook, and Provenance and Export can be built from the spine tables first unless implementation uncertainty remains.

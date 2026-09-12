---
stepsCompleted: [1]
inputDocuments: []
session_topic: 'User-friendly prompt evaluation monitoring and editing website for the AI Tutor in Tutor System'
session_goals: 'Identify necessary product features for non-technical users, covering prompt composition review, prompt version history, evaluation result comparison, evaluation sample distribution review, natural-language customization of evaluation sets and rubrics, and multi-turn dialog evaluation samples.'
selected_approach: 'progressive-flow'
techniques_used: ['Question Storming', 'Morphological Analysis', 'Role Playing', 'Decision Tree Mapping']
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** geo
**Date:** 2026-06-20

## Session Overview

**Topic:** User-friendly prompt evaluation monitoring and editing website for the AI Tutor in Tutor System

**Goals:** Identify necessary product features for non-technical users, covering prompt composition review, prompt version history, evaluation result comparison, evaluation sample distribution review, natural-language customization of evaluation sets and rubrics, and multi-turn dialog evaluation samples.

### Context Guidance

The product should help non-technical people understand, compare, and safely improve AI Tutor prompts without needing to inspect raw scripts, raw JSON, or evaluation internals.

### Session Setup

The initial feature floor is:

- Prompt composition review.
- Prompt version log.
- Evaluation result comparison, including statistical summaries and A/B comparison.
- Evaluation sample distribution review.
- Natural-language customization for evaluation sets and rubrics.
- Multi-turn dialog evaluation samples.

The brainstorming should expand this into a coherent product surface with enough guardrails, review workflows, and evidence trails that non-technical users can make changes without quietly damaging evaluation validity.

## Technique Selection

**Approach:** Progressive Technique Flow

**Journey Design:** Systematic development from exploration to action.

**Progressive Techniques:**

- **Phase 1 - Exploration:** Question Storming for surfacing hidden product, evaluation, and user-assumption questions before locking into features.
- **Phase 2 - Pattern Recognition:** Morphological Analysis for mapping the evaluation product as combinations of prompts, datasets, rubrics, comparisons, users, and audit states.
- **Phase 3 - Development:** Role Playing for refining the product from the perspectives of non-technical educators, prompt engineers, evaluators, admins, and compliance reviewers.
- **Phase 4 - Action Planning:** Decision Tree Mapping for turning the feature space into concrete workflows, release phases, and safety gates.

**Journey Rationale:** This product is not just a dashboard. It is a control surface for changing how an AI Tutor is evaluated. The flow should therefore discover hidden failure modes, make the product understandable to non-technical users, and preserve enough rigor that prompt and rubric changes remain defensible.

## Phase 1: Question Storming

**Technique Focus:** Generate the right product questions before locking into feature design.

**Seed Input:** The initial examples already identify the core non-technical-user gaps:

- Users cannot confidently tell whether a prompt improved.
- Users cannot confidently tell why a prompt failed.
- Users cannot confidently tell whether the evaluation set is balanced.
- Users cannot confidently tell whether the rubric changed or whether that change affected comparability.
- Users cannot confidently tell whether a multi-turn sample reflects a real tutoring situation.

**Captured Ideas:**

**[Trust #1]**: Evidence-First Improvement
_Concept_: The product should make "prompt improved" mean more than a higher average score. It should show score movement, confidence, regressions, affected rubric dimensions, and example transcripts where behavior changed.
_Novelty_: The comparison becomes evidence-centered instead of leaderboard-centered.

**[Trust #2]**: Failure Explanation Layer
_Concept_: Each failed or regressed sample should have a readable explanation that links the transcript, rubric criterion, model response, expected tutor behavior, and reviewer note. Non-technical users should see "what went wrong" before seeing raw implementation details.
_Novelty_: It treats failures as reviewable teaching cases, not opaque rows in a results table.

**[Validity #3]**: Evaluation Set Health View
_Concept_: The site should show whether the evaluation set is balanced across learner level, phishing scenario type, intervention type, emotional tone, conversation length, locale, and safety-sensitive cases. It should flag gaps and overrepresented clusters.
_Novelty_: The dataset becomes a visible quality object, not a hidden backend fixture.

**[Governance #4]**: Rubric Comparability Guard
_Concept_: Rubric edits should be tracked as first-class changes, with warnings when new results are no longer directly comparable to old results. Natural-language rubric editing should produce a before/after diff and require confirmation of changed meaning.
_Novelty_: It prevents a common false win: improving scores by changing the measuring stick.

**[Dialog #5]**: Multi-Turn Reality Check
_Concept_: Multi-turn samples should be reviewed as tutor conversations with turns, intent, learner state, expected tutor strategy, and failure highlights. The UI should help users judge whether samples represent real tutoring situations rather than synthetic one-shot prompts.
_Novelty_: It evaluates the tutor as a dialog partner, not a single-answer generator.

**[Comparison #6]**: Rubric Delta Review Queue
_Concept_: A/B testing should not only report aggregate winners. The comparison page should identify evaluation cases where at least one rubric score changed, then present those cases as a focused review queue with per-rubric deltas, direction of change, and side-by-side prompt outputs.
_Novelty_: It avoids overwhelming users with every evaluation case while still exposing the exact evidence behind score movement.

**User Insight:** Parameter or prompt changes may improve some rubric dimensions while degrading others. Non-technical users therefore need a case-level inspection page that filters to changed rubric scores and makes each comparison easy to review.

**[Visualization #7]**: Promptfoo Evidence Lens
_Concept_: The A/B case comparison should visualize the rich information already present in the promptfoo dataset instead of flattening it into a table of scores. Each changed case should have a readable evidence panel showing scenario metadata, variables, expected behavior, rubric criteria, assertion results, model outputs, evaluator rationale, and score deltas.
_Novelty_: It treats promptfoo data as a structured story for human review, not just a machine-readable eval artifact.

**User Insight:** The existing promptfoo dataset already demonstrates substantial information. The product should make that information visible and understandable when users inspect A/B case comparisons.

### Accepted Design Direction: A/B Changed Case Inspector

Use this design first for the case-level A/B comparison page.

**Primary Rule:** Show changed cases first, especially cases where one or more rubric scores changed between A and B.

**Screen Structure:**

- Summary matrix across rubrics, showing improved, regressed, unchanged, and net movement.
- Changed case filters for regression-only, mixed tradeoff, critical rubric regression, large movement, rubric type, scenario tag, learner level, and multi-turn cases.
- Changed case list with case title, scenario, changed rubrics, direction, and review priority.
- Case inspector with plain-English summary, metadata fact sheet, A/B transcript comparison, rubric delta strip, evaluator rationale, and reviewer decision.

**Case Inspector Layers:**

- Plain-English case summary.
- Promptfoo variables rendered as human-readable labels.
- Multi-turn transcript view with side-by-side A/B outputs.
- Rubric delta strip with text labels and score direction.
- Evaluator rationale for each changed rubric.
- Reviewer decision options: accept tradeoff, needs prompt revision, needs rubric review, needs dataset review, or send to technical reviewer.

**Design Principle:** Promptfoo remains the source of truth. The UI should translate promptfoo evidence into a readable review experience before exposing raw YAML, JSON, or evaluator internals.

## Phase 2: Morphological Analysis

**Technique Focus:** Map the product as a set of dimensions so the design does not collapse into one overloaded dashboard.

**Transition from Phase 1:** The accepted A/B Changed Case Inspector reveals that the website needs to combine prompt versions, promptfoo case metadata, rubric deltas, multi-turn transcripts, evaluator rationale, filters, and review decisions. Morphological analysis will make those dimensions explicit.

**Initial Product Dimensions:**

- **Comparison Unit:** prompt version, model parameter set, rubric version, dataset version, or combined experiment run.
- **Case Visibility:** all cases, changed cases only, regressions only, mixed tradeoffs, critical-rubric changes, representative cluster samples.
- **Rubric Movement:** improved, regressed, unchanged, mixed, critical regression, statistically meaningful movement.
- **Evidence Surface:** summary score, rubric delta, promptfoo metadata, transcript, evaluator rationale, raw assertion details, reviewer note.
- **User Action:** inspect, filter, mark decision, request prompt revision, request rubric review, request dataset review, approve release.
- **Audience Mode:** non-technical reviewer, prompt engineer, evaluator/dataset curator, admin/compliance reviewer.
- **Dialog Type:** single-turn, multi-turn, long conversation, emotional learner, beginner learner, edge-case safety scenario.
- **Governance State:** draft, under review, approved, blocked, deployed, archived.

**[Workflow #8]**: Release Readiness Review
_Concept_: A proposed prompt version should have a top-level readiness page that summarizes whether it is ready, not ready, or needs review before release. The page should explain the decision using aggregate movement, unresolved changed cases, safety regressions, audience-specific impacts, rubric comparability, and dataset consistency.
_Novelty_: It separates executive decision-making from detailed case inspection, giving non-technical users a clear release gate with evidence-backed drill-downs.

**Accepted Product Position:** Release Readiness Review is necessary. The A/B Changed Case Inspector is a drill-down beneath this readiness workflow, not the first screen a non-technical user should face.

**Release Readiness Inputs:**

- Aggregate score movement by rubric.
- Statistical confidence or uncertainty indicator.
- Count of changed cases requiring review.
- Count and severity of regressions.
- Critical rubric regressions.
- Segment-specific movement, such as beginner learners or long conversations.
- Rubric version comparability.
- Dataset version consistency.
- Reviewer decisions on changed cases.
- Open blockers before approval.

**[Data Model #9]**: Three Artifact Versions Plus Evaluation Run
_Concept_: Prompt, rubric, and dataset should each have their own lightweight version identity. Each evaluation run links to exactly one prompt version, one rubric version, and one dataset version, plus model and parameter configuration.
_Novelty_: It gives the product honest comparison boundaries without turning the system into a heavyweight custom version-control platform.

**Practicality Assessment:** Separate versions are practical if they are treated as immutable artifact snapshots with IDs, metadata, and human-readable change summaries. They should not become a full Git replacement.

**User Insight:** Git already handles code versioning, but rubric versions matter because changing a rubric can change score meaning. Versioning each evaluation artifact is ideal if the implementation remains simple enough to operate.

**Design Constraint:** The current artifact shape is not permanent. Future development may change how artifact content is stored, such as using different files for different rubrics. The product should therefore version logical artifacts, not hardcode assumptions about a single current file layout.

**Implication:** The UI and evaluation run registry should depend on stable artifact IDs, artifact type, content hash, source path or paths, and metadata. The physical file layout can evolve without breaking historical comparisons.

## Phase 3: Role Playing

**Technique Focus:** Test the design against the minds of real users before refining it further.

**Role 1: Non-Technical Curriculum Owner**

This user wants a clear answer first, not a chart first.

**What they need at the top of the page:**

- A plain decision label such as ready, needs review, or blocked.
- A short explanation in simple language.
- A clear next step button.
- A small number of blockers, not a long evidence dump.

**What would fail for them:**

- Opening with dense metrics before the verdict.
- Showing raw promptfoo structure before translating it into plain English.
- Hiding the main risk inside a lower-level case table.

**Role Insight #10**: Verdict-First Readiness Card
_Concept_: The top of the Release Readiness Review should start with a plain-language verdict, a brief reason, and an obvious next action before any detailed metrics or case lists appear.
_Novelty_: It gives non-technical users the decision up front and keeps analysis below the fold.

**User Checkpoint:** For this curriculum-owner perspective, should the top page feel more like a release gate with a recommendation, or more like a review dashboard with status summaries?

**Role 2: Prompt Engineer**

This user wants to understand prompt behavior changes, not just release status.

**What they need:**

- Which cases changed.
- Which rubrics moved up or down.
- What prompt section likely caused the change.
- Whether the change is broad or limited to a narrow scenario.
- Side-by-side outputs with the important lines highlighted.
- A fast way to jump from summary to the exact case that matters.

**What would fail for them:**

- Only showing aggregate score movement.
- Hiding changed cases behind too many filters.
- Making them inspect unchanged cases manually.
- Not showing the likely behavioral tradeoff behind a score change.

**Role Insight #11**: Behavior-Driven Change Trace
_Concept_: The A/B inspector should connect each score movement to the prompt behavior it likely reflects, using changed cases, highlighted lines, and per-rubric rationale so the engineer can infer what to fix.
_Novelty_: It makes the comparison actionable for prompt editing instead of only evaluative.

**Prompt Engineer Question:** Should the case detail view also show a prompt diff or just the outputs and rubrics first, with prompt diff as a secondary drill-down?

**Role 3: Evaluation Dataset Curator**

This user wants to know whether the evaluation set is a fair and useful representation of real tutor behavior.

**What they need:**

- Distribution of cases by learner level, phishing scenario, dialog length, misconception type, emotional tone, and safety risk.
- Visibility into which segments changed during A/B comparison.
- Warnings for overrepresented or underrepresented case categories.
- A way to identify duplicate or near-duplicate samples.
- A way to inspect whether multi-turn dialogs are realistic and pedagogically meaningful.
- A natural-language workflow for proposing new cases or rebalancing the dataset.

**What would fail for them:**

- Only showing aggregate eval scores without sample coverage.
- Treating all cases as equally representative.
- Hiding dataset composition behind raw promptfoo files.
- Letting users add natural-language cases without showing the impact on distribution.

**Role Insight #12**: Dataset Coverage Map
_Concept_: The product should include a dataset coverage page that visualizes the promptfoo evaluation set by meaningful educational and phishing-training dimensions, then links coverage gaps to suggested case additions.
_Novelty_: It makes the eval set inspectable as a curriculum-quality object, not just a test fixture.

**Dataset Curator Question:** Should natural-language dataset editing start from "add cases like this" inside a failed/changing A/B case, or from a standalone dataset coverage page?

**Role 4: Rubric Owner**

This user wants rubric changes to be useful without making historical scores dishonest.

**Decision:** Natural-language rubric editing is allowed only as a draft workflow. The product must show a before/after rubric diff, changed scoring meaning, comparability warning, and examples of behavior that would now pass or fail differently.

**Role Insight #13**: Rubric Meaning Diff
_Concept_: Rubric edits should be reviewed as changes to measurement meaning, not only changes to wording. The UI should show changed criteria, changed pass/fail interpretation, and whether results remain comparable with prior runs.
_Novelty_: It prevents false improvements caused by moving the measuring stick.

**Role 5: Admin or Release Reviewer**

This user wants accountability and a clean approval trail.

**Decision:** Prompt releases must flow through a simple review state: draft, evaluated, needs review, blocked, approved, deployed, archived. Case-level review decisions roll up into release readiness.

**Role Insight #14**: Evidence-Backed Approval Trail
_Concept_: Every release decision should record the compared runs, artifact versions, unresolved regressions, reviewer decisions, and final approval note.
_Novelty_: It turns subjective prompt release judgment into an auditable product workflow.

## Phase 4: Decision Tree Mapping

**Technique Focus:** Convert the brainstorm into a practical product plan.

### Top-Level Product Decision Tree

1. A user opens a proposed evaluation run comparison.
2. The system identifies whether the comparison is clean or cautionary:
   - Clean prompt A/B: only prompt artifact changed.
   - Caution: prompt plus rubric, dataset, model config, or evaluator config changed.
   - Not directly comparable: multiple meaning-changing artifacts changed.
3. The system shows Release Readiness Review first:
   - ready, needs review, or blocked.
   - short explanation and next best action.
4. If there are changed cases, the user opens A/B Changed Case Inspector:
   - changed cases only by default.
   - filters for regressions, mixed tradeoffs, critical rubric changes, tags, learner level, and multi-turn cases.
5. The user resolves changed cases:
   - accept tradeoff.
   - request prompt revision.
   - request rubric review.
   - request dataset review.
   - send to technical reviewer.
6. The readiness page recalculates from unresolved decisions.
7. The reviewer approves, blocks, or requests a new revision.

### MVP Product Surfaces

- Release Readiness Review.
- A/B Changed Case Inspector.
- Case Detail Evidence View.
- Prompt Version Log and Composition Review.
- Dataset Coverage Map.
- Rubric Version and Meaning Diff.
- Evaluation Run Registry.
- Natural-language draft workflows for dataset and rubric proposals.

### MVP Guardrails

- Promptfoo remains the authoritative evaluator.
- Browser UI must not contain provider secrets.
- Natural-language editing produces drafts, not silent source-file mutation.
- Artifact versions are logical snapshots, not assumptions about current file layout.
- Results must indicate whether comparison is clean, cautionary, or not directly comparable.
- Score movement must be shown by rubric and by changed case, not only aggregate pass rate.

### Explicit Non-Goals

- Do not build a custom Git replacement.
- Do not run live provider calls from browser code.
- Do not silently approve prompt changes from aggregate scores alone.
- Do not hide rubric or dataset changes inside prompt comparison.
- Do not require non-technical users to read raw YAML or JSON before understanding the result.

### Final Brainstorm Decision

Proceed with a refactored PRD that treats the website as a non-technical Prompt Evaluation Review Workspace. The product thesis is: prompt evaluation is only useful to non-technical reviewers when comparison evidence is verdict-first, case-inspectable, artifact-version-aware, and guarded against misleading score changes.

**[Visualization #7]**: A/B Signal Map
_Concept_: The A/B comparison page should turn the existing prompt-flow dataset into a visual map of change, showing where each case moved across rubric dimensions rather than forcing users to read raw tables. The view could combine compact score deltas, grouped clusters of similar cases, and a drill-down path for individual comparisons.
_Novelty_: It converts a dense evaluation dataset into a readable change surface, helping non-technical users see patterns before they inspect details.

**User Insight:** The dataset already contains a lot of information, so the A/B comparison feature needs a user-friendly visualization layer that reveals the important changes without exposing everything at once.

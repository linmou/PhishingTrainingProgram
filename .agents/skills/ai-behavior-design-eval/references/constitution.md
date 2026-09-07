# Behavior constitution

Intent: separate overall principles and their priorities from the contextual specs that make them observable.

## Constitutional artifact

Use one canonical constitution for the product scope. It is not a system prompt, rubric collection, or duplicate policy document. Keep scenario requirements, case inventories, prompt changes, and run results in their existing artifacts.

Include:

- Identity, version, purpose, covered actors/modes, and adoption status with the responsible human and explicit decision evidence. Mark proposed material draft; existing prompts and rubrics are evidence of implementation, not proof of intended policy.
- Stable principle IDs with intent, obligations/prohibitions, applicability, and permitted exceptions. Distinguish hard constraints from preferences.
- Named conflicts, the conditions that activate them, and the governing precedence or balancing rule. Do not invent a universal ranking when priorities are conditional. Record unresolved conflicts and who must decide them.
- Revision authority and human decision evidence. The constitution owns principles and priorities; per-requirement grounding belongs only in downstream specifications. Keep links between artifacts in the project index and revision-impact work in downstream planning, without a reverse requirement inventory in the constitution.

Use a concise principle table and conflict table when useful; do not prescribe the product's actual values from generic examples.

## Human review checkpoint

Constitution design and revision are human-in-the-loop. The agent proposes and explains; the responsible human decides the product's principles, priorities, scope, and exceptions.

1. Persist the draft or proposed revision without overwriting the adopted version. Present the principles/conflict rules, meaningful alternatives and tradeoffs, unresolved choices, and affected specs/evaluations. For a revision, show the changes against the adopted version.
2. Ask for human review and pause adoption and dependent acceptance work. Incorporate feedback and return material revisions for review. Silence, benchmark success, agent review, and permission to edit files are not constitutional approval.
3. Record the human decision, identity, date, and exact reviewed version/reference, including accepted changes and remaining objections. Adopt only the explicitly approved version; partial approval leaves disputed material draft. Preserve the decision history and superseded versions.

A requested draft can be delivered complete while adoption remains pending. Reuse an unchanged version's recorded human approval without asking again. If a spec requires a new priority or exception, route that proposal through this checkpoint instead of letting a grounding review authorize it. An agent may review fidelity to already approved principles; it cannot replace the human constitutional decision.

## Spec interpretation and review

Each spec pins an immutable constitution version/reference and annotates each requirement with applicable principles, contextual interpretation, and priority rules. This downstream annotation is the single source of the requirement-to-constitution mapping. Name competing principles and the applicable conflict rule; justify permitted exceptions rather than copying constitutional prose. Implementation-specific constraints may cite a separate source; do not invent a principle merely to force a mapping.

Review whether the interpretation respects applicable obligations, uses priorities in the correct context, and introduces no unauthorized exception. Record outcome, reviewer, date, and supporting rationale. This is design review, separate from model evaluation; model scores cannot approve the constitution or its interpretation.

For example, a proposed priority of factual accuracy over misleading encouragement could ground a spec that corrects an HTTPS misconception without affirming it. This illustrates the relationship, not an adopted tutor principle.

Unresolved material conflicts block acceptance-ready freezing. Provisional specs, rubrics, and diagnostic runs may proceed within scope if explicitly labeled; they do not establish acceptance. Historical results retain their original claims and versions, with missing constitutional grounding reported rather than fabricated.

## Revision impact

For changed principles or priority rules, derive the affected specs, requirements, rubrics, cases, and regression partitions from downstream references and record the impact in evaluation planning; record unaffected judgments with reasons. Unmapped dependencies are gaps, not evidence of no impact. Revising the constitution does not authorize changing all downstream artifacts or running evaluations.

When authorized, revise affected interpretations and checks, add conflict/boundary cases, and evaluate the affected scope alongside existing regression coverage. Changed expected behavior or evaluation contracts require a fresh comparable baseline; editorial-only changes may retain evidence with an explicit no-semantic-impact rationale. Preserve old versions and runs. Never relax the constitution merely to make observed failures pass.

# Final analysis and metric interactions

Intent: explain what an evaluation establishes about the intended behavior, including whether requirements can be satisfied together and which action the evidence supports.

## Report output

Use the executed run record's **Final analysis** for a short decision narrative and **Metric interactions** for the supporting investigation. Keep per-metric results in that run record and raw evidence in immutable runs. For a finding spanning behaviors, record it once in the reviewed run record and link the affected behavior-design IDs and snapshots; do not silently rewrite their designs.

The narrative answers: what the observed behavior implies for the user or learning outcome; which gains and failures matter; how interactions affect the interpretation; what the evidence cannot establish; and what action follows. Cite case/run evidence for substantive claims. Label direct observations, supported interpretations, and unresolved hypotheses distinctly; unmeasured user/learning effects remain inferences. Explain changed experimental factors before attributing an effect to a prompt edit; an uncontrolled comparison does not isolate its cause.

Report failed and incomplete runs as fully as the available evidence permits. State each blocker and the exact remaining work. Design/preparation records may identify anticipated tensions, but empirical interaction findings remain unrun. Saved-run review uses available evidence and proposes missing experiments without launching them.

## Joint outcome analysis

Screen the requirement/check mapping for shared triggers, outputs, decisions, and state transitions, including other behavior designs in the evaluated scope. Select relationships with co-applicable obligations, declared dependencies/priorities, or observed gains paired with regressions. Record the screening scope and selection rationale. Inspect material larger groups when pairwise analysis would miss a combined conflict; an exhaustive matrix of unrelated metrics is unnecessary.

For each selected pair:

1. Determine co-applicability from the frozen requirements and manifest, not from which outputs happened to pass. Requirements for distinct modes, turns, or conditions need not apply simultaneously. Distinguish mutually exclusive action values from conflicting obligations to choose both values in the same state.
2. Join check results by run, case/version, repetition, turn, and target generation. Within each run, both metrics must describe the same preserved output. Compare baseline and candidate on common cases, versions, settings, and predeclared repetition policy; matching run outputs are not assumed identical.
3. Report counts for both pass, only A pass, only B pass, and both fail, plus a separate unevaluable count with missing/error reasons. These counts total the frozen co-applicable case/repetition count N. Show joint success as both-pass/N and keep unevaluable records in N. Never fabricate these cells from marginal pass rates or silently drop invalid outputs. No co-applicable cases means not applicable; absent check evidence means unassessed.
4. Keep partitions and unchanged regression slices visible. Link the outputs, expected labels or rubric judgments, and cases responsible for joint failures and baseline-to-candidate changes. Include joint-success examples as counterevidence to broad conflict claims. For larger groups, report all-pass/N and the relevant violating combinations. Repeated generations of a case are not independent new scenarios; state limited coverage and variability instead of claiming population-wide certainty.

## Investigating apparent conflicts

Use the raw output and the applicable clauses to distinguish these explanations; several may remain plausible:

| Explanation | Evidence needed / useful discriminating check |
| --- | --- |
| Empirical model or prompt tradeoff | On comparable jointly applicable cases, one behavior improves while another worsens. Inspect same-output failures and joint-success witnesses; a controlled prompt variation may test the explanation. Observed opposition or correlation alone does not establish causation or impossibility. |
| Evaluator or expected-label defect | Show how a rubric, label, field extraction, or applicability rule contradicts the pinned spec, or why evaluator disagreement remains unresolved. Review raw outputs against annotated examples; version and validate/calibrate a correction before a new comparable evaluation. |
| Requirement incompatibility | Cite the exact requirements, a reachable shared trigger/state, and why their allowed outcomes have no common valid result under the existing priority/exception rules. For example, the same active state cannot require one single-valued decision field to equal both `continue` and `stop`. For semantic constraints, give a reasoned contradiction and review status; absence of a joint pass is insufficient proof. |
| Conditional priority or dependency | Show the adopted rule and the condition that activates it, or the prerequisite failure that makes another outcome unreachable. Apply the frozen evaluation contract; do not waive dependent failures or mark them inapplicable after seeing results. |
| Case mix, noise, or insufficient evidence | Check shared applicability, partition composition, generation settings, repetitions, missing outputs, and judge variability. Aggregate rates across different contexts cannot establish a same-response conflict. |

For each material finding, preserve supporting and counterevidence, classification and confidence rationale, affected requirement/metric/design IDs, and remaining alternatives. Use scoped claims such as “no joint success observed in these cases” when satisfiability is unresolved. A valid joint-success witness refutes absolute incompatibility for that context, not every other context.

When evidence cannot distinguish explanations, propose the smallest discriminating check and its expected outcomes: for example, score a constructed response intended to satisfy both requirements, inspect a disputed label against the approved rule, or vary one prompt instruction while holding the case and settings fixed. A constructed response is a diagnostic witness, not production performance evidence. Execute only within an authorized evaluation/refinement endpoint and budget. Preserve diagnostic inputs, outputs, changed factors, and metadata separately; respect holdout exposure rules and do not use a diagnostic subset for acceptance.

## Decision consequences

Keep the frozen acceptance gates authoritative. Exploratory joint counts provide diagnosis; they are not a new post-hoc acceptance threshold or an average that offsets another metric's failure. If simultaneous conformance needs an additional gate, propose it for a versioned contract and a fresh comparable baseline.

A demonstrated unresolved requirement contradiction makes grounding inconsistent and blocks acceptance under the existing grounding gate, even if marginal metric rates pass. Show the relevant clauses, affected specs/checks, and concrete resolution options with their consequences. Reuse an applicable adopted conflict rule; a new principle, priority, or exception requires the constitution's human review process. Permission to refine a prompt does not adopt that choice.

An empirical tradeoff alone does not establish inconsistent grounding. Keep actual regression/failure gate results visible, then recommend a supported prompt change or further diagnostic evidence. Evaluator defects require versioned corrections and recalibration/validation. Missing evidence needed for a gate leaves that verdict incomplete; a missing exploratory statistic is reported as a limitation without inventing a new gate. Preserve original results and failure dispositions through any revision.

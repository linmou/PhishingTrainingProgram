# Evaluation run record: <run ID>

Intent: preserve evidence and the decision for one executed evaluation run. This record does not define behavior requirements, constitutional policy, response contracts, or future experiments.

Run ID: <immutable run ID>
Executed: <timestamp>
Behavior specification snapshot: <canonical path and content hash>
Response contract snapshot: <path and content hash, if applicable>
Experiment definition: <path and content hash>
Prompt snapshot: <path and content hash>
Rubric and case-manifest snapshots: <paths and hashes>
Baseline / candidate relation: <baseline ID, candidate ID, or standalone saved-run review>
Experimental changes: <prompt diff/reference and other changed factors; evidence for any claim of comparability>

## Run outcome

Evaluation verdict: <accepted / failed / incomplete>
Grounding verdict: <resolved / pending / inconsistent; based on requirement-level annotations in the design snapshot>
Release verdict: <verified / incomplete / outside scope>
Blocking evidence: <case/check IDs, errors, or none>

## Result summary

| Metric / method | Suite / partition | Passed / expected | Errors / missing | Threshold | Baseline delta | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| <metric> | <scope> | <n/N> | <n/N> | <frozen gate> | <percentage points or not applicable> | <pass/fail/incomplete> |

Supporting-check results: <validity/operational failures and evidence>
New-metric failures: <case/assertion IDs and evidence>
Existing-metric regressions: <case/assertion IDs and evidence>
Missing results and evaluation/provider/parsing/judge errors: <details or none>

Previously passing cases now failing: <case/assertion IDs, evidence, review disposition>
Residual failures allowed by thresholds: <case IDs and explanation; do not hide them>
Required exact/safety/pair checks: <passed/expected and violations>

## Metric interactions

Analysis scope: <metrics and pinned behavior-design snapshot screened, shared triggers/output/state, selected pairs or groups and why; excluded/inapplicable relationships and evidence gaps>

| Interaction ID / metrics | Run / common case set | Both pass | A pass / B fail | A fail / B pass | Both fail | Unevaluable | Expected N / evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <I1; A, B> | <scope> | <count> | <count> | <count> | <count> | <count> | <N and run links> |

<!-- Use separate baseline and candidate rows. Four evaluated cells plus unevaluable must total N. For material larger groups, report all-pass/N and violating combinations in a linked table. -->

| Interaction ID | Finding | Supporting and counterevidence | Classification / remaining uncertainty | Effect on the decision | Next action |
| --- | --- | --- | --- | --- | --- |
| <I1> | <scoped finding> | <case/output/check IDs> | <tradeoff / evaluator defect / requirement conflict / unresolved> | <existing gate result; no retrospective waiver> | <specific action> |

## Final analysis

Conclusion and user/learning effect: <supported conclusion; mark unmeasured effects as inference>
Gains and remaining weaknesses: <material changes with evidence links>
Explanation and limits: <facts, interpretations, uncertainty, and comparability limits>
Recommended action: <retain/refine, repair evaluator, resolve requirements, or collect evidence>

## Evidence

Immutable run directory: <path>
Inputs and outputs: <complete target inputs; raw, parsed, and displayed outputs>
Evaluator evidence: <raw/parsed judgments, expected/actual values, errors, and settings>
Execution metadata: <commands, exit codes, timestamps, revision, worktree changes, usage>

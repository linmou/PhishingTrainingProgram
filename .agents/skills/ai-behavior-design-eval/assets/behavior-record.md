# Behavior: <behavior name>

Intent: specify <observable user/product outcome> and preserve the evidence for its implementation.

<!-- Fill only the sections reached by the requested endpoint. Mark later work unrun; replace every retained placeholder before handing off. -->

Updated: <date>
Behavior ID / spec version: <stable ID> / <version>
Source commit and worktree changes: <revision and relevant changes>
Requested endpoint: <design / preparation / evaluation / release verification>
Current stage and verdict: <stage; unrun / failed / incomplete / accepted>

## Behavior specification

User or learning outcome: <why this behavior is needed>

| Requirement ID | Trigger and prior state | Required result | Prohibited result | Permitted alternatives | User-visible effect / consumer |
| --- | --- | --- | --- | --- | --- |
| R1 | <observable input and relevant history> | <testable result> | <failure to avoid> | <valid variation> | <visible result> |

Non-goals: <what this behavior does not require>
Response contract and invalid-output handling: <existing fields/types, optional decisions, transitions, and recovery>
Clarifying examples and assumptions: <only those needed to resolve ambiguity>

## Evaluation contract

| Requirement | Metric ID | Assertion type | Rubric / assertion version | Applicable suites and partitions | Threshold |
| --- | --- | --- | --- | --- | --- |
| R1 | <metric_id> | <semantic / deterministic> | <path and hash> | <scope> | <frozen threshold> |

Calibration evidence: <annotated examples, grader results, defects and resolution>
Baseline / target prompt: <immutable versions>
Target and judge configuration: <models, endpoints without credentials, temperature, limits, provider options>
Regression comparison policy: <same-case baseline comparison and any stricter case rules>
Repetitions / seed policy: <predeclared policy, unsupported settings stated>
Manifest version and freeze time: <path/hash and timestamp>

## Case applicability and additions

Existing-case inventory: <complete table below or companion artifact link>

| Existing case ID / version | Assessment: reuse, refine, not_applicable | Reason / exact changed fields | Requirement and new metrics | Existing checks retained / source variant |
| --- | --- | --- | --- | --- |
| <case> | <assessment> | <reason> | <mapping or none> | <assertions and source> |

| Added case ID / version | Source suite and provenance | Role | Requirement / metrics | Pair or transition sequence | Independent author / exposure status |
| --- | --- | --- | --- | --- | --- |
| <case> | <record/fixture ID, revision, derived fields> | <positive / negative / boundary / recovery / regression> | <mapping> | <ID or not applicable> | <evidence or not applicable> |

Coverage gaps or inapplicable roles: <reason and remaining work>
Holdout replacements: <exposed IDs, exposure event, retained regression cases, independent replacement IDs>

## Changes and iteration history

| Iteration / run ID | Observed failure or baseline result | Explanation | Prompt change | Other changed factors | Evaluation outcome / evidence |
| --- | --- | --- | --- | --- | --- |
| <baseline> | <observed result> | <interpretation> | <none> | <settings or none> | <immutable run link> |

Accepted modification: <exact prompt diff or immutable reference, with rationale tied to requirements>
Any contract revision: <why spec/rubric/cases changed and replacement baseline ID>

## Evaluation snapshot

| Metric | Suite / partition | Comparable cases / manifest | Baseline passed / expected | Candidate passed / expected | Delta | Threshold | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <metric> | <suite> | <same case set/version> | <n/N> | <n/N> | <percentage points> | <threshold> | <pass/fail/unrun> |

New-metric failures: <case/assertion IDs and evidence>
Existing-metric regressions: <case/assertion IDs and evidence>
Missing results and evaluation/provider/parsing/judge errors: <details or none>

Previously passing cases now failing: <case/assertion IDs, evidence, review disposition>
Residual failures allowed by thresholds: <case IDs and explanation; do not hide them>
Required exact/safety/pair checks: <passed/expected and violations>

## Evidence and completion

Baseline run: <immutable directory>
Candidate and holdout validation runs: <immutable directories>
Run manifests: <inputs, raw/parsed outputs, settings, versions, raw/parsed scores, errors, commands, timestamps, revision, usage>
Production-path checks: <run/evidence or not required/unrun with reason>
Browser/downstream checks: <run/evidence or not required/unrun with reason>
Evaluation verdict: <accepted / failed / incomplete / unrun, with blocking reasons>
Release verdict: <verified / incomplete / outside requested scope, with evidence>
Next step if incomplete: <specific remaining task>

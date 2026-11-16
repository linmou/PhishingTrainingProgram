# Full tutor response history: focused diagnostic

Intent: test the user's two requested changes against previously failing task-progression cases.

Updated: 2026-11-14. Baseline commit: `e3e8697513d52561438e7212ddb443ef962104df`, plus the existing local task-meaning candidate. Local experiment only.

## Design

Baseline is the current task-meaning prompt (the preceding experiment's frozen-v3 `task_meaning` arm), with only posted response text added after each generated turn. Candidate removes both literal `At most 40 words of ` phrases and adds the entire parsed `{reason,decision,response}` to subsequent model history. No new target-analysis instruction, target field, teaching rule, heading change, or learner-facing length change. The existing prompt already asks reason to identify demonstrated and remaining meaning.

Six exposed cases are retained: gift-card contextual judgment, library contextual judgment, library bare agreement, overlapping meeting-plan points, phone contradiction after completion, and all-complete library. The first four reproduce prior failure boundaries; the last two are controls. Each arm has three independent repetitions and two generated turns. The second learner message is always `Okay.`. Earlier legacy tutor messages have no saved JSON; their reasons are not reconstructed. Full JSON becomes available on turn two from the actual first generation. Thus turn one tests only the reason-cap change; turn two tests the combined intervention with each arm's own generated history.

Expected coverage: 72 target responses and 216 judgments. First-turn cases retain their existing provenance and references. Second turns are explicitly synthetic continuations. Tutor statements are not learner mastery, and acknowledgment adds no new demonstrated meaning. No unseen holdout or learning-effect claim. The two changes are bundled at the user's request; their separate causal contributions are not identified on turn two.

## Grounding and measurement

Reuse `tutor-system/docs/ai-behaviors/constitution.md`, the existing T02/T02.1/T02.2 and T01.1 requirements in `tutor-behavior-specification.md`, and the preceding contextual-completion frozen-v3 rubrics and judge procedures. This changes model context and a response-contract length instruction, not the mastery criteria. The old contract document contains legacy names; pin actual parser/source alongside it. Reason remains an observable evidence summary. No semantic output is graded by keyword matching.

Metrics are LLM-judged contextual progression, observation prerequisite, and component disclosure. Judge sees only actual posted dialogue and learner-facing response, never the model's reason/decision. Rerun the prior 16 calibration examples. If calibration fails, retain grades as provisional diagnostics and report exact disagreements; independent review remains necessary. No acceptance claim can follow failed calibration or this limited case sample. Independent reviewer inspects the exact frozen change and every target output, with special attention to the previously unstable overlapping-task and generic-action judgments.

Report both turns separately, all metrics, joint success, case partitions, errors/missing slots, and paired pass-to-fail changes. Primary diagnostic: turn-two progression improvement without prerequisite/disclosure regression. Retain all failures and reviewer disagreements rather than retrying for a favorable verdict.

## Execution

Use configured DashScope endpoint and `qwen3.8-flash` for target and judge. Target temperature 0.3, thinking false, max tokens 600; judge temperature 0, thinking true, max tokens 8000. Same token budgets as prior experiment: removing a word instruction does not remove provider output limits. Two format attempts, two transport attempts, explicit timeouts, three repetitions, no specified seed. Eight workers by default, configurable with `--num-workers`. Shared process concurrency never exceeds worker count. No local GPU task.

Commands from experiment worktree root:

```sh
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-14-full-response-history/run.cjs prepare
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-14-full-response-history/run.cjs run --num-workers 8
rtk proxy node evals/promptfoo/scaffolding-diagnostics/2026-11-14-full-response-history/run.cjs summarize
```

Freeze source contents and exact initial requests before model calls. Save every request, provider response, parsed output, judge input/output, timing, settings, and resumable job ID under ignored `raw/`. Retain compact summaries, source/artifact hashes, log, and report in Git. Resume only identical frozen requests. Stop after this fixed diagnostic; do not tune against its outcomes.

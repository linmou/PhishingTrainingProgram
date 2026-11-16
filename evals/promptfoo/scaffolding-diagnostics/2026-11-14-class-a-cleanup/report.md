# Class A prompt cleanup: paired comparison

Intent: record whether removing style parameters, default content lists and the ambiguous progress-label rule improves tutor progression.

Updated: 2026-11-15. Source: `8cf3259` plus uncommitted working-tree prompt edits. Frozen fingerprint: `0ff95e3620f9b8cd58be7862ac1b77b91d43cab989290aface6611f737379c1e`.

## Arms

| Arm | Prompt |
| --- | --- |
| Baseline | Working tree as it was before the Class A edits. Rebuilt from HEAD `prompts/index.ts`, `basePrompt.ts` and `detectionRules.ts` with the session-start policy text. Its system prompts match the earlier full-response-history candidate exactly for all six shared cases. |
| Candidate | Current working tree: `ACTIVATE_STYLE_PARAMETER = false`; base line, default safe actions, 5 W's framework, privacy principles and "direct teaching, practical checks" removed; progress-label meaning folded into `LEARNER_COMPLETION_EVIDENCE_POLICY`. Role parameter kept. |

Both arms are generated in the same run. The tutor-history format for later turns is the same in both arms (full structured history).

## Datasets and settings

- Contextual-completion `frozen-v3.json`: 9 cases. The 6 full-response-history cases add a second "Okay." turn. 45 targets per arm.
- Task-label continuity `frozen-v12.json`: 12 fixed cases, including three movie-room cases rebuilt from the saved room configuration with each arm's builder, plus 2 four-turn trajectories. 60 targets per arm.
- Each dataset is judged with its own frozen rubrics, judge prompts and calibration set.
- Tutor: Qwen3.8-flash, no thinking, temperature 0.3, 600 tokens. Judge: Qwen3.8-flash, thinking, temperature 0, 8,000 tokens. Three repetitions.
- 40 shared concurrent calls. The old hard limit of 32 is now a warning, because no document justifies it as a provider limit. No 429 responses were observed.
- The frozen inputs came from the MacBook copy by Taildrop (archive sha256 `24605234…9210`). All four frozen-file hashes match the MacBook manifest check.

## Results

Calibration agreed 16/16 (contextual) and 39/39 (task label). All 210 targets were valid. One contextual prerequisite judgment ended with a format error.

| Dataset | Arm | Progression | Prerequisite / ordering | No premature answer | All three |
| --- | --- | --- | --- | --- | --- |
| Contextual (45) | Baseline | 33 | 43 | 41 | 30 |
| Contextual (45) | Candidate | 32 | 41 (+1 error) | 42 | 30 |
| Task label (60) | Baseline | 51 | 54 | 47 | 43 |
| Task label (60) | Candidate | 52 | 54 | 49 | 46 |

Paired check outcomes: 12 pass→fail and 14 fail→pass. With three repetitions, these differences are within sampling variation. The cleanup is neutral: no measurable improvement and no regression.

## What the failures show

- **Real movie room:** neither arm switches points. All six replies stay on the exact time/place action. All fail because they ask for the action after "Oh, not safe", which the judge does not accept as demonstrated recognition.
- **Wrong-target selection remains in both arms.** Only failed progression replies were read, so the counts below are lower bounds; passing replies were not audited, and the judge has passed real switches before. Counting replies that work on a point or task other than the unfinished one: about 12/105 in each arm. That covers contradiction-then-"Okay" moving to consequences (3/3 each), the overlapping event returning to "tomorrow" (6/6 baseline, 5/6 candidate), `journey_5` turn 4 (1 each), the "THIS FRIDAY" switch (baseline 1), and generic action instead of the configured source check (baseline 1, candidate 3). Only the specific historical movie-room switch was absent (0/6).
- **Remaining failures are evidence tracking, not style or default content:**
  - advancing after bare agreement (`component_5_bare_agreement`, 0/3 progression in both arms);
  - re-asking an already demonstrated overlapping meaning (`event_one_answer_covers_overlapping_points`, progression 0/6 → 1/6);
  - generic safe-action questions instead of the configured source check (`library_contextual_judgment`, progression 4/6 → 2/6, small sample).

These match the Class B items in the contradiction review: bare agreement, overlapping evidence and repair after contradiction.

## Target-continuity audit (all 210 replies)

`continuity.cjs` adds a separate judge for one question: does a reply leave an unfinished knowledge point for a different one? Choosing observation versus behavior within the same point is not judged. Retesting a completed task is a separate category. Same model and settings as the run judge.

Calibration: 13/13. The examples are 12 existing task-label examples relabelled for cross-point jumps only (4 jumps, 8 non-jumps), plus the historical movie reply ("wait until you leave the theater", a jump). These are exposed examples, not a holdout.

Four calls timed out at 180 s. Their first records are kept as `*.timeout-attempt1.json`; one identical retry resolved all four.

| | Baseline (105) | Candidate (105) |
| --- | --- | --- |
| Cross-point jumps | 4 | 6 (one disputed) |
| Retest of a completed task | 6 | 6 |
| Allowed advance after a completed point | 3 | 4 |
| Generic content outside the inventory | 0 | 1 |

The jumps:
- `phone_contradiction_after_completed_task`, turn 2 after "Okay.": 3/3 in each arm. The reopened point is left for stranger-contact consequences.
- `component_4_recognition_done`: baseline 1/3 ("THIS FRIDAY").
- `component_5_bare_agreement`: candidate 2/3. After a bare "Okay." it moves to the sharing action of another point.
- `component_5_recognition_confusion`: candidate r3. Disputed: a near-identical baseline reply was judged current-point.

Every jump also failed the run's progression metric, so in this sample the progression judge did not pass any jump. The overlapping-event failures are retests of demonstrated meaning, not jumps. The earlier hand count of about 12 per arm mixed jumps with retests and generic action questions.

Conclusion: cross-point jumps occur in about 4–6% of replies in this sample, concentrated in two triggers: bare agreement after tutor-supplied content, and "Okay." after a contradiction. The original movie-room switch did not occur (0/6). The sample is small and exposed; this does not establish a production rate.

## Limits

These are exposed development cases, not holdouts. Three repetitions per case. Most cases use the `casual_peer` preset; only the three saved movie-room cases exercise `supportive_adult` style parameters. Machine grades are not independently reannotated in this run.

## Evidence

Ignored `raw/`: `frozen.json`, `baseline-src/`, `targets/`, `judgments/`, `calibration-*`, `summary-1794719698671.json`, `execution-*-1794718702233.json`, `run.log`. Run time 16.6 minutes.

Reproduce from the worktree root:

```sh
node evals/promptfoo/scaffolding-diagnostics/2026-11-14-class-a-cleanup/run.cjs prepare
node evals/promptfoo/scaffolding-diagnostics/2026-11-14-class-a-cleanup/run.cjs run --num-workers 40
```

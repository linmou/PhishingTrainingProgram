# Assessment option gate and multi-target browser coverage

Intent: record the learner input gate, the two-target tutoring/assessment test, and the limits of current validation.

Date: 2026-10-14. Baseline commit: `ecee681a9856b46e924bb9c9c61d4adf5c348826`.

## Changed behavior

An open learner-owned assessment disables ordinary chat and generic Reply. The learner submits its displayed option controls. The shared context rejects missing/invalid selections, wrong assessment/question IDs, and stale or foreign questions before persistence. Valid answers use the trusted API even if the checklist policy changes. Retry keeps the gate; pass, terminal failure, cancellation or an incomplete historical question restores normal discussion. Grading and target scheduling remain server-authoritative.

`RoomContext.md` and the QA guide now describe this input contract. The browser guide describes the gate checks and two-target delivery journey. The implementation spec is [the option-gate spec](../../../_bmad-output/implementation-artifacts/spec-assessment-option-gate-and-multi-target-e2e.md).

## Browser coverage

`assessment-answer` now checks chat/Reply gating, empty selection, correctly bound persisted answers, authoritative attempt records, retry and terminal reload behavior. `assessment-delivery` tutors URL Domain Check while Partial, develops full understanding, delivers and answers its assessment, and sends tutor feedback parented to the terminal answer. It then repeats that cycle for Official Support. Assertions check distinct target/assessment identities, selected options, target-local progress/events, exactly two closed assessment lifecycles, and feedback after each closure.

The test records per-step learner messages, function requests/results, provider attempts, stored public messages, private lifecycle/attempt rows, before/after progress, gates and screenshots before fixture cleanup. Its policy preflight requires the hosted final-assessment helper and matching preparation function. It never substitutes the old Partial/basic trigger.

## Validation results

| Check | Result |
| --- | --- |
| Focused frontend regression matrix | 15 suites, 195 tests passed; answer routing, concurrency, ingress, modes, adapters, page lifecycle/decision/draft, PostComment and PublicAssessmentQuestion |
| Browser harness | 20 tests passed, including actual Chromium gate assertions, invalid persisted bindings, policy prerequisite and wrong-parent/time feedback regression |
| Changed-file TypeScript diagnostics | Zero across seven changed source/test files |
| Full repository TypeScript | Exit 2; 454 diagnostics in untouched files, including existing integration fixture/type mismatches; full output retained |
| Changed production-source ESLint | Zero errors; two existing hook dependency warnings |
| JavaScript syntax and whitespace checks | Passed |
| Independent review | Blind, edge and acceptance reviews completed; sequencing/first-target-tutoring findings corrected and re-reviewed with no open findings |
| Real original-room student view | Chrome DevTools confirmed composer and all 24 Reply buttons disabled; all four option inputs enabled; no answer submitted |
| Live staging multi-target delivery | Failed hosted-policy prerequisite before room fixtures or provider calls; neither cycle ran |

Frontend command from `tutor-system/`:

```sh
rtk proxy env CI=true npm test -- --watchAll=false --runInBand --silent --testPathPattern='(RoomContext\.transfer|RoomPagePost\.transfer|transferAssessmentUiAdapter|PostComment|PublicAssessmentQuestion).*test'
rtk proxy npm run test:e2e:unit
rtk proxy npx tsc --noEmit --pretty false
```

## Live evidence and remaining release requirement

The local production-backed app on port 3100 showed the gate against the original room `6dbd1133-c07a-4af6-9da4-41f874e26ffb`, learner `794abdb9-6c8e-4526-a384-1e1a5a7f794a`, assessment `85feb0e3-b542-4024-891c-d8266fc10e47`. This validates the visible gate on real persisted state; it does not repair or grade the prior answer.

A separate local app on port 3101 targeted staging `ciubrzggdqesgvfkpolj`. Live run `20261014213730-42243e4f` reported both `final_policy_helper = false` and `preparation_uses_final_policy = false`. The workflow failed with `Live prerequisite mismatch` and `room_ids = []`; no room fixture was created or cleaned. The hosted final-assessment policy release remains necessary before a successful live multi-target run can be claimed. This frontend change does not apply that separate release.

Evidence directories, retained locally:

- `tmp/assessment-option-gate-20261014/`: original-room DOM snapshot, TypeScript log, review diff and review JSON artifacts.
- `tmp/browser_demo_runs/staging-template-20261014213730-42243e4f/`: report, prerequisite result and failure screenshots.

## Review resolutions

The initial E2E draft lacked a real tutor turn during the first Partial phase and posted Support evidence before first-terminal feedback. Both defects were patched: each Partial phase has real reviewed tutoring with unchanged learner progress, and each terminal answer receives its own tutoring reply after closure. A dedicated regression rejects a next-topic parent, wrong feedback mode, and pre-close/equal-close timestamps. The edge and acceptance reviewers confirmed the revised sequence.

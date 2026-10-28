# First-round judge aggregation

## Method

Five independent judges reviewed the four complete candidate plans against the request, repository fit, feasibility, simplicity, assumption discipline, risk handling, and validation quality. Judges were not shown one another’s output. The fixed aggregation rule is:

1. Rank candidates by each judge’s full-plan ranking.
2. Sum rank positions across all five judges; lower is better.
3. Use rubric totals and repeated recommendations as supporting evidence.
4. Preserve minority risks even when they do not change the selected backbone.

## Result

All five judges produced the same full ranking:

| Candidate | Rank positions | Rank sum | Rubric totals | Decision |
|---|---:|---:|---:|---|
| `plan_1.md` — state-machine contract | 1, 1, 1, 1, 1 | **5** | 29, 29, 29, 29, 29 | **Select as backbone** |
| `plan_2.md` — evaluation-first gate | 2, 2, 2, 2, 2 | 10 | 26, 28, 26, 27, 27 | Import evaluation discipline |
| `plan_3.md` — minimal suggestion overlay | 3, 3, 3, 3, 3 | 15 | 25, 26, 25, 26, 26 | Import bounded lifecycle/UI tactics |
| `plan_4.md` — audit event sourcing | 4, 4, 4, 4, 4 | 20 | 24, 24, 23, 24, 24 | Import revision/reconnect controls only |

Plan 1 is selected because it gives the feature one narrow, testable domain boundary while preserving the existing `RoomContext` and suggestion/composer flow. Its central commitments are:

- one strict structured AI decision contract;
- one pure two-state transition function;
- separate raw AI output, human review draft, and final sent record;
- an authoritative room mode plus message-level final mode;
- atomic reviewed-send persistence;
- server-enforced progress locking; and
- deterministic, Promptfoo, live-Qwen, browser, regression, and metadata gates.

## Imports from other candidates

### From `plan_2.md`

- Capture the existing tutoring evaluation baseline before behavior changes.
- Freeze a versioned observable behavior contract and fixture policy before prompt tuning.
- Use ecological cases and independently worded synthetic holdouts.
- Add equal-error-count contrast cases so the four-consecutive-violation example cannot become a hidden counter rule.
- Treat schema validity, critical false positives, and critical correction exits as blocking gates.
- Record provider, model, prompt/configuration version, inputs, raw/parsed output, scores, timestamps, and failure classification.

The final plan will not require stochastic model gates to finish before deterministic persistence or UI work can start. The evaluation contract is frozen first, and every gate is required before delivery.

### From `plan_3.md`

- Keep the existing suggestion-to-composer pipeline as the implementation boundary.
- Give each valid generated suggestion a stable identifier.
- Record accepted, wording-edited, mode-rectified, rejected, and superseded dispositions.
- Preserve an edited draft after a failed send.
- Test rapid regeneration, duplicate sends, stale suggestions, and rejection without state transition.

Raw model evidence remains immutable; dispositions are separate actions or constrained lifecycle fields.

### From `plan_4.md`

- Make a monotonic room-state revision mandatory for reviewed sends and manual overrides.
- Reject stale writes rather than silently overwriting newer state.
- Ignore older real-time updates and refetch authoritative state after reconnect.
- Test cross-room and student access to raw reasons, prompt data, and audit metadata.

The final plan rejects full event sourcing, replay/rebuild infrastructure, general event payload schemas, and a separate `correction_evaluated` fact. Those would create a second source of truth and are not required by the requested two-state feature.

## Preserved risks

- Guard must not escalate genuine confusion, effort, partial improvement, or clarification-seeking merely because mistakes repeat.
- Guard must not exit on superficial, evasive, or keyword-only compliance.
- Malformed structured output must fail closed; no text-based mode inference or silent tutoring fallback.
- The final message and authoritative room mode must commit or roll back together.
- Client locking alone is insufficient; the progression mutation must also be protected at the server/database boundary.
- Raw AI reasons and audit metadata must not leak to students or student DOM.
- Historical Guard messages must retain Guard identity after the room returns to tutoring.
- Existing tutoring quality must remain at its current gate.
- Manual activation/deactivation must be explicitly audited and must not depend on a hidden trigger or implicit tutoring default.

## Gate result

The first-round judging gate passed: five independent judge artifacts are present and complete, the ranking is unanimous, the fixed aggregation rule selects `plan_1.md`, and the selected imports/incompatibilities are explicit.

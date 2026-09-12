# TDD Gate Outcome: transfer_assessment_lean_closeout

## Verdict

`PRE-RED GATE: FAIL` - TDD activation terminated. The slice was misclassified and is not
TDD-shaped.

## Monitor finding that terminated the run

BLOCKING 2: the mapped fix edits the same test file that Red edits, and the Green phase forbids
any test-file edit. The definition of done named exactly one artifact, the test, so no production
change could make Red's assertion pass. A zero-delta Green is not defined in the phase contracts.
The skill's applicability gate instructs: "If no executable behavior remains after classification,
stop using this skill and continue with the appropriate non-TDD workflow."

This was the main agent's classification error, not a defect in the monitor or the tooling.

## All blocking findings, confirmed by the main agent

1. **Gate artifacts are Git-ignored.** `/Users/.../.git/info/exclude` line 7 excludes `/audits/*`,
   and no negation exists for this feature, so `tdd_snapshot.py` cannot include the request map,
   role receipt, or scope artifact, and `phase_guard.py` would fail closed. Prior runs added
   explicit negations such as `!/audits/transfer_domain_*`, which is why they succeeded.

2. **No Green-legal artifact.** See the verdict above.

3. **The Red design was internally contradictory.** The map demanded the function list intersect
   the final-state function set in one place and be a subset of it in another; intersection would
   not catch stale names. It also named no computation for "final-state function set", although a
   correct set requires DROP/CREATE awareness because migration 032 both drops and re-creates
   `review_assessment_draft_v1` and `send_reviewed_tutor_response_v3`.

4. **The requirement table did not trace every clause.** The seven kept operations, six removed
   operations, five removed draft columns, the KEPT `assessment_request_results`, the append-only
   status of 025/027/028/029, and the baseline status of 032/033 were all untraced. The map
   recorded only 034/035/036 as pre-committed.

## Factual error in the map, found by the monitor

The map said "the live seven plus the two functions that genuinely carry a narrow search_path".
The list holds seven entries in total: four that exist in the final schema
(`review_assessment_draft_v1`, `send_reviewed_tutor_response_v3`, `post_assessment_message_v1`,
`prepare_transfer_turn_v1`) and three that do not (`reject_assessment_draft_v1`,
`regenerate_assessment_draft_v1`, `transfer_draft_trigger_key_v1`). "Seven plus two" was nonsense.

## Notes that stand

- Route `compact` was correctly chosen for the artifact class; the problem was the slice, not the
  route.
- Path classification was clean: the editable test path is test-like under both heuristics and does
  not intersect the protected set.
- Migrations 032/033 (commit `95849f1`) and 034/035/036 (commit `2582030`) are both baseline.
- Request map sha256 `6b79fa1bc26bc90e919a1741f576b86d0f5660b1198be224515d59edbf92b754`.
- Role receipt sha256 `2d11fa4b89ff4daef25c2019cc8bd9866f65c9b10ead25e67138c30f37915d36`.
- No `pre_red` snapshot was created and no `refs/tdd/transfer_assessment_lean_closeout/*` ref exists.

## Consequence

The test-suite correction proceeds as ordinary test maintenance, outside TDD phases. The remaining
cleanup - specs, tasks, analysis, checklists - is guidance work that was always outside this
skill's scope. The hosted behavioural lane stays deferred because it requires a service_role
connection.

## Cost of this failed activation

One delegated monitor and roughly thirty minutes of wall clock, producing no code change. The
useful output is this record plus three confirmations: the route was right, the path
classification was clean, and the two baseline commits are correctly not in-phase. Had the
applicability gate been applied honestly at step 0, the run would not have started.

## Correction to notes that stand

The earlier "Path classification was clean" note is true and irrelevant: classification was never
the defect. An audit of the request map shows the opposite - every mapped `executable` row named
only a test file, and the definition of done named no production artifact, so no legal Green
existed. Red's target and the fix were the same file.

## Skill follow-up applied

The gate in `/Users/admin/.agents/skills/fast-multi-agent-tdd` now rejects this class of slice at
step 0, before any monitor is delegated: a slice is admitted only when Red has a test-like artifact
and Green has a production-side artifact distinct from every planned Red test path. Test-only
deltas are named `test maintenance` and routed outside the skill, so this failure costs nothing
next time instead of one monitor cycle.


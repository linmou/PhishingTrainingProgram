# TDD Request Map: transfer_assessment_lean_closeout

`route: compact`

## Requirement re-check

Restated outcome, from the user's perspective: the component 102 cleanup must leave no executable artifact
that still depends on a removed operation, dropped column, or dropped function, so that a reader or a
runtime call cannot be misled by the pre-refactor surface.

Constraints carried forward from the conversation and repository guidance:

- The lean design keeps exactly seven operations: `initialize_checklist`, `post_message`, `analyze_message`,
  `prepare_turn`, `review_draft`, `send_reviewed`, `process_message`.
- Removed operations: `capabilities`, `reject_draft`, `regenerate_draft`, `cancel_question`,
  `invalidate_question`, `confirm_external_transfer`.
- Removed functions: `reject_assessment_draft_v1`, `regenerate_assessment_draft_v1`,
  `transfer_draft_trigger_key_v1`, `confirm_external_transfer_v1`.
- Removed draft columns: `trigger_key`, `supersedes_draft_id`, `rejected_reason`, `raw_hash`, `final_hash`.
- `private.assessment_request_results` is KEPT; it is the generic request-idempotency ledger.
- Migrations 025/027/028/029 retain the pre-refactor definitions deliberately as append-only history, and
  must not be rewritten. Removal lives in 032/033/036.

## Requirement-to-feature table

| Requirement | User-visible feature | Must-exist artifact | Acceptance evidence | Work type | TDD? |
|---|---|---|---|---|---|
| No executable test still pins a function that the final schema does not contain | A reader of the test suite sees only live functions | `tutor-system/src/services/__tests__/transferMigrationExtensionCalls.test.ts` | Test passes AND does not name any removed function | executable | yes |
| The hosted lane exercises only live RPCs | `transfer_assessment_rpc_behaviour.sql` runs green under service_role | that file | Manual run by the operator with service_role | executable | deferred (external service) |
| Specs and task lists describe only the lean design | Reader-facing docs match the code | `specs/102-transfer-backend/*` | Consistency review | guidance | no - outside TDD |

Excluded from this slice, with reasons:

- `specs/102-transfer-backend/**`, `specs/**/checklists/**`, `plan/.../milestone_ledger.md`: work type
  `guidance`. The skill's trigger conditions explicitly exclude tasks that edit only Markdown.
- `supabase/tests/transfer_assessment_rpc_behaviour.sql`: executable, but its execution requires a
  `service_role` connection to the hosted project, which this session does not hold. That is an external
  service and non-deterministic availability, so it cannot be the compact slice. It is recorded here as a
  deferred executable row rather than silently dropped.
- Migrations 034, 035, 036: authored and committed in `2582030`. They are production changes already made
  before this activation; this map records them so the phase guard can classify them as baseline, not as
  in-phase edits.

## Selected vertical slice

The smallest end-to-end usable behavior: `transferMigrationExtensionCalls.test.ts` reports only functions
that exist in the final schema, and still performs its real job - catching a schema-unqualified `digest(`
call in a transfer migration.

Classification is `compact` because the test is a bounded, deterministic, local filesystem scan. It reads
`supabase/migrations/*.sql`, parses text, and asserts. No network, no database, no concurrency, no GPU, no
non-determinism, and no unrelated persistent side effect.

## Highest-risk execution boundary

The boundary is the test's own function-name list versus the migration history it scans. The test currently
passes for the wrong reason: it lists three functions that the final schema does not contain, and because
the scan is over migration *history* - where those functions still legitimately appear - the stale list is
invisible to the assertions. A reader would conclude those functions are live.

## Minimal execution path that crosses the boundary

1. Run the suite as it stands and record the passing baseline.
2. Add an assertion that names the live function set and requires the test's own list to intersect the
   migrations' final-state function set. This is the Red: it must fail against the current list.
3. Correct the list to the live seven plus the two functions that genuinely carry a narrow search_path.
4. Re-run: green, and the new assertion holds.

## Observable evidence that the boundary was crossed

The new assertion fails before the fix and passes after, while the original digest-guard assertions keep
passing. That combination proves the test both caught the stale list and retained its original power.

## Behavior-controlling properties, observations, and shortcut implementations that must fail

| Property | Test observation | Shortcut that must fail |
|---|---|---|
| The list contains no function absent from the final schema | New assertion over the final-state function set | Hard-coding a list that still includes the three removed names |
| The list still covers functions whose `search_path` excludes `extensions` | Existing digest-guard assertions keep passing | Deleting the list entirely, or emptying it, to satisfy the new assertion |
| The test still detects a real unqualified `digest(` call | Existing offender-detection assertions | Weakening the regex, or asserting only that the file exists |
| The test does not depend on migration ordering by accident | Reuse the existing sorted `migrationFiles()` enumeration | Globbing unsorted, or pinning a specific migration filename |

## Controls that govern the selected path

- `NARROW_SEARCH_PATH_FUNCTIONS`: the list under test; its membership is the behavior.
- `repairedPairs()` and `liveOffenders()`: the two derived sets. Removing a name from the list changes
  `liveOffenders()` output, which is why the existing offender assertion must be re-derived rather than
  deleted.
- `migrationFiles()`: bounds the scan to `NNN_*.sql`. Unchanged; noted so the guard can confirm no edit.
- `functionBlocks()`: the CREATE OR REPLACE splitter. Unchanged; noted for the same reason.

## Definition of done

- `transferMigrationExtensionCalls.test.ts` passes.
- Its function list names no removed function.
- Its original digest-guard power is retained, proven by the offender-detection assertion still failing when
  a genuinely unqualified call is present in the scan.
- The full transfer suite still passes.
- Docs and specs are NOT edited in any TDD phase; they are handled in a separate non-TDD pass.

## Resource ceiling

Consistent with the repository's instruction to be conservative with agents: one dedicated monitor, and the
mandated three-reviewer Red debate. No parallel implementers.

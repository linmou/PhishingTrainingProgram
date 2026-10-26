# Scenario Dropdown Review

Intent: record the isolated reuse of the dropdown fix for issue #32.

Updated: 2026-10-26. Source commit: `2caa4ae`. Base: merged PR #31 on `no_sign_up`.

Integration: PR #36 recovery at `7493add` is included for combined verification. The generated dropdown retains all seven current catalog entries after retiring Personal Details Protection. User requested merging the recovered fixes after checks on 2026-10-26.

The AI settings dropdown generates scenario options from `SCENARIO_TEMPLATES`, grouped by category, including Movie Meetup Social Engineering. A component test checks that every registry entry appears exactly once. The existing catalog and saved learning targets are unchanged.

Review found no blocker in the isolated option generation. Three focused Jest suites pass, 32 tests total, using explicit local placeholder Supabase configuration. The initial run lacked that configuration and failed at client initialization; rerunning with the repository CI settings passed. Existing React test warnings remain.

This is a partial fix for #32: settings still infer scenario identity from target-array equality; explicit saved identity, full room-template mapping coverage and live creation/save/reopen acceptance remain open. The dropdown test covers every current registry option and catches omitted categories/options. No deployment is claimed.

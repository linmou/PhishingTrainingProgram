# Scenario Dropdown Review

Intent: record the isolated reuse of the dropdown fix for issue #32.

Updated: 2026-10-26. Source commit: `2caa4ae`. Base: merged PR #31 on `no_sign_up`.

Integration: PR #36 recovery at `7493add` is included for combined verification. The generated dropdown retains all seven current catalog entries after retiring Personal Details Protection. User requested merging the recovered fixes after checks on 2026-10-26.

The AI settings dropdown generates scenario options from `SCENARIO_TEMPLATES`, grouped by category, including Movie Meetup Social Engineering. A component test checks that every registry entry appears exactly once. The existing catalog and saved learning targets are unchanged.

Review found no blocker in option generation or the catalog integration. Four focused Jest suites pass, 41 tests total. Current source candidate `be8a695` passed all three GitHub checks in run 40392785166 after retrying a build job stalled during checkout. The initial isolated 32-test run and later combined regression used explicit local placeholder Supabase configuration. Existing React test warnings remain.

Staging acceptance passes for all six normal teaching templates: create a room, verify its image and five targets, check the mapped scenario, save/reopen, and confirm Movie Meetup is selectable. General Scam Indicators exposes five targets; custom target text persists and reopens as Custom / General. Report: `output/playwright/template-recovery-ciubrzggdqesgvfkpolj-20261026201550797-64513/report.json`. All six rooms, dependent fixture rows and the temporary user were removed; the project lease was released. Source tree: `c8c5d725b44f2f757d1ab27268dfe75028065dba`; public assets: `3b0a4f7288faa95177b7e943cabcfc649276a059`; lockfile: `ad852b5a9e5a05fd79f4f57a9f7bcc981ba60b2c`. The evidence update changes documentation only, preserving those tested artifacts.

PR #36 merged as `97883a6` with identical tested runtime artifacts. The phone image was corrected in staging and production using an image-only guarded update, argument SHA-256 `ac068d8a8761922b3f46115b91948e11a9707c78063648b639c326358c411191`. Other template fields retained hashes `65bb151d3014b8ec705019ef63c462f5` (staging) and `b511ccd3101537bde27c236b7fca2565` (production). Its phone-room browser checks pass against both projects with cleanup; reports are in the sibling recovery worktree's `output/playwright/template-recovery-ciubrzggdqesgvfkpolj-20261026201132558-58574/` and `template-recovery-zgbufaxooqxeabewktzd-20261026201329423-61148/`. Earlier selector and premature-navigation failures remain saved; the harness now waits for modal closure and persisted state.

Release owner: root Codex agent. User authorized recovery, PRs and merge on 2026-10-26. Render deployment `dep-dbfr8eh5efls73fr7fgg` was observed live at #36's merge commit. After #33 merges, require identical integrated source/assets/lockfile, confirm its Render deploy is live, then run the six-template browser check against the public production app. Final acceptance and report path are recorded in PR #33's release handoff; no pending production step is implied complete by this document.

This fixes the missing dropdown entry and verifies current template mappings, but #32 remains open for explicit saved scenario identity and stronger inventory validation. Settings still infer scenario identity from target-array equality. The dropdown test covers every current registry option and catches omitted categories/options.

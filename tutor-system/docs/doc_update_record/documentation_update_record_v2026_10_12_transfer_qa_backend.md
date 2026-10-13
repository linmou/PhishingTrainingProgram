# Transfer assessment backend QA regressions

Intent: preserve the browser failures as database regression assertions and restore the Edge test suite's room-entry contract coverage.

Date: 2026-10-12. Baseline commit: `e67a509e16a15521d8d8b2c3d6e96e3bb452d749`.

The browser QA observed `PERSISTENCE_FAILED` for fresh checklist synchronization in a second room and for a tutor status edit. The Edge handler forwards these operations to `initialize_transfer_checklist_v1` and `edit_room_checklist_v1`; its generic persistence error does not establish a database root cause.

`supabase/tests/transfer_assessment_qa_regressions.sql` creates two transfer rooms for one learner, initializes and retries the same local targets independently in each room, changes covered progress back to partial, and checks that an observer cannot change that progress. It rolls back its fixtures. Run it against a disposable database restored from the inspected hosted baseline before implementing the database correction, then repeat against a fresh baseline with the candidate SQL applied.

The existing assessment Edge tests had five stale fixtures/assertions after the room-entry guard was added. They now distinguish the `join_room_v1` call from posting and assessment commits, check its verified `p_student_id`, and allow the integrated assessment journey to reach answer processing. The tutor edit test now sends and asserts the actual `updates` payload.

Validation: `/Users/admin/.deno/bin/deno test --no-lock --allow-env --allow-net --allow-run --unstable-sloppy-imports supabase/functions/assessment-api/index.test.ts` from `tutor-system/`: baseline 21 passed / 5 failed; corrected tests 26 passed / 0 failed. This includes the Edge type-check test. Worktree dependencies reuse the main checkout's ignored `node_modules` through a symlink.

Database status: **local setup blocked**. Supabase MCP schema inspection returned Unauthorized on 2026-10-12. The new SQL assertions have not run, and no database correction or migration was authored from archived schema. Staging (`ciubrzggdqesgvfkpolj`) and production (`zgbufaxooqxeabewktzd`) remain unmodified by this work. Resume by restoring MCP access, inspecting the live functions and constraints, exporting a fresh baseline, and executing the documented local Red-Green sequence before staging deployment.

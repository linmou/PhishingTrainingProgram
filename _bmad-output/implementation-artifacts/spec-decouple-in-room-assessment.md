# Decouple in-room assessment from learning tracing (#100)

The checkbox controls only preparation and delivery of new transfer assessments. Active learner-owned transfer checklists always receive ordinary-message analysis and remain visible to the learner and owning tutor. Assessment answers keep their existing trusted processing lifecycle.

Use `rooms.in_room_assessment_enabled boolean not null default true`. Preserve existing rooms' `transfer_learning_enabled` values during backfill, as explicitly selected by the maintainer. Preserve the cyberbullying practice restriction. Retain the legacy column for compatibility; checkbox saves never write it. A tutor-owned `configure_assessment` operation writes the protected new column through the existing trusted boundary; direct anon/authenticated inserts or updates to it are denied while existing room-column writes remain available. Untouched settings never write either flag, and explicit edits survive background refreshes.

Disabled `prepare_turn` and `send_reviewed` return `IN_ROOM_ASSESSMENT_DISABLED` (409, non-retryable). Ordinary posting, analysis including catch-up, tutor progress context, and progress subscriptions do not depend on that switch. New rooms default on. A missing transfer checklist retains the legacy posting/analysis path.

Acceptance: deterministic send/late-checklist/settings/tutor regressions; fresh-baseline SQL Red/Green, backfill/default and real-role permission checks; staging browser toggle off → persisted message → analysis marker → visible target update → ordinary tutor generation without preparation; explicit server rejection for preparation and delivery; preserve assessment-on lifecycle; repeat affected production checks after integration and release gates.

This extends the persisted-choice behavior in `spec-assessment-toggle-persistence.md`; it does not change tracing judgments, grading, answer limits, or the exit-assessment UI. Component requirements are recorded in specs/102 and specs/103. Release owner: root Codex agent, issue #100 branch; evidence is in the dated assessment-switch release record.

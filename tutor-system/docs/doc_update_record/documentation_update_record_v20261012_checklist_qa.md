# Checklist QA corrections — 2026-10-12

Intent: record the tutor checklist behavior corrected after transfer-assessment browser QA.

Learning targets saved before a learner joins synchronize when the learner becomes available. Targets entered after the learner joins synchronize immediately. A failed synchronization retains the local draft; **Retry sync** submits initialization again. Concurrent refreshes share the active request.

Requests are scoped to the active room and learner. Switching either allows its new initialization immediately; completion of an old request cannot overwrite the new checklist, clear its draft, or reset its loading state. Empty saved drafts are not initialized. Deferred-response tests cover both room and learner switches.

Tutor notes on a transfer checklist use the trusted `edit_learning_progress` operation with action `edit_item`, as do other target metadata edits. A rejected write preserves the displayed saved value and shows the error. Legacy checklist writes retain their existing service.

The expanded item now exposes an **Understanding** selector for none, basic, good, and excellent. It submits `set_understanding` and is disabled by the Guard progression lock.

Validation: focused checklist hook and component suites cover retry recovery, synchronization after learner join, concurrent refreshes, note rejection, understanding edits, and Guard locking. Live database acceptance and browser verification remain part of the parent QA run; these frontend tests do not establish a deployment result.

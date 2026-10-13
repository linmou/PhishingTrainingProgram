# Checklist QA corrections — 2026-10-12

Intent: record the tutor checklist behavior corrected after transfer-assessment browser QA.

Learning targets saved before a learner joins synchronize when the learner becomes available. Targets entered after the learner joins synchronize immediately. A failed synchronization retains the local draft; **Retry sync** submits initialization again. Concurrent refreshes share the active request.

Requests are scoped to the active room and learner. Switching either allows its new initialization immediately; completion of an old request cannot overwrite the new checklist, clear its draft, or reset its loading state. Empty saved drafts are not initialized. Deferred-response tests cover both room and learner switches.

The room now also checks target readiness for tutors and displays a setup reminder with **Open Learning Targets** when their panel is closed. The existing learner waiting message stays role-specific. The guide BDD scenario exercises the reminder and opens the panel while verifying no assessment is prepared.

On 2026-10-13, browser QA found that successful target synchronization left an already joined learner showing the waiting message until reload. While waiting, the learner now rechecks readiness every three seconds, including after a failed read. The checks stop when targets arrive or the room unmounts. Fake-timer page tests verify readiness recovery, stopping after success, and cleanup without requiring a new chat message.

Tutor notes on a transfer checklist use the trusted `edit_learning_progress` operation with action `edit_item`, as do other target metadata edits. A rejected write preserves the displayed saved value and shows the error. Legacy checklist writes retain their existing service.

The expanded item now exposes an **Understanding** selector. It submits `set_understanding` and is disabled by the Guard progression lock. On 2026-10-13, live policy inspection confirmed transfer targets allow only none, basic, and good; the selector now omits excellent for transfer targets. Ordinary targets retain excellent. Focused tests cover both sets of choices.

Trusted edits apply the returned status and understanding pair together, so automatic normalization by the database is visible immediately in the item and completion summary.

Validation: focused checklist hook and component suites cover retry recovery, synchronization after learner join, concurrent refreshes, note rejection, understanding edits, and Guard locking. Live database acceptance and browser verification remain part of the parent QA run; these frontend tests do not establish a deployment result.

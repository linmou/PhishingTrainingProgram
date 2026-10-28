# W11: Browser and Release Verification

## Source

Original §16, §§19-20, and §17 W11.

## Required browser flow

1. Initialize a new learner-owned transfer checklist while legacy data remains unchanged.
2. Record an eligible learner signal and prepare one structured draft.
3. Review, edit, reconfirm, and send a four-option public question; verify the room remains tutoring.
4. Submit a correct selection and verify one exact progress transition, reload persistence, and tutoring feedback.
5. Submit a wrong selection and verify needs-review, repair, new learner evidence, new context, and later pass.
6. Verify Guard deferral and recovery without progression mutation while locked.
7. Verify rejection, regeneration, dirty drafts, stale revisions, reconnect/catch-up, retries, duplicate tabs, and duplicate answers.
8. Inspect learner network requests, realtime payloads, exports, browser storage, and errors for private keys, transfer basis, raw model output, and rationale leakage.
9. Attempt forged identity, cross-learner, cross-room, stale-question, direct-write, and legacy-RPC operations.

## Release gate

Preserve browser run ID, exact environment/configuration, screenshots, console/network errors, linked AI run IDs, and feature-flag state. The seven-room legacy browser run is not transfer evidence. Enable the backend capability only after every gate passes; rollback disables new generation/delivery without dropping tables or erasing evidence.

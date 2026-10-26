# Feedback Batching Documentation Update

Intent: record issue #20's read-path change and its reproducible acceptance evidence.

Date: 2026-10-24. Source baseline: `7762cbb`.

Updated `README.md` and added `message-feedback-loading.md` to describe batches of 100 message IDs, three concurrent batches, 1,000-rating row pagination, room/user cache isolation, explicit empty entries and targeted event invalidation. Existing feedback table reads and stored rating semantics are preserved.

Verification: five focused suites passed, 58 tests total. The real RoomProvider integration exercised 50 persisted messages in one batch, stale-room results and callbacks, and overlapping INSERT/broadcast events targeting one message. The service benchmark reduced 10/100/1,000-message calls from 20/200/2,000 to 1/1/10. Simulated 5 ms network timings and limitations are recorded in the linked guide; full command output and machine-readable Jest results are retained under ignored `output/issue-20-20261024/`.

Integration owner retains combined TypeScript/build checks and actual browser acceptance. This change adds no SQL, Edge Function, secret or server configuration artifact.

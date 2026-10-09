# Room Learning Target Synchronization Documentation Update

Intent: record the local-first target workflow and the learner identity fallback used while a room session is being discovered.

Date: 2026-10-05

The tutor Learning Progress panel now writes transfer targets to the room-scoped browser draft before attempting learner-owned synchronization, even when a learner candidate is already visible. A failed promotion keeps the draft rendered and reports a synchronization-specific error; the draft is removed only after the owned checklist is read back successfully. Ownerless transfer reads preserve the same local draft instead of replacing it with an invalid-owner error.

Tutor learner selection prefers the single active session returned by the room session query. If that query returns no learner or fails temporarily, the first persisted student message is used as a temporary identity signal. Pre-populated and optimistic temporary messages are excluded, and multiple active learner IDs remain ambiguous.

Verification: the focused checklist and direct-entry suites pass 27/27 tests; the related transfer context and RoomPagePost lifecycle suites pass 40/40 tests; the production build completes with existing ESLint warnings.

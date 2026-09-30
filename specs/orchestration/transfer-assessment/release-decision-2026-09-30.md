# Transfer Assessment Release Decision: 2026-09-30

Intent: record the owner's version-scoped release authorization while keeping incomplete verification visible.

## Decision

The owner authorizes release of the transfer-assessment product code at commit `97ebe9fd11d78ab2874e098415f84e4c3eaf608d` without waiting for the ordinary automated release gates. This decision applies to that product-code version only; any later product-code change needs a new decision or the ordinary gate-complete path. The owner accepts the unverified outcomes below for this release. This document records authorization, not deployment or a measured hosted feature-flag state.

The Edge Function defaults `TRANSFER_ASSESSMENT_ENABLED` to `true` and an explicit `false` disables assessment requests. The release runner does not set or read that hosted variable. Its historical `disabled` snapshot is a configured expectation, not a backend observation.

## Open Evidence

| Area | Status at decision | Release treatment |
|---|---|---|
| 104 live quality | Calibration, complete baseline/candidate, frozen holdouts, and quality verdict absent | Accepted pending for this version; no evaluation pass claimed |
| Integration | Current UI-upgrade coverage manifest blocked on 104 consumer handoffs | Accepted pending; no integration promotion claim |
| Hosted backend and provider | Current-version hosted authorization, storage, provider, and privacy evidence incomplete | Accepted pending; prior hosted checks do not prove this version |
| 105 release | Browser, privacy, attacks, activation, rollback, and all declared scenarios incomplete | Accepted pending; no automated release approval claimed |

The existing application user ID is stored in browser localStorage and does not authenticate a caller. Historical backend evidence also records a participant-readable `assessment_key` on `public.messages`. This release decision does not recast either boundary as verified protection.

The milestone ledger retains the individual milestone statuses. The release runner retains its evidence-based `release_not_approved` verdict until its ordinary required gates, lanes, and scenarios pass. The owner decision is a separate authorization and must not be represented as `release_approved` or as a passed 104 gate.

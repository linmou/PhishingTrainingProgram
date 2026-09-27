# Transfer Replay Documentation Update Record

Intent: record why component 102 documentation changed and the evidence available at the update.

**Date**: 2026-09-27  
**Implementation base commit**: `60882b2`  

## Change

- Documented the deferred terminal assessment event lifecycle and room mode replay in the data model, database schema, and Supabase service boundary.
- Clarified that replay retains the original inbox identity and applies the same terminal assessment progress/history transition as `apply_learning_event_v1` when still valid.

## Verification

- Focused Jest: 5 suites, 34 tests passed, exit 0.
- Checked Deno: 13 tests passed, exit 0.
- Corrected local restored-copy rehearsal: migration exit 0, backend 8/8, RPC 27/27, transaction rolled back.
- Separate synthetic valid-legacy rehearsal: 1 keyed/0 uncovered before migration; one private `legacy_incomplete` row, public key column absent, zero attempts afterward. Migration, backend 8/8, and RPC 27/27 passed.
- Native local two-session races: wrong/wrong and correct/wrong both observed a blocked competing session and passed final persisted state assertions.
- Native direct-role checks: anon and authenticated each denied for v2 RPC, legacy v1 RPC, and private table update; six SQLSTATE `42501` results and zero mutations.
- Corrected invalid terminal transition on a new local clone: migration passed, backend 8/8, RPC 28/28 including rollback and actual history checks; expanded direct-role matrix 10/10 denied with zero mutations.
- Current-migration native races passed both scenarios with observed lock waits. The rollback-only fault fixture passed eight injected write stages and a normal terminal call after trigger removal; no test rows or triggers remained.
- A third local race passed with wrong first, correct second: stale CAS then expected-count-one retry, yielding two attempts and one terminal event/evidence/history effect.
- Reconciled the RPC contract and data model with the implemented trusted Edge resolver and ten-argument commit RPC; SQL remains the atomic persistence authority.
- Native delivery race passed with an observed room lock, one matching public/private winner, and no losing pair; target mismatch and invalid reviewed content produced no pair.
- Local catalog comparison matched eight RPC signatures and listed 50 private columns. Hosted generated types and a component-branch build asset scan remain unavailable.
- Component branch build: exit 1 at the component-103-owned `transferRoomFixtures.ts:146` public DTO mismatch.
- Hosted Supabase, two-session races, and hosted generated types remain open in `specs/102-transfer-backend/implementation-evidence.md`.

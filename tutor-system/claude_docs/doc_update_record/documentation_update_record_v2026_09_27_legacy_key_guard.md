# Legacy-Key Migration Guard Documentation Record

Intent: record why the transfer schema documentation changed and what was verified.

Date: 2026-09-27
Implementation commit: `12fb743`

## Change

- Documented the migration abort for uncovered legacy assessment keys before private copy or public key removal.
- Recorded the read-only source preflight stop without row identifiers or key values.

## Verification

- Focused migration Jest suite: 6 tests passed at implementation commit `12fb743`.
- Hosted migration and rollback: unrun; no disposable restored database was available.

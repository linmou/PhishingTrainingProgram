/**
 * Documentation record for transfer message routing at the RoomContext boundary.
 *
 * Intent: record how assessment answers and ordinary student messages reach their trusted
 * processing paths.
 */

# Transfer message processing identity

## Date

2026-09-26

## Scope

- Pass the delivered assessment identity with learner answer processing.
- Route student messages without an assessment identity directly to evidence analysis.
- Clarify both paths in the `RoomContext` documentation.

## Evidence

- Focused transfer `RoomContext` suites: 5 suites, 29 tests passed.
- `git diff --check`: passed.

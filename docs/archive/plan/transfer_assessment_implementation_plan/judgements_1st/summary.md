# Independent Judge Summary

## Deterministic selection

The fixed selection rule is applied in order: lowest rank-position sum, then highest rubric total, then first-place votes, then lowest plan number.

| Plan | Judge 01 rank | Judge 02 rank | Judge 03 rank | Judge 04 rank | Judge 05 rank | Rank-position sum | Rubric totals | First-place votes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `plan_1.md` | 1 | 1 | 1 | 1 | 1 | 5 | 27, 28, 27, 27, 28 | 5 |
| `plan_2.md` | 3 | 2 | 2 | 3 | 2 | 12 | 24, 27, 25, 24, 27 | 0 |
| `plan_4.md` | 2 | 3 | 3 | 2 | 3 | 13 | 25, 25, 24, 26, 26 | 0 |
| `plan_3.md` | 4 | 4 | 4 | 4 | 4 | 20 | 23, 23, 21, 23, 23 | 0 |

## Backbone

**Selected backbone: `candidates/plan_1.md` (Traceability First).** It has the lowest rank-position sum and unanimous first-place support. The judges consistently identified its single traceability graph and milestone ledger as the strongest controls against omission, intent drift, and false completion.

## Accepted contributions

- From `plan_2.md`: use complete learner-visible slices as execution views inside the single traceability ledger, including initialization, delivery, grading/recovery, concurrency/privacy, and browser acceptance.
- From `plan_3.md`: add frozen transfer fixtures, semantic metrics, judge calibration, unchanged/contract-compatible baselines, raw run metadata, and independent holdouts to the evaluation work package after the audit gate.
- From `plan_4.md`: add verified-principal authorization, student ownership, public/private data boundaries, immutable keys, stale revision checks, unique unresolved-question enforcement, atomic writes, and legacy-RPC bypass tests before client exposure.

## Rejected or constrained imports

- Do not make live evaluation the first implementation dependency; the intent-drift audit must precede runtime implementation.
- Do not create competing status ledgers for slices, security, and evaluation; all statuses belong in one milestone ledger.
- Do not treat security details or semantic metrics as new product requirements unless they trace to the preserved original handoff.
- Do not treat hosted checks, local integration checks, or the legacy seven-room browser run as interchangeable evidence classes.

## Stage result

The ranking stage passed. The synthesized draft must use Plan 1 as its backbone and incorporate only the compatible contributions above.

# Verification Gates

## Intent

Separate plan-artifact integrity from feature release acceptance. Passing a lower gate never implies that the release gate passed.

| Gate | Criterion | Required evidence |
|---|---|---|
| G0 | Source preserved, package files complete, candidate/judge artifact gates passed | `source_baseline.md`, `gates/candidates.md`, `gates/judges.md` |
| G1 | Reorganized package has no material intent drift from original | multi-debate audit JSON and aggregate summary |
| G2 | Deterministic transfer behavior is complete and exact | golden fixtures and all §14 suites, including orchestrator |
| G3 | Database constraints, RLS, atomicity, idempotency, and legacy compatibility are evidenced | supported isolated or hosted SQL checks; no Docker assumption |
| G4 | Verified principal and answer-key privacy boundary are evidenced | authorization integration and browser/network inspection |
| G5 | Production v3 path and Promptfoo semantic evaluation pass frozen gates | calibration, baseline/candidate, holdout, raw per-case evidence |
| G6 | Dedicated transfer browser acceptance passes | browser run ID, screenshots/network/console evidence, all §16 scenarios |
| G7 | §19 definition of done and final report pass | complete evidence inventory and final report |
| G8 | Feature activation and rollback are authorized | all prior gates pass, flag/rollback evidence |

## Gate rules

- A missing or errored result remains visible and blocks acceptance; it cannot be omitted from a denominator.
- `milestone_ledger.md` is the only status authority. This file defines gate criteria and evidence requirements; it does not maintain a second status register.
- Legacy seven-room browser evidence is regression evidence only and cannot satisfy G6.
- Static SQL inspection is not a substitute for SQL/RLS execution evidence.
- A local name, role, UUID, or browser storage value is not a verified principal.
- A passing Promptfoo benchmark is not product release acceptance.
- The ordinary automated approval requires every gate to pass. The version-scoped owner release decision in `milestone_ledger.md` permits release of that version with open gates; their statuses remain incomplete and the automated verdict remains `release_not_approved`.

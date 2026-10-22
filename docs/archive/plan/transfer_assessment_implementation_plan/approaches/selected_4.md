# Selected Approach 4: Database and Security First

- Core strategy: prove ownership, key confidentiality, transactions, and authorization before UI exposure.
- Primary optimization target: avoid unsafe data release or bypasses.
- Decomposition boundary: migration, RLS, private schema, trusted operations, attack tests.
- Sequencing principle: schema invariants first, then server calls, then clients.
- Main tradeoff: visible product progress is slower.
- Major risk: hosted environment and credentials can block all downstream work.

## Required security boundaries

Transfer checklists are explicitly student-owned. Learners see only public question data and own answers. Answer keys, transfer basis, raw model output, and private rationale remain server-side. A verified principal, room authorization, immutable keys, stale revision checks, unique unresolved-question constraints, atomic progress/history writes, and rejection of legacy-RPC bypasses are release gates. If the trusted verifier or hosted test environment is unavailable, keep the capability disabled and record the blocker.

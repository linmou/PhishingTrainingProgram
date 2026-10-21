# Cross-machine coordination and combined verification

Intent: record shared-project lease coverage and evidence for the combined candidate.

Date: 2026-10-21. Baseline: `72f1087`, stacked on allocator PR #7 and CI PR #6.

Added an atomic GitHub-reference coordinator shared by browser fixtures and Staging deployment entrypoints. Existing fixed fixtures are serialized across machines. The manual deployment workflow retains its lease through the release owner's acceptance checks and exports it as an artifact. Direct MCP/API operators must acquire the same lease; possession of direct write credentials remains a cooperative-protocol boundary. No hosted runtime/schema behavior changes are part of this PR.

The combined verifier hashes the committed frontend/SQL/Edge/dependency/harness artifact set, runs offline harness tests and real database allocation integration, tests shared-reference contention, and runs one affected Staging browser workflow while checking that hosted function versions remain stable. Matching release/lifecycle and production checks remain governed by the existing policy.

Initial checks: 3 coordinator tests and 20 browser-runner tests passed. Live combined verification evidence will be added after committing the candidate. Full frontend Jest remains blocked by the inherited baseline regressions, as explicitly kept outside #5 by the user.

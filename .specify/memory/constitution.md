# Phishing Training Program Constitution

<!-- Intent: define the non-negotiable engineering and release rules for Spec Kit work in this repository. -->

## Core Principles

### I. Preserve Requirements and Evidence
The approved requirement source remains normative. Every component MUST map its requirements, tasks, tests, and completion evidence to the single initiative ledger. A partial, missing, or errored result MUST remain visible and MUST NOT be represented as passed.

### II. Keep Authority Server-Side
Authentication, authorization, private assessment data, answer keys, idempotency, and progress transitions MUST remain server-authoritative. Browser identity values are not trusted principals. Public DTOs MUST exclude private drafts, keys, rationale, transfer basis, and raw model output.

### III. Test First and Verify the Real Boundary
Executable changes MUST follow the repository's `fast-multi-agent-tdd` workflow. Tests MUST cover negative and edge cases as well as happy paths. Integration tests MUST consume actual upstream artifacts; synthetic replacements cannot prove a producer-to-consumer handoff.

### IV. Use Stable, Explicit Contracts
Component boundaries MUST use explicit versioned types, schemas, API operations, and lifecycle invariants. Each shared file and public contract MUST have one owner. Database, service, UI, evaluation, and browser evidence are separate gates and MUST NOT substitute for one another.

### V. Prefer the Smallest Coherent Design
Implementation MUST follow existing repository patterns and avoid speculative abstractions, compatibility layers, duplicate state authorities, and silent fallbacks. Complexity requires a concrete requirement or verified integration need.

## Project Constraints

- The application remains React and TypeScript with Supabase unless an approved requirement changes that architecture.
- Docker is unavailable; database acceptance MUST use supported hosted Supabase execution evidence.
- Transfer assessment MUST NOT introduce a new sign-in product or depend on `auth.uid()` where the application identity contract does not use it.
- `TRANSFER_ASSESSMENT_ENABLED` MUST remain disabled until every release gate passes.
- Rollback MUST disable new generation and delivery without deleting assessment evidence or existing data.

## Development Workflow

Each component MUST complete `specify -> clarify -> plan -> tasks -> analyze` before implementation. CRITICAL and HIGH analysis findings MUST be resolved and rechecked. Component work is promoted only after local verification, serial integration, handoff tests, integration tests, end-to-end tests, smoke tests, and recorded immutable SHAs. Documentation nearest to modified code MUST be reviewed before commit and updated when behavior or contracts change.

## Governance

This constitution applies to all Spec Kit components and orchestration records in this repository. Repository `AGENTS.md` files and the approved initiative plan provide more specific instructions where they do not conflict with these principles. Amendments require a documented reason, user approval for material semantic changes, and a version update.

**Version**: 1.0.0 | **Ratified**: 2026-09-11 | **Last Amended**: 2026-09-11

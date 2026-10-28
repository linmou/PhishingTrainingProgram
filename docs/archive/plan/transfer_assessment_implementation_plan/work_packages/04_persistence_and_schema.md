# W3: Persistence and Schema

## Source

Original §§8-9, §12, §14, §17 W3, and §20 compatibility/rollback.

## Ordered implementation

1. Reconcile the hosted schema, existing policies, function overloads, enum values, and realtime publication before further migration changes.
2. Verify forward migrations preserve legacy rows and add explicit student ownership, policy version, turn mode, public question, private draft/key, event, idempotency, and audit links.
3. Enforce valid transfer state pairs and one unresolved question per room/student.
4. Enforce immutable reviewed keys, stale draft revisions, source-message scope, and no direct client writes for transfer state/evidence.
5. Verify `apply_learning_event_v1` and reviewed delivery are atomic, idempotent, and causal; history must store actual before/after pairs.
6. Verify failed delivery, invalidation, stale snapshots, and authorization failures roll back without partial progress.
7. Regenerate TypeScript database types from the actual supported schema and compare them with the runtime contract.

## Completion gate

Static migration review may support diagnosis but cannot close W3. The gate requires supported database execution evidence for invariants, RLS, transaction behavior, races, and legacy compatibility. Docker is not assumed.

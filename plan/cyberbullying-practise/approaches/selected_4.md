# Assigned approach
Intent: condition one independent implementation plan.

## 4. server-owned-practice-orchestration
- Candidate name: server-owned-practice-orchestration
- Core strategy: Move practice dispatch, context loading, generation/progress authorization and reviewed approval behind a trusted practice-turn API; client renders shared controls.
- Primary optimization target: Authoritative contracts and consistent behavior across clients
- Decomposition boundary: Trusted server operation boundary
- Sequencing principle: Schema and server operation contracts first, wire thin client last
- Main tradeoff: Largest server scope and deployment coordination
- Major risk: Shared frontend orchestration migration expands beyond feature need

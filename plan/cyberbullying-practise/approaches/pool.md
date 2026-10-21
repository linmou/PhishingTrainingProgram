# Approach pool
Intent: compare explicit integration boundaries and tradeoffs for this request.

## 1. inline-room-dispatch
- Candidate name: inline-room-dispatch
- Core strategy: Keep the existing room controller and shared services; add explicit practice_type branches at current integration points, extending shared data/contracts directly.
- Primary optimization target: Minimum change surface and fastest comprehensible delivery
- Decomposition boundary: Existing RoomContext, AI service dispatcher, shared RPC and panel
- Sequencing principle: Inventory and one coordinated schema change, then end-to-end Cyberbullying slice and regressions
- Main tradeoff: Branching in a large existing controller
- Major risk: Missing a hidden phishing-side effect in a shared entry point

## 2. practice-adapter-boundary
- Candidate name: practice-adapter-boundary
- Core strategy: Extract a narrow typed practice adapter interface consumed by the room controller; phishing and Cyberbullying implementations supply generation/progress/configuration policies.
- Primary optimization target: Make subject-specific coupling explicit and independently testable
- Decomposition boundary: Adapter boundary between shared room workflow and practice behavior
- Sequencing principle: Characterize existing behavior, extract phishing adapter, then implement Cyberbullying adapter
- Main tradeoff: Additional abstraction and refactor before feature value
- Major risk: Interface grows into an unnecessary plugin framework

## 3. separate-cyber-room-composition
- Candidate name: separate-cyber-room-composition
- Core strategy: Create a dedicated Cyberbullying room container/controller composed from existing shared chat/review/progress/rating UI and services; keep phishing orchestration in its current container.
- Primary optimization target: Isolate new workflow from implicit phishing hooks
- Decomposition boundary: Route/container boundary with shared primitives and persistence
- Sequencing principle: Contracts/schema first, implement separate container, reuse components incrementally
- Main tradeoff: Some orchestration duplication
- Major risk: Identity/ratings/exports drift between containers

## 4. server-owned-practice-orchestration
- Candidate name: server-owned-practice-orchestration
- Core strategy: Move practice dispatch, context loading, generation/progress authorization and reviewed approval behind a trusted practice-turn API; client renders shared controls.
- Primary optimization target: Authoritative contracts and consistent behavior across clients
- Decomposition boundary: Trusted server operation boundary
- Sequencing principle: Schema and server operation contracts first, wire thin client last
- Main tradeoff: Largest server scope and deployment coordination
- Major risk: Shared frontend orchestration migration expands beyond feature need

## 5. target-domain-first
- Candidate name: target-domain-first
- Core strategy: Introduce reusable target-progress domain operations first, then layer practice dispatch and character replies onto the existing room.
- Primary optimization target: Prove progress reuse and attribution before role-playing
- Decomposition boundary: Progress domain API with existing UI orchestration
- Sequencing principle: Progress contracts then role-playing then UI
- Main tradeoff: May overinvest in progress extraction
- Major risk: Closely overlaps adapter-boundary and delays scenarios

## 6. import-copilot-component
- Candidate name: import-copilot-component
- Core strategy: Port Copilot's post/comment component as the Cyberbullying view, then connect it to platform session/progress/approval services.
- Primary optimization target: Preserve scenario presentation with least visual reconstruction
- Decomposition boundary: Imported feature component linked to platform services
- Sequencing principle: Asset/component import first, platform state integration second
- Main tradeoff: Two competing state models need reconciliation
- Major risk: Local state from Copilot bypasses authoritative history or supervision

## 7. schema-contract-first-inline
- Candidate name: schema-contract-first-inline
- Core strategy: Specify storage/RPC contracts and migration first, then implement small explicit room branches against the committed contract.
- Primary optimization target: Migration predictability
- Decomposition boundary: Database contracts supporting existing room services
- Sequencing principle: Schema/permission tests before UI
- Main tradeoff: More up-front schema commitment
- Major risk: Same core strategy as inline-room-dispatch

## 8. staged-strangler-adapter
- Candidate name: staged-strangler-adapter
- Core strategy: Introduce practice adapter seams only where each Cyberbullying slice needs them and retire phishing leakage incrementally.
- Primary optimization target: Reduce adapter extraction blast radius
- Decomposition boundary: Incrementally extracted practice adapters
- Sequencing principle: One vertical slice per extracted capability
- Main tradeoff: Temporary coexistence of old and new paths
- Major risk: Same eventual strategy as practice-adapter-boundary

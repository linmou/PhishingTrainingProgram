# Assigned approach
Intent: condition one independent implementation plan.

## 1. inline-room-dispatch
- Candidate name: inline-room-dispatch
- Core strategy: Keep the existing room controller and shared services; add explicit practice_type branches at current integration points, extending shared data/contracts directly.
- Primary optimization target: Minimum change surface and fastest comprehensible delivery
- Decomposition boundary: Existing RoomContext, AI service dispatcher, shared RPC and panel
- Sequencing principle: Inventory and one coordinated schema change, then end-to-end Cyberbullying slice and regressions
- Main tradeoff: Branching in a large existing controller
- Major risk: Missing a hidden phishing-side effect in a shared entry point

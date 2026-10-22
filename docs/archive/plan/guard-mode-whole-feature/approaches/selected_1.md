# state-machine-contract

- Core strategy: Model each AI turn and room lock/unlock transition as an explicit typed state machine driven by a validated structured AI response.
- Primary optimization target: Correct mode transitions and easy-to-test behavior.
- Decomposition boundary: Pure mode/transition contract first; adapters for AI, Supabase, RoomContext, and UI afterward.
- Sequencing principle: Define states and invariants, then implement persistence, AI generation, UI, and evaluations against those invariants.
- Main tradeoff: More up-front modeling and state types than a quick overlay.
- Major risk: The model can become over-engineered if it duplicates existing RoomContext state instead of owning only Guard-specific state.

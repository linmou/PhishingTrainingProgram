# minimal-suggestion-overlay

- Core strategy: Extend the existing `generateTutorSuggestion` → `AISuggestionBox` → `CommentInput` path with a mode field, Guard composer variant, message metadata, and a small room lock state.
- Primary optimization target: Smallest safe change that preserves current tutoring behavior and UI.
- Decomposition boundary: Reuse current RoomContext, suggestion state, message insertion, and components; add only Guard-specific branches and schema fields.
- Sequencing principle: Add structured parsing and persistence, then add the UI mode variant and state lock, followed by evaluation fixtures.
- Main tradeoff: Fast and familiar implementation, but Guard logic remains close to existing mixed responsibilities.
- Major risk: Branches in the already-large RoomContext can become hard to reason about and may allow tutoring/Guard states to diverge.

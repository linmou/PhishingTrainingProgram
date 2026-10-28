# Guard Mode implementation approach pool

## 1. state-machine-contract

- Core strategy: Model each AI turn and room lock/unlock transition as an explicit typed state machine driven by a validated structured AI response.
- Primary optimization target: Correct mode transitions and easy-to-test behavior.
- Decomposition boundary: Pure mode/transition contract first; adapters for AI, Supabase, RoomContext, and UI afterward.
- Sequencing principle: Define states and invariants, then implement persistence, AI generation, UI, and evaluations against those invariants.
- Main tradeoff: More up-front modeling and state types than a quick overlay.
- Major risk: The model can become over-engineered if it duplicates existing RoomContext state instead of owning only Guard-specific state.

## 2. audit-event-sourcing

- Core strategy: Treat every raw AI decision, human rectification, sent response, correction result, and deactivation as an immutable mode event; derive current Guard state from the event history.
- Primary optimization target: Complete accountability and reconstruction of tutor decisions.
- Decomposition boundary: Mode-event persistence and projection are central; UI and AI are event producers/consumers.
- Sequencing principle: Design event schema and projection first, then connect AI and UI.
- Main tradeoff: Strong auditability with more database rows and projection logic.
- Major risk: Excessive complexity for a 1:1 room and possible inconsistency between derived state and existing message history.

## 3. minimal-suggestion-overlay

- Core strategy: Extend the existing `generateTutorSuggestion` → `AISuggestionBox` → `CommentInput` path with a mode field, Guard composer variant, message metadata, and a small room lock state.
- Primary optimization target: Smallest safe change that preserves current tutoring behavior and UI.
- Decomposition boundary: Reuse current RoomContext, suggestion state, message insertion, and components; add only Guard-specific branches and schema fields.
- Sequencing principle: Add structured parsing and persistence, then add the UI mode variant and state lock, followed by evaluation fixtures.
- Main tradeoff: Fast and familiar implementation, but Guard logic remains close to existing mixed responsibilities.
- Major risk: Branches in the already-large RoomContext can become hard to reason about and may allow tutoring/Guard states to diverge.

## 4. evaluation-first-gate

- Core strategy: Build the structured-output validator, multi-turn Guard evaluation cases, rubrics, quality gate, and production/browser evaluation harness before changing runtime behavior.
- Primary optimization target: Prevent unmeasured AI behavior changes from reaching implementation or release.
- Decomposition boundary: Evaluation contract and fixtures are the first product contract; runtime and UI must satisfy them.
- Sequencing principle: Specify observable behavior and release thresholds, create red tests, implement AI contract/prompt, then implement state/UI and close the gates.
- Main tradeoff: Early evaluation work slows the first visible UI change but reduces behavioral ambiguity.
- Major risk: Evaluation cases may encode an incomplete policy and need revision before they are useful.

## 5. two-stage-policy-writer

- Core strategy: Use a dedicated mode-classification step followed by a response-writing step conditioned on the classification, with a final combined response envelope.
- Primary optimization target: Separate escalation accuracy from tone/content generation.
- Decomposition boundary: Mode classifier, response writer, envelope validator, and downstream state machine are independent services.
- Sequencing principle: Stabilize classification cases, then response rubrics, then wire both into the existing suggestion path.
- Main tradeoff: Easier diagnosis of classification versus more LLM calls, latency, cost, and new failure modes.
- Major risk: Conflicts with the requested single AI response contract and may create inconsistent decisions between stages.

## 6. database-authoritative-realtime

- Core strategy: Make Supabase the source of truth for active room mode, lock state, and final Guard identity; clients subscribe and render the persisted state.
- Primary optimization target: Consistent tutor/student state across realtime updates and reloads.
- Decomposition boundary: Append-only migration plus service functions own state transitions; React clients become projections.
- Sequencing principle: Add schema/RLS/service transition operations, then connect RoomContext, then UI and tests.
- Main tradeoff: Strong multi-client consistency at the cost of more database round trips and migration surface.
- Major risk: Current simplified RLS policies and optimistic message behavior may make invalid intermediate states visible.

## 7. composer-first-human-control

- Core strategy: Make the existing tutor composer a mode-aware simulated post editor; AI only supplies a draft and raw mode, while the composer owns final mode/profile selection.
- Primary optimization target: Clear human responsibility and low tutor interaction cost.
- Decomposition boundary: Suggestion review/composer is the primary feature boundary; AI contract and persistence support it.
- Sequencing principle: Build mode-aware composer preview and human rectification first, then add AI decision generation, lock projection, and evaluation.
- Main tradeoff: Strong UX clarity and reuse of the current human editing path, but mode logic may be too UI-centric.
- Major risk: Non-UI clients or background state changes may bypass composer invariants.

## 8. vertical-slice-release

- Core strategy: Deliver the feature in thin end-to-end slices: structured tutoring response, manual Guard turn, automatic Guard persistence/exit, then audit/evaluation hardening.
- Primary optimization target: Early executable feedback through the full product path.
- Decomposition boundary: Each slice crosses prompt/service, persistence, RoomContext, tutor UI, student UI, and tests.
- Sequencing principle: Every slice is red-green-refactor and independently demoable before the next behavior is added.
- Main tradeoff: Fast discovery of integration problems with temporary seams between slices.
- Major risk: Early slices can establish weak data contracts that later transitions must migrate.

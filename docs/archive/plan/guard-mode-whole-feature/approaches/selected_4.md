# audit-event-sourcing

- Core strategy: Treat every raw AI decision, human rectification, sent response, correction result, and deactivation as an immutable mode event; derive current Guard state from the event history.
- Primary optimization target: Complete accountability and reconstruction of tutor decisions.
- Decomposition boundary: Mode-event persistence and projection are central; UI and AI are event producers/consumers.
- Sequencing principle: Design event schema and projection first, then connect AI and UI.
- Main tradeoff: Strong auditability with more database rows and projection logic.
- Major risk: Excessive complexity for a 1:1 room and possible inconsistency between derived state and existing message history.

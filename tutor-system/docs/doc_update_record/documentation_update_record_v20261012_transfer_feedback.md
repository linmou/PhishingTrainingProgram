# Transfer answer feedback routing

Intent: record the browser QA correction to tutor feedback after a graded transfer answer.

- Date: 2026-10-12.
- Baseline commit: e67a509e16a15521d8d8b2c3d6e96e3bb452d749.
- Updated RoomContext.md to describe assessment-answer routing and the target label in draft review.
- Persisted answers skip ordinary evidence analysis and candidate preparation; the next AI action produces a tutor suggestion.
- Regression coverage mounts RoomProvider with persisted correct and incorrect answers, then replays realtime delivery and repeats the AI action. It verifies stable answer identity, no evidence or preparation request, and a tutor decision.
- App source TypeScript validation passes. Full-project TypeScript validation remains affected by preexisting test typing errors.

Follow-up on 2026-10-12 (baseline f63838d):

- Feedback generation requires server review lifecycle fields and fails closed when they are unavailable.
- Provider input carries the persisted resolution, attempts, feedback requirement, and public question. Terminal results additionally carry the safe answer explanation; open attempts carry no key.
- Added retry/unresolved and unavailable-lifecycle integration cases plus a provider-boundary assertion on structured inputs.
- Backend RPC deployment and browser verification remain separate release requirements.

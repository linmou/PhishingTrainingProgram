# Room AI Browser Path Documentation Update

Intent: record the browser coverage added for the real tutor AI response path in a manually created assessment room.

Date: 2026-10-04

Extended `room-assessment-setup` so it now creates the room, promotes the local assessment-target draft after learner join, persists learner evidence, clicks the tutor's real `Generate AI Response` control, asserts a successful `prepare_turn` response, and then continues through assessment delivery. The workflow records the raw assessment API response so failures expose the server operation and status instead of only the UI fallback text.

The message `The transfer request could not be completed. Try again.` is the fallback from `classifyAssessmentFailure` when an error has no recognized server code. Known API codes are normally included in the surfaced message; the new browser evidence captures the underlying response for unknown failures.

# Documentation update record: student rating gate ignores pre-populated transcript lines

Intent: record which documents were changed for the `rating_gate_prepop` code change and which behaviour they now describe, without claiming any unshipped behaviour.

Date: 2026-09-12
Implementation commit ID: the commit that introduces this record, on top of `19d729e` (TDD refs: `refs/tdd/rating_gate_prepop/pre_green` = `32ff8e6a`, `pre_docs` = `ca6f2d8c`)

## Code change being documented

`tutor-system/src/pages/RoomPagePost.tsx`, `getUnratedResponse()`: the student rating gate now skips messages whose id begins with `prepop-`, because pre-populated dialogue is synthesized in memory by `RoomContext` and has no `messages` row, so it can never be rated. Verified by the extended oracle `src/__tests__/tutor_response_rating_gate.e2e.test.tsx` (7 scenarios: the virtual-line case now sends without a dialog, while a pre-populated line beside a persisted unrated turn still gates on the persisted turn).

## Changed documents

- `tutor-system/README.md`: the "Required Response Ratings" feature bullet now says the gate applies to the latest persisted AI/Tutor response and that pre-populated transcript lines are never claimed by the prompt; the file header date and commit reference were refreshed.
- `claude_docs/RoomContext.md`: the "Student reply gate" section now states that `prepop-<roomId>-<index>` messages are render-only and therefore skipped by the gate, and records the coexistence case (virtual line plus persisted unrated turn still gates on the persisted turn).
- `claude_docs/doc_update_record/documentation_update_record_v2026_09_12_rating_gate_prepop.md`: this record.

## Not changed

- No production, test, schema, or migration document was edited in the documentation phase; `src/pages/RoomPagePost.tsx` and the oracle are frozen at the `pre_docs` baseline.
- No other document in `claude_docs/` describes the rating gate (checked with a repository-wide search for the dialog text, the gate wording, and `rating-reminder`); `claude_docs/supabase-service.md` and `claude_docs/database-schema.md` describe the feedback storage, which this change does not touch.

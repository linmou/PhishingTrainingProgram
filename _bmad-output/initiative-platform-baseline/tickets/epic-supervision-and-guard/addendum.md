# Addendum: Owner supervision and Guard epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-supervision-and-guard/epic-supervision-and-guard.md`.

Updated: 2026-10-27. Sources: the guard re-audit after constitution rule R9 in the git-ignored `audits/` folder (`guard_r9_supervision_and_guard_*`), and the earlier P6 triage audit (`guardp6_supervision_and_guard_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the re-audit. The re-audit passed the R1 guard (`cyberbullying_browser_draft.sql`, "wrong owner accepted"), both R2 guards and the R3 SQL guard ("unsent reviews cannot publish"), so they no longer appear below.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R3 | `tutor-system/src/pages/__tests__/RoomPagePost.transferDraft.test.tsx` (discards the candidate through the room context without delivering anything) | Mocks the room context, so the publication path never runs; it also lets a tutor who is not the owner use the review controls. | C1 | A discarded or unsent draft reaches the learner. |

## B. Guards that can wait under P6

None.

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-70 | R1, R3 | No test that the server refuses a non-owner editing learning progress or delivering or grading an assessment; no test that a phishing suggestion inserts no message or that the AI never changes other room state; no test renders the room as a second tutor (NFR-1, FR-52). |

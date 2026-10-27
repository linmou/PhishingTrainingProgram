# Addendum: Rooms and templates epic

Intent: hold the volatile facts about how well this epic's rules are guarded by tests, so the epic itself stays stable. Each row links up to a rule in `_bmad-output/initiative-platform-baseline/tickets/epic-rooms-and-templates/epic-rooms-and-templates.md`.

Updated: 2026-10-27. Sources: the guard audit and the P6 triage audit in the git-ignored `audits/` folder (`guard_rooms_and_templates_*`, `guardp6_rooms_and_templates_*`). Tests were read, not run; the 'Why the guard fails' column comes from criteria c2 and c3 of the guard audit.

## A. Test debt needed for the pilot

| Rule | Guard | Why the guard fails | Basis | Harm if the clause breaks |
| --- | --- | --- | --- | --- |
| R5 | `tutor-system/src/pages/__tests__/TutorView.modal.test.tsx` (should handle delete room successfully); `tutor-system/supabase/tests/cyberbullying_practise.sql` (room deletion cleans dialogue) | TutorView.modal.test.tsx mocks server deletion (disputed); cyberbullying_practise.sql requires anonymous direct deletion to succeed, bypassing the required owner-checked function. | C4 | A non-owner or anonymous deletion destroys pilot records for good. The screen test mocks the whole server, and the SQL test deletes as an anonymous user. |

## B. Guards that can wait under P6

The owner deferred these on 2026-10-24 under the open question named in `_bmad-output/initiative-platform-baseline/prd-tutor-platform/addendum.md` §F: the limitation is accepted for the pilot, and the tests wait for the formal product.

| Rule | Guard | Why the guard fails | Accepted limitation | Open question |
| --- | --- | --- | --- | --- |
| R1 | `tutor-system/src/__tests__/room_management.bdd.test.tsx` (Room creation form validation) | Two reviewers found no fault; one found it checks only the empty title, not password-required, custom-name or default-image rules. | The owner checks the room setup before teaching. | OQ-18 |
| R2 | `tutor-system/supabase/tests/cyberbullying_practise.sql` (mutable practice type, error PRACTICE_TYPE_IMMUTABLE) | Two reviewers found no fault; one found it checks only immutability, not refusal of an incomplete cyberbullying scenario. | Practice-type and scenario checks are supervised. | OQ-18 |
| R3 | `tutor-system/src/__tests__/room_template_management.test.tsx` (should clear stale password and custom OP state when selected template does not define them) | Two reviewers found no fault; one found it skips practice-type filtering and read-only tutor templates. | The owner checks prefilled template values. | OQ-18 |
| R4 | `tutor-system/src/pages/__tests__/StudentView.roomVisibility.test.tsx` (shows real teaching rooms and hides marker + Demo: + DemoTutor harness + marked creates) | Two reviewers found no fault; one found it checks the student list only, not the tutor dashboard or observer list. | Adults point learners to the right room. | OQ-18 |

## C. Clauses with no guard

| Former ID | Rule | Missing guard |
| --- | --- | --- |
| G-63 | R1–R5 | No test for "password mode requires a password", the server refusing an incomplete cyberbullying scenario, offering only templates of the selected type, or test rooms missing from the tutor dashboard and observer list; room deletion's cascade into private records and the "cannot be undone" text are only partly checked (FR-4, FR-5, FR-6, FR-8, FR-9). |

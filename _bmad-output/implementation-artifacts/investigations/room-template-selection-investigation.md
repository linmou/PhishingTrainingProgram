# Investigation: Tutor room template selection

Intent: identify why templates may be unavailable when a tutor creates a room, using application source and live production evidence.

## Hand-off Brief

Production contains 19 global templates, but the application's anonymous template query returns HTTP 200 with an empty array. The production row-level security policy excludes the zero-UUID system owner, and TutorView hides its picker for an empty result. Add a narrowly scoped read policy for global templates and verify staging before production.

## Case Info

| Field | Value |
| --- | --- |
| Date opened | 2026-10-14 |
| Status | Concluded |
| Input | “why the room templates are not selectable when a tutor want to create a new room ?” |
| Project | Production `zgbufaxooqxeabewktzd`; affected browser session not yet identified |
| Evidence | Local application source; live read-only Supabase MCP queries |

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Tutor creation UI | Available | `tutor-system/src/pages/TutorView.tsx:79` calls `getRoomTemplatesByTutor`; selector starts at line 395. |
| Production schema | Available | MCP confirms `public.room_templates` exists. |
| Exact affected session | Missing | Username, page URL, network errors, and whether selector is absent or empty are unknown. |

## Investigation Backlog

| Path | Status |
| --- | --- |
| Trace source filtering and template loader | Done |
| Inspect production template rows and read policies | Done |
| Distinguish user templates, teaching templates, and test fixtures | Done |

## Confirmed Findings

1. `tutor-system/src/services/supabase.ts:903` queries `room_templates` with `tutor_id = '00000000-0000-0000-0000-000000000000'`; the tutor ID argument does not change this query.
2. Live production MCP inspection on 2026-10-14 found 19 template rows, all with that zero-UUID owner. Examples include Account Security Alert Scam, iTunes Gift Card Survey Scam, Location Sharing Safety, Movie Meetup Social Engineering, Nintendo Switch Deal Scam, Phone Number Phishing Training, and 13 Demo entries.
3. `public.room_templates` has RLS enabled. Its sole policy, `Tutors can manage their own templates`, applies to ALL commands and public roles, with `((tutor_id = auth.uid()) OR (tutor_id IS NULL))`. This excludes global rows for an anonymous application request.
4. An independent read-only request reproduced the application's filter against `https://zgbufaxooqxeabewktzd.supabase.co/rest/v1/room_templates?select=template_name&tutor_id=eq.00000000-0000-0000-0000-000000000000&order=template_name.asc`, using the configured public anon key in memory. Result: `{"status":200,"templates":[]}`. No credentials were recorded.
5. `tutor-system/src/pages/TutorView.tsx:76` loads only database templates; `:396` renders the picker only for `templates.length > 0`. The empty successful response hides the selector without a user-facing failure.
6. `tutor-system/src/pages/TutorView.tsx:408` additionally filters behavior demo names. `tutor-system/src/pages/TestRoomsView.tsx:29` documents the anonymous policy limitation and ships local demo seed fallback, while the normal tutor picker has no corresponding fallback.
7. `tutor-system/src/contexts/AuthContext.tsx:48` stores app identity in localStorage; `:104` restores that simple identity. This differs from a Supabase Auth session used by `auth.uid()`.

## Deduced Conclusions

The production template data is present. The policy excludes the global template owner, causing the application query to return an empty list; the UI then hides template selection. This explains the reported absence for the normal display-name session. A different authenticated browser session has not been inspected.

## Hypothesized Paths

### Hypothesis 1: Templates cannot be selected in room creation

**Status:** Refuted as a universally disabled UI; confirmed as unavailable for the normal anonymous database request.

**Would confirm:** A disabled or absent selector despite accessible applicable templates.

**Would refute:** Selector exists and only filtered or absent database rows explain the empty list.

**Resolution:** Source contains a functional selector. Live database policy and anonymous REST reproduction confirm row filtering before rendering.

## Source Code Trace

Display-name session → TutorView.loadTemplates → getRoomTemplatesByTutor → global-owner REST filter → RLS excludes all global rows → HTTP 200 [] → setTemplates([]) → picker condition false.

## Conclusion

**Confidence:** High for the ordinary anonymous application request. Production policy inspection and direct API reproduction confirm the database/UI chain. No application code, database rows, or policies were changed.

## Recommended Next Steps

Add a SELECT-only policy allowing the intended application roles to read system-owned global templates. Preserve mutation restrictions. Validate the exact migration and affected browser workflow on staging before applying and verifying it on production, following `tutor-system/docs/supabase-release-workflow.md`.

## Reproduction Plan

Use the production public client with no Supabase user session to execute the loader's zero-UUID filter: it returns []. Open the normal tutor create-room form: the picker is absent. After the proposed read policy passes staging validation, repeat the same request and confirm ordinary teaching templates are selectable while behavior demos retain their separate Test Rooms placement.

## Existing Test Evidence

From `tutor-system/`, ran `rtk npm test -- --watchAll=false --runInBand --runTestsByPath src/__tests__/room_template_management.test.tsx src/utils/__tests__/behaviorTestRooms.test.ts`. Exit 1: 19 tests passed, two failed; template-management suite passed. Passing tests prove selection and prefilling work when the mocked service returns templates, but mocks cannot detect live RLS filtering.

The two failures are a separate room-list classification issue: `src/utils/__tests__/behaviorTestRooms.test.ts:52` and `:147` expect classic Account Security rooms not to be test rooms. The Guard seed shares `Account Security Alert Scam` as its title (`src/services/demoRoomTemplates.ts:398`) and is test-only (`:429`), so title matching (`src/utils/behaviorTestRooms.ts:58`) returns true. This does not explain the missing picker and was not modified.

## Follow-up: 2026-10-14

The user authorized the fix. An additive SELECT policy was locally validated against fresh production restores, then applied and verified on staging and production. Public REST now returns two staging shared templates (including a reusable teaching fixture copied from production) and all 19 production shared templates. The Render browser shows six teaching options; selecting Nintendo Switch Deal Scam fills the correct title and description. Hosted tests confirm unchanged shared write restrictions and rollback cleanup. The focused application template suite passes all 13 tests.

Exact SQL: `tutor-system/supabase/archived_migrations/20261014010000_global_room_template_read.sql`. Release record: `tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_global_room_template_read.md`. Root cause resolved; the separate classification issue remains outside this fix.

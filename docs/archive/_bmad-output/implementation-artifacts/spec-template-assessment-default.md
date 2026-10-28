---
title: Enable in-room assessment by default for all room templates
type: feature
created: 2026-10-14
status: done
baseline_commit: 28706fe82eeda00c6cdac639fc2cd2195e0fdd07
context:
  - '{project-root}/tutor-system/docs/supabase-release-workflow.md'
  - '{project-root}/tutor-system/docs/browser-e2e-testing.md'
---

Intent: make rooms created from any teaching or test template start with in-room assessment enabled.

<frozen-after-approval reason="user requested assessment on by default in all templates">

## Intent

**Problem:** Both template creation paths omit `rooms.transfer_learning_enabled`, so the live database default `false` leaves new rooms with assessment disabled.

**Approach:** Set the shared database column default to `true`. Both template paths and future templates inherit the default without duplicated template flags. Existing saved room settings and explicit opt-outs remain effective.

## Boundaries & Constraints

Change only the creation default. Preserve existing room data, template content, permissions, AI prompts and assessment lifecycle behavior. Deliver the exact tested SQL to staging then production and record browser and database evidence.

## I/O & Edge-Case Matrix

| Scenario | Input | Expected behavior |
| --- | --- | --- |
| Template creation | Any teaching/test template, omitted setting | Stored `transfer_learning_enabled=true` |
| Plain creation | Omitted setting | Stored setting true |
| Explicit opt-out | Insert or update setting false | False persists |
| Existing room | Saved false or true | Value unchanged by migration |
| Invalid value | Explicit null | Existing NOT NULL rejection |

</frozen-after-approval>

## Code Map

- `tutor-system/src/services/supabase.ts:92` creates a room without an assessment override.
- `tutor-system/src/pages/TutorView.tsx:198` and `src/pages/TestRoomsView.tsx:140` share that creation service.
- `tutor-system/src/components/AIAssistantSettings.tsx:138` reads the stored room setting.
- `tutor-system/supabase/archived_migrations/20261014020000_room_assessment_default_on.sql` is the exact deployed migration.
- `tutor-system/supabase/tests/room_assessment_default_on.sql` verifies actual creation/default/opt-out behavior.
- `tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_room_assessment_default_on.md` records release acceptance.

## Tasks & Acceptance

- [x] Inspect both live projects and capture fresh production baseline.
- [x] Validate Red/Green migration with existing-data, role, default, explicit-false and null-boundary assertions.
- [x] Apply staging, verify API/database assertions and template-created room settings in browser.
- [x] Recheck production, apply identical SQL, verify matching deployed browser behavior and cleanup.
- [x] Archive migration and record exact hash and results.

**Acceptance Criteria:**
- Given any existing room template, when a new room is created, then its saved in-room assessment setting is on without tutor intervention.
- Given a newly created AI-enabled template room, when settings open and the page reloads, then Enable In-Room Assessment is checked.
- Given explicit false values, when creating or updating rooms or applying this migration, then those values remain false.
- Given both targets, when delivery closes, then their defaults match the tested SQL and verification evidence exists.

## Verification

Fresh-baseline PostgreSQL assertions plus hosted transactional assertions exercise every template, actual anon/authenticated inserts, opt-outs and rollback. Browser checks create a teaching-template room on staging and the deployed production site, inspect checked assessment and persisted state, reload, and clean generated fixtures. Existing settings and template component suites cover unchanged checkbox and template behavior.

## Spec Change Log

## Suggested Review Order

- Review the shared creation default used by all templates.
  [20261014020000_room_assessment_default_on.sql:4](../../../../tutor-system/supabase/archived_migrations/20261014020000_room_assessment_default_on.sql#L4)
- Inspect actual-role creation, explicit opt-outs and rollback assertions.
  [room_assessment_default_on.sql:23](../../../../tutor-system/supabase/tests/room_assessment_default_on.sql#L23)
- Review local parity, hosted results, browser checks and cleanup evidence.
  [documentation_update_record_v2026_10_14_room_assessment_default_on.md:26](../../../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_room_assessment_default_on.md#L26)

---
title: Restore shared room templates in tutor room creation
type: bugfix
created: 2026-10-14
status: done
baseline_commit: ecee681a9856b46e924bb9c9c61d4adf5c348826
context:
  - '{project-root}/tutor-system/docs/supabase-release-workflow.md'
  - '{project-root}/tutor-system/docs/browser-e2e-testing.md'
---

Intent: restore template selection for the application's ordinary display-name tutor sessions.

<frozen-after-approval reason="user authorized the diagnosed fix with 'fix it'">

## Intent

**Problem:** Production contains shared templates owned by the zero UUID, but the existing RLS policy excludes them for ordinary application sessions. The loader receives an empty result and the tutor form hides its picker.

**Approach:** Add a narrowly scoped SELECT policy for system-owned templates. Test the exact SQL against a fresh hosted baseline, apply and verify staging first, then apply and verify production.

## Boundaries & Constraints

Keep the existing owner policy and mutation behavior intact. Use the existing template loader and form. Preserve existing unrelated work and migration files. Retain commands, hashes, policy comparisons, permission assertions, and browser evidence.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Ordinary tutor | Public anon client, zero-UUID templates | Shared templates readable and selectable | Stop release if empty |
| Authenticated client | Non-system JWT subject | Shared templates readable | Assert under actual role |
| Other owner | Template with a distinct non-null owner | Existing visibility preserved | Assert unrelated row hidden |
| Mutation | Anon/authenticated UPDATE, DELETE, INSERT of global templates | Existing write restrictions preserved | Assert denial or zero affected rows |
| Owner | JWT subject matches private template owner | Existing owner access preserved | Assert read/write behavior |

</frozen-after-approval>

## Code Map

- `tutor-system/src/services/supabase.ts:903` queries shared templates by zero-UUID owner.
- `tutor-system/src/pages/TutorView.tsx:396` renders the picker when returned templates exist.
- `tutor-system/supabase/archived_migrations/20261014010000_global_room_template_read.sql` holds the exact SQL deployed to both projects.
- `tutor-system/supabase/tests/global_room_template_read.sql` contains behavioral permission assertions.
- `tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_global_room_template_read.md` records release evidence.

## Tasks & Acceptance

**Execution:**
- [x] Capture and compare live baseline and fresh local restore.
- [x] Write failing permission assertions and narrow SELECT policy; validate Green against fresh restore.
- [x] Apply exact SQL on staging and verify permissions plus browser template selection.
- [x] Recheck production, apply identical SQL, and verify matching browser behavior.
- [x] Archive SQL and record evidence from both projects.

**Acceptance Criteria:**
- Given the public application session, when a tutor opens room creation, then ordinary shared teaching templates are selectable and prefill the form.
- Given a disallowed writer, when it attempts to modify a shared template, then the shared template is unchanged.
- Given both hosted targets, when verification completes, then both have the same tested SELECT policy and recorded matching SQL hash.

## Spec Change Log

## Verification

- PostgreSQL assertions: expected Red missing-template failure, Green read/write boundary pass.
- Hosted public REST: selected project's global rows are returned.
- Browser: open tutor creation, select an ordinary shared template, inspect prefilled title and description.
- Review the additive policy and preserved original policy against both live projects.

## Suggested Review Order

- Review the shared-template SELECT scope deployed identically to staging and production.
  [20261014010000_global_room_template_read.sql:4](../../../../tutor-system/supabase/archived_migrations/20261014010000_global_room_template_read.sql#L4)
- Check actual role boundaries and fixture rollback assertions.
  [global_room_template_read.sql:31](../../../../tutor-system/supabase/tests/global_room_template_read.sql#L31)
- Inspect release evidence, browser outcomes, and retained local catalog comparisons.
  [documentation_update_record_v2026_10_14_global_room_template_read.md:26](../../../../tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_global_room_template_read.md#L26)

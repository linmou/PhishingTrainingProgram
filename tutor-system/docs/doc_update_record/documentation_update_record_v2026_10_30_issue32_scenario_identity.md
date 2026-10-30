# Issue 32 scenario identity

Intent: record the persistence contract and verification of the remaining scenario settings requirements.

Date: 2026-10-30. Implementation baseline: `764caf8`. Owner: root Codex agent. Branch: `fix/issue-32-scenario-identity`.

## Change and scope

Preserve the existing room-template scenario reference as `prompt_config.scenario` in the existing JSON configuration storage. Settings save the registry key or explicit `null` for Custom / General. Target edits retain identity; switching to Custom preserves target text. Named scenario selection loads its registered targets. Missing identity on older rooms retains the existing exact-array recovery. No database or Edge artifact is required.

Registry validation rejects missing/unknown references. Inventory tests cover normal teaching, test-only demo and controlled comparison variants, including shared scenario references. The AI assistant module documentation describes the persistence and selection behavior.

## Verification

Focused Jest run: 6 suites, 71 tests passed, including all six teaching templates editing/saving/reopening, explicit Custom save/reopen, registry options, full template inventory, invalid/missing references, AI initialization persistence, room source of truth and room template creation. Existing React act/router warnings remain.

Repository-wide `tsc --noEmit` reports 446 diagnostics on both the unchanged HEAD source and this candidate; comparison of filename/code/message found zero new diagnostics. `npm run build` passes with existing lint and Browserslist warnings. The browser candidate uses the explicit staging URL/key rather than the checked-in production defaults.

## Acceptance still open

Staging: run the exact candidate frontend against `ciubrzggdqesgvfkpolj`; create a Movie Meetup room, edit targets, save/reload and verify retained identity; switch to Custom, save/reload and verify identity/target persistence; remove and verify all fixtures under the project lease.

Production: after integration into `no_sign_up` and matching frontend deployment, repeat the affected browser flow against `zgbufaxooqxeabewktzd` and record cleanup. Issue 32 remains open until this evidence is complete. Root Codex agent owns these checks.

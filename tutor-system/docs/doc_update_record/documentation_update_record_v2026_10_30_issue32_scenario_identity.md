# Issue 32 scenario identity

Intent: record the persistence contract and verification of the remaining scenario settings requirements.

Date: 2026-10-30. Implementation baseline: `764caf8`. Owner: root Codex agent. Branch: `fix/issue-32-scenario-identity`.

## Change and scope

Preserve the existing room-template scenario reference as `prompt_config.scenario` in the existing JSON configuration storage. Settings save the registry key or explicit `null` for Custom / General. Target edits retain identity; switching to Custom preserves target text. Named scenario selection loads its registered targets. Missing identity on older rooms retains the existing exact-array recovery. No database or Edge artifact is required.

Registry validation rejects missing/unknown references. Inventory tests cover normal teaching, test-only demo and controlled comparison variants, including shared scenario references. The AI assistant module documentation describes the persistence and selection behavior.

## Verification

Focused Jest run: 6 suites, 71 tests passed, including all six teaching templates editing/saving/reopening, explicit Custom save/reopen, registry options, full template inventory, invalid/missing references, AI initialization persistence, room source of truth and room template creation. Existing React act/router warnings remain.

Repository-wide `tsc --noEmit` reports 446 diagnostics on both the unchanged HEAD source and this candidate; comparison of filename/code/message found zero new diagnostics. `npm run build` passes with existing lint and Browserslist warnings. The browser candidate uses the explicit staging URL/key rather than the checked-in production defaults.

## Staging acceptance

Passed against `ciubrzggdqesgvfkpolj`, using the candidate frontend at `http://localhost:3012`, commit `4a5fdfc505d0493710dbf16b39fb0db3b6c974b7`. The project lease was acquired before the first fixture write and retained through cleanup. No backend deployment was needed.

Created Movie Meetup through the normal tutor UI as temporary tutor `11a970af-7572-4037-a7c5-0ac5431911a9`, room `1b1b8a68-897c-4091-93b5-0ff0d828c3ea`. Initial settings selected Movie Meetup and showed its five targets. Replaced targets with `Issue32 edited Movie Meetup target`, saved, reloaded the whole page and reopened settings: scenario remained Movie Meetup and the edit persisted. Switched to Custom, saved, reloaded and reopened: Custom remained selected with the same target. A separate database read confirmed `prompt_config.scenario: null`, the edited detection array and an empty verification array.

Screenshots: `output/playwright/issue32-staging-20261030/scenario-reload.png` and `custom-reload.png`. The lease record is in that directory. Browser snapshots and console logs are in `.playwright-cli/`, including the initial settings snapshot `page-2026-10-30T13-33-09-931Z.yml`. Existing console failures included a missing-profile lookup during initial join and missing checklist before target setup; the settings assertions and saves passed.

Deleted the room through the UI, navigated out and closed the browser. An initial cleanup query used the nonexistent `room_sessions` name; corrected it to `sessions`. REST deletion of the temporary user was rejected by the existing client-contract gate; management SQL cleanup then removed only the exact tagged user. Final persisted counts were zero for the room, messages, AI config, sessions, session checklists and temporary user. The project lease was then released.

SHA-256 over sorted tracked paths plus NUL plus file bytes: frontend `src/` = `1b30ede7bb0d981dcb7a4747ece0bda37ef4dbca8946f42c8bf6c4341fc7ff9c`; public assets = `84b59c33b00b31169d12d810cfe3606ba151dffe959c0275cf4288d40430111b`.

## Production acceptance still open

Production: after integration into `no_sign_up` and matching frontend deployment, repeat the affected browser flow against `zgbufaxooqxeabewktzd` and record cleanup. Issue 32 remains open until this evidence is complete. Root Codex agent owns these checks.

# Review: technology and version claims in the architecture spine

Intent: check each named technology and version in the spine's Stack section against the project (package.json, package-lock.json, Edge Function imports, deno.lock, config.toml) and the web. Date: 2026-10-22. The spine was not edited.

Verdict: the spine's claims match the project. Four statements are imprecise or unconfirmed (F1-F4 below). Most named technologies are old but still work, and the spine ratifies a brownfield project, so age alone is not flagged. Support facts are in the last table.

## Project check

| Spine claim | package.json range | Locked version | Result |
| --- | --- | --- | --- |
| React, React DOM ^18.2.0 | ^18.2.0 | 18.3.1 | Match. 18.3.1 is the last 18.x release. |
| TypeScript ^4.9.5 | ^4.9.5 | 4.9.5 | Match. |
| react-scripts 5.0.1 | 5.0.1 (exact) | 5.0.1 | Match. |
| react-router-dom ^6.20.1 | ^6.20.1 | 6.30.1 | Match; the lock is 10 minors above the stated floor. |
| @supabase/supabase-js ^2.39.0 | ^2.39.0 | 2.51.0 | Match on the range, but the browser runs 2.51.0 while the Edge Function runs 2.39.0 (see F1). |
| Edge Functions pin 2.39.0 via esm.sh | not applicable | not applicable | Partly right. Only `assessment-api/index.ts` imports `https://esm.sh/@supabase/supabase-js@2.39.0`. `ai-api` has no supabase-js import. `deno.lock` also records it at 2.39.0. |
| @testing-library/react ^13.4.0 | ^13.4.0 | 13.4.0 | Match. |
| jest-cucumber ^4.5.0 | ^4.5.0 | 4.5.0 | Match. |
| Jest bundled with CRA 5 | not applicable | not applicable | Not checked directly (see F4). |
| Deno (Edge Functions) | not applicable | not applicable | `supabase/config.toml` sets `deno_version = 1`. The spine does not state a Deno version. Functions use `Deno.serve`, `Deno.env.get` and `import.meta.main`, and import `../../../src/**/*.ts` with explicit `.ts` extensions. The root `deno.json` enables `unstable: ["sloppy-imports"]`. |
| Postgres | not stated in the spine | not applicable | `config.toml` sets `major_version = 17` for the local stack. The spine says "Postgres" with no version. |

Not checked: `node_modules` is not installed in this worktree, so "installed" means locked versions from `package-lock.json`. The Node version used in CI is not stated anywhere in the spine.

## Findings

- F1 (medium): the spine's version column hides a split. The browser locks supabase-js 2.51.0 while the Edge Function runs 2.39.0, twelve minors apart. This is the main drift between the browser and server stacks. The spine should say that the Edge pin is separate from the client range, and that it covers `assessment-api` only.
- F2 (medium): the Edge Function dependency style (esm.sh URL import) is not Supabase's recommended style. Current Supabase docs prefer `npm:` specifiers and per-function `deno.json`, and describe import maps as legacy. They still support esm.sh. This is a support fact, not an error. The spine should not call esm.sh pinning a recommended practice. Its pinning to an exact version does follow the docs' pin-versions guidance.
- F3 (low): `config.toml` has `deno_version = 1`. I confirmed this only locally. I did not confirm from a current source that the hosted runtime, the local CLI and `deno.json` agree on the Deno major version. The spine does not state the Deno version, so none of its claims is wrong. A reader who wants the version will not find it.
- F4 (low): "Jest bundled with CRA 5" is unconfirmed. I did not verify the Jest major version bundled with react-scripts 5.0.1. I believe it is Jest 27, but that is not confirmed here. "Postgres" and "AI provider" carry no version, so nothing in them can be out of date.

## Web support status (secondary sources; no primary page was fetched)

| Technology | Status found | Source quality |
| --- | --- | --- |
| Create React App / react-scripts | Formally deprecated by the React team on 2025-02-14; no active maintainers; the React docs steer new apps to frameworks or Vite. | Multiple news and community reports. I did not read the official React blog post. |
| React 18 | No published end-of-life date. The last release is 18.3.1 (2024-04-26) and the line is frozen. React 19 is current. The sources conflict on whether 18 counts as end of life. | Third-party tracker (endoflife.ai); it contradicts itself. |
| TypeScript 4.9 | Not confirmed. My search returned nothing for TypeScript. The project locks 4.9.5, which is the last 4.9 release. | Not confirmed against the web. |
| @supabase/supabase-js 2.x | The 2.x line is current, with 2.112.x seen on JSR. Node 18 support was dropped at 2.79.0 and Node 20 at 2.110.0. The locked 2.51.0 and the pinned 2.39.0 are far behind the latest. The Node drops matter if the project upgrades supabase-js. | Supabase changelog and the supabase-js README. |
| Supabase Edge Functions on Deno | Current and documented. The docs recommend `npm:` imports and `Deno.serve`. The specific Deno version is not stated in the sources I found. | Supabase docs. |
| esm.sh | Supabase docs still list it as a supported CDN. I found no status page for esm.sh itself. | Supabase docs only. |

## Flagged as unconfirmed

- TypeScript 4.9 support status.
- esm.sh service status.
- The Deno runtime version of the hosted Edge environment.
- The Jest version bundled with react-scripts 5.0.1.
- React 18 end-of-life status, because the sources conflict.
- Any statement about a primary page: all web facts above come from search summaries, not from fetched primary pages.

Suggested wording changes to the spine are F1 and F2 only. A supabase-js upgrade, a CRA replacement or a TypeScript upgrade is a separate decision, not part of this review.

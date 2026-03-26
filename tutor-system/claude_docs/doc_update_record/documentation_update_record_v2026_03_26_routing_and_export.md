## Intent
Record the March 26, 2026 documentation updates for refresh-safe routing and learning progress export so the deployment behavior and tutor export workflow remain traceable.

## Metadata
- Date: 2026-03-26
- Scope: `claude_docs/README.md`
- Commit ID: pending at record creation time

## Changes
- Documented that the app shell uses hash-based routing so deep links survive refresh on static hosting without rewrite rules.
- Documented that this routing choice is specifically intended to avoid refresh-time `not found` behavior on deployments such as Render static hosting.
- Documented that tutors can export Learning Progress as JSON from the checklist panel.
- Documented that the export includes summary counts and serialized checklist items.

## Evidence
- Routing regression test covers booting the app from a hash deep link.
- Checklist export component test covers JSON download payload generation.
- Local browser run created a room, generated a manual checklist, and downloaded a valid learning progress JSON file.

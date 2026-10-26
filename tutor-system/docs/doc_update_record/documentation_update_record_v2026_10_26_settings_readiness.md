# Settings readiness in room setup

Intent: make the browser workflow save the loaded template configuration.

Updated: 2026-10-26. Source baseline: `8e6362e`.

The earlier `staging-template-20261026080548-bc1fb0a6` tutor screenshot shows
Smart Generate reporting no detection areas. The settings component and the
entire AI configuration loading effect match `origin/no_sign_up`; this is
not evidence of a new ownership-extraction defect. The enabled checkbox is
set from the room before its asynchronous AI configuration has loaded.

A local component diagnostic reproduced the inherited behavior: with an
enabled room, unresolved `aiConfig` and no generation in progress, Save is
enabled and submits `prompt_config: null` with defaults. That diagnostic
passed with the eight existing component checks. Its source remains an
uncommitted investigation artifact; this repair changes no application code.

Before either settings save, the workflow now waits for both target fields
to exist, be editable, and exactly match the created configuration's five
detection targets and empty verification list. It reads the actual form
fields by their existing placeholders because their visual labels have no
HTML association. The enabled checkbox remains an independent assertion.

`node --test scripts/browser-e2e.test.js` passes 27/27 checks, including a real
Chromium readiness check covering absent, empty, incorrect, partial and
disabled fields before accepting the exact loaded values. The helper retains
the existing 90-second browser bound. `git diff --check` passes. No hosted
operations or app/prompt changes were performed.
Independent review found no issues and reran all 27 harness checks successfully.

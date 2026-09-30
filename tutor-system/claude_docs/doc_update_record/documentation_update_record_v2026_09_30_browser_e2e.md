# Browser E2E Documentation Update

Intent: record the browser workflow reorganization and staging setup guidance.

Date: 2026-09-30
Base commit: `c2747f7`

## Changes

- Added the browser E2E guide with production/staging project identities, environment setup, workflow commands, evidence retention, and cleanup behavior.
- Linked the guide from the repository instructions and tutor-system documentation index.
- Updated the tutor-system README and testing strategy for seven staging Playwright workflows and separate release evidence commands.
- Documented canonical assessment template targets and dialogue in the staging fixture migration.

## Evidence

- The real staging transfer recording completed with HTTP 200 assessment and tutor provider calls; see ignored `output/playwright/transfer-learning-demo-video-20260930195109-55a4e42b/evidence.json` in the local workspace.
- The recorder cleanup left zero messages, sessions, and session checklists in `assessment-delivery` after that run.

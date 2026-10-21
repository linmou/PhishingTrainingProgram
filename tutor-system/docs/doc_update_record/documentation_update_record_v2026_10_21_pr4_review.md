# PR #4 review and Staging smoke

Intent: record the release-policy review and live acceptance evidence for the fixture lock.

Date: 2026-10-21. Reviewed baseline: `16c2f955bf90f8deffbdd6840b7f2cc8e8fc63e2`.

The release policy preserves root AGENTS.md's single pending migration requirement, staging-before-production sequence, exact-artifact promotion and acceptance gates. The same-host fixture lock and Actions concurrency boundaries are explicit. Updated the browser guide's workflow inventory. These harness/documentation changes do not change deployed server behavior.

Verification from `agent-verification-isolation`:

- `node --test tutor-system/scripts/browser-e2e/fixture-lock.test.js scripts/database/export_validation_baseline.test.js`: 6 passed.
- `cd tutor-system && node --test scripts/browser-e2e.test.js`: 20 passed.
- `E2E_TARGET=staging node scripts/browser-e2e.js --workflow=checklist-management`: PASS, 2026-10-21 08:53:45–08:54:02 UTC, project `ciubrzggdqesgvfkpolj`, app `http://localhost:3114`.
- Run `20261021085345-f534faa8`: acquired project lock before fixture work; created two targets; persisted status, priority and text edits; verified reload; cleanup passed for room `3630671f-b40d-48ed-b28b-e1da6d407436`; lock release reported no error.

Raw report and screenshot: `tmp/browser_demo_runs/staging-template-20261021085345-f534faa8/`. Report includes source hashes, IDs, timestamps, persisted values and lock ownership. Existing main-checkout dependencies were used for this targeted smoke; clean frontend installation and Jest/build are tracked separately in #5.

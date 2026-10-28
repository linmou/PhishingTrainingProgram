# Fixture Cleanup Transfer Guard

Intent: allow ownership-checked browser fixtures to clean protected transfer checklists without changing application permissions or workflow results.

Updated: 2026-10-26. Implementation baseline: `f4eb30c`. Release owner: root open-issues agent.

The full browser run failed an assessment-delivery Guard check, then fixture cleanup failed with SQLSTATE `42501 TRANSFER_CHECKLIST_WRITE_REQUIRED`. The live guard definition saved in `output/open-issues-release-20261025/lease-f4eb30c/checklist-guard-live.json` requires `app.transfer_operation=on` for transfer-policy checklist deletion. The release owner verified the tagged template, performed cleanup with the transaction-local flag and confirmed all related counts zero and response mode false; the repair/readback evidence remains in that lease directory and its lease was released.

Both template cleanup and created-room cleanup now call `PERFORM set_config('app.transfer_operation', 'on', true)` at the beginning of their existing SQL `DO` transaction. The created Cyberbullying room cascade also uses a flagged transaction, preserves the exact room/tutor ownership filter, requires a successful DELETE, and reads back zero rooms and related rows. Fixture-marker and owner validation still precede mutations. The `true` argument confines the guard setting to the cleanup transaction.

The focused tests invoke the actual helpers through a mocked Management API, inspect the SQL submitted at runtime, require the local flag before protected deletes, retain all readbacks, and reject missing fixture markers and foreign owners before mutation. They are included by the normal browser-runner unit entry point. The complete runner unit command passed 26 tests locally. No hosted operation was performed by the implementation agent. This change fixes cleanup only; the original Guard classification failure remains open for separate diagnosis.

Independent review is **CLEAR**, with all 26 browser-runner unit tests rerun successfully. Review confirmed the transaction-local flag, unchanged ownership checks and retained cleanup/readback assertions.

```sh
rtk proxy node --test scripts/browser-e2e.test.js
```

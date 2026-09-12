# Documentation update record: transfer assessment draft disposition facade and teacher draft DTO

Intent: record the T014 facade completion and the R05 teacher draft DTO, stating what was
executed and what remains unexecuted.

Date: 2026-09-12
Implementation commit IDs: `4a42378` (facade), `2368a12` (DTO)

## Changed documents and artifacts

- `tutor-system/src/services/transferAssessmentService.ts`: added `rejectDraft` and
  `regenerateDraft`, typed `RejectedAssessmentDraftDTO` and `RegeneratedAssessmentDraftDTO`,
  the `TeacherAssessmentDraftDTO` interface with its key and forbidden-storage-name
  allowlists, and `toTeacherAssessmentDraftDTO`.
- `tutor-system/src/services/__tests__/transferAssessmentDraftDisposition.test.ts`: new, 10 tests.
- `tutor-system/src/services/__tests__/transferAssessmentDraftDto.test.ts`: new, 12 tests.
- `tutor-system/src/services/__tests__/transferMigrationExtensionCalls.test.ts`: the
  "two inherited callers still unqualified" expectation was replaced, deliberately, because
  migration 029 repairs both. New assertions pin 029's two functions and their
  `SECURITY DEFINER` / `search_path` posture.
- `specs/102-transfer-backend/tasks.md`: T009 marked complete with its hosted evidence and its
  execution limit; T014 recorded as partial with the remaining gap named.

## Why these were the next units

The Edge Function, the shared allowlist, and migration 027 already carried `reject_draft` and
`regenerate_draft`, but the browser facade exposed no way to reach them, and
`TeacherAssessmentDraftDTO` — which reconciliation R05 calls the only private browser DTO for
a draft — did not exist anywhere in `src/`. Both gaps are reachable without database rights,
so neither was gated by the read-only connection.

## Verification performed

- Transfer-only suites: `8 suites / 63 tests` pass, including the 22 new tests.
- `npx tsc --noEmit` reports zero errors for every touched file. Pre-existing errors remain in
  unrelated files (`storage-integration.test.ts`, `testValidation.test.ts`) and are unchanged.
- The DTO key set is asserted against the API contract document, and the storage-projection
  test populates every forbidden column with a unique marker so a leak is detectable by value.
- `regenerateDraft` is asserted to leave the caller's provider payload byte-identical, which is
  the facade-level expression of "provider failure cannot mutate the source draft".

## Verification boundary

Not executed: PART 2 of the T009 lane, any live RPC call, Edge Function deployment, or
end-to-end acceptance. All of those require a `service_role` connection. The facade tests
inject a fake API, so they prove request shape and response contract, not deployed behaviour.
Migration 029 remains applied-by-nobody at this point.

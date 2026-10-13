# Transfer assessment browser QA closure

Intent: preserve the final browser outcomes and remaining limits after merging the transfer-assessment QA repairs.

Date: 2026-10-13 UTC. Verified application commit: `a8857e3` on `no_sign_up`. Guide: `docs/transfer-assessment-qa-guide.docx`, SHA-256 `7ea96d59af3d2618d67fef6e4f5abc3bfd13b35dd11286240bb1caab8b725879`.

## Result

All 13 guide scenarios pass using the documented combination of Chrome DevTools MCP browser runs, regression tests and live SQL assertions. Four isolated agent worktrees were merged. The browser used local CRA frontends against staging (`ciubrzggdqesgvfkpolj`, port 3100) and production (`zgbufaxooqxeabewktzd`, port 3101). The frontend build is validated locally; no hosted frontend deployment is claimed.

The original six defects are corrected: post-assessment AI feedback; target initialization and retry; paired status/understanding edits; trusted notes saves; target labels and tutor-only answer/context review. Later browser findings added typed-answer linking, non-consuming ambiguous/assisted handling, preserved history after cancellation, automatic learner readiness refresh, and accurate stale-candidate recovery from structured HTTP errors.

Staging Edge version 52 and production version 9 use source manifest `24df7e0093052f39de57382b20d76d651dcdbc320cd251900eebd6d15a9da1f1`. SQL hash and full release gates are recorded in [the database release record](documentation_update_record_v2026_10_13_transfer_qa_repairs.md). The final stale-draft correction changes frontend code only.

## Key browser evidence

- Staging correct-first, retry/failure, typed correct-second, multiple-choice ambiguity and assisted cancellation all produced the expected authoritative attempt/progress state. Duplicate processing consumed no extra attempt.
- Production assessment `c5885986-69d8-453a-9694-e3929405240f` accepted typed `C?` on attempt one; MCP confirmed covered/good and delivered linked tutoring feedback with feedback_required=false. Notes and partial/basic edits persisted after reopening the original failing room.
- Existing staging fixture `79be49a2-e53c-493d-bd66-adcffbadbba5`, owned by DemoTutor_213782, verified failed initialization followed by actual Retry sync HTTP200. A scoped browser fault injection produced the initial failure; it was disabled before the successful server request.
- In that fixture, changing progress after preparation caused ASSESSMENT_NOT_ELIGIBLE. The fixed editor disabled Send and remained superseded after edits. Discard/regenerate recovered. A subsequent offline delivery failure recovered to exactly one public question.
- Recovery assessment `334fe9d9-9d71-469c-996f-d5ff90f9b33a` rejected `B or D` with zero accepted attempts, then accepted selected B as a correct first attempt. Offline/online reconnection also preserved the production answer/history and received later tutoring feedback.
- Guard protected the learner before assessment, locked progression, allowed corrective messages and returned to tutoring. Observer rendering was verified in the original browser run plus current automated tests; learner private-review denial and actual SQL role boundaries passed.

Full sanitized request/response bodies, IDs, snapshots, available provider input/output, injection metadata and 11 screenshots: repository-root `output/qa-transfer-remediation-2026-10-13/`. The scenario matrix is `report.md`; detailed browser evidence is `browser-evidence.json`. The original failed run remains in `output/qa-transfer-2026-10-12/`.

## Validation and limits

The combined frontend run passed 176 tests; subsequent targeted readiness, parser/orchestrator, independent recovery/privacy and final HTTP-error suites passed 30, 65, 144 and 62 tests respectively. These suites overlap and must not be summed. The Edge suite passed 33 tests. The final production build passed with existing warnings. Seven SQL behavior/permission scenarios passed locally and on both projects; terminal fault injection and two concurrent cancellation/pass orders passed locally.

One model analysis failed strict output validation repeatedly and produced no event or draft. A subsequent learner paraphrase succeeded. Rejected analysis output is not persisted by the existing handler, so its exact invalid field remains unobservable. The guide's non-feasible tagged BDD scenario is not counted as passing executable coverage. The terminal third-post rejection prevents grading but retains its existing imprecise WRONG_LEARNER code.

Transactional hosted SQL fixtures were rolled back and verified absent. Browser fixtures remain for review, including modified existing staging pass/failure fixtures and an unused newly created recovery room `e55cd129-0e29-45a2-acbb-5f0773a474a5`; an empty-fixture automated run must account for this retained state. Existing unrelated pending migration records were preserved.

## Separate template availability finding

Read-only Supabase MCP found 19 global templates in production and one in staging. Both browser queries return HTTP200 with no rows because the live RLS policy only permits `tutor_id = auth.uid()` or a null owner; global rows use the all-zero system owner. All four reusable QA rooms exist in both databases under DemoTutor_213782. The global-template visibility policy remains unchanged. Evidence: `output/qa-transfer-remediation-2026-10-13/template-availability-investigation.md`.

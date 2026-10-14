# Early-message recheck browser verification

Intent: retain real-browser evidence that learner messages posted before goals are automatically checked when the tutor creates those goals.

Date: 2026-10-14. Branch: `no_sign_up`. Fix: `6c6c1c5`, merged by `7582916`.
Recorded HEAD: `73f5908eafffec347572572be384c0546e3323e3`. Application source matches `2bd3143`; intervening changes were documentation and repository guidance.

## Environment and execution

The merged CRA application was built with staging Supabase settings and served locally at `http://127.0.0.1:3108`. Playwright launched real headless Chromium with separate tutor and learner contexts. Supabase target: `ciubrzggdqesgvfkpolj`. The existing browser runner blocked traffic to other Supabase projects. Analysis used the deployed staging Edge Function and its configured real provider; browser requests and database responses were captured without mocking.

Selected workflow: `early-message-recheck`. Fixture: `286de02f-30b0-46ee-8df3-17d1dae1ca89`, the empty tagged assessment-delivery template. Tutor: `DemoTutor_213782`. Learner: `794abdb9-6c8e-4526-a384-1e1a5a7f794a`. The runner validated the fixture and owner before mutations. Provider and privileged database credentials stayed outside the application process.

With the staging environment loaded as described in [browser-e2e-testing.md](../browser-e2e-testing.md), repeat using:

```sh
rtk npm run test:e2e:staging -- --workflow=early-message-recheck
```

The local launcher and staging build are retained under `output/playwright/early-message-recheck-live/`. The temporary server was stopped after verification.

## Final results

Run: `staging-template-20261014233555-57a571a4`, from `2026-10-14T23:35:55.442Z` to `2026-10-14T23:36:24.243Z`.

| Check | Observed evidence |
| --- | --- |
| Posts precede goals | Two persisted learner posts; zero checklists and zero learning events before goal creation. |
| Goal creation through browser | Tutor entered one detection and one verification target and submitted the manual form. Checklist: `85eef90a-c21f-4eef-ac77-c125e55a8d4d`. |
| Automatic chronological replay | Four tutor analysis requests in order A, A, B, B. First request per message analyzed it; the second returned `already_processed: true`. All returned HTTP 200. No tutor AI preparation request occurred. |
| Saved and visible progress | Both targets were `covered` with `good` understanding; the tutor panel showed 100% completion, 2/2 items. |
| Backend completion | Exactly one applied `analysis_complete` record per early message, plus two applied progress events. |
| Later ordinary learner post | An unrelated third message invoked ordinary posting and analysis. Earlier messages returned `already_processed: true`; their saved events remained identical. The third message added one completion marker and no progress event. |
| Reload | Tutor reload still showed both goals covered. The complete event ledger matched the state before reload. |
| Cleanup | Passed. Messages, sessions, checklists, feedback, private assessment rows, provider attempts and learning-event rows were empty afterward; the fixture response mode returned to its baseline. |
| Reproducibility | Final workflow SHA-256 matched the source file after the run. The report records source commit, runner/workflow hashes, target and timestamps. |
| Runner regression | All 20 existing runner tests passed after registering the workflow. |
| Build | Staging-configured optimized build passed; existing Browserslist age warning remained. |

Early message IDs in chronological order: `c13803f6-0491-4e2e-a897-f645e46f9812`, `eb06dc3b-779c-44d0-b783-b67ce865e16c`. Later unrelated message: `124adeff-5581-47ac-b567-ab9a4fdd4ae9`.

## Evidence and earlier attempts

The final [report](../../../output/playwright/early-message-recheck-live/staging-template-20261014233555-57a571a4/report.json) records pass and cleanup. The [workflow evidence](../../../output/playwright/early-message-recheck-live/staging-template-20261014233555-57a571a4/early-message-recheck.json) contains complete learner inputs, API request/response bodies and database snapshots before goals, after replay, after the later post and after reload. The [reload screenshot](../../../output/playwright/early-message-recheck-live/staging-template-20261014233555-57a571a4/early-message-progress-after-reload.jpg) shows the final panel and discussion. These generated artifacts remain local and are not committed.

All four attempts remain under `output/playwright/early-message-recheck-live/` and their original `tmp/browser_demo_runs/` paths:

- `20261014233214-ad588832`: failed before goal creation. Automation filled the manual form while learner lookup was still refreshing the panel; the fields reset. The workflow now waits for that lookup and loading state, and checks both input values before submitting. Cleanup passed.
- `20261014233427-666ce12b`: replay completed and both targets became covered, but an overstrict test expected a separate progress transition from each early message. The first message had already advanced both targets, so the second correctly had a completion marker without a further transition. The test now requires one completed analysis per message and the resulting progress, without demanding redundant transitions. Cleanup passed.
- `20261014233510-1f11ac8c`: passed replay, later-message duplicate prevention, reload and cleanup.
- `20261014233555-57a571a4`: passed the final source, including explicit completion-confirmation and successful learner-API assertions; cleanup passed.

This run adds live staging coverage to the [local post-merge verification](documentation_update_record_v2026_10_14_early_message_recheck_merge.md). Semantic classification quality remains covered by the separate transfer-analysis evaluations.

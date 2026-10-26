# Room setup analysis evidence

Intent: retain the analysis request outcome when room-setup browser acceptance fails.

Updated: 2026-10-26. Implementation baseline: `f4eb30c`.

## Observed failure

Run `staging-template-20261026075217-f2d452f2` failed waiting for the unified
safe-action target in room `2796beea-3c34-4402-b691-7ef6f18273cc` to become
covered with good or excellent understanding. Cleanup passed. The workflow
captured responses locally but did not write them when its state check threw,
so this run cannot distinguish an API error, model decision or timing issue.
The 20-second polling budget started after composer clearance, which proves
message persistence rather than analysis completion.

Projected Edge logs for the surrounding window contain 47 HTTP invocations,
all status 200/204, with the longest assessment invocation about 5.7 seconds.
They lack request-body or room attribution. These observations do not prove
that the workflow's analysis succeeded or that its failure was a timeout.

## Harness change

Before sending, the workflow arms a 90-second analysis response wait restricted
to POST `analyze_message` for the created room. It requires HTTP 200 and the
successful API envelope before polling persisted progress. The existing
covered and good/excellent condition is unchanged.

`room-assessment-setup-analysis.json` is written on success and failure with
room/item IDs, start/end time, timeout, stage, error details and full captured
request/response calls. The failure stage distinguishes sending, waiting for
analysis and checking persisted progress. This is a harness change; the app
and deployed artifacts are unchanged.

## Verification

`node --test scripts/browser-e2e.test.js` passes 23/23 checks. The new focused
checks verify that the wait precedes sending, rejects another room, another
operation and GET requests, uses the bounded response budget, verifies progress
only after a successful response, and retains raw calls for send, timeout,
HTTP, envelope and persisted-progress failures. `git diff --check` passes.
The integrated release owner coordinates the next targeted live run.
Independent review found no issues and reran all 23 harness checks successfully.

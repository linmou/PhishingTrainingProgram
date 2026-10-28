# Room setup result assertion repair

Intent: record the obsolete browser assertion and the replacement identity checks.

Updated: 2026-10-25. Implementation baseline: `45867b4`.

## Evidence

The staging run `staging-template-20261026001900-4f21d4a8` timed out at
`room-assessment-setup.js:200` while looking for a `Correct.` status nested in
the question. Its learner failure screenshot shows the result as a separate
message, matching the current result-message rendering contract. Room
`4c2df8dc-4198-449b-bb21-814bd7067859` and assessment
`568cd4f0-059e-45a2-9e60-adcdf9b03b9e` identify the failed journey; cleanup passed.

## Change

The workflow loads the saved messages, requires exactly one selected-option B
answer and its question closed as `passed` with grade `pass` on that answer,
and requires exactly one result with matching learner,
assessment, question, answer, parent and first-attempt identity plus `passed`
outcome. It locates the visible result by the persisted message ID. The
workflow evidence now includes both saved rows. The local regression exercises
the sibling layout, wrong identities, wrong grade/attempt, duplicate or absent
results, and an unrelated visible result. A search of the browser workflows
found no other obsolete nested result-status assertions.

## Verification

`node --test scripts/browser-e2e.test.js` passed 21/21 checks, including the
real Chromium sibling-result regression. `git diff --check` passed.
Hosted rerun remains owned by the integrated release coordinator; this change
does not perform hosted writes or fixture mutations.

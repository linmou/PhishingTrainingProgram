# Learning Progress Merge into no_sign_up

Intent: record integration of the original upper-right placement and verification on the target branch.

Date: 2026-10-15. Target baseline: `860b81a`. Source branch: `fix/learning-progress-upper-right`. Source commit: `ecabba2c0762c838fb6a81accb234010c46925ab`.

## Integrated behavior

Restore the original fixed Learning Progress button and right-side panel, including the original mobile offsets and toolbar icon. Retain desktop sidebar clearance, full-width notices, and short-screen panel scrolling. The user accepted the documented narrow-screen overlaps and requested this merge.

The only merge conflict was documentation metadata in `docs/README.md`; resolution retains the current date, source restoration commit, and existing release metadata.

## Verification

- On the merged target, the five focused checklist and room transfer suites pass: 70 tests, zero failures.
- `npm run build` passes on the merged target, with existing lint and Browserslist warnings.
- `git diff --cached --check` passes.
- The merged checklist/page/layout source matches the source branch exactly. The source branch's 22 offline Chromium cases remain the layout evidence; they were not rerun during integration. See the [original-position record](documentation_update_record_v2026_10_14_learning_progress_original_position.md) for coverage and the known overlaps.

This operation integrates the frontend change locally into `no_sign_up`; it does not publish or deploy it.

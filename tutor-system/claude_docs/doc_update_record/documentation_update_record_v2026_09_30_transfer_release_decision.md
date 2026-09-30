# Transfer Release Decision Documentation Update

Intent: record why the current-version release documents changed while preserving the unfinished gate results.

Date: 2026-09-30
Base product-code commit: `97ebe9fd11d78ab2874e098415f84e4c3eaf608d`

The owner authorized release of that product-code version with component 104's live quality gate and the other recorded integration, hosted, and component 105 checks incomplete. The tracked decision is `specs/orchestration/transfer-assessment/release-decision-2026-09-30.md`; the initiative ledger mirrors the decision without marking unfinished milestones complete. Active component specs and the tutor response contract now refer to the decision. The release runner still reports its ordinary evidence-based verdict and does not measure or set the hosted flag.

Verification: `node --test tutor-system/scripts/transfer-assessment-release.test.js` passed 21/21 tests; `git diff --check` passed. No runtime code, hosted configuration, or deployment changed.

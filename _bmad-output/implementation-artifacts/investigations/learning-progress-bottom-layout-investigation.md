# Investigation: Learning Progress below the discussion

Intent: explain which change moved Learning Progress, its recorded author, and its rationale.

## Hand-off Brief

Learning Progress was deliberately moved into document flow by commit `22c569ba029626dc10d0a14634f8ed35cff21f42`. The expanded panel stacks below the discussion at viewport widths of 1100px or less, and the collapsed button uses document flow at every width. The recorded rationale was to prevent the panel from covering tutor controls; no implementation change is part of this investigation.

## Case Info

- Date: 2026-10-14.
- Status: Concluded.
- Source baseline: `8dc7271`.
- User report: "why 'learning progress' is now at the downside of the page ? who modified it ? why".
- Evidence: current source, Git diff/blame, and the implementation's documentation record.

## Confirmed Findings and Source Trace

1. `tutor-system/src/components/ChecklistPanel.css:732` sets a 1100px breakpoint. At that width or below, `position: static` replaces the fixed sidebar. `tutor-system/src/pages/RoomPagePost.tsx:1227` renders the panel after the discussion, so it appears below it.
2. `tutor-system/src/components/ChecklistPanel.css:18` puts the collapsed button in normal document flow at all widths. The same commit removed its fixed top-right positioning.
3. Git blame attributes both changes to `22c569ba029626dc10d0a14634f8ed35cff21f42`, authored and committed as `linmou <margelnin@gmail.com>` on 2026-10-14 at 18:10:17 -0400. Subject: `fix(ui): keep tutor controls clear of learning progress panel`. Merge `3fabb57673327b603f0636ad58f386be7189d401` brought branch `fix/learning-progress-layout` into `integration/chat-feedback-ui-fixes` at 18:10:32 -0400.
4. `tutor-system/docs/doc_update_record/documentation_update_record_v2026_10_14_learning_progress_layout.md` explicitly records the stacking decision. It reports that the original 400px sidebar overlapped the AI button at 1280px with Guard enabled: AI button x=871–964; panel starting at x=880.

## Hypothesis and Refutation

- Hypothesis: a recent layout edit caused Learning Progress to appear at the bottom. Status: Confirmed by the diff and blame.
- Alternative checked: an accidental JSX relocation. The commit changed the room layout class, while the panel's existing placement after the discussion became visible through the CSS positioning change.

## Verification Evidence

Read the exact introducing diff, compared current CSS/JSX, and checked blame for both responsive positioning and the collapsed button. The implementation record reports 16 browser cases and 4 Jest suites / 48 tests; these historical results were not rerun for this explanation.

## Missing Evidence

Git identifies the commit account but cannot establish whether a human or an assistant operated under it. The user's exact browser width and live deployed version were not inspected; the source mechanism is confirmed.

## Conclusion

Confidence: High for the source change and recorded rationale. This was a deliberate overlap fix with a visible placement tradeoff. A future adjustment can keep Learning Progress accessible near the top while preserving clearance for the tutor controls; that requires a separate implementation request.

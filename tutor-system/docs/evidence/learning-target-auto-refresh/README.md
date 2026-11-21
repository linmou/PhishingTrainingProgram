# Local panel previews

Captured 2026-11-12 in Orca's embedded browser from the actual modified `ChecklistPanel.tsx` and its CSS/EvidenceModal, bundled with React and simulated hook/auth/service inputs. The preview explicitly displays “Local component preview · simulated data”. It has no Supabase connection and is not staging acceptance.

- `tutor-draft-preserved.png`: 1366×900; type an unsaved note, simulate a committed status update and priority change Important → Critical; the same expanded card and note remain.
- `learner-read-only-mobile.png`: 390×844; learner card expanded; saved progress/evidence are visible and setup/edit/add controls are absent.

Transient preview source/build: `/tmp/ptp-refresh-preview/build.cjs`; served locally on port 3187 for capture. esbuild 0.28.0 was installed only under `/tmp/ptp-refresh-preview-tools`, without modifying repository dependencies. Automated behavioral coverage lives in `src/components/__tests__/ChecklistPanel.live.test.tsx` and the hook/page suites. Full room layout, server delivery and viewer authorization still need the live checks in the release record.

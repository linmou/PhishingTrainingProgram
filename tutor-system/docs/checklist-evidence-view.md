<!-- Intent: identify the supported evidence viewer and its learner-scoped selection lifecycle.
Updated: 2026-11-08. Baseline commit: a69b836. -->

# Checklist evidence viewer

`ChecklistPanel` owns the selected evidence item and renders `EvidenceModal`. This implements the existing learner-evidence view required by PRD FR-23. The supported viewer is active; the former logging-only evidence action opens it.

The viewer uses the current checklist item rather than a copied evidence snapshot. Refreshes show updated evidence, including an empty history. Closing, hiding the panel, loading a replacement checklist or removing the item clears selection. The room, requested learner, signed-in user, checklist identity and checklist learner bind that selection; changing any of them closes the old viewer. Returning to the previous scope does not revive its selection.

The modal only displays data already returned through the existing checklist access path. Opening requires the returned checklist's room and requested learner to match the current selection, including while a refresh retains the previous checklist. It makes no independent data request. Checklist export and other evidence rendering retain their existing contracts.

The modal renders through a portal at the document body so transformed room containers cannot constrain its full-screen overlay. It focuses its close control on opening, cycles keyboard focus within its buttons, supports Escape and restores the connected opener on close.

Focused integration verification is in `src/components/__tests__/ChecklistPanel.evidence.test.tsx`, alongside the existing checklist export and transfer suites. Check detection and verification evidence, closing/reopening, refreshed empty evidence, removed items, scope changes and keyboard focus.

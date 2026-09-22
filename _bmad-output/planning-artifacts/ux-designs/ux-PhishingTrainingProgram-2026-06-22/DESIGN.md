---
name: Prompt Evaluation Review Workspace
status: draft
sources:
  - /Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/evals/web/PRD.md
updated: 2026-06-22
description: A quiet, evidence-first review workspace for non-technical prompt evaluation reviewers.
colors:
  surface-base: '#F6F8F7'
  surface-raised: '#FFFFFF'
  surface-subtle: '#EEF3F1'
  surface-selected: '#E7F4EF'
  ink-primary: '#172322'
  ink-secondary: '#536466'
  ink-muted: '#7A898B'
  border-subtle: '#D5DEDF'
  border-strong: '#AEBBBC'
  primary: '#1E6F5C'
  on-primary: '#FFFFFF'
  primary-soft: '#DDEFE9'
  info: '#2F6EA5'
  info-soft: '#E4EFF8'
  warning: '#B7791F'
  warning-soft: '#FFF3D8'
  danger: '#B84A3D'
  danger-soft: '#FBE7E4'
  neutral-accent: '#59677D'
  neutral-accent-soft: '#E8ECF2'
typography:
  display:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 30px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: '0'
  title:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1.3'
    letterSpacing: '0'
  subtitle:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 16px
    fontWeight: '650'
    lineHeight: '1.4'
    letterSpacing: '0'
  body:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label:
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1.35'
    letterSpacing: '0'
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace'
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.35'
    letterSpacing: '0'
rounded:
  sm: 4px
  md: 6px
  lg: 8px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 20px
  '6': 24px
  '8': 32px
  '10': 40px
  page-x: 32px
  page-y: 28px
  panel-gap: 16px
components:
  app-shell:
    background: '{colors.surface-base}'
    sidebar-background: '#12292D'
    sidebar-foreground: '#D7E7E8'
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.on-primary}'
    radius: '{rounded.md}'
  button-secondary:
    background: '{colors.surface-raised}'
    foreground: '{colors.ink-primary}'
    border: '{colors.border-subtle}'
    radius: '{rounded.md}'
  panel:
    background: '{colors.surface-raised}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
  run-card:
    background: '{colors.surface-raised}'
    border: '{colors.border-subtle}'
    radius: '{rounded.lg}'
    selected-background: '{colors.surface-selected}'
  status-good:
    foreground: '{colors.primary}'
    background: '{colors.primary-soft}'
  status-info:
    foreground: '{colors.info}'
    background: '{colors.info-soft}'
  status-warning:
    foreground: '{colors.warning}'
    background: '{colors.warning-soft}'
  status-danger:
    foreground: '{colors.danger}'
    background: '{colors.danger-soft}'
---

# Prompt Evaluation Review Workspace — Design Spine

## Brand & Style

This is an evidence workbench. It should feel calm, exact, and operational: a place where a curriculum reviewer can read an evaluation story without feeling pushed into a technical console. The design avoids hero-style marketing, decorative illustration, and oversized cards. It favors clear hierarchy, compact evidence panels, readable comparisons, and explicit provenance.

The core visual promise is: **the UI never argues harder than the evidence**. Score movement, warnings, starred runs, and draft states are visible, but none of them become theatrical. A reviewer should feel oriented, not persuaded.

## Colors

The palette is mostly neutral with four semantic accents.

- **Surface Base (`#F6F8F7`)** is the page background. It keeps the workspace quiet without becoming beige or decorative.
- **Surface Raised (`#FFFFFF`)** is used for panels, run cards, transcripts, and forms.
- **Primary Green (`#1E6F5C`)** marks the single most important action or selected state. It is not used for success decoration everywhere.
- **Info Blue (`#2F6EA5`)** marks neutral evidence context, such as measurement notes or linked provenance.
- **Warning Amber (`#B7791F`)** marks cautionary interpretation: unresolved decisions, measurement-change warnings, coverage gaps.
- **Danger Red (`#B84A3D`)** marks regressions, critical rubric movement, or error states.
- **Neutral Accent (`#59677D`)** supports secondary anchors and metadata when a fourth status tone is needed.

Do not use gradients, bokeh, decorative blobs, or color-only meaning. Every state color must be paired with readable text.

## Typography

The product uses a single sans-serif family. This is intentional: the workspace is dense and repeated-use. The type ramp is compact but not cramped.

- **Display** is reserved for page titles only.
- **Title** is used for panel headings and important page subsections.
- **Subtitle** is used for run names, case names, and artifact names.
- **Body** is the default reading size.
- **Label** is used for field names and table headers. Labels use weight, not letter spacing.
- **Mono** is used only for IDs, version names, source refs, and compact artifact identifiers.

Letter spacing is always `0`. Long IDs and rubric names must wrap cleanly instead of forcing overflow.

## Layout & Spacing

The primary surface is desktop web. Use a persistent left navigation on desktop, a top navigation or drawer on tablet/mobile, and content panels arranged in a 12-column grid.

Recommended desktop frame:

- Left navigation: 240px.
- Main content max width: none by default; evidence pages need room.
- Page padding: `{spacing.page-x}` horizontal and `{spacing.page-y}` vertical.
- Panel gap: `{spacing.panel-gap}`.
- Two-column evidence layouts must preserve readable transcript width; if space is tight, stack instead of shrinking text.

Do not nest cards inside cards. Page sections are panels; repeated items such as run cards, changed-case rows, and rubric rows may be cards or table rows.

## Elevation & Depth

Depth is mostly tonal. Use borders and surface color before shadows. Shadows are allowed only for overlays, drawers, menus, and focused popovers.

Panels use a 1px border with `{colors.border-subtle}`. Selected run cards use tone and border treatment, not heavy shadow.

## Shapes

Corners are utilitarian:

- `{rounded.sm}` for small controls and chips.
- `{rounded.md}` for buttons, inputs, and compact badges.
- `{rounded.lg}` for panels, dialogs, and run cards.
- `{rounded.full}` only for small status chips.

No oversized rounded rectangles for evidence content. The product should read as a serious tool.

## Components

- **Run Card** — Shows Evaluation Run ID, timestamp, artifact versions, score summary, diagnosis summary, and starred state. It does not show durable baseline/candidate badges. Selected state is visual, not a role label.
- **Comparison Tray** — Appears after two run cards are selected. Shows Run A and Run B IDs, changed/stable artifact groups, passive Comparison Type, and one action: `Inspect run`.
- **Evidence Matrix** — Compact rubric movement summary. Rows must include improved, regressed, unchanged, net movement, and critical flag when relevant.
- **Case Row** — Shows case ID/title, scenario tags, changed rubrics, movement direction, priority, and Review Decision status. Clicking opens Case Detail Evidence View.
- **Transcript Pair** — Two aligned output columns. Changed lines are highlighted softly; full conversation remains accessible.
- **Diagnosis Form** — Structured fields with evidence links and target artifact. Free text is supported but never replaces structured target selection.
- **Draft Guardrail Banner** — Appears inside artifact-specific draft surfaces when the user risks changing the tutor and measurement system together.
- **Status Chip** — Uses semantic color plus text. Chips are labels unless explicitly implemented as filters.
- **Technical Details Drawer** — Collapsed by default. Contains raw Promptfoo references, source paths, hashes, and technical metadata.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use compact panels and readable evidence rows | Build a marketing-style dashboard with oversized hero cards |
| Show Comparison Type as context | Make Comparison Type look like a primary action |
| Keep primary actions singular per surface | Put three competing buttons in one tray |
| Distinguish prompt improvement from measurement improvement | Collapse all score movement into one generic improvement status |
| Show starred state as a bookmark | Treat starred as release, approval, or deployment |
| Put draft creation inside artifact-specific pages | Reintroduce a generic artifact draft builder page |
| Keep raw YAML/source details behind drawers | Force non-technical reviewers to start with raw Promptfoo data |

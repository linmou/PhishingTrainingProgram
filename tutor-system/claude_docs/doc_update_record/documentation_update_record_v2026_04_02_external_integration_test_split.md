<!--
Intent: Record the documentation changes that split deterministic regression tests from opt-in external integration suites.
Date: 2026-04-02
Commit: fc41c9d
-->

# Documentation Update Record

## Scope

- Updated [README.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/README.md) to explain deterministic regression commands versus external integration commands.
- Updated [testing-strategy.md](/Users/admin/Documents/GitHub.nosynchr/PhishingTrainingProgram/tutor-system/claude_docs/testing-strategy.md) to define the repository's test tiers and execution rules.

## Reason

The repository had live OpenAI-backed tests and browser automation tests mixed into the default Jest run. That made `npm test` fail for vendor or environment reasons that did not prove a product regression.

## Result

- Default regression commands now document a deterministic contract.
- Real OpenAI validation remains available as an explicit command.
- Browser E2E validation remains available as an explicit command.

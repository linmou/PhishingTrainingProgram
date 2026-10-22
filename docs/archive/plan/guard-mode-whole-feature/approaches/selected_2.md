# evaluation-first-gate

- Core strategy: Build the structured-output validator, multi-turn Guard evaluation cases, rubrics, quality gate, and production/browser evaluation harness before changing runtime behavior.
- Primary optimization target: Prevent unmeasured AI behavior changes from reaching implementation or release.
- Decomposition boundary: Evaluation contract and fixtures are the first product contract; runtime and UI must satisfy them.
- Sequencing principle: Specify observable behavior and release thresholds, create red tests, implement AI contract/prompt, then implement state/UI and close the gates.
- Main tradeoff: Early evaluation work slows the first visible UI change but reduces behavioral ambiguity.
- Major risk: Evaluation cases may encode an incomplete policy and need revision before they are useful.

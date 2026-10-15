# Transfer evaluation additions

Intent: record the integration of the new branch evaluation cases into the current transfer-analysis contract.

Date: 2026-10-15. Implementation baseline: `8dc7271`; source evaluation commit: `af86353863c60d5517b6bb6b3a4748554c64fd36`.

Updated the transfer analysis evaluation plan and nearest harness README for 40 added cases, current-handler execution, three-repetition classification, exact-input reuse, 16 workers and subsequent expanded full-suite coverage. The original 73 cases remain available. Archived flag expectations stay in source provenance; active checks follow the adopted events-only contract and Partial-to-Covered assessment rule.

Validation: 23 focused Node tests pass across current-runner, existing consumer integration and classification suites. They cover full/added manifests, consumer behavior, missing/invalid outputs, exact request replay, alias linkage, source drift and frozen thresholds. The independent audit is stored beside the harness. This is evaluation tooling/data only; it changes no deployed server behavior.

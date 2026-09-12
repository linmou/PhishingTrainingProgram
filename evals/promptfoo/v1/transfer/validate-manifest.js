#!/usr/bin/env node
// Purpose: validate-manifest.js is the offline quickstart entry point: it validates a frozen transfer manifest against the case contract and the published schema document, and exits non-zero on any error.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateManifest, loadManifest } = require('./manifest-schema');
const { validateCases } = require('./case-schema');
const { transferTargetSettings } = require('./shared-request-contract');

function validateFrozenPackage() {
  const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'cases.json'), 'utf8')).cases;
  const manifest = loadManifest();
  const caseErrors = validateCases(cases);
  const manifestErrors = validateManifest(manifest, { cases });
  const settings = transferTargetSettings();
  const settingsErrors = [];
  if (manifest.shared_request_contract.evaluation_effective_completion_token_budget !== settings.source_max_tokens) {
    settingsErrors.push({ path: 'shared_request_contract.evaluation_effective_completion_token_budget', error: 'budget_mismatch', expected: settings.source_max_tokens, actual: manifest.shared_request_contract.evaluation_effective_completion_token_budget });
  }
  if (manifest.shared_request_contract.evaluation_enable_thinking !== settings.source_enable_thinking) {
    settingsErrors.push({ path: 'shared_request_contract.evaluation_enable_thinking', error: 'thinking_mismatch', expected: settings.source_enable_thinking, actual: manifest.shared_request_contract.evaluation_enable_thinking });
  }
  return { cases: cases.length, caseErrors, manifestErrors: [...manifestErrors, ...settingsErrors] };
}

if (require.main === module) {
  const schemaDocument = process.argv[2];
  if (!schemaDocument) throw new Error('Supply the published case-schema contract document path.');
  const result = validateFrozenPackage();
  const document = fs.readFileSync(path.resolve(schemaDocument), 'utf8');
  const missingSections = ['Top-level shape', 'Required fields', 'Validation and versioning'].filter(section => !document.includes(section));
  const output = {
    schema_document: path.resolve(schemaDocument),
    schema_document_sections_missing: missingSections,
    cases: result.cases,
    case_errors: result.caseErrors.length,
    manifest_errors: result.manifestErrors.length,
    details: [...result.caseErrors, ...result.manifestErrors]
  };
  console.log(JSON.stringify(output, null, 2));
  if (result.caseErrors.length || result.manifestErrors.length || missingSections.length) process.exitCode = 1;
}

module.exports = { validateFrozenPackage };

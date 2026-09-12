#!/usr/bin/env node
// Purpose: runner-config.test.js pins the transfer runner registration: the feature flag stays disabled by default, a live run without configuration throws MISSING_LIVE_CONFIGURATION instead of falling back, and local prompt/request/provider overrides are rejected.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { transferRunnerConfig, assertNoLocalAuthority, FEATURE_FLAG } = require('./runner-config');
const manifest = require('./manifest.json');

test('the transfer feature flag is disabled by default and is not enabled by run configuration', () => {
  const config = transferRunnerConfig({});
  assert.equal(FEATURE_FLAG, 'TRANSFER_ASSESSMENT_ENABLED');
  assert.equal(config.feature_flag_enabled, false);
  assert.equal(config.contract_version, 'v3');
  assert.equal(config.legacy_contract_versions.slice().sort().join(','), 'legacy,v2');
  assert.equal(config.target_max_tokens, 1200);
  assert.equal(config.target_enable_thinking, false);
});

test('a live run without provider configuration throws instead of falling back to a mock or a local prompt', () => {
  assert.throws(() => transferRunnerConfig({ live: true, env: {} }), error => {
    assert.equal(error.message, 'MISSING_LIVE_CONFIGURATION');
    assert.deepEqual(error.required, ['REACT_APP_OAI_API_KEY', 'REACT_APP_OAI_BASE_URL']);
    return true;
  });
  const configured = transferRunnerConfig({ live: true, env: { REACT_APP_OAI_API_KEY: 'present', REACT_APP_OAI_BASE_URL: 'https://example.invalid/v1' } });
  assert.equal(configured.live, true);
  assert.equal(configured.endpoint_host, 'example.invalid');
  assert.equal(configured.credentials_present, true);
  assert.equal(configured.endpoint, undefined);
});

test('a local prompt, request, endpoint, or budget override is rejected', () => {
  for (const key of ['prompt', 'prompt_text', 'system_prompt', 'messages', 'endpoint', 'base_url', 'api_key', 'token_budget', 'max_tokens']) {
    assert.throws(() => assertNoLocalAuthority({ [key]: 'value' }), /local authority/i, `${key} must be rejected`);
  }
  assert.deepEqual(assertNoLocalAuthority({ cases: 'x', variant: 'candidate', out: 'y' }), []);
});

test('the manifest frozen values are the values the runner advertises', () => {
  const config = transferRunnerConfig({ manifest });
  assert.equal(config.target_max_tokens, manifest.shared_request_contract.evaluation_effective_completion_token_budget);
  assert.equal(config.target_enable_thinking, manifest.shared_request_contract.evaluation_enable_thinking);
  assert.equal(config.builder_source_sha256, manifest.shared_request_contract.builder_source_sha256);
  assert.equal(config.production_prompt_reference, manifest.shared_request_contract.production_prompt_reference);
  assert.equal(config.legacy_settings_untouched, true);
});

test('the runner configuration never inherits the legacy v1 token allowance for the transfer path', () => {
  const legacy = require('../settings.json');
  const config = transferRunnerConfig({});
  assert.equal(legacy.target_max_tokens, 8000);
  assert.equal(legacy.target_enable_thinking, true);
  assert.notEqual(config.target_max_tokens, legacy.target_max_tokens);
  assert.notEqual(config.target_enable_thinking, legacy.target_enable_thinking);
});

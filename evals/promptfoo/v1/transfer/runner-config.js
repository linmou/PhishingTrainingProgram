#!/usr/bin/env node
// Purpose: runner-config.js registers the transfer runner with the existing v1 runner: it keeps the feature flag disabled by default, rejects local prompt/request/provider authority, and refuses a live run without configuration instead of falling back to a mock.
'use strict';
const FEATURE_FLAG = 'TRANSFER_ASSESSMENT_ENABLED';
const LIVE_REQUIRED = ['REACT_APP_OAI_API_KEY', 'REACT_APP_OAI_BASE_URL'];
const LOCAL_AUTHORITY_KEYS = ['prompt', 'prompt_text', 'system_prompt', 'messages', 'endpoint', 'base_url', 'api_key', 'token_budget', 'max_tokens'];
const LEGACY_CONTRACT_VERSIONS = ['legacy', 'v2'];

function transferRunnerConfig(options = {}) {
  const manifest = options.manifest || require('./manifest.json');
  const declared = manifest.shared_request_contract;
  const config = {
    feature_flag: FEATURE_FLAG,
    feature_flag_enabled: false,
    contract_version: 'v3',
    legacy_contract_versions: LEGACY_CONTRACT_VERSIONS.slice(),
    target_max_tokens: declared.evaluation_effective_completion_token_budget,
    target_enable_thinking: declared.evaluation_enable_thinking,
    builder_source_sha256: declared.builder_source_sha256,
    production_prompt_reference: declared.production_prompt_reference,
    parity_result: declared.parity_result,
    adapter: 'evals/promptfoo/v1/transfer/adapter.js',
    legacy_settings_untouched: true,
    live: false
  };
  if (!options.live) return config;
  const env = options.env || {};
  const missing = LIVE_REQUIRED.filter(name => !env[name]);
  if (missing.length) {
    const error = new Error('MISSING_LIVE_CONFIGURATION');
    error.required = missing;
    throw error;
  }
  let endpointHost = null;
  try {
    endpointHost = new URL(env.REACT_APP_OAI_BASE_URL).host;
  } catch {
    endpointHost = null;
  }
  return { ...config, live: true, credentials_present: true, endpoint_host: endpointHost };
}

function assertNoLocalAuthority(options = {}) {
  const offending = Object.keys(options).filter(key => LOCAL_AUTHORITY_KEYS.includes(key));
  if (offending.length) throw new Error(`runner-config: refusing local authority over ${offending.join(', ')}; the shared v3 builder and production prompt own that authority`);
  return [];
}

module.exports = { transferRunnerConfig, assertNoLocalAuthority, FEATURE_FLAG, LIVE_REQUIRED, LOCAL_AUTHORITY_KEYS, LEGACY_CONTRACT_VERSIONS };

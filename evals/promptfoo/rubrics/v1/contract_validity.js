#!/usr/bin/env node
// Purpose: expose v1 response-contract validation separately from behavior accuracy metrics.

module.exports = require('./decision-metrics').contractValidity;

#!/usr/bin/env node
// Purpose: gate-fixtures.js is the offline quickstart entry point that runs every declared transfer gate fixture and exits non-zero when any fixture returns a verdict other than its expected verdict.
'use strict';
const { runFixtures } = require('./fixtures/gate-fixtures');

if (require.main === module) {
  const results = runFixtures();
  const mismatched = results.filter(result => !result.matched);
  console.log(JSON.stringify({ fixtures: results.length, matched: results.length - mismatched.length, mismatched: mismatched.length, results }, null, 2));
  if (mismatched.length) process.exitCode = 1;
}

module.exports = { runFixtures };

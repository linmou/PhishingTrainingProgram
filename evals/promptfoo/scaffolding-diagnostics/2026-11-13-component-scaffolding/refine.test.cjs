#!/usr/bin/env node
// Tests refine.cjs: full assembled-prompt cleanup preserves requests and rejects missing or duplicated source clauses.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {prepare, compose} = require('./prepare.cjs');
const {cleanMessages} = require('./refine.cjs');
const {cases} = prepare(fs.mkdtempSync(path.join(os.tmpdir(), 'component-cleanup-')));
const recipe = require('./candidate-cleanup-full.json');
test('nine generic changes apply once across every full fixed-case request', () => {
  assert.equal(recipe.replacements.length, 9);
  for (const c of cases) {
    const input = compose(c, 'instruction');
    const copy = structuredClone(input);
    const output = cleanMessages(input, 'candidate-cleanup-full.json');
    assert.deepEqual(input, copy, 'Input request mutated');
    assert.deepEqual(output.slice(1), input.slice(1), 'Learner request changed');
    for (const {before, after} of recipe.replacements) {
      assert.equal(input[0].content.split(before).length, 2);
      assert.equal(output[0].content.split(before).length, 1);
      assert(output[0].content.includes(after));
    }
    for (const point of c.inventory.detection_areas) assert(output[0].content.includes(point));
  }
});
test('cleanup fails closed on missing or duplicated source clauses', () => {
  const input = compose(cases[0], 'instruction');
  assert.throws(() => cleanMessages([{...input[0], content: input[0].content.replace(recipe.replacements[0].before, '')}, input[1]], 'candidate-cleanup-full.json'));
  assert.throws(() => cleanMessages([{...input[0], content: input[0].content + recipe.replacements[0].before}, input[1]], 'candidate-cleanup-full.json'));
});

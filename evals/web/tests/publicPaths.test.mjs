// Responsible for: evals/web/scripts/publicPaths.mjs
// Purpose: public /eval and /promptfoo path mapping for shared Cloudflare access

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { resolvePublicPath, WEB_ROOT, PROMPTFOO_ROOT } from '../scripts/publicPaths.mjs';

test('maps /eval to the viewer index', () => {
  const mapped = resolvePublicPath('/eval');
  assert.equal(mapped.type, 'file');
  assert.equal(mapped.filePath, path.join(WEB_ROOT, 'index.html'));
});

test('maps /eval/ assets under the web root', () => {
  const mapped = resolvePublicPath('/eval/src/app.js');
  assert.equal(mapped.type, 'file');
  assert.equal(mapped.filePath, path.join(WEB_ROOT, 'src/app.js'));
});

test('maps /promptfoo results for the viewer fetch paths', () => {
  const mapped = resolvePublicPath('/promptfoo/results/latest.json');
  assert.equal(mapped.type, 'file');
  assert.equal(mapped.filePath, path.join(PROMPTFOO_ROOT, 'results/latest.json'));
});

test('rejects path traversal', () => {
  assert.equal(resolvePublicPath('/eval/../../secret'), null);
  assert.equal(resolvePublicPath('/promptfoo/../web/package.json'), null);
});

test('root redirects to /eval/', () => {
  assert.deepEqual(resolvePublicPath('/'), { type: 'redirect', location: '/eval/' });
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('./react-scripts.js'), 'utf8');

function run(command, env, dotenv = {}) {
  const process = { argv: ['node', 'react-scripts.js', command, '--runInBand'], env: { ...env } };
  let forwarded;
  vm.runInNewContext(source, { process, require(name) {
    if (name === 'react-scripts/config/env') {
      for (const [key, value] of Object.entries(dotenv)) process.env[key] ??= value;
    } else if (name === 'react-scripts/bin/react-scripts') forwarded = [...process.argv];
    else throw new Error(`Unexpected module ${name}`);
  } });
  return { env: process.env, forwarded };
}

test('bridges only the configured public model and forwards test arguments', () => {
  const result = run('test', { OAI_MODEL: ' alternate-model ', REACT_APP_OAI_MODEL: 'stale', OAI_API_KEY: 'private' });
  assert.equal(result.env.REACT_APP_OAI_MODEL, 'alternate-model');
  assert.equal(result.env.REACT_APP_OAI_API_KEY, undefined);
  assert.deepEqual(result.forwarded, ['node', 'react-scripts.js', 'test', '--runInBand']);
});

test('loads environment files after selecting the CRA mode, preserving shell precedence', () => {
  for (const [command, mode] of [['start', 'development'], ['build', 'production'], ['test', 'test']]) {
    assert.equal(run(command, {}, { OAI_MODEL: 'file-model' }).env.NODE_ENV, mode);
    assert.equal(run(command, {}, { OAI_MODEL: 'file-model' }).env.REACT_APP_OAI_MODEL, 'file-model');
    assert.equal(run(command, { OAI_MODEL: 'shell-model' }, { OAI_MODEL: 'file-model' }).env.REACT_APP_OAI_MODEL, 'shell-model');
  }
});

test('rejects absent, empty and whitespace model configuration before starting CRA', () => {
  for (const value of [undefined, '', '  ']) {
    assert.throws(() => run('build', { OAI_MODEL: value }), /OAI_MODEL is required/);
  }
});

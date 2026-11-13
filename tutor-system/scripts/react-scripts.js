// CRA exposes only REACT_APP_* values. Bridge the public model name from the
// canonical OAI_MODEL setting without exposing the provider key or base URL.
const command = process.argv[2];
process.env.NODE_ENV = command === 'build' ? 'production' : command === 'test' ? 'test' : 'development';
require('react-scripts/config/env');
const model = process.env.OAI_MODEL?.trim();
if (!model) {
  throw new Error('OAI_MODEL is required in the environment or .env configuration.');
}
process.env.REACT_APP_OAI_MODEL = model;
require('react-scripts/bin/react-scripts');

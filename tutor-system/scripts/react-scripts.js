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
// CRA can inline the whole REACT_APP_* environment into the public bundle. Provider credentials
// are server-only, so never let a secret-looking REACT_APP_* value reach the frontend build.
const PUBLIC_KEYS = new Set(['REACT_APP_SUPABASE_ANON_KEY']);
const SECRET_NAME = /^REACT_APP_\w*(API_KEY|SECRET|TOKEN|PASSWORD)$|^REACT_APP_OAI_BASE_URL$/;
for (const name of Object.keys(process.env)) {
  if (SECRET_NAME.test(name) && !PUBLIC_KEYS.has(name)) {
    console.warn(`Removing server-only ${name} from the frontend environment.`);
    delete process.env[name];
  }
}
require('react-scripts/bin/react-scripts');

#!/usr/bin/env node
// Purpose: expose the tutor-system .env values to the integration edge handoff tests. Node does not read .env files, and importing the real component 102 service constructs a Supabase client that requires REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY at module load.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, '../tutor-system/.env');

export function loadTutorSystemEnv() {
  let text;
  try {
    text = readFileSync(envPath, 'utf8');
  } catch {
    return { loaded: false, keys: [] };
  }

  const keys = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
    keys.push(key);
  }

  return { loaded: true, keys };
}

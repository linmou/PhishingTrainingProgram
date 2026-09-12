#!/usr/bin/env node
// Purpose: resolve extensionless TypeScript specifiers for the integration edge handoff tests, so they can import the real tutor-system modules instead of a reimplementation.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CANDIDATE_SUFFIXES = ['.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx', '/index.js'];

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : process.cwd();
    const base = specifier.startsWith('/')
      ? specifier
      : new URL(specifier, pathToUrl(parent)).pathname;
    if (!CANDIDATE_SUFFIXES.some((suffix) => base.endsWith(suffix))) {
      for (const suffix of CANDIDATE_SUFFIXES) {
        if (existsSync(base + suffix)) {
          return { url: pathToUrl(base + suffix), shortCircuit: true };
        }
      }
    }
  }
  return nextResolve(specifier, context);
}

function pathToUrl(value) {
  return value.startsWith('file:') ? value : 'file://' + encodeURI(value);
}

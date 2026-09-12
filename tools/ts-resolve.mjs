#!/usr/bin/env node
// Purpose: Node loader hook that lets the integration edge handoff tests import the real tutor-system TypeScript modules, which use bundler-style extensionless specifiers that Node's ESM resolver does not resolve on its own.

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./ts-resolve-hooks.mjs', pathToFileURL(import.meta.filename));

#!/usr/bin/env node
/**
 * Assertions that no browser-facing value retains transfer-assessment private material.
 *
 * Responsibility: give every 103 test one shared definition of "private field" so a leak is
 * caught in React state, props, exports, and error surfaces by the same rule.
 */

import { PUBLIC_ASSESSMENT_FORBIDDEN_KEYS } from '../services/transferAssessmentService';

/**
 * Keys that must never appear in learner-facing state, exports, or rendered output.
 * `assessment_key` is added on top of component 102's list: it is the private answer key the
 * promoted one-table design stores on the participant-readable message row.
 */
export const FORBIDDEN_BROWSER_KEYS: ReadonlyArray<string> = [
  ...PUBLIC_ASSESSMENT_FORBIDDEN_KEYS,
  'assessment_key',
];

interface FoundKey {
  path: string;
  key: string;
}

/** Walk any value and return every forbidden key that appears anywhere inside it. */
export function findForbiddenKeys(value: unknown, path = '$', found: FoundKey[] = []): FoundKey[] {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenKeys(entry, `${path}[${index}]`, found));
    return found;
  }
  if (value && typeof value === 'object') {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (FORBIDDEN_BROWSER_KEYS.includes(key)) {
        found.push({ path: `${path}.${key}`, key });
      }
      findForbiddenKeys(entry, `${path}.${key}`, found);
    });
  }
  return found;
}

/** Assert a value carries none of the forbidden keys, reporting the exact path when it does. */
export function expectNoPrivateAssessmentFields(value: unknown): void {
  const found = findForbiddenKeys(value);
  if (found.length > 0) {
    throw new Error(
      `Private assessment material leaked into browser-facing state: ${found
        .map((entry) => `${entry.key} at ${entry.path}`)
        .join(', ')}`
    );
  }
}

/** Assert the serialized form of a value contains none of the forbidden key names either. */
export function expectSerializedWithoutPrivateFields(value: unknown): void {
  const serialized = JSON.stringify(value ?? null);
  const leaked = FORBIDDEN_BROWSER_KEYS.filter((key) => serialized.includes(`"${key}"`));
  if (leaked.length > 0) {
    throw new Error(`Private assessment key names appear in serialized output: ${leaked.join(', ')}`);
  }
}

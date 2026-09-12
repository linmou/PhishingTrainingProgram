#!/usr/bin/env node
// Test responsible for keeping schema-qualified extension calls in the transfer migrations. pgcrypto is installed in the `extensions` schema on the hosted project, while these functions set `search_path = public, private`, so any unqualified `digest(` call inside them fails at runtime with `function digest(bytea, unknown) does not exist`. This guard catches that class of defect at review time instead of at first execution.

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

/** Functions whose SET search_path excludes the schema that holds pgcrypto. */
const NARROW_SEARCH_PATH_FUNCTIONS = [
  'review_assessment_draft_v1',
  'send_reviewed_tutor_response_v3',
  'post_assessment_message_v1',
  'prepare_transfer_turn_v1',
  'reject_assessment_draft_v1',
  'regenerate_assessment_draft_v1',
  'transfer_draft_trigger_key_v1',
];

function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{3}_.*\.sql$/.test(name))
    .sort();
}

function functionBlocks(source: string): Array<{ name: string; body: string }> {
  return source
    .split(/(?=CREATE OR REPLACE FUNCTION )/i)
    .map((block) => {
      const match = block.match(/CREATE OR REPLACE FUNCTION\s+([\w.]+)/i);
      return match ? { name: match[1], body: block } : null;
    })
    .filter((entry): entry is { name: string; body: string } => entry !== null);
}

describe('transfer migration extension calls', () => {
  const files = migrationFiles();
  const sources = files.map((name) => ({ name, text: readFileSync(join(MIGRATIONS_DIR, name), 'utf8') }));

  /** Every (file, function) pair that a later migration re-creates, so an earlier
   *  unqualified call is repaired by history rather than still live. */
  function repairedPairs(): string[] {
    const pairs: string[] = [];
    sources.forEach(({ name, text }) => {
      functionBlocks(text).forEach(({ name: fnName, body }) => {
        if (/extensions\.digest\s*\(/.test(body)) {
          pairs.push(fnName.split('.').pop() ?? fnName);
        }
      });
    });
    return pairs;
  }

  /** Unqualified callers that still ship in the repository's latest history. */
  function liveOffenders(): string[] {
    const repaired = repairedPairs();
    const offenders: string[] = [];
    sources.forEach(({ name, text }) => {
      functionBlocks(text).forEach(({ name: fnName, body }) => {
        const shortName = fnName.split('.').pop() ?? fnName;
        if (!NARROW_SEARCH_PATH_FUNCTIONS.includes(shortName)) return;
        if (repaired.includes(shortName)) return;
        if (/(^|[^.\w])digest\s*\(/m.test(body)) offenders.push(`${name}:${fnName}`);
      });
    });
    return offenders.sort();
  }

  it('finds the transfer migrations', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((name) => name.startsWith('027_'))).toBe(true);
  });

  it('qualifies the trigger-key digest with the extensions schema', () => {
    const fix = sources.find(({ name }) => name.startsWith('028_'));
    expect(fix).toBeDefined();
    expect(fix!.text).toMatch(/extensions\.digest\s*\(/);
    expect(fix!.text).toMatch(/CREATE OR REPLACE FUNCTION\s+private\.transfer_draft_trigger_key_v1/);
  });

  it('reports only the two inherited 025 callers as still unqualified', () => {
    // These two are a pre-existing defect inherited from migration 025 and are NOT
    // repaired by any later migration yet. When a migration qualifies them, this
    // expectation must be updated deliberately rather than silently relaxed.
    expect(liveOffenders()).toEqual([
      '025_transfer_assessment_storage.sql:review_assessment_draft_v1',
      '025_transfer_assessment_storage.sql:send_reviewed_tutor_response_v3',
    ]);
  });

  it('does not count a function as an offender once a later migration repairs it', () => {
    expect(repairedPairs()).toContain('transfer_draft_trigger_key_v1');
  });
});

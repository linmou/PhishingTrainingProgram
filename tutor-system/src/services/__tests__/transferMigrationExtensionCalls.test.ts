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

  it('leaves no unqualified narrow-search-path digest caller in the latest migration history', () => {
    // Migration 028 repaired transfer_draft_trigger_key_v1 and migration 029 repaired the
    // two callers inherited from 025, so the offender list must now be empty. This is the
    // deliberate update the previous expectation's comment called for; a non-empty result
    // means a new unqualified call was introduced.
    expect(liveOffenders()).toEqual([]);
  });

  it('qualifies both inherited 025 callers in migration 029', () => {
    const fix = sources.find(({ name }) => name.startsWith('029_'));
    expect(fix).toBeDefined();
    const repaired = functionBlocks(fix!.text)
      .filter(({ body }) => /extensions\.digest\s*\(/.test(body))
      .map(({ name }) => name.split('.').pop());
    expect(repaired.sort()).toEqual(['review_assessment_draft_v1', 'send_reviewed_tutor_response_v3']);
  });

  it('re-creates the 029 callers with their security posture intact', () => {
    const fix = sources.find(({ name }) => name.startsWith('029_'));
    const blocks = functionBlocks(fix!.text);
    const qualified = blocks.filter(({ body }) => /extensions\.digest\s*\(/.test(body));
    expect(qualified).toHaveLength(2);
    qualified.forEach(({ body }) => {
      expect(body).toMatch(/SECURITY DEFINER/i);
      expect(body).toMatch(/SET search_path = public, private/i);
      // An unqualified call must not survive alongside the qualified one.
      expect(body).not.toMatch(/(^|[^.\w])digest\s*\(/m);
    });
  });

  it('does not count a function as an offender once a later migration repairs it', () => {
    expect(repairedPairs()).toContain('transfer_draft_trigger_key_v1');
    expect(repairedPairs()).toContain('review_assessment_draft_v1');
    expect(repairedPairs()).toContain('send_reviewed_tutor_response_v3');
  });
});

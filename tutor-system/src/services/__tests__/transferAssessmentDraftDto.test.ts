#!/usr/bin/env node
// Test responsible for the private teacher draft DTO boundary (T014, reconciliation R05):
// `TeacherAssessmentDraftDTO` is the only private browser DTO name for a draft, its key set must
// equal the allowlist the API contract declares, and projecting a storage row must drop every
// private storage column instead of forwarding it. Learner-facing payloads must never carry it.

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  TEACHER_ASSESSMENT_DRAFT_DTO_KEYS,
  TEACHER_ASSESSMENT_DRAFT_DTO_FORBIDDEN_STORAGE_NAMES,
  toTeacherAssessmentDraftDTO,
} from '../transferAssessmentService';
import type { TeacherAssessmentDraftDTO } from '../transferAssessmentService';

const contractPath = join(__dirname, '..', '..', '..', '..', 'specs', '102-transfer-backend', 'contracts', 'assessment-api.md');
const contractSource = readFileSync(contractPath, 'utf8');

/**
 * Read the DTO allowlist out of the owning contract document. The contract is the source of
 * truth, so deriving the expectation here means editing the contract without editing the code
 * fails the suite rather than silently passing.
 *
 * The paragraph mixes two kinds of entry: backticked literal field names, and prose descriptions
 * for the three private-review fields the contract leaves unnamed. Only the backticked names can
 * be read mechanically, so this returns them and the prose entries separately.
 */
function contractDeclaredKeys(): { literal: string[]; prose: string[] } {
  const marker = '`TeacherAssessmentDraftDTO` is the only private browser DTO name.';
  const start = contractSource.indexOf(marker);
  if (start < 0) throw new Error('DTO paragraph not found in assessment-api.md');
  const paragraph = contractSource.slice(start, contractSource.indexOf('\n\n', start));
  const declared = paragraph.match(/may contain ([^.]+)\./);
  if (!declared) throw new Error('DTO field list not found in the contract paragraph');
  const entries = declared[1]
    .replace(/,? and /g, ',')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return {
    literal: entries
      .filter((entry) => entry.startsWith('`') && entry.endsWith('`'))
      .map((entry) => entry.replace(/^`|`$/g, '')),
    prose: entries.filter((entry) => !entry.startsWith('`')).map((entry) => entry.toLowerCase()),
  };
}

/**
 * The contract describes the three private-review fields in prose rather than naming them, so the
 * concrete names are this module's choice and are pinned here. Each entry pairs the name with the
 * phrase the contract uses, so a contract that renames a concept fails loudly.
 */
const PROSE_FIELD_MAPPING: Array<{ key: string; contractPhrase: string }> = [
  { key: 'decision', contractPhrase: 'structured decision' },
  { key: 'reason', contractPhrase: 'observable reason' },
  { key: 'assessment_basis', contractPhrase: 'private assessment basis' },
];

function validDTO(): TeacherAssessmentDraftDTO {
  return {
    draft_id: 'draft-1',
    revision: 3,
    status: 'draft',
    supersedes_draft_id: null,
    progress_snapshot_hash: 'c'.repeat(64),
    decision: { mode: 'assessment' },
    reason: null,
    assessment_basis: { concept_rule: 'rule' },
  };
}

describe('teacher assessment draft DTO boundary', () => {
  it('declares exactly the keys the API contract allowlists', () => {
    const { literal } = contractDeclaredKeys();
    const expected = [...literal, ...PROSE_FIELD_MAPPING.map((entry) => entry.key)];
    expect([...TEACHER_ASSESSMENT_DRAFT_DTO_KEYS].sort()).toEqual(expected.sort());
  });

  it('still matches the contract wording for the prose-described private fields', () => {
    const { prose } = contractDeclaredKeys();
    // Every prose entry must be claimed by a mapping, and every mapping must cite real contract
    // wording, so neither side can drift without failing here.
    PROSE_FIELD_MAPPING.forEach(({ contractPhrase }) => {
      expect(prose.some((entry) => entry.includes(contractPhrase))).toBe(true);
    });
    expect(PROSE_FIELD_MAPPING).toHaveLength(prose.length);
  });

  it('keeps the declared key list free of duplicates and storage names', () => {
    const keys = [...TEACHER_ASSESSMENT_DRAFT_DTO_KEYS];
    expect(new Set(keys).size).toBe(keys.length);
    const collisions = keys.filter((key) => TEACHER_ASSESSMENT_DRAFT_DTO_FORBIDDEN_STORAGE_NAMES.includes(key));
    expect(collisions).toEqual([]);
  });

  it('projects a private draft row onto the allowlist and drops every storage column', () => {
    const storageRow: Record<string, unknown> = {
      draft_id: 'draft-1',
      revision: 3,
      status: 'draft',
      supersedes_draft_id: null,
      progress_snapshot_hash: 'c'.repeat(64),
      decision: { mode: 'assessment' },
      reason: null,
      assessment_basis: { concept_rule: 'rule' },
    };
    // Every forbidden column is present and populated, so a leak is detectable by value too.
    TEACHER_ASSESSMENT_DRAFT_DTO_FORBIDDEN_STORAGE_NAMES.forEach((name, index) => {
      storageRow[name] = `leaked-${index}`;
    });

    const dto = toTeacherAssessmentDraftDTO(storageRow);

    expect(Object.keys(dto).sort()).toEqual([...TEACHER_ASSESSMENT_DRAFT_DTO_KEYS].sort());
    expect(JSON.stringify(dto)).not.toContain('leaked-');
    TEACHER_ASSESSMENT_DRAFT_DTO_FORBIDDEN_STORAGE_NAMES.forEach((name) => {
      expect(dto).not.toHaveProperty(name);
    });
  });

  it('carries the private basis a reviewing teacher needs while never carrying raw model output', () => {
    const dto = toTeacherAssessmentDraftDTO({
      ...validDTO(),
      raw_model_output: { decision: { mode: 'assessment' } },
      reviewed_payload: { response: 'private' },
    });

    expect(dto.assessment_basis).toEqual({ concept_rule: 'rule' });
    expect(dto.decision).toEqual({ mode: 'assessment' });
    expect(dto).not.toHaveProperty('raw_model_output');
    expect(dto).not.toHaveProperty('reviewed_payload');
  });

  it('normalizes absent fields to null rather than undefined so the shape is stable', () => {
    const dto = toTeacherAssessmentDraftDTO({ draft_id: 'draft-1', revision: 1, status: 'draft' });
    TEACHER_ASSESSMENT_DRAFT_DTO_KEYS.forEach((key) => {
      expect(dto[key]).not.toBeUndefined();
    });
    expect(dto.supersedes_draft_id).toBeNull();
    expect(dto.assessment_basis).toBeNull();
  });

  it.each(['draft', 'rejected', 'ignored', 'sent', 'superseded'])(
    'accepts %s as a draft status',
    (status) => {
      const dto = toTeacherAssessmentDraftDTO({ ...validDTO(), status });
      expect(dto.status).toBe(status);
    }
  );

  it('documents the DTO as teacher-only so learner operations cannot return it', () => {
    // The exclusion is contract text, not an implementation detail; assert it stays stated.
    const marker = '`TeacherAssessmentDraftDTO` is the only private browser DTO name.';
    const paragraph = contractSource.slice(
      contractSource.indexOf(marker),
      contractSource.indexOf('\n\n', contractSource.indexOf(marker))
    );
    expect(paragraph).toContain('It must not be returned by learner operations');
  });
});

// Purpose: normalize explicit assessment selections without guessing from arbitrary learner prose.

import { AssessmentOption, AssessmentOptionId, AssessmentSelectionType } from '../types/assessment';

export type ParsedSelection =
  | { kind: 'selection'; option_ids: AssessmentOptionId[] }
  | { kind: 'clarification_required'; code: string }
  | { kind: 'not_selection' };

const optionIds: AssessmentOptionId[] = ['A', 'B', 'C', 'D'];

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[，、]/g, ',')
    .replace(/[\t\r ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function stripTrailingPunctuation(value: string): string {
  return value.trim().replace(/[.!?]+$/, '').trim();
}

function removePrefix(value: string): string {
  return value.replace(/^(?:answer\s*:\s*|my answer is\s+|i choose\s+|i select\s+|i think\s+|maybe\s+)/i, '').trim();
}

function normalizeOptionText(value: string): string {
  return stripTrailingPunctuation(normalizeText(value)).toLocaleLowerCase();
}

function splitExplanation(value: string): string {
  const match = value.match(/^(.*?)(?:\s+because\b|\s+—\s*|\n)/is);
  return match ? match[1].trim() : value;
}

function isContentQuestion(value: string): boolean {
  return /^(?:what|how|why|when|where|who|can|could|would|does|is|are)\b/i.test(value);
}

function clarification(code: string): ParsedSelection {
  return { kind: 'clarification_required', code };
}

export function parseAssessmentAnswer(
  content: string,
  selectionType: AssessmentSelectionType,
  options: ReadonlyArray<AssessmentOption>
): ParsedSelection {
  const normalized = normalizeText(content);
  if (!normalized) return { kind: 'not_selection' };

  const withoutPrefix = removePrefix(normalized);
  const candidate = splitExplanation(withoutPrefix);
  const exactOptionMatches = options.filter(
    (option) => normalizeOptionText(option.text) === normalizeOptionText(candidate)
  );
  if (exactOptionMatches.length === 1) {
    return { kind: 'selection', option_ids: [exactOptionMatches[0].id] };
  }

  const cleanCandidate = stripTrailingPunctuation(candidate).replace(/\s+/g, ' ').trim();
  if (/\b(?:or|not)\b|\//i.test(cleanCandidate)) {
    return clarification('AMBIGUOUS_SELECTION');
  }
  if (isContentQuestion(normalized)) return { kind: 'not_selection' };

  const parts = cleanCandidate.split(/\s*(?:,|;|\band\b|&|\+)\s*/i);
  if (parts.length === 0 || parts.some((part) => !/^[A-D]$/i.test(part))) {
    if (cleanCandidate.split(/\s+/).length > 2) return { kind: 'not_selection' };
    return clarification('SELECTION_NOT_RECOGNIZED');
  }

  const selected = Array.from(new Set(parts.map((part) => part.toUpperCase() as AssessmentOptionId)));
  selected.sort((left, right) => optionIds.indexOf(left) - optionIds.indexOf(right));
  if (selectionType === 'single' && selected.length !== 1) {
    return clarification('SINGLE_SELECTION_CARDINALITY');
  }
  return { kind: 'selection', option_ids: selected };
}

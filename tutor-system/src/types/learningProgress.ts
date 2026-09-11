// Purpose: define the transfer-policy progress pairs without introducing a second mastery field.

export type ProgressPolicyVersion = 'legacy_v1' | 'transfer_v1';
export type TransferStatus = 'pending' | 'partially_covered' | 'needs_review' | 'covered';
export type TransferUnderstandingLevel = 'none' | 'basic' | 'good';

export type TransferProgress =
  | { status: 'pending'; understanding_level: 'none' }
  | { status: 'partially_covered'; understanding_level: 'basic' }
  | { status: 'needs_review'; understanding_level: 'basic' }
  | { status: 'covered'; understanding_level: 'good' };

export const LEVEL_BY_STATUS = {
  pending: 'none',
  partially_covered: 'basic',
  needs_review: 'basic',
  covered: 'good',
} as const;

export function isValidTransferProgress(value: {
  status: string;
  understanding_level: string | undefined;
}): value is TransferProgress {
  return LEVEL_BY_STATUS[value.status as TransferStatus] === value.understanding_level;
}

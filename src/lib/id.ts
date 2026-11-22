import { ulid } from 'ulid';

export type IdPrefix =
  | 'biz'
  | 'usr'
  | 'bu'
  | 'loc'
  | 'prd'
  | 'var'
  | 'inv'
  | 'mov'
  | 'ord'
  | 'oi'
  | 'pay'
  | 'int'
  | 'syn'
  | 'aud';

export function createId(prefix: IdPrefix): string {
  return `${prefix}_${ulid()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatOrderNumber(existingNumbers: string[], date = new Date()): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const periodPrefix = `ORD-${yyyy}${mm}-`;

  let maxSeq = 0;
  for (const num of existingNumbers) {
    if (num.startsWith(periodPrefix)) {
      const suffix = parseInt(num.slice(periodPrefix.length), 10);
      if (Number.isFinite(suffix) && suffix > maxSeq) {
        maxSeq = suffix;
      }
    }
  }

  return `${periodPrefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

import { RateLimitError } from './errors';

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/**
 * Lightweight in-memory sliding-window rate limiter per client key.
 */
export function enforceRateLimit(
  request: Request,
  bucketPrefix: string,
  maxRequests = 120,
  windowMs = 60_000
): void {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'local';
  const key = `${bucketPrefix}:${ip}`;
  const now = Date.now();

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > maxRequests) {
    throw new RateLimitError();
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
}

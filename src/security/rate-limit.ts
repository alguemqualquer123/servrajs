/**
 * Servra - Rate Limiting
 * 
 * Built-in rate limiting to prevent brute force and DoS attacks.
 * Uses sliding window algorithm for better accuracy.
 */

import type { RateLimitOptions, Middleware, LOARequest, LOAResponse } from '../core/types';

// ============================================================================
// Rate Limit Store - Sliding Window
// ============================================================================

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();
let nextCleanup = 0;

// ============================================================================
// Rate Limit Middleware
// ============================================================================

export function rateLimit(options: Partial<RateLimitOptions> = {}): Middleware {
  const opts: Required<RateLimitOptions> = {
    enabled: options.enabled ?? true,
    windowMs: options.windowMs ?? 60000,
    max: options.max ?? 100,
    message: options.message ?? 'Too many requests',
    statusCode: options.statusCode ?? 429,
    standardHeaders: options.standardHeaders ?? true,
    legacyHeaders: options.legacyHeaders ?? false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    skipFailedRequests: options.skipFailedRequests ?? false,
    storeLimit: options.storeLimit ?? 100000,
    keyGenerator: options.keyGenerator ?? ((req: LOARequest) => req.ip),
    handler: options.handler ?? defaultHandler,
  };

  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    if (!opts.enabled) {
      next();
      return;
    }

    const key = opts.keyGenerator(req);
    const now = Date.now();
    const windowStart = now - opts.windowMs;
    cleanupExpired(now, opts.windowMs, opts.storeLimit);

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    entry.timestamps = entry.timestamps.filter(ts => ts > windowStart);
    entry.timestamps.push(now);

    const remaining = Math.max(0, opts.max - entry.timestamps.length);

    if (opts.standardHeaders) {
      const resetTime = Math.ceil((now + opts.windowMs) / 1000);
      res.header('RateLimit-Limit', opts.max.toString());
      res.header('RateLimit-Remaining', remaining.toString());
      res.header('RateLimit-Reset', resetTime.toString());
    }

    if (opts.legacyHeaders) {
      res.header('X-RateLimit-Limit', opts.max.toString());
      res.header('X-RateLimit-Remaining', remaining.toString());
    }

    if (entry.timestamps.length > opts.max) {
      const retryAfter = Math.ceil((entry.timestamps[0] + opts.windowMs - now) / 1000);
      res.header('Retry-After', Math.max(1, retryAfter).toString());
      opts.handler(req, res);
      return;
    }

    next();
  };
}

function defaultHandler(req: LOARequest, res: LOAResponse): void {
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded',
    statusCode: 429,
  });
}

// ============================================================================
// Store Management
// ============================================================================

export function clearStore(): void {
  store.clear();
}

export function resetKey(key: string): void {
  store.delete(key);
}

function cleanupExpired(now: number, windowMs: number, storeLimit: number): void {
  if (now < nextCleanup && store.size <= storeLimit) {
    return;
  }

  const expiredThreshold = now - windowMs;

  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter(ts => ts > expiredThreshold);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }

  if (store.size > storeLimit) {
    const overflow = store.size - storeLimit;
    let deleted = 0;
    for (const key of store.keys()) {
      store.delete(key);
      deleted++;
      if (deleted >= overflow) break;
    }
  }

  nextCleanup = now + Math.min(windowMs, 60000);
}

// ============================================================================
// Export
// ============================================================================

export default rateLimit;

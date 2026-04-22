/**
 * LOA Framework - Rate Limiting
 * 
 * Built-in rate limiting to prevent brute force and DoS attacks.
 * Uses in-memory store for simplicity, can be extended to Redis.
 */

import type { RateLimitOptions, Middleware, LOARequest, LOAResponse } from '../core/types';

// ============================================================================
// Rate Limit Store
// ============================================================================

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store (would use Redis in production)
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
    cleanupExpired(now, opts.windowMs, opts.storeLimit);

    // Get or create entry
    let entry = store.get(key);
    
    if (!entry || now > entry.resetTime) {
      // Reset
      entry = {
        count: 0,
        resetTime: now + opts.windowMs,
      };
      store.set(key, entry);
    }

    // Increment
    entry.count++;

    // Set headers
    if (opts.standardHeaders) {
      const remaining = Math.max(0, opts.max - entry.count);
      const resetTime = Math.ceil(entry.resetTime / 1000);
      
      res.header('RateLimit-Limit', opts.max.toString());
      res.header('RateLimit-Remaining', remaining.toString());
      res.header('RateLimit-Reset', resetTime.toString());
    }

    if (opts.legacyHeaders) {
      const remaining = Math.max(0, opts.max - entry.count);
      res.header('X-RateLimit-Limit', opts.max.toString());
      res.header('X-RateLimit-Remaining', remaining.toString());
    }

    // Check limit
    if (entry.count > opts.max) {
      res.header('Retry-After', Math.ceil((entry.resetTime - now) / 1000).toString());
      opts.handler(req, res);
      return;
    }

    if (opts.skipSuccessfulRequests || opts.skipFailedRequests) {
      const raw = res.raw;
      raw.once('finish', () => {
        const statusCode = raw.statusCode || res.statusCode;
        if ((opts.skipSuccessfulRequests && statusCode < 400) ||
            (opts.skipFailedRequests && statusCode >= 400)) {
          decrementKey(key);
        }
      });
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

export function getEntry(key: string): RateLimitEntry | undefined {
  return store.get(key);
}

export function resetKey(key: string): void {
  store.delete(key);
}

function decrementKey(key: string): void {
  const entry = store.get(key);
  if (!entry) return;

  entry.count = Math.max(0, entry.count - 1);
  if (entry.count === 0) {
    store.delete(key);
  }
}

function cleanupExpired(now: number, windowMs: number, storeLimit: number): void {
  if (now < nextCleanup && store.size <= storeLimit) {
    return;
  }

  for (const [key, entry] of store) {
    if (entry.resetTime <= now) {
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

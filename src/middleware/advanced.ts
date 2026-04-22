/**
 * Servra - Advanced Middleware
 * 
 * Advanced middleware features for security and request handling.
 */

import type { Middleware, LOARequest, LOAResponse, NextFunction } from '../core/types';

export interface ProxyOptions {
  trustProxy: boolean;
  proxyDepth: number;
  trustedProxies: string[];
  realIpHeader: string;
}

export interface FileSizeOptions {
  maxFileSize: number;
  maxFields: number;
  maxFieldSize: number;
  maxFieldsSize: number;
}

export interface TimeoutOptions {
  timeout: number;
  onTimeout: (req: LOARequest, res: LOAResponse) => void;
}

export interface RateLimitOptions {
  enabled: boolean;
  windowMs: number;
  max: number;
  message: string | object;
  statusCode: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  storeLimit: number;
  keyGenerator: (req: LOARequest) => string;
  handler: (req: LOARequest, res: LOAResponse) => void;
}

// In-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// ============================================================================
// Proxy Protection Middleware
// ============================================================================

export function proxyProtection(options: Partial<ProxyOptions> = {}): Middleware {
  const opts: Required<ProxyOptions> = {
    trustProxy: options.trustProxy ?? true,
    proxyDepth: options.proxyDepth ?? 1,
    trustedProxies: options.trustedProxies ?? ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
    realIpHeader: options.realIpHeader ?? 'x-real-ip',
  };

  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    if (!opts.trustProxy) {
      next();
      return;
    }

    // Get client IP considering proxy
    const forwardedForHeader = req.header('x-forwarded-for');
    const forwardedFor = Array.isArray(forwardedForHeader) ? forwardedForHeader[0] : forwardedForHeader;
    const realIpHeader = req.header(opts.realIpHeader);
    const realIp = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;
    const remoteAddr = req.ip;

    let clientIp = remoteAddr;

    if (forwardedFor && opts.trustProxy) {
      const ips = forwardedFor.split(',').map(ip => ip.trim());
      
      // Trust only the number of proxies configured
      const trustedIps = ips.slice(-opts.proxyDepth);
      
      // Check if all forwarding proxies are trusted
      const allTrusted = trustedIps.every(ip => isTrustedProxy(ip, opts.trustedProxies));
      
      if (allTrusted && ips.length > 0) {
        clientIp = ips[0];
      }
    } else if (realIp) {
      clientIp = Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Verify client IP is from trusted network
    if (!isTrustedProxy(clientIp, opts.trustedProxies)) {
      // Allow if running locally, otherwise might be attack
      if (!opts.trustedProxies.includes(clientIp) && !isPrivateNetwork(clientIp)) {
        // Log warning but don't block - could be legitimate
      }
    }

    next();
  };
}

// ============================================================================
// File Size Limit Middleware
// ============================================================================

export function fileSizeLimit(options: Partial<FileSizeOptions> = {}): Middleware {
  const opts: Required<FileSizeOptions> = {
    maxFileSize: options.maxFileSize ?? 5 * 1024 * 1024, // 5MB default
    maxFields: options.maxFields ?? 100,
    maxFieldSize: options.maxFieldSize ?? 1024 * 1024, // 1MB
    maxFieldsSize: options.maxFieldsSize ?? 1024 * 1024, // 1MB
  };

  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    const contentLength = req.header('content-length');
    const contentType = req.header('content-type');

    if (contentLength) {
      const contentLengthStr = Array.isArray(contentLength) ? contentLength[0] : contentLength;
      const size = parseInt(contentLengthStr, 10);

      if (!Number.isFinite(size) || size < 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid Content-Length header',
          statusCode: 400,
        });
        return;
      }
      
      if (size > opts.maxFileSize) {
        res.status(413).json({
          error: 'Payload Too Large',
          message: `Request body exceeds maximum size of ${opts.maxFileSize} bytes`,
          statusCode: 413,
        });
        return;
      }
    }

    // Check content-type for multipart or urlencoded
    if (contentType) {
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // Will be handled by body parser
      } else if (contentType.includes('multipart/form-data')) {
        // Basic check - will be validated by body parser
      }
    }

    next();
  };
}

// ============================================================================
// Request Timeout Middleware
// ============================================================================

export function timeout(options: Partial<TimeoutOptions> = {}): Middleware {
  const opts: Required<TimeoutOptions> = {
    timeout: options.timeout ?? 30000,
    onTimeout: options.onTimeout ?? ((req: LOARequest, res: LOAResponse) => {
      res.status(408).json({
        error: 'Request Timeout',
        message: 'Request timed out',
        statusCode: 408,
      });
    }),
  };

  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    req.raw.setTimeout(opts.timeout, () => {
      if (!res.sent) {
        opts.onTimeout(req, res);
      }
      req.raw.destroy();
    });

    next();
  };
}

// ============================================================================
// IP Range Check
// ============================================================================

function isTrustedProxy(ip: string, trustedProxies: string[]): boolean {
  for (const proxy of trustedProxies) {
    if (proxy.includes('/')) {
      // CIDR notation
      if (cidrContains(proxy, ip)) return true;
    } else if (proxy === ip) {
      return true;
    }
  }
  return false;
}

function cidrContains(cidr: string, ip: string): boolean {
  const [base, bits] = cidr.split('/');
  if (!bits) return base === ip;

  const parsedBits = parseInt(bits, 10);
  if (!Number.isInteger(parsedBits) || parsedBits < 0 || parsedBits > 32) {
    return false;
  }

  const mask = parsedBits === 0 ? 0 : (0xffffffff << (32 - parsedBits)) >>> 0;
  const baseNum = ipToNum(base);
  const ipNum = ipToNum(ip);

  return (baseNum & mask) === (ipNum & mask);
}

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isPrivateNetwork(ip: string): boolean {
  const num = ipToNum(ip);
  
  // 10.0.0.0/8
  if ((num & 0xff000000) === 0x0a000000) return true;
  
  // 172.16.0.0/12
  if ((num & 0xfff00000) === 0xac100000) return true;
  
  // 192.168.0.0/16
  if ((num & 0xffff0000) === 0xc0a80000) return true;
  
  // 127.0.0.0/8 (localhost)
  if ((num & 0xff000000) === 0x7f000000) return true;
  
  return false;
}

// ============================================================================
// Enhanced Rate Limiting
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

  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    if (!opts.enabled) {
      next();
      return;
    }

    const key = opts.keyGenerator(req);
    const now = Date.now();
    cleanupRateLimitStore(now, opts.windowMs, opts.storeLimit);

    let entry = rateLimitStore.get(key);
    
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + opts.windowMs,
      };
      rateLimitStore.set(key, entry);
    }

    entry.count++;

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

    if (entry.count > opts.max) {
      res.header('Retry-After', Math.ceil((entry.resetTime - now) / 1000).toString());
      opts.handler(req, res);
      return;
    }

    if (opts.skipSuccessfulRequests || opts.skipFailedRequests) {
      res.raw.once('finish', () => {
        const statusCode = res.raw.statusCode || res.statusCode;
        if ((opts.skipSuccessfulRequests && statusCode < 400) ||
            (opts.skipFailedRequests && statusCode >= 400)) {
          const current = rateLimitStore.get(key);
          if (!current) return;
          current.count = Math.max(0, current.count - 1);
          if (current.count === 0) rateLimitStore.delete(key);
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

let nextRateLimitCleanup = 0;

function cleanupRateLimitStore(now: number, windowMs: number, storeLimit: number): void {
  if (now < nextRateLimitCleanup && rateLimitStore.size <= storeLimit) {
    return;
  }

  for (const [key, entry] of rateLimitStore) {
    if (entry.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }

  if (rateLimitStore.size > storeLimit) {
    const overflow = rateLimitStore.size - storeLimit;
    let deleted = 0;
    for (const key of rateLimitStore.keys()) {
      rateLimitStore.delete(key);
      deleted++;
      if (deleted >= overflow) break;
    }
  }

  nextRateLimitCleanup = now + Math.min(windowMs, 60000);
}

// ============================================================================
// Export
// ============================================================================

export default {
  proxyProtection,
  fileSizeLimit,
  timeout,
  rateLimit,
};

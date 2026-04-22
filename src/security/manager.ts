/**
 * LOA Framework - Security Manager
 * 
 * Central security coordinator that manages all built-in security features.
 * Security is enabled by default, with all headers, rate limiting, etc.
 */

import type { SecurityOptions, SecurityConfig, HelmetOptions, RateLimitOptions, CORSOptions, CSRFOptions, Middleware, LOARequest, LOAResponse } from '../core/types';
import type { Logger } from '../core/types';
import { helmet } from './helmet';
import { rateLimit } from './rate-limit';
import { cors } from './cors';
import { csrf } from './csrf';

// ============================================================================
// Security Manager
// ============================================================================

export class SecurityManager {
  readonly #options: Required<SecurityOptions>;
  readonly #logger: Logger;

  // Security middleware functions
  #helmetMiddleware: Middleware | null = null;
  #rateLimitMiddleware: Middleware | null = null;
  #corsMiddleware: Middleware | null = null;
  #csrfMiddleware: Middleware | null = null;

  constructor(options: SecurityConfig = {}, logger?: Logger) {
    this.#logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const helmetDefaults = this.#defaultHelmetOptions();
    const rateLimitDefaults = this.#defaultRateLimitOptions();
    const corsDefaults = this.#defaultCORSOptions();
    const csrfDefaults = this.#defaultCSRFOptions();

    // Set defaults
    this.#options = {
      enabled: options.enabled ?? true,
      helmet: { ...helmetDefaults, ...options.helmet },
      rateLimit: { ...rateLimitDefaults, ...options.rateLimit },
      cors: { ...corsDefaults, ...options.cors },
      csrf: {
        ...csrfDefaults,
        ...options.csrf,
        cookieOptions: {
          ...csrfDefaults.cookieOptions,
          ...options.csrf?.cookieOptions,
        },
      },
      bodyLimit: options.bodyLimit ?? '1mb',
      timeout: options.timeout ?? 30000,
      trustedProxies: options.trustedProxies ?? ['127.0.0.1', '::1'],
    };

    // Initialize security middlewares
    this.#initialize();
  }

  // ========================================================================
  // Initialization
  // ========================================================================

  #initialize(): void {
    // Helmet (security headers)
    if (this.#options.helmet) {
      this.#helmetMiddleware = helmet(this.#options.helmet);
    }

    // Rate limiting
    if (this.#options.rateLimit.enabled) {
      this.#rateLimitMiddleware = rateLimit(this.#options.rateLimit);
    }

    // CORS
    if (this.#options.cors.enabled) {
      this.#corsMiddleware = cors(this.#options.cors);
    }

    // CSRF
    if (this.#options.csrf.enabled) {
      this.#csrfMiddleware = csrf(this.#options.csrf);
    }
  }

  #defaultHelmetOptions(): Required<HelmetOptions> {
    return {
      contentSecurityPolicy: true,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: true,
      originAgentCluster: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
      strictTransportSecurity: true,
      xContentTypeOptions: true,
      xDownloadOptions: true,
      xFrameOptions: 'DENY',
      xPermittedCrossDomainPolicies: 'none',
      xXSSProtection: '1; mode=block',
      permissionsPolicy: true,
    };
  }

  #defaultRateLimitOptions(): Required<RateLimitOptions> {
    return {
      enabled: true,
      windowMs: 60000,
      max: 100,
      message: 'Too many requests',
      statusCode: 429,
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      storeLimit: 100000,
      keyGenerator: (req: LOARequest) => req.ip,
      handler: (req: LOARequest, res: LOAResponse) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          statusCode: 429,
        });
      },
    };
  }

  #defaultCORSOptions(): Required<CORSOptions> {
    return {
      enabled: true,
      origin: undefined,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: [],
      credentials: false,
      maxAge: 86400,
      preflightContinue: false,
    };
  }

  #defaultCSRFOptions(): Required<CSRFOptions> {
    return {
      enabled: false,
      cookie: true,
      secret: process.env.CSRF_SECRET ?? 'change-me-in-production',
      header: 'x-csrf-token',
      tokenGetter: (req: LOARequest) => {
        const header = req.header('x-csrf-token');
        return (Array.isArray(header) ? header[0] : header) || '';
      },
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      },
    };
  }

  // ========================================================================
  // Get Security Middleware
  // ========================================================================

  /**
   * Get combined security middleware
   */
  middleware(): Middleware {
    return (req: LOARequest, res: LOAResponse, next: () => void) => {
      if (!this.#options.enabled) {
        next();
        return;
      }

      // Run all security middleware in order
      if (this.#helmetMiddleware) {
        this.#helmetMiddleware(req, res, () => {});
        if (res.sent) return;
      }

      if (this.#rateLimitMiddleware) {
        this.#rateLimitMiddleware(req, res, () => {});
        if (res.sent) return;
      }

      if (this.#corsMiddleware) {
        this.#corsMiddleware(req, res, () => {});
        if (res.sent) return;
      }

      if (this.#csrfMiddleware) {
        this.#csrfMiddleware(req, res, () => {});
        if (res.sent) return;
      }

      // Sanitize inputs
      if (req.url.includes('?') || Object.keys(req.params).length > 0 || Object.keys(req.body).length > 0) {
        this.#sanitizeRequest(req);
      }

      next();
    };
  }

  // ========================================================================
  // Input Sanitization
  // ========================================================================

  #sanitizeRequest(req: LOARequest): void {
    // Sanitize query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (isBlockedObjectKey(key)) {
        delete req.query[key];
        continue;
      }

      if (typeof value === 'string') {
        req.query[key] = sanitizeInput(value);
      } else if (Array.isArray(value)) {
        req.query[key] = value.map((item) => typeof item === 'string' ? sanitizeInput(item) : item);
      }
    }

    for (const [key, value] of Object.entries(req.params)) {
      if (isBlockedObjectKey(key)) {
        delete req.params[key];
        continue;
      }

      if (typeof value === 'string') {
        req.params[key] = sanitizeInput(value);
      }
    }

    // Sanitize body
    const body = req.body;
    if (body && typeof body === 'object') {
      this.#sanitizeObject(body);
    }
  }

  #sanitizeObject(obj: unknown, depth: number = 0): void {
    if (depth > 10) return; // Prevent prototype pollution via recursion
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Block prototype pollution
      if (isBlockedObjectKey(key)) {
        delete (obj as Record<string, unknown>)[key];
        continue;
      }

      if (typeof value === 'string') {
        (obj as Record<string, unknown>)[key] = sanitizeInput(value);
      } else if (typeof value === 'object') {
        this.#sanitizeObject(value, depth + 1);
      }
    }
  }

  // ========================================================================
  // Options Access
  // ========================================================================

  get options(): Required<SecurityOptions> {
    return this.#options;
  }

  get helmetOptions(): Required<HelmetOptions> {
    return this.#options.helmet as Required<HelmetOptions>;
  }

  get rateLimitOptions(): Required<RateLimitOptions> {
    return this.#options.rateLimit as Required<RateLimitOptions>;
  }

  get corsOptions(): Required<CORSOptions> {
    return this.#options.cors as Required<CORSOptions>;
  }

  get csrfOptions(): Required<CSRFOptions> {
    return this.#options.csrf as Required<CSRFOptions>;
  }

  // ========================================================================
  // Bypass Methods
  // ========================================================================

  disableRateLimiting(): void {
    this.#rateLimitMiddleware = null;
  }

  disableCORS(): void {
    this.#corsMiddleware = null;
  }

  disableCSRF(): void {
    this.#csrfMiddleware = null;
  }

  // ========================================================================
  // Logging
  // ========================================================================

  logSecurityEvent(event: string, details: Record<string, unknown>): void {
    this.#logger.warn(`[SECURITY] ${event}`, details);
  }
}

// ============================================================================
// Input Sanitization
// ============================================================================

function sanitizeInput(input: string): string {
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove common XSS patterns
  sanitized = sanitized
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');

  // Block SQL injection patterns (basic)
  sanitized = sanitized
    .replace(/(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/gi, '');

  // Block header injection
  sanitized = sanitized.replace(/[\r\n]/g, '');

  return sanitized;
}

function isBlockedObjectKey(key: string): boolean {
  return key === '__proto__' || key === 'prototype' || key === 'constructor' || key === 'constructor.prototype';
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSecurityManager(
  options: SecurityOptions,
  logger?: Logger
): SecurityManager {
  return new SecurityManager(options, logger);
}

// ============================================================================
// Export
// ============================================================================

export default SecurityManager;

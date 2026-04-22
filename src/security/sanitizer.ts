/**
 * Servra - Input Sanitizer
 * 
 * Prevents/protects against common input-based attacks:
 * - XSS
 * - SQL Injection
 * - Prototype Pollution
 * - Header Injection
 */

import type { LOARequest, LOAResponse, Middleware, NextFunction } from '../core/types';

const BLOCKED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'constructor.prototype', 'prototype']);

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeXSS(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize for HTML context
 */
export function sanitizeHTML(input: string): string {
  return sanitizeXSS(input);
}

/**
 * Block SQL injection patterns
 */
export function sanitizeSQL(input: string): string {
  const blocked = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|LOAD_FILE|DUMPFILE)\b|--|\/\*|\*\/|@@|0x)/gi;
  return input.replace(blocked, '');
}

/**
 * Prevent prototype pollution
 */
export function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (BLOCKED_OBJECT_KEYS.has(key)) continue;
    
    if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitizeHeaders(sanitizeXSS(value));
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitize path to prevent path traversal
 */
export function sanitizePath(input: string): string {
  // Remove dangerous patterns
  return input
    .replace(/\0/g, '')
    .replace(/\.\./g, '')
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/');
}

/**
 * Remove header injection characters
 */
export function sanitizeHeaders(input: string): string {
  return input.replace(/[\r\n]/g, '');
}

/**
 * General sanitization wrapper
 */
export function sanitize(): Middleware;
export function sanitize(input: string, type?: 'xss' | 'sql' | 'path' | 'html'): string;
export function sanitize(input?: string, type: 'xss' | 'sql' | 'path' | 'html' = 'xss'): string | Middleware {
  if (typeof input !== 'string') {
    return sanitizeMiddleware();
  }

  switch (type) {
    case 'xss': return sanitizeXSS(input);
    case 'sql': return sanitizeSQL(input);
    case 'path': return sanitizePath(input);
    case 'html': return sanitizeHTML(input);
    default: return input;
  }
}

/**
 * Middleware for request sanitization
 */
export function sanitizeInput(): (req: LOARequest) => void {
  return (req: LOARequest) => {
    // Sanitize query
    for (const key of Object.keys(req.query)) {
      if (BLOCKED_OBJECT_KEYS.has(key)) {
        delete req.query[key];
        continue;
      }

      const value = req.query[key];
      if (typeof value === 'string') {
        req.query[key] = sanitizeHeaders(sanitizeXSS(value));
      } else if (Array.isArray(value)) {
        req.query[key] = value.map((item) => sanitizeHeaders(sanitizeXSS(item)));
      }
    }

    // Sanitize params
    for (const key of Object.keys(req.params)) {
      if (BLOCKED_OBJECT_KEYS.has(key)) {
        delete req.params[key];
        continue;
      }

      if (typeof req.params[key] === 'string') {
        req.params[key] = sanitizePath(req.params[key]);
      }
    }

    if (req.body && typeof req.body === 'object') {
      const sanitizedBody = sanitizeObject(req.body);
      for (const key of Object.keys(req.body)) {
        delete req.body[key];
      }
      Object.assign(req.body, sanitizedBody);
    }
  };
}

function sanitizeMiddleware(): Middleware {
  const sanitizeRequest = sanitizeInput();

  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    sanitizeRequest(req);
    next();
  };
}

// ============================================================================
// Export
// ============================================================================

export default {
  sanitizeXSS,
  sanitizeHTML,
  sanitizeSQL,
  sanitizeObject,
  sanitizePath,
  sanitizeHeaders,
  sanitize,
  sanitizeInput,
};

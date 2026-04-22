/**
 * Servra - CORS (Cross-Origin Resource Sharing)
 * 
 * Built-in CORS support with strict defaults.
 */

import type { CORSOptions, Middleware, LOARequest, LOAResponse } from '../core/types';

// ============================================================================
// CORS Middleware
// ============================================================================

export function cors(options: Partial<CORSOptions> = {}): Middleware {
  const opts: Required<CORSOptions> = {
    enabled: options.enabled ?? true,
    origin: options.origin,
    methods: options.methods ?? ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: options.allowedHeaders ?? ['Content-Type', 'Authorization'],
    exposedHeaders: options.exposedHeaders ?? [],
    credentials: options.credentials ?? false,
    maxAge: options.maxAge ?? 86400,
    preflightContinue: options.preflightContinue ?? false,
  };

  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    if (!opts.enabled) {
      next();
      return;
    }

    const originHeader = req.header('origin');
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const requestMethod = req.method?.toUpperCase();
    const requestHeadersRaw = req.header('access-control-request-headers');
    const requestHeaders = Array.isArray(requestHeadersRaw) ? requestHeadersRaw[0] : requestHeadersRaw;
    const allowedOrigin = resolveAllowedOrigin(origin, opts.origin, opts.credentials);

    // Handle preflight OPTIONS request
    if (requestMethod === 'OPTIONS') {
      // Check origin
      if (origin && !allowedOrigin) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'CORS origin denied',
          statusCode: 403,
        });
        return;
      }

      // Set Allow-Origin
      if (allowedOrigin) {
        res.header('Access-Control-Allow-Origin', allowedOrigin);
        if (allowedOrigin !== '*') {
          res.header('Vary', 'Origin');
        }
      }

      // Set Allow-Methods
      res.header('Access-Control-Allow-Methods', opts.methods.join(', '));

      // Set Allow-Headers
      const allowedHeaders = flattenHeaders(opts.allowedHeaders);
      if (allowedHeaders.length > 0) {
        res.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      } else if (requestHeaders) {
        res.header('Access-Control-Allow-Headers', requestHeaders);
      }

      // Set Allow-Credentials
      if (opts.credentials) {
        res.header('Access-Control-Allow-Credentials', 'true');
      }

      // Set Max-Age
      if (opts.maxAge) {
        res.header('Access-Control-Max-Age', opts.maxAge.toString());
      }

      // Continue or end preflight
      if (opts.preflightContinue) {
        next();
      } else {
        res.status(204).send();
      }

      return;
    }

    // Handle simple requests
    if (origin && allowedOrigin) {
      res.header('Access-Control-Allow-Origin', allowedOrigin);
      if (allowedOrigin !== '*') {
        res.header('Vary', 'Origin');
      }
    }

    // Set Expose-Headers
    if (opts.exposedHeaders.length > 0) {
      res.header('Access-Control-Expose-Headers', opts.exposedHeaders.join(', '));
    }

    // Set Allow-Credentials
    if (opts.credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    next();
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function isOriginAllowed(
  origin: string,
  allowed: string | string[] | ((origin: string) => boolean) | undefined
): boolean {
  if (!allowed) return false;
  if (allowed === '*') return true;

  if (typeof allowed === 'function') {
    return allowed(origin);
  }

  const allowedOrigins = Array.isArray(allowed) ? allowed : [allowed];
  return allowedOrigins.includes(origin);
}

function resolveAllowedOrigin(
  origin: string | undefined,
  allowed: string | string[] | ((origin: string) => boolean) | undefined,
  credentials: boolean
): string | undefined {
  if (!origin) {
    return allowed === '*' && !credentials ? '*' : undefined;
  }

  if (!isOriginAllowed(origin, allowed)) {
    return undefined;
  }

  if (allowed === '*' && credentials) {
    return undefined;
  }

  return allowed === '*' ? '*' : origin;
}

function flattenHeaders(headers: (string | string[])[]): string[] {
  return headers.flatMap((header) => Array.isArray(header) ? header : [header]);
}

// ============================================================================
// Export
// ============================================================================

export default cors;

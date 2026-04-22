/**
 * LOA Framework - CSRF Protection
 *
 * Signed double-submit token protection with stateless verification.
 */

import type { CSRFOptions, Middleware, LOARequest, LOAResponse } from '../core/types';
import { hmacSha256, randomBytes, secureCompare } from '../core/crypto';

const DEFAULT_SECRET = 'change-me-in-production';
const TOKEN_TTL_MS = 60 * 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ============================================================================
// CSRF Middleware
// ============================================================================

export function csrf(options: Partial<CSRFOptions> = {}): Middleware {
  const opts: Required<CSRFOptions> = {
    enabled: options.enabled ?? false,
    cookie: options.cookie ?? true,
    secret: options.secret ?? process.env.CSRF_SECRET ?? DEFAULT_SECRET,
    header: options.header ?? 'x-csrf-token',
    tokenGetter: options.tokenGetter ?? ((req: LOARequest) => {
      const header = req.header(options.header ?? 'x-csrf-token');
      return (Array.isArray(header) ? header[0] : header) || '';
    }),
    cookieOptions: options.cookieOptions ?? {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    },
  };

  if (opts.enabled && process.env.NODE_ENV === 'production' &&
      (opts.secret === DEFAULT_SECRET || opts.secret.length < 32)) {
    throw new Error('CSRF protection requires a strong secret in production');
  }

  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    if (!opts.enabled) {
      next();
      return;
    }

    if (SAFE_METHODS.has(req.method)) {
      const token = createToken(opts.secret);
      res.header('X-CSRF-Token', token);

      if (opts.cookie) {
        res.cookie('csrf_token', token, opts.cookieOptions);
      }

      next();
      return;
    }

    const clientToken = opts.tokenGetter(req);

    if (!clientToken || !isTokenValid(clientToken, opts.secret)) {
      sendForbidden(res, 'Invalid CSRF token');
      return;
    }

    if (opts.cookie) {
      const cookieToken = req.cookie('csrf_token') ?? '';
      if (!cookieToken || !secureCompare(cookieToken, clientToken)) {
        sendForbidden(res, 'CSRF token mismatch');
        return;
      }
    }

    next();
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function createToken(secret: string): string {
  const nonce = Buffer.from(randomBytes(32)).toString('base64url');
  const expires = (Date.now() + TOKEN_TTL_MS).toString(36);
  const payload = `${nonce}.${expires}`;
  const signature = hmacSha256(payload, secret);

  return `${payload}.${signature}`;
}

function isTokenValid(token: string, secret: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [nonce, expires, signature] = parts;
  if (!nonce || !expires || !signature) return false;

  const expiresAt = Number.parseInt(expires, 36);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return false;
  }

  const expected = hmacSha256(`${nonce}.${expires}`, secret);
  return secureCompare(signature, expected);
}

function sendForbidden(res: LOAResponse, message: string): void {
  res.status(403).json({
    error: 'Forbidden',
    message,
    statusCode: 403,
  });
}

// ============================================================================
// Export
// ============================================================================

export default csrf;

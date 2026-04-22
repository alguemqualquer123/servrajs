/**
 * Servra - Enhanced Security Headers (Helmet-like)
 * 
 * Adds security headers to responses for OWASP Top 10 protection.
 * All headers are enabled by default.
 */

import type { HelmetOptions, Middleware, LOARequest, LOAResponse } from '../core/types';

// ============================================================================
// Helmet Middleware
// ============================================================================

export function helmet(options: Partial<HelmetOptions> = {}): Middleware {
  const opts: Required<HelmetOptions> = {
    contentSecurityPolicy: options.contentSecurityPolicy ?? true,
    crossOriginEmbedderPolicy: options.crossOriginEmbedderPolicy ?? false,
    crossOriginOpenerPolicy: options.crossOriginOpenerPolicy ?? true,
    crossOriginResourcePolicy: options.crossOriginResourcePolicy ?? true,
    originAgentCluster: options.originAgentCluster ?? true,
    referrerPolicy: options.referrerPolicy ?? 'strict-origin-when-cross-origin',
    strictTransportSecurity: options.strictTransportSecurity ?? true,
    xContentTypeOptions: options.xContentTypeOptions ?? true,
    xDownloadOptions: options.xDownloadOptions ?? true,
    xFrameOptions: options.xFrameOptions ?? 'DENY',
    xPermittedCrossDomainPolicies: options.xPermittedCrossDomainPolicies ?? 'none',
    xXSSProtection: options.xXSSProtection ?? '1; mode=block',
    permissionsPolicy: options.permissionsPolicy ?? true,
    expectCt: options.expectCt ?? { maxAge: 31536000, enforce: true },
  };

  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    if (opts.strictTransportSecurity) {
      const hstsValue = typeof opts.strictTransportSecurity === 'object'
        ? buildHSTSValue(opts.strictTransportSecurity)
        : 'max-age=31536000; includeSubDomains; preload';
      
      if (hstsValue) {
        res.header('Strict-Transport-Security', hstsValue);
      }
    }

    if (opts.xContentTypeOptions) {
      res.header('X-Content-Type-Options', 'nosniff');
    }

    if (opts.xDownloadOptions) {
      res.header('X-Download-Options', 'noopen');
    }

    if (opts.xFrameOptions) {
      res.header('X-Frame-Options', 
        typeof opts.xFrameOptions === 'string' ? opts.xFrameOptions : 'DENY'
      );
    }

    if (opts.xPermittedCrossDomainPolicies) {
      res.header('X-Permitted-Cross-Domain-Policies',
        typeof opts.xPermittedCrossDomainPolicies === 'string' 
          ? opts.xPermittedCrossDomainPolicies 
          : 'none'
      );
    }

    if (opts.xXSSProtection) {
      res.header('X-XSS-Protection',
        typeof opts.xXSSProtection === 'string' 
          ? opts.xXSSProtection 
          : '1; mode=block'
      );
    }

    if (opts.referrerPolicy) {
      res.header('Referrer-Policy',
        typeof opts.referrerPolicy === 'string' 
          ? opts.referrerPolicy 
          : 'strict-origin-when-cross-origin'
      );
    }

    if (opts.originAgentCluster) {
      res.header('Origin-Agent-Cluster', '?1');
    }

    if (opts.crossOriginOpenerPolicy) {
      res.header('Cross-Origin-Opener-Policy', 'same-origin');
    }

    if (opts.crossOriginResourcePolicy) {
      res.header('Cross-Origin-Resource-Policy',
        typeof opts.crossOriginResourcePolicy === 'string' 
          ? opts.crossOriginResourcePolicy 
          : 'same-origin'
      );
    }

    if (opts.crossOriginEmbedderPolicy) {
      res.header('Cross-Origin-Embedder-Policy', 'require-corp');
    }

    if (opts.contentSecurityPolicy) {
      const cspValue = typeof opts.contentSecurityPolicy === 'object'
        ? buildCSPValue(opts.contentSecurityPolicy)
        : "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'";
      
      if (cspValue) {
        res.header('Content-Security-Policy', cspValue);
      }
    }

    if (opts.permissionsPolicy) {
      const ppValue = typeof opts.permissionsPolicy === 'object'
        ? buildPermissionsPolicyValue(opts.permissionsPolicy)
        : 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()';
      
      if (ppValue) {
        res.header('Permissions-Policy', ppValue);
      }
    }

    if (opts.expectCt) {
      const expectCtValue = typeof opts.expectCt === 'object'
        ? `max-age=${opts.expectCt.maxAge}; ${opts.expectCt.enforce ? 'enforce' : ''}${opts.expectCt.reportUri ? '; report-uri=' + opts.expectCt.reportUri : ''}`
        : 'max-age=31536000; enforce';
      
      res.header('Expect-CT', expectCtValue);
    }

    next();
  };
}

function buildHSTSValue(options: Record<string, string | number | boolean>): string {
  const parts: string[] = [];
  
  if (options.maxAge) parts.push(`max-age=${options.maxAge}`);
  if (options.includeSubDomains) parts.push('includeSubDomains');
  if (options.preload) parts.push('preload');

  return parts.join('; ');
}

function buildCSPValue(policy: Record<string, string>): string {
  const directives: string[] = [];

  for (const [directive, value] of Object.entries(policy)) {
    directives.push(`${directive} ${value}`);
  }

  return directives.join('; ');
}

function buildPermissionsPolicyValue(policy: Record<string, string[]>): string {
  const permissions: string[] = [];

  for (const [name, allowlist] of Object.entries(policy)) {
    permissions.push(`${name}=(${allowlist.join(', ')})`);
  }

  return permissions.join(', ');
}

export default helmet;

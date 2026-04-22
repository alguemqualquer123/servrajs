/**
 * Servra - DNS Rebinding Protection
 * 
 * Protects against DNS rebinding attacks by validating Host headers.
 * Prevents attackers from using dynamic DNS to bypass IP-based restrictions.
 */

import type { Middleware, LOARequest, LOAResponse } from '../core/types';

export interface DNSRebindingOptions {
  allowedHosts?: string[];
  allowedDomains?: string[];
  checkInternalRedirect?: boolean;
  blockPrivateIPs?: boolean;
  hostnameTTL?: number;
}

const DEFAULT_HOSTNAME_TTL = 30000;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.google',
  '169.254.169.254',
  'metadata.google.internal',
]);

const BLOCKED_IP_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '127.0.0.53/32',
  '::1/128',
  'fc00::/7',
  'fe80::/10',
  'ff00::/8',
];

interface CachedHostname {
  hostname: string;
  allowed: boolean;
  timestamp: number;
}

const hostnameCache = new Map<string, CachedHostname>();
let lastCacheCleanup = 0;

export function dnsRebinding(options: DNSRebindingOptions = {}): Middleware {
  const opts = {
    allowedHosts: options.allowedHosts ?? [],
    allowedDomains: options.allowedDomains ?? [],
    checkInternalRedirect: options.checkInternalRedirect ?? true,
    blockPrivateIPs: options.blockPrivateIPs ?? true,
    hostnameTTL: options.hostnameTTL ?? DEFAULT_HOSTNAME_TTL,
  };

  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    const host = req.hostname;
    if (!host) {
      next();
      return;
    }

    if (BLOCKED_HOSTS.has(host.toLowerCase())) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Blocked hostname',
        statusCode: 400,
      });
      return;
    }

    if (opts.allowedHosts.length > 0) {
      const allowed = opts.allowedHosts.some(allowedHost => 
        host.toLowerCase() === allowedHost.toLowerCase() ||
        host.toLowerCase().endsWith('.' + allowedHost.toLowerCase())
      );
      if (!allowed) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Hostname not allowed',
          statusCode: 400,
        });
        return;
      }
    }

    if (opts.blockPrivateIPs && isPrivateIP(host)) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Private IP addresses not allowed',
        statusCode: 400,
      });
      return;
    }

    if (isExternalRedirect(host) && opts.checkInternalRedirect) {
      const cacheKey = req.ip + '|' + host;
      const cached = hostnameCache.get(cacheKey);
      const now = Date.now();

      if (cached && now - cached.timestamp < opts.hostnameTTL) {
        if (!cached.allowed) {
          res.status(400).json({
            error: 'Bad Request',
            message: 'DNS rebinding attack detected',
            statusCode: 400,
          });
          return;
        }
        next();
        return;
      }

      hostnameCache.set(cacheKey, {
        hostname: host,
        allowed: true,
        timestamp: now,
      });

      cleanupCache(now);
    }

    next();
  };
}

function isPrivateIP(ip: string): boolean {
  for (const cidr of BLOCKED_IP_RANGES) {
    if (cidrContains(cidr, ip)) {
      return true;
    }
  }
  return false;
}

function isExternalRedirect(host: string): boolean {
  const ip = host.match(/^(\d+\.\d+\.\d+\.\d+|[a-fA-F0-9:]+)$/);
  return ip !== null;
}

function cidrContains(cidr: string, ip: string): boolean {
  if (!cidr.includes('/') || !ip.includes('.')) {
    return cidr === ip;
  }

  const [base, bitsRaw] = cidr.split('/');
  const bits = Number.parseInt(bitsRaw ?? '', 10);

  if (!isValidIPv4(base) || !isValidIPv4(ip) || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipToNum(base) & mask) === (ipToNum(ip) & mask);
}

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0;
}

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number.parseInt(part, 10);
    return value >= 0 && value <= 255;
  });
}

function cleanupCache(now: number): void {
  if (now - lastCacheCleanup < 60000) {
    return;
  }

  const ttl = DEFAULT_HOSTNAME_TTL * 2;
  for (const [key, value] of hostnameCache) {
    if (now - value.timestamp > ttl) {
      hostnameCache.delete(key);
    }
  }

  if (hostnameCache.size > 10000) {
    hostnameCache.clear();
  }

  lastCacheCleanup = now;
}

export default dnsRebinding;

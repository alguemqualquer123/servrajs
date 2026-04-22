/**
 * Servra - Response Compression
 * 
 * Simple gzip compression middleware for JSON responses.
 */

import { createGzip } from 'zlib';
import type { Middleware, LOARequest, LOAResponse } from '../core/types';

export interface CompressionOptions {
  enabled?: boolean;
  threshold?: number;
  level?: number;
}

const DEFAULT_THRESHOLD = 1024;
const DEFAULT_LEVEL = 6;

export function compression(options: CompressionOptions = {}): Middleware {
  const opts = {
    enabled: options.enabled ?? true,
    threshold: options.threshold ?? DEFAULT_THRESHOLD,
    level: options.level ?? DEFAULT_LEVEL,
  };

  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    if (!opts.enabled) {
      next();
      return;
    }

    const acceptEncoding = req.header('accept-encoding') || '';
    if (!acceptEncoding.includes('gzip')) {
      next();
      return;
    }

    const originalJson = res.json.bind(res);
    let bodyCache: Buffer | null = null;
    let compressed = false;

    (res as unknown as { json: typeof originalJson }).json = function(data: unknown): LOAResponse {
      bodyCache = Buffer.from(JSON.stringify(data));
      return originalJson(data);
    };

    (res.raw as unknown as { _loaCompressed: boolean })._loaCompressed = false;

    const originalEnd = Function.prototype.bind.call(res.raw.end, res.raw);
    (res.raw as unknown as Record<string, unknown>).end = function(): void {
      if (compressed || !bodyCache || res.statusCode !== 200) {
        originalEnd();
        return;
      }

      if (bodyCache.length < opts.threshold) {
        originalEnd();
        return;
      }

      const gzip = createGzip({ level: opts.level });
      compressed = true;

      res.raw.setHeader('Content-Encoding', 'gzip');
      res.raw.removeHeader('Content-Length');

      gzip.pipe(res.raw, { end: true });
      gzip.end(bodyCache);
    };

    next();
  };
}

export default compression;

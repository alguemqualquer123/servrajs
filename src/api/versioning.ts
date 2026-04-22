/**
 * Servra - API Versioning
 * 
 * Semantic versioning for APIs with multiple strategies.
 */

import type { Handler, Middleware, LOARequest, LOAResponse } from '../core/types';

export interface VersionOptions {
  strategy?: 'header' | 'path' | 'query';
  header?: string;
  queryParam?: string;
  defaultVersion?: string;
  versions?: Record<string, string>;
}

export interface VersionedRoute {
  version: string;
  path: string;
  handler: Handler;
  middlewares?: Middleware[];
}

const DEFAULT_HEADER = 'Accept-Version';
const DEFAULT_QUERY = 'version';
const DEFAULT_STRATEGY = 'header';

const VERSION_PATTERN = /^v(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([a-zA-Z0-9.-]+))?$/;

export class VersionManager {
  #strategy: 'header' | 'path' | 'query';
  #header: string;
  #queryParam: string;
  #defaultVersion: string;
  #versions: Map<string, string> = new Map();
  #routes: VersionedRoute[] = [];

  constructor(options: VersionOptions = {}) {
    this.#strategy = options.strategy ?? DEFAULT_STRATEGY;
    this.#header = options.header ?? DEFAULT_HEADER;
    this.#queryParam = options.queryParam ?? DEFAULT_QUERY;
    this.#defaultVersion = options.defaultVersion ?? '1.0.0';

    if (options.versions) {
      for (const [version, path] of Object.entries(options.versions)) {
        this.#versions.set(version, path);
      }
    }
  }

  getVersion(req: LOARequest): string | null {
    switch (this.#strategy) {
      case 'header':
        const header = req.header(this.#header);
        return Array.isArray(header) ? header[0] : header || this.#defaultVersion;
      case 'query':
        return String(req.query[this.#queryParam] ?? this.#defaultVersion);
      case 'path':
        const match = req.path.match(/^\/v(\d+)/);
        return match ? `v${match[1]}` : this.#defaultVersion;
      default:
        return this.#defaultVersion;
    }
  }

  isValidVersion(version: string): boolean {
    if (version.startsWith('v')) version = version.slice(1);
    return VERSION_PATTERN.test(version);
  }

  compareVersions(a: string, b: string): number {
    const parse = (v: string) => {
      const match = v.match(VERSION_PATTERN);
      if (!match) return [0, 0, 0];
      return [
        parseInt(match[1], 10) * 10000,
        parseInt(match[2] || '0', 10) * 100,
        parseInt(match[3] || '0', 10),
      ];
    };

    const [aMajor, aMinor, aPatch] = parse(a);
    const [bMajor, bMinor, bPatch] = parse(b);

    if (aMajor !== bMajor) return aMajor - bMajor;
    if (aMinor !== bMinor) return aMinor - bMinor;
    return aPatch - bPatch;
  }

  middleware(): Middleware {
    return (req: LOARequest, res: LOAResponse, next: () => void) => {
      const version = this.getVersion(req);
      
      if (version && !this.isValidVersion(version)) {
        res.status(400).json({
          error: 'Invalid Version',
          message: `Invalid API version: ${version}`,
          statusCode: 400,
        });
        return;
      }

      (req as LOARequest & { apiVersion: string }).apiVersion = version || this.#defaultVersion;
      next();
    };
  }

  getVersionInfo(version: string): { major: number; minor: number; patch: number } | null {
    const match = version.match(VERSION_PATTERN);
    if (!match) return null;

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2] || '0', 10),
      patch: parseInt(match[3] || '0', 10),
    };
  }

  getLatestVersion(): string {
    const versions = Array.from(this.#versions.keys());
    if (versions.length === 0) return this.#defaultVersion;

    return versions.sort((a, b) => this.compareVersions(b, a))[0];
  }

  isDeprecated(version: string): boolean {
    const latest = this.getLatestVersion();
    return this.compareVersions(version, latest) < 0;
  }
}

export function createVersionManager(options?: VersionOptions): VersionManager {
  return new VersionManager(options);
}

export default { createVersionManager, VersionManager };

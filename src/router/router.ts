/**
 * LOA Framework - Router
 * 
 * High-level router that manages routes and lookups.
 * Uses Radix Tree for O(k) route lookup.
 */

import type { HttpMethod, RouteMatch, Handler, Middleware } from '../core/types';
import { RadixTree } from './radix-tree';

// ============================================================================
// Router Options
// ============================================================================

export interface RouterOptions {
  caseSensitive?: boolean;
  ignoreTrailingSlash?: boolean;
  cacheSize?: number;
}

// ============================================================================
// Router Class
// ============================================================================

export class Router {
  readonly #radix: RadixTree;
  readonly #options: Required<RouterOptions>;

  constructor(options: RouterOptions = {}) {
    this.#options = {
      caseSensitive: options.caseSensitive ?? false,
      ignoreTrailingSlash: options.ignoreTrailingSlash ?? true,
      cacheSize: options.cacheSize ?? 1000,
    };

    this.#radix = new RadixTree({
      caseSensitive: this.#options.caseSensitive,
      ignoreTrailingSlash: this.#options.ignoreTrailingSlash,
      cacheSize: this.#options.cacheSize,
    });
  }

  // ========================================================================
  // Route Registration
  // ========================================================================

  /**
   * Add route to router
   */
  add(method: HttpMethod, path: string, handler: Handler, middlewares: Middleware[] = []): void {
    if (!path || !handler) {
      throw new Error('Path and handler are required');
    }

    // Normalize path
    const normalizedPath = this.#normalizePath(path);

    this.#radix.add(method, normalizedPath, handler, middlewares);
  }

  /**
   * Add multiple routes at once
   */
  addRoutes(routes: Array<{
    method: HttpMethod;
    path: string;
    handler: Handler;
    middlewares?: Middleware[];
  }>): void {
    for (const route of routes) {
      this.add(route.method, route.path, route.handler, route.middlewares);
    }
  }

  // ========================================================================
  // Route Lookup
  // ========================================================================

  /**
   * Lookup route - returns RouteMatch or null
   */
  lookup(method: HttpMethod, path: string): RouteMatch | null {
    const normalizedPath = this.#normalizePath(path);
    return this.#radix.lookup(method, normalizedPath);
  }

  /**
   * Check if route exists
   */
  has(method: HttpMethod, path: string): boolean {
    return this.lookup(method, path) !== null;
  }

  // ========================================================================
  // Prefix Management
  // ========================================================================

  getPrefix(): string {
    return this.#radix.getPrefix();
  }

  setPrefix(prefix: string): void {
    this.#radix.setPrefix(prefix);
  }

  // ========================================================================
  // Path Normalization
  // ========================================================================

  #normalizePath(path: string): string {
    if (!path) return '/';

    // Remove trailing slash
    if (this.#options.ignoreTrailingSlash && path !== '/' && path.endsWith('/')) {
      path = path.slice(0, -1);
    }

    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = '/' + path;
    }

    // Apply case sensitivity
    if (!this.#options.caseSensitive) {
      path = path.toLowerCase();
    }

    return path;
  }

  // ========================================================================
  // Statistics
  // ========================================================================

  getStats(): {
    cacheSize: number;
    cacheHits: number;
    cacheMisses: number;
    hitRate: number;
  } {
    return this.#radix.getStats();
  }

  getAllRoutes(): Array<{ method: HttpMethod; path: string; handler: Handler }> {
    return this.#radix.getAllRoutes();
  }

  // ========================================================================
  // Debug
  // ========================================================================

  printRoutes(): void {
    console.log('\n=== Registered Routes ===');
    const routes = this.getAllRoutes();
    
    // Group by method
    const byMethod = new Map<HttpMethod, Array<{ path: string; handler: Handler }>>();
    
    for (const route of routes) {
      const existing = byMethod.get(route.method) || [];
      existing.push({ path: route.path, handler: route.handler });
      byMethod.set(route.method, existing);
    }

    // Print in order
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    for (const method of methods) {
      const routes = byMethod.get(method);
      if (routes) {
        console.log(`\n${method}:`);
        for (const route of routes) {
          console.log(`  ${route.path}`);
        }
      }
    }

    console.log('\n========================\n');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createRouter(options: RouterOptions = {}): Router {
  return new Router(options);
}

// ============================================================================
// Export
// ============================================================================

export default Router;
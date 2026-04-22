/**
 * LOA Framework - Route Definitions
 */

import type { HttpMethod, Handler, Middleware, RequestParams } from '../core/types';

// ============================================================================
// Route Types
// ============================================================================

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: Handler;
  middlewares: Middleware[];
  version?: string;
}

export interface RouteMatch {
  handler: Handler;
  middlewares: Middleware[];
  params: RequestParams;
}

export interface RouteGroup {
  prefix: string;
  routes: RouteDefinition[];
}

// ============================================================================
// Route Builder
// ============================================================================

export function createRoute(
  method: HttpMethod,
  path: string,
  handler: Handler,
  middlewares: Middleware[] = []
): RouteDefinition {
  return {
    method,
    path,
    handler,
    middlewares,
  };
}

export function createRouteMatch(
  handler: Handler,
  middlewares: Middleware[] = [],
  params: RequestParams = {}
): RouteMatch {
  return {
    handler,
    middlewares,
    params,
  };
}

// ============================================================================
// Route Grouping
// ============================================================================

export function createRouteGroup(
  prefix: string,
  routes: Array<{ method: HttpMethod; path: string; handler: Handler }>
): RouteGroup {
  return {
    prefix,
    routes: routes.map((r) => ({
      method: r.method,
      path: r.path,
      handler: r.handler,
      middlewares: [],
    })),
  };
}

export function joinPaths(prefix: string, path: string): string {
  // Ensure prefix ends with /
  const normalizedPrefix = prefix.endsWith('/') ? prefix : prefix + '/';
  
  // Ensure path doesn't start with /
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  
  return normalizedPrefix + normalizedPath;
}

// ============================================================================
// Export
// ============================================================================

export default {
  createRoute,
  createRouteMatch,
  createRouteGroup,
  joinPaths,
};
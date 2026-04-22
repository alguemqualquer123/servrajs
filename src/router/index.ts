/**
 * LOA Framework - Router
 */

export { createRouter, Router } from './router';
export { RadixTree } from './radix-tree';

export interface RouteMatch {
  handler: Function;
  middlewares: Function[];
  params: Record<string, string>;
}

export interface RouteDefinition {
  method: string;
  path: string;
  handler: Function;
  middlewares: Function[];
}
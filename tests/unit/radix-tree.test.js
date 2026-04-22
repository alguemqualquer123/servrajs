import { test, expect } from '../testkit.js';
import { RadixTree } from '../../dist/router/radix-tree.js';

test('RadixTree matches static routes (trailing slash ignored)', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';

  tree.add('GET', '/users', handler, []);

  const match1 = tree.lookup('GET', '/users');
  const match2 = tree.lookup('GET', '/users/');

  expect(match1).toBeDefined();
  expect(match2).toBeDefined();
  expect(match1.handler).toBe(handler);
  expect(match2.handler).toBe(handler);
});

test('RadixTree matches param routes and extracts params', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';

  tree.add('GET', '/users/:id', handler, []);

  const match = tree.lookup('GET', '/users/123');
  expect(match).toBeDefined();
  expect(match.handler).toBe(handler);
  expect(JSON.stringify(match.params)).toBe(JSON.stringify({ id: '123' }));
});

test('RadixTree matches wildcard routes and captures the rest', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';

  tree.add('GET', '/assets/*', handler, []);

  const match = tree.lookup('GET', '/assets/a/b/c');
  expect(match).toBeDefined();
  expect(match.handler).toBe(handler);
  expect(JSON.stringify(match.params)).toBe(JSON.stringify({ '*': 'a/b/c' }));
});

test('RadixTree prefers static routes over params', () => {
  const tree = new RadixTree();
  const staticHandler = () => 'static';
  const paramHandler = () => 'param';

  tree.add('GET', '/users/me', staticHandler, []);
  tree.add('GET', '/users/:id', paramHandler, []);

  const match = tree.lookup('GET', '/users/me');
  expect(match).toBeDefined();
  expect(match.handler).toBe(staticHandler);
});

test('RadixTree isolates routes by method', () => {
  const tree = new RadixTree();
  const handler = () => 'ok';

  tree.add('GET', '/users', handler, []);

  expect(tree.lookup('GET', '/users')).toBeDefined();
  expect(tree.lookup('POST', '/users')).toBe(null);
});

test('RadixTree getAllRoutes lists inserted routes', () => {
  const tree = new RadixTree();
  tree.add('GET', '/users/:id', () => {}, []);
  tree.add('POST', '/users', () => {}, []);

  const routes = tree.getAllRoutes().map((r) => `${r.method} ${r.path}`).sort();
  const list = JSON.stringify(routes);
  expect(list).toContain('GET /users/:id');
  expect(list).toContain('POST /users');
});

test('RadixTree can be case sensitive', () => {
  const tree = new RadixTree({ caseSensitive: true });
  const handler = () => 'ok';

  tree.add('GET', '/Users', handler, []);

  expect(tree.lookup('GET', '/Users')).toBeDefined();
  expect(tree.lookup('GET', '/users')).toBe(null);
});

test('RadixTree dynamic cache records hits for repeated lookups', () => {
  const tree = new RadixTree({ cacheSize: 10 });
  tree.add('GET', '/users/:id', () => {}, []);

  expect(tree.lookup('GET', '/users/1')).toBeDefined();
  expect(tree.lookup('GET', '/users/1')).toBeDefined();

  const stats = tree.getStats();
  expect(stats.cacheHits).toBeTruthy();
});


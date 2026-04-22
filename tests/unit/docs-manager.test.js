import { test, expect } from '../testkit.js';
import { DocsManager } from '../../dist/docs/manager.js';

test('DocsManager builds OpenAPI paths with {param} placeholders', () => {
  const docs = new DocsManager();
  docs.configure({ title: 'Test', version: '1.0.0', apiKeys: ['k'] });

  docs.registerRoute({ method: 'GET', path: '/users/:id', handlerName: 'getUser' });
  docs.documentRoute({
    method: 'GET',
    path: '/users/:id',
    summary: 'Get user',
    responses: { '200': { description: 'ok' } },
  });

  const spec = docs.buildSpec();
  expect(spec.openapi).toBe('3.1.0');
  expect(JSON.stringify(spec.paths)).toContain('/users/{id}');
  expect(JSON.stringify(spec.paths)).toContain('"get"');
});

test('DocsManager assigns default tags when missing', () => {
  const docs = new DocsManager();
  docs.configure({ title: 'Test', version: '1.0.0', apiKeys: ['k'] });
  docs.registerRoute({ method: 'GET', path: '/hello', handlerName: 'hello' });
  docs.documentRoute({ method: 'GET', path: '/hello', summary: 'Hello' });

  const spec = docs.buildSpec();
  const route = spec.routes.find((r) => r.path === '/hello' && r.method === 'GET');
  expect(route).toBeDefined();
  expect(JSON.stringify(route.tags)).toContain('default');
});


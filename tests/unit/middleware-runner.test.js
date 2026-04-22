import { test, expect, createMockRes } from '../testkit.js';
import { MiddlewareRunner } from '../../dist/index.js';

test('MiddlewareRunner executes global and route middleware in order', async () => {
  const runner = new MiddlewareRunner();
  const calls = [];

  runner.use(async (_req, _res, next) => {
    calls.push('g1');
    next();
    await Promise.resolve();
    calls.push('g1:after');
  });

  const route = [
    async (_req, _res, next) => {
      calls.push('r1');
      next();
      await Promise.resolve();
      calls.push('r1:after');
    },
  ];

  const req = {};
  const res = createMockRes();
  await runner.runWithMiddlewares(req, res, route, async () => {
    calls.push('final');
  });

  expect(JSON.stringify(calls)).toBe(JSON.stringify(['g1', 'r1', 'final', 'r1:after', 'g1:after']));
});

test('MiddlewareRunner stops when middleware does not call next', async () => {
  const runner = new MiddlewareRunner();
  let finalCalled = false;

  runner.use((_req, res, _next) => {
    res.status(200).json({ ok: true });
  });

  const req = {};
  const res = createMockRes();
  await runner.runWithMiddlewares(req, res, [], async () => {
    finalCalled = true;
  });

  expect(finalCalled).toBe(false);
  expect(res.sent).toBe(true);
});

test('MiddlewareRunner forwards thrown errors to error handlers', async () => {
  const runner = new MiddlewareRunner();
  const req = {};
  const res = createMockRes();

  runner.use(() => {
    throw new Error('boom');
  });

  runner.useErrorHandler((err, _req, response, _next) => {
    response.status(500).json({ ok: false, message: err.message });
  });

  await runner.runWithMiddlewares(req, res, [], async () => {});

  expect(res.statusCode).toBe(500);
  expect(res.payload?.message).toBe('boom');
});

test('MiddlewareRunner ignores multiple next() calls from same middleware', async () => {
  const runner = new MiddlewareRunner();
  let finalCount = 0;

  runner.use((_req, _res, next) => {
    next();
    next();
  });

  const req = {};
  const res = createMockRes();
  await runner.runWithMiddlewares(req, res, [], async () => {
    finalCount++;
  });

  expect(finalCount).toBe(1);
});


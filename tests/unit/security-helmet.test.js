import { test, expect, createMockRes } from '../testkit.js';
import { helmet } from '../../dist/security/helmet.js';

function createReq() {
  return {
    header() {
      return undefined;
    },
  };
}

test('helmet() sets common security headers by default', () => {
  const mw = helmet();
  const req = createReq();
  const res = createMockRes();
  let nextCalled = false;

  mw(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(true);
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['x-frame-options']).toBe('DENY');
  expect(res.headers['referrer-policy']).toBeDefined();
});

test('helmet() can disable headers via options', () => {
  const mw = helmet({ xContentTypeOptions: false, xFrameOptions: false, strictTransportSecurity: false });
  const req = createReq();
  const res = createMockRes();

  mw(req, res, () => {});

  expect(res.headers['x-content-type-options']).toBeUndefined();
  expect(res.headers['x-frame-options']).toBeUndefined();
});


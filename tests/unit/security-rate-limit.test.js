import { test, expect, createMockRes } from '../testkit.js';
import { rateLimit, clearStore } from '../../dist/security/rate-limit.js';

function createReq(ip = '127.0.0.1') {
  return {
    ip,
    header() {
      return undefined;
    },
  };
}

test('rateLimit() allows up to max requests within window', () => {
  clearStore();
  const mw = rateLimit({ windowMs: 60000, max: 2 });

  const req = createReq('1.1.1.1');
  const res1 = createMockRes();
  const res2 = createMockRes();
  const res3 = createMockRes();

  let n1 = 0;
  let n2 = 0;
  let n3 = 0;

  mw(req, res1, () => { n1++; });
  mw(req, res2, () => { n2++; });
  mw(req, res3, () => { n3++; });

  expect(n1).toBe(1);
  expect(n2).toBe(1);
  expect(n3).toBe(0);
  expect(res3.statusCode).toBe(429);
  expect(res3.headers['retry-after']).toBeDefined();
});

test('rateLimit() is isolated by keyGenerator/ip', () => {
  clearStore();
  const mw = rateLimit({ windowMs: 60000, max: 1 });

  const reqA = createReq('2.2.2.2');
  const reqB = createReq('3.3.3.3');

  const resA1 = createMockRes();
  const resA2 = createMockRes();
  const resB1 = createMockRes();

  let a1 = 0;
  let a2 = 0;
  let b1 = 0;

  mw(reqA, resA1, () => { a1++; });
  mw(reqA, resA2, () => { a2++; });
  mw(reqB, resB1, () => { b1++; });

  expect(a1).toBe(1);
  expect(a2).toBe(0);
  expect(b1).toBe(1);
});


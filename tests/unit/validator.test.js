import { test, expect, createMockRes } from '../testkit.js';
import { validator as validatorMiddleware } from '../../dist/index.js';
import { isEmail, isPhone, isUrl, isUUID } from '../../dist/validation/validator.js';

test('Validation helpers accept expected formats', () => {
  expect(isEmail('ada@example.com')).toBe(true);
  expect(isEmail('nope')).toBe(false);

  expect(isUrl('https://example.com')).toBe(true);
  expect(isUrl('not a url')).toBe(false);

  expect(isUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
  expect(isUUID('not-uuid')).toBe(false);

  expect(isPhone('+1 (555) 123-4567')).toBe(true);
  expect(isPhone('abc')).toBe(false);
});

test('validator middleware rejects missing required fields', () => {
  const middleware = validatorMiddleware({
    name: { type: 'string', required: true, min: 2 },
  });

  const req = { body: {} };
  const res = createMockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(false);
  expect(res.statusCode).toBe(400);
  expect(res.payload?.error).toBe('Validation Failed');
});

test('validator middleware validates types and bounds', () => {
  const middleware = validatorMiddleware({
    name: { type: 'string', required: true, min: 2, max: 3 },
    age: { type: 'number', min: 18, max: 30 },
  });

  const req = { body: { name: 'A', age: 10 } };
  const res = createMockRes();

  middleware(req, res, () => {});

  expect(res.statusCode).toBe(400);
  expect(JSON.stringify(res.payload)).toContain('at least 2');
  expect(JSON.stringify(res.payload)).toContain('at least 18');
});

test('validator middleware supports enum and custom validation', () => {
  const middleware = validatorMiddleware({
    role: { type: 'string', enum: ['admin', 'user'] },
    email: { type: 'string', custom: (value) => isEmail(String(value)) },
  });

  const req = { body: { role: 'root', email: 'bad' } };
  const res = createMockRes();

  middleware(req, res, () => {});

  expect(res.statusCode).toBe(400);
  expect(JSON.stringify(res.payload)).toContain('must be one of');
  expect(JSON.stringify(res.payload)).toContain('email is invalid');
});

test('validator middleware attaches req.validated on success', () => {
  const middleware = validatorMiddleware({
    name: { type: 'string', required: true, min: 2 },
    age: { type: 'number' },
  });

  const req = { body: { name: 'Ada', age: 36 } };
  const res = createMockRes();
  let nextCalled = false;

  middleware(req, res, () => {
    nextCalled = true;
  });

  expect(nextCalled).toBe(true);
  expect(req.validated.name).toBe('Ada');
  expect(req.validated.age).toBe(36);
});


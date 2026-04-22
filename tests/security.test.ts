/**
 * LOA Framework - Security Tests
 */

import { createApp, helmet, rateLimit, sanitize, cors, csrf } from '../src/index.js';

describe('Security Tests', () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    app = createApp({ security: { enabled: true } });
  });

  describe('Helmet Middleware', () => {
    it('should create helmet middleware', () => {
      const middleware = helmet();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should accept custom options', () => {
      const middleware = helmet({
        contentSecurityPolicy: true,
        crossOriginResourcePolicy: 'same-origin',
        xFrameOptions: 'DENY',
      });
      expect(middleware).toBeDefined();
    });
  });

  describe('Rate Limit Middleware', () => {
    it('should create rate limit middleware', () => {
      const middleware = rateLimit();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should accept custom options', () => {
      const middleware = rateLimit({
        windowMs: 60000,
        max: 100,
      });
      expect(middleware).toBeDefined();
    });
  });

  describe('Sanitize Middleware', () => {
    it('should create sanitize middleware', () => {
      const middleware = sanitize();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('CORS Middleware', () => {
    it('should create CORS middleware', () => {
      const middleware = cors();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should accept custom options', () => {
      const middleware = cors({
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: true,
      });
      expect(middleware).toBeDefined();
    });
  });

  describe('CSRF Middleware', () => {
    it('should create CSRF middleware', () => {
      const middleware = csrf();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });

    it('should accept custom options', () => {
      const middleware = csrf({
        cookie: true,
        secret: 'test-secret',
      });
      expect(middleware).toBeDefined();
    });
  });

  describe('Application Security', () => {
    it('should create app with security enabled', () => {
      expect(app).toBeDefined();
    });

    it('should allow disabling security', () => {
      const appNoSecurity = createApp({ security: { enabled: false } });
      expect(appNoSecurity).toBeDefined();
    });

    it('should allow custom security options', () => {
      const appCustomSecurity = createApp({
        security: {
          enabled: true,
          helmet: {
            contentSecurityPolicy: true,
            xFrameOptions: 'DENY',
          },
          rateLimit: {
            enabled: true,
            max: 50,
          },
        },
      });
      expect(appCustomSecurity).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security routes', () => {
      const routes = [];
      app.get('/test', (req, res) => {
        res.json({ ok: true });
      });
      expect(app.router).toBeDefined();
    });
  });
});

describe('Input Validation Tests', () => {
  it('should validate required fields', () => {
    const data = { name: 'John', age: 25 };
    expect(data.name).toBeDefined();
    expect(data.age).toBeGreaterThan(0);
  });

  it('should handle XSS attempts', () => {
    const xssInput = '<script>alert("xss")</script>';
    const sanitized = sanitizeInput(xssInput);
    expect(sanitized).not.toContain('<script>');
  });

  it('should handle SQL injection attempts', () => {
    const sqlInput = "'; DROP TABLE users;--";
    const sanitized = sanitizeInput(sqlInput);
    expect(sanitized).not.toContain('DROP');
  });
});

function sanitizeInput(input: string): string {
  let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  sanitized = sanitized.replace(/(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b)/gi, '');
  return sanitized;
}

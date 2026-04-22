export interface Env {
  nodeEnv: string;
  host: string;
  port: number;
  debug: boolean;
  bodyLimit: string;
  requestTimeoutMs: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  corsOrigins: string[];
  docsKeys: string[];
  csrfSecret?: string;
}

export const env: Env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '127.0.0.1',
  port: readInt(process.env.PORT, 3000),
  debug: readBool(process.env.DEBUG, false),
  bodyLimit: process.env.BODY_LIMIT ?? '1mb',
  requestTimeoutMs: readInt(process.env.REQUEST_TIMEOUT_MS, 30000),
  rateLimitMax: readInt(process.env.RATE_LIMIT_MAX, 100),
  rateLimitWindowMs: readInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  corsOrigins: readList(process.env.CORS_ORIGINS),
  docsKeys: readList(process.env.DOCS_KEYS),
  csrfSecret: process.env.CSRF_SECRET,
};

function readInt(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBool(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return value === 'true' || value === '1';
}

function readList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

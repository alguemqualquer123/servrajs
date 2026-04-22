import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { performance } from 'node:perf_hooks';
import type {
  DocsOptions,
  DocsRoute,
  Handler,
  HttpMethod,
  LOARequest,
  LOAResponse,
} from '../core/types';
import { secureCompare, sha256 } from '../core/crypto';
import { renderDocsHtml } from './ui';

type InternalDocsOptions = Required<Omit<DocsOptions, 'security'>> & {
  security: {
    apiKeys: string[];
    headerName: string;
    storageKey: string;
    allowPublicAccess: boolean;
  };
};

interface RegisteredRoute {
  method: HttpMethod;
  path: string;
  handlerName?: string;
}

interface TryPayload {
  method?: unknown;
  path?: unknown;
  headers?: unknown;
  body?: unknown;
}

const DEFAULT_MAX_REQUEST_BYTES = 64 * 1024;
const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024;
const SAFE_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']);
const BLOCKED_TRY_HEADERS = new Set([
  'connection',
  'content-length',
  'cookie',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export class DocsManager {
  #options: InternalDocsOptions = normalizeOptions();
  readonly #routes = new Map<string, RegisteredRoute>();
  readonly #docs = new Map<string, DocsRoute>();

  configure(options: DocsOptions = {}): void {
    this.#options = normalizeOptions(options);
  }

  get options(): InternalDocsOptions {
    return this.#options;
  }

  registerRoute(route: RegisteredRoute): void {
    const key = routeKey(route.method, route.path);
    if (!this.#routes.has(key)) {
      this.#routes.set(key, route);
    }
  }

  documentRoute(route: DocsRoute): void {
    const path = normalizePath(route.path);
    const key = routeKey(route.method, path);
    this.#docs.set(key, {
      ...route,
      path,
      tags: route.tags?.length ? route.tags : ['default'],
    });
  }

  uiHandler(): Handler {
    return (_req: LOARequest, res: LOAResponse) => {
      res
        .header('Cache-Control', 'no-store')
        .header('Content-Security-Policy', [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data:",
          "connect-src 'self'",
          "frame-ancestors 'none'",
        ].join('; '))
        .html(renderDocsHtml(this.#options as Required<DocsOptions>));
    };
  }

  specHandler(): Handler {
    return (req: LOARequest, res: LOAResponse) => {
      if (!this.#isAuthorized(req)) {
        this.#sendUnauthorized(res);
        return;
      }

      res
        .header('Cache-Control', 'no-store')
        .json(this.buildSpec());
    };
  }

  tryHandler(): Handler {
    return async (req: LOARequest, res: LOAResponse) => {
      if (!this.#options.tryIt) {
        res.status(404).json({ error: 'Not Found', message: 'Try it is disabled', statusCode: 404 });
        return;
      }

      if (!this.#isAuthorized(req)) {
        this.#sendUnauthorized(res);
        return;
      }

      try {
        const payload = await readTryPayload(req, this.#options.maxRequestBytes);
        const response = await this.#executeTryRequest(req, payload);
        res.header('Cache-Control', 'no-store').json(response);
      } catch (error) {
        const candidate = error as Error & { statusCode?: number };
        res.status(candidate.statusCode ?? 400).json({
          error: 'Docs Try Failed',
          message: candidate.message,
          statusCode: candidate.statusCode ?? 400,
        });
      }
    };
  }

  buildSpec() {
    const routes = [...this.#routes.values()]
      .map((route) => this.#mergeRouteDocs(route))
      .filter((route) => !route.hidden)
      .filter((route) => !isDocsPath(route.path, this.#options.path))
      .sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`))
      .map((route) => ({
        id: routeKey(route.method, route.path),
        ...route,
      }));

    return {
      openapi: '3.1.0',
      info: {
        title: this.#options.title,
        version: this.#options.version,
        description: this.#options.description,
      },
      docs: {
        path: this.#options.path,
        tryIt: this.#options.tryIt,
      },
      security: {
        headerName: this.#options.security.headerName,
        storageKey: this.#options.security.storageKey,
      },
      routes,
      paths: toOpenApiPaths(routes),
    };
  }

  #mergeRouteDocs(route: RegisteredRoute): DocsRoute {
    const doc = this.#docs.get(routeKey(route.method, route.path));
    if (doc) {
      return {
        ...doc,
        method: route.method,
        path: route.path,
      };
    }

    return {
      method: route.method,
      path: route.path,
      summary: `${route.method} ${route.path}`,
      description: route.handlerName ? `Handler: ${route.handlerName}` : undefined,
      tags: ['default'],
      request: {
        contentType: 'application/json',
      },
      responses: {
        '200': {
          description: 'Successful response',
        },
      },
    };
  }

  #isAuthorized(req: LOARequest): boolean {
    if (this.#options.security.allowPublicAccess) {
      return true;
    }

    if (this.#options.security.apiKeys.length === 0) {
      return false;
    }

    const provided = getHeader(req, this.#options.security.headerName);
    if (!provided) {
      return false;
    }

    const providedHash = sha256(provided);
    return this.#options.security.apiKeys.some((key) => secureCompare(sha256(key), providedHash));
  }

  #sendUnauthorized(res: LOAResponse): void {
    res.status(401).json({
      error: 'Unauthorized',
      message: this.#options.security.apiKeys.length === 0
        ? 'Docs keys are not configured'
        : 'Invalid docs key',
      statusCode: 401,
    });
  }

  async #executeTryRequest(req: LOARequest, payload: TryPayload) {
    const method = String(payload.method ?? '').toUpperCase() as HttpMethod;
    if (!SAFE_METHODS.has(method)) {
      throw httpError(400, 'Invalid HTTP method');
    }

    const path = String(payload.path ?? '');
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
      throw httpError(400, 'Try path must be a same-origin relative path');
    }

    if (isDocsPath(path.split('?')[0] || '/', this.#options.path)) {
      throw httpError(400, 'Docs internal routes cannot be executed from try it');
    }

    const host = getHeader(req, 'host') || `${req.hostname}${req.port ? `:${req.port}` : ''}`;
    const protocol = req.secure ? 'https:' : 'http:';
    const url = new URL(path, `${protocol}//${host}`);
    const headers = sanitizeTryHeaders(payload.headers);
    const body = normalizeBody(payload.body);

    if (body.length > this.#options.maxRequestBytes) {
      throw httpError(413, 'Try request body is too large');
    }

    if (body && !headers['content-type']) {
      headers['content-type'] = 'application/json';
    }

    const startedAt = performance.now();
    const response = await sendHttpRequest(url, {
      method,
      headers,
      body,
      maxResponseBytes: this.#options.maxResponseBytes,
      timeoutMs: 30000,
    });

    return {
      ...response,
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function normalizeOptions(options: DocsOptions = {}): InternalDocsOptions {
  const apiKeys = options.security?.apiKeys ?? options.apiKeys ?? [];
  return {
    enabled: options.enabled ?? true,
    path: normalizePath(options.path ?? '/docs'),
    title: options.title ?? 'LOA API Docs',
    version: options.version ?? '1.0.0',
    description: options.description ?? 'Interactive API documentation',
    apiKeys,
    tryIt: options.tryIt ?? true,
    maxRequestBytes: options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES,
    maxResponseBytes: options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES,
    security: {
      apiKeys,
      headerName: normalizeHeaderName(options.security?.headerName ?? 'x-docs-key'),
      storageKey: options.security?.storageKey ?? 'loa_docs_key',
      allowPublicAccess: options.security?.allowPublicAccess ?? false,
    },
  };
}

function normalizePath(path: string): string {
  if (!path) return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function routeKey(method: HttpMethod, path: string): string {
  return `${method}:${normalizePath(path)}`;
}

function isDocsPath(path: string, docsPath: string): boolean {
  const normalized = normalizePath(path);
  return normalized === docsPath || normalized.startsWith(`${docsPath}/`);
}

function getHeader(req: LOARequest, name: string): string | undefined {
  const value = req.header(name);
  return Array.isArray(value) ? value[0] : value;
}

function normalizeHeaderName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'x-docs-key';
}

async function readTryPayload(req: LOARequest, limit: number): Promise<TryPayload> {
  if (req.body && Object.keys(req.body).length > 0) {
    return req.body as TryPayload;
  }

  const raw = await readRawBody(req, limit);
  if (!raw) return {};

  try {
    return JSON.parse(raw) as TryPayload;
  } catch {
    throw httpError(400, 'Try request body must be valid JSON');
  }
}

function readRawBody(req: LOARequest, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;

    req.raw.on('data', (chunk: Buffer) => {
      if (done) return;
      total += chunk.length;
      if (total > limit) {
        done = true;
        req.raw.destroy();
        reject(httpError(413, 'Try request body is too large'));
        return;
      }
      chunks.push(chunk);
    });

    req.raw.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });

    req.raw.on('error', (error) => {
      if (done) return;
      done = true;
      reject(error);
    });
  });
}

function sanitizeTryHeaders(headers: unknown): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return clean;
  }

  for (const [name, value] of Object.entries(headers as Record<string, unknown>)) {
    const headerName = normalizeHeaderName(name);
    if (!headerName || BLOCKED_TRY_HEADERS.has(headerName)) continue;
    if (typeof value !== 'string') continue;
    clean[headerName] = value.replace(/[\r\n\0]/g, '');
  }

  return clean;
}

function normalizeBody(body: unknown): string {
  if (body === undefined || body === null) return '';
  if (typeof body === 'string') return body;
  return JSON.stringify(body);
}

function sendHttpRequest(
  url: URL,
  options: {
    method: HttpMethod;
    headers: Record<string, string>;
    body: string;
    maxResponseBytes: number;
    timeoutMs: number;
  }
): Promise<{
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  truncated: boolean;
}> {
  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const req = transport(url, {
      method: options.method,
      headers: options.headers,
      timeout: options.timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      let truncated = false;

      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total <= options.maxResponseBytes) {
          chunks.push(chunk);
        } else if (!truncated) {
          const remaining = Math.max(0, options.maxResponseBytes - (total - chunk.length));
          if (remaining > 0) {
            chunks.push(chunk.subarray(0, remaining));
          }
          truncated = true;
        }
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          truncated,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(httpError(408, 'Try request timed out'));
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function toOpenApiPaths(routes: Array<DocsRoute & { id: string }>) {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const path = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = {
      summary: route.summary,
      description: route.description,
      tags: route.tags,
      deprecated: route.deprecated,
      responses: route.responses ?? {
        '200': {
          description: 'Successful response',
        },
      },
    };
  }

  return paths;
}

export function createDocsManager(options?: DocsOptions): DocsManager {
  const manager = new DocsManager();
  manager.configure(options);
  return manager;
}

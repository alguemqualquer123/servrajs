/**
 * Servra - Core Application
 */

import { createServer, Server, ServerResponse, IncomingMessage } from 'http';
import { Emitter } from './events';
import { randomUUID } from './crypto';

import type {
  HttpMethod,
  Handler,
  Middleware,
  ErrorHandler,
  AppOptions,
  DocsOptions,
  DocsRoute,
  Plugin,
} from './types';

import { createRequest } from '../request/index';
import { createResponse } from '../response/index';
import { createRouter, Router } from '../router/index';
import { MiddlewareRunner } from '../middleware/index';
import { SecurityManager } from '../security/index';
import { DocsManager } from '../docs/index';
import { createLogger, createDefaultLogger, Logger } from '../utils/index';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_BODY_LIMIT = '1mb';
const DEFAULT_REQUEST_TIMEOUT = 30000;
const DEFAULT_HEADERS_TIMEOUT = 10000;
const DEFAULT_KEEP_ALIVE_TIMEOUT = 5000;
const DEFAULT_MAX_HEADER_SIZE = 16 * 1024;
const DEFAULT_MAX_REQUESTS_PER_SOCKET = 1000;

interface ApplicationState {
  server: Server | null;
  running: boolean;
  errorHandler: ErrorHandler | null;
}

export class LOAApplication extends Emitter {
  readonly #options: AppOptions;
  readonly #router: Router;
  readonly #middleware: MiddlewareRunner;
  readonly #security: SecurityManager;
  readonly #docs: DocsManager;
  readonly #logger: Logger;
  readonly #state: ApplicationState;
  #requestCounter: number = 0;
  #server: Server | null = null;
  #docsRoutesRegistered: boolean = false;

  constructor(options: AppOptions = {}) {
    super();

    this.#options = {
      port: options.port ?? DEFAULT_PORT,
      host: options.host ?? DEFAULT_HOST,
      dev: options.dev ?? process.env.NODE_ENV !== 'production',
      debug: options.debug ?? false,
      security: {
        enabled: options.security?.enabled ?? true,
        bodyLimit: options.security?.bodyLimit ?? DEFAULT_BODY_LIMIT,
        timeout: options.security?.timeout ?? DEFAULT_REQUEST_TIMEOUT,
        trustedProxies: options.security?.trustedProxies ?? ['127.0.0.1', '::1'],
        helmet: options.security?.helmet,
        rateLimit: options.security?.rateLimit,
        cors: options.security?.cors,
        csrf: options.security?.csrf,
      },
      docs: options.docs,
      router: options.router,
      plugins: options.plugins,
    };

    this.#logger = this.#options.debug
      ? createLogger({ level: 'debug' })
      : createDefaultLogger();

    this.#router = createRouter({
      caseSensitive: this.#options.router?.caseSensitive ?? false,
      ignoreTrailingSlash: true,
      cacheSize: this.#options.router?.cacheSize ?? 1000,
    });

    this.#middleware = new MiddlewareRunner();
    this.#security = new SecurityManager(this.#options.security, this.#logger);
    this.#docs = new DocsManager();

    this.#state = {
      server: null,
      running: false,
      errorHandler: null,
    };

    this.use(this.#security.middleware());

    if (options.docs && options.docs.enabled !== false) {
      this.docs(options.docs);
    }

    if (this.#options.debug) {
      this.#logger.info('[SERVRA] Application initialized');
    }
  }

  #createServer(): Server {
    const timeout = this.#options.security?.timeout ?? DEFAULT_REQUEST_TIMEOUT;
    const server = createServer({
      maxHeaderSize: DEFAULT_MAX_HEADER_SIZE,
      requestTimeout: timeout,
    });

    server.requestTimeout = timeout;
    server.headersTimeout = Math.min(DEFAULT_HEADERS_TIMEOUT, timeout);
    server.keepAliveTimeout = DEFAULT_KEEP_ALIVE_TIMEOUT;
    server.maxRequestsPerSocket = DEFAULT_MAX_REQUESTS_PER_SOCKET;

    server.on('request', this.#handleRequest.bind(this));
    server.on('error', this.#handleServerError.bind(this));
    server.on('close', this.#handleServerClose.bind(this));

    return server;
  }

  async #handleRequest(
    rawReq: IncomingMessage,
    rawRes: ServerResponse
  ): Promise<void> {
    const requestId = this.#generateRequestId();
    const startTime = this.#options.debug ? process.hrtime.bigint() : 0n;

    try {
      const timeout = this.#options.security?.timeout ?? DEFAULT_REQUEST_TIMEOUT;
      rawReq.setTimeout(timeout, () => {
        if (!rawRes.headersSent && !rawRes.writableEnded) {
          rawRes.statusCode = 408;
          rawRes.setHeader('Content-Type', 'application/json');
          rawRes.setHeader('X-Request-ID', requestId);
          rawRes.end(JSON.stringify({
            error: 'Request Timeout',
            message: 'Request timed out',
            statusCode: 408,
            requestId,
          }));
        }
        rawReq.destroy();
      });

      const method = (rawReq.method?.toUpperCase() ?? 'GET') as HttpMethod;
      const requestUrl = rawReq.url ?? '/';
      const queryIndex = requestUrl.indexOf('?');
      const lookupPath = queryIndex === -1 ? requestUrl : requestUrl.slice(0, queryIndex);

      const req = createRequest(rawReq, {
        id: requestId,
        bodyLimit: this.#options.security?.bodyLimit ?? DEFAULT_BODY_LIMIT,
        trustedProxies: this.#options.security?.trustedProxies ?? ['127.0.0.1', '::1'],
        logger: this.#logger,
      });

      const res = createResponse(rawRes, {
        logger: this.#logger,
      });
      res.header('X-Request-ID', requestId);

      if (this.#options.debug) {
        this.emit('request', req, res);
      }

      const match = this.#router.lookup(method, lookupPath || '/');

      if (!match) {
        res.status(404).json({
          error: 'Not Found',
          message: `Cannot ${method} ${req.path}`,
          statusCode: 404,
          requestId,
        });
        return;
      }

      req.setParams(match.params);

      const middlewareStack = [...match.middlewares];
      await this.#middleware.runWithMiddlewares(
        req,
        res,
        middlewareStack,
        async () => {
          try {
            const result = await match.handler(req, res);

            if (result !== undefined && !res.sent) {
              if (typeof result === 'object') {
                res.json(result);
              } else {
                res.send(result);
              }
            }
          } catch (handlerError) {
            throw handlerError;
          }
        }
      );

      if (this.#options.debug) {
        const durationNs = Number(process.hrtime.bigint() - startTime);
        this.#logRequest(method, req.path, res.statusCode, durationNs);
      }

      if (this.#options.debug) {
        this.emit('response', req, res);
      }
    } catch (error) {
      await this.#handleError(error as Error, rawReq, rawRes, requestId);
    }
  }

  async #handleError(
    error: Error,
    rawReq: IncomingMessage,
    rawRes: ServerResponse,
    requestId: string
  ): Promise<void> {
    if (this.#options.debug) { this.#logger.error(`[SERVRA] Request error: ${error.message}`, error.stack); } else { this.#logger.debug(`[SERVRA] Request error: ${error.message}`); }

    if (this.#state.errorHandler) {
      try {
        const req = createRequest(rawReq, {
          id: requestId,
          bodyLimit: this.#options.security?.bodyLimit ?? DEFAULT_BODY_LIMIT,
          trustedProxies: this.#options.security?.trustedProxies ?? ['127.0.0.1', '::1'],
          logger: this.#logger,
        });
        const res = createResponse(rawRes, { logger: this.#logger });
        res.header('X-Request-ID', requestId);

        await this.#state.errorHandler(error, req, res, () => {});
        if (!res.sent && !rawRes.writableEnded) {
          this.#sendErrorResponse(rawRes, requestId, error);
        }
      } catch {
        this.#sendErrorResponse(rawRes, requestId, error);
      }
    } else {
      this.#sendErrorResponse(rawRes, requestId, error);
    }

    this.emit('error', error);
  }

  #sendErrorResponse(rawRes: ServerResponse, requestId: string, error?: Error): void {
    if (rawRes.headersSent || rawRes.writableEnded) {
      return;
    }

    const statusCode = getErrorStatusCode(error);
    const exposeMessage = statusCode < 500 || this.#options.dev;
    const message = exposeMessage && error?.message
      ? error.message
      : 'An error occurred';

    rawRes.statusCode = statusCode;
    rawRes.setHeader('Content-Type', 'application/json');
    rawRes.setHeader('Cache-Control', 'no-store');
    rawRes.setHeader('X-Request-ID', requestId);
    rawRes.end(
      JSON.stringify({
        error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
        message,
        statusCode,
        requestId,
      })
    );
  }

  #handleServerError(error: Error): void {
    if (this.#options.debug) { this.#logger.debug(`[SERVRA] Server error: ${error.message}`); } else { this.#logger.error(`[SERVRA] Server error: ${error.message}`); }
    this.emit('error', error);
  }

  #handleServerClose(): void {
    this.#state.running = false;
    if (this.#options.debug) {
      this.#logger.info('[SERVRA] Server closed');
    }
    this.emit('close');
  }

  #generateRequestId(): string {
    this.#requestCounter++;
    return this.#options.debug
      ? randomUUID()
      : this.#requestCounter.toString(36);
  }

  #logRequest(
    method: string,
    path: string,
    statusCode: number,
    durationNs: number
  ): void {
    const durationMs = durationNs / 1e6;
    
    if (this.#options.debug || durationMs > 100) {
      this.#logger.debug(
        `[SERVRA] ${method} ${path} ${statusCode} ${durationMs.toFixed(2)}ms`
      );
    }
  }

  get(path: string, handler: Handler): this;
  get(path: string, middleware: Middleware, handler: Handler): this;
  get(path: string, middlewares: Middleware[], handler: Handler): this;
  get(
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    return this.#addRoute('GET', path, middlewareOrHandler, handler);
  }

  post(path: string, handler: Handler): this;
  post(path: string, middleware: Middleware, handler: Handler): this;
  post(path: string, middlewares: Middleware[], handler: Handler): this;
  post(
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    return this.#addRoute('POST', path, middlewareOrHandler, handler);
  }

  put(path: string, handler: Handler): this;
  put(path: string, middleware: Middleware, handler: Handler): this;
  put(path: string, middlewares: Middleware[], handler: Handler): this;
  put(
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    return this.#addRoute('PUT', path, middlewareOrHandler, handler);
  }

  patch(path: string, handler: Handler): this;
  patch(path: string, middleware: Middleware, handler: Handler): this;
  patch(path: string, middlewares: Middleware[], handler: Handler): this;
  patch(
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    return this.#addRoute('PATCH', path, middlewareOrHandler, handler);
  }

  delete(path: string, handler: Handler): this;
  delete(path: string, middleware: Middleware, handler: Handler): this;
  delete(path: string, middlewares: Middleware[], handler: Handler): this;
  delete(
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    return this.#addRoute('DELETE', path, middlewareOrHandler, handler);
  }

  options(path: string, handler: Handler): this;
  options(path: string, middleware: Middleware, handler: Handler): this;
  options(path: string, middlewares: Middleware[], handler: Handler): this;
  options(
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    return this.#addRoute('OPTIONS', path, middlewareOrHandler, handler);
  }

  head(path: string, handler: Handler): this;
  head(path: string, middleware: Middleware, handler: Handler): this;
  head(path: string, middlewares: Middleware[], handler: Handler): this;
  head(
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    return this.#addRoute('HEAD', path, middlewareOrHandler, handler);
  }

  #addRoute(
    method: HttpMethod,
    path: string,
    middlewareOrHandler: Middleware | Middleware[] | Handler,
    handler?: Handler
  ): this {
    let middlewares: Middleware[] = [];
    let actualHandler: Handler;

    if (handler) {
      middlewares = Array.isArray(middlewareOrHandler)
        ? middlewareOrHandler
        : [middlewareOrHandler as Middleware];
      actualHandler = handler;
    } else {
      middlewares = [];
      actualHandler = middlewareOrHandler as Handler;
    }

    if (!actualHandler || typeof actualHandler !== 'function') {
      throw new Error(`Handler must be a function for ${method} ${path}`);
    }

    this.#router.add(method, path, actualHandler, middlewares);
    this.#docs.registerRoute({
      method,
      path: this.#resolveRoutePath(path),
      handlerName: actualHandler.name,
    });

    if (this.#options.debug) {
      this.#logger.info(`[SERVRA] Route registered: ${method} ${path}`);
    }
    this.emit('route', method, path, actualHandler);

    return this;
  }

  group(prefix: string, callback: () => void): this {
    const originalPrefix = this.#router.getPrefix();
    this.#router.setPrefix(prefix);
    callback();
    this.#router.setPrefix(originalPrefix);
    return this;
  }

  version(prefix: string, callback: () => void): this {
    return this.group(`/api${prefix}`, callback);
  }

  use(middleware: Middleware | Middleware[]): this {
    const middlewares = Array.isArray(middleware) ? middleware : [middleware];
    
    for (const mw of middlewares) {
      if (typeof mw !== 'function') {
        throw new Error('Middleware must be a function');
      }
      this.#middleware.use(mw);
      this.emit('middleware', mw);
    }

    this.#logger.debug(`[SERVRA] Middleware registered: ${middlewares.length}`);
    return this;
  }

  docs(options: DocsOptions = {}): this {
    if (options.enabled === false) {
      return this;
    }

    this.#docs.configure(options);

    if (this.#docsRoutesRegistered) {
      return this;
    }

    const docsPath = this.#docs.options.path;
    this.get(docsPath, this.#docs.uiHandler());
    this.get(`${docsPath}/spec.json`, this.#docs.specHandler());
    this.get(`${docsPath}/openapi.json`, this.#docs.specHandler());
    this.post(`${docsPath}/try`, this.#docs.tryHandler());
    this.#docsRoutesRegistered = true;

    return this;
  }

  documentRoute(route: DocsRoute): this {
    this.#docs.documentRoute(route);
    return this;
  }

  getOpenApiSpec(): {
    openapi: string;
    info: Record<string, unknown>;
    paths: Record<string, unknown>;
    [key: string]: unknown;
  } {
    return this.#docs.buildSpec();
  }

  setErrorHandler(handler: ErrorHandler): this {
    this.#state.errorHandler = handler;
    return this;
  }

  async plugin(plugin: Plugin): Promise<this> {
    if (!plugin.name || !plugin.register) {
      throw new Error('Plugin must have name and register function');
    }

    this.#logger.info(`[SERVRA] Registering plugin: ${plugin.name}`);
    
    await plugin.register(this);
    this.emit('plugin', plugin);

    return this;
  }

  async listen(port: number, hostname?: string): Promise<Server> {
    const listenPort = port ?? this.#options.port ?? DEFAULT_PORT;
    const listenHost = hostname ?? this.#options.host ?? DEFAULT_HOST;

    return new Promise((resolve, reject) => {
      try {
        if (!this.#server) {
          this.#server = this.#createServer();
        }

        this.#server.listen(listenPort, listenHost, () => {
          this.#state.running = true;
          if (this.#options.debug) {
            this.#logger.info(`[SERVRA] Server listening on http://${listenHost}:${listenPort}`);
          }
          this.emit('start', this.#server);
          resolve(this.#server);
        });

        this.#server.on('error', (error: Error) => {
          this.#logger.error(`[SERVRA] Server error: ${error.message}`);
          reject(error);
        });
      } catch (error) {
        reject(error as Error);
      }
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.#server) {
        resolve();
        return;
      }

      this.#server.close((error) => {
        if (error) {
          this.#logger.error(`[SERVRA] Error closing server: ${error.message}`);
          reject(error);
        } else {
          this.#server = null;
          if (this.#options.debug) {
if (this.#options.debug) { this.#logger.debug(`[SERVRA] Server closed`); } else { this.#logger.info('[SERVRA] Server closed'); }
          }
          resolve();
        }
      });
    });
  }

  get server(): Server | null {
    return this.#server;
  }

  get running(): boolean {
    return this.#state.running;
  }

  get router(): Router {
    return this.#router;
  }

  get logger(): Logger {
    return this.#logger;
  }

  #resolveRoutePath(path: string): string {
    const prefix = this.#router.getPrefix();
    const normalizedPath = normalizePath(path);

    if (!prefix) {
      return normalizedPath;
    }

    const normalizedPrefix = normalizePath(prefix);
    if (normalizedPath === normalizedPrefix || normalizedPath.startsWith(`${normalizedPrefix}/`)) {
      return normalizedPath;
    }

    return normalizePath(`${normalizedPrefix}/${normalizedPath.replace(/^\//, '')}`);
  }
}

export function createApp(options: AppOptions = {}): LOAApplication {
  return new LOAApplication(options);
}

function getErrorStatusCode(error?: Error): number {
  const candidate = error as (Error & { statusCode?: number; status?: number }) | undefined;
  const statusCode = candidate?.statusCode ?? candidate?.status;

  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }

  return 500;
}

function normalizePath(path: string): string {
  if (!path) return '/';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.length > 1 && normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

export default LOAApplication;

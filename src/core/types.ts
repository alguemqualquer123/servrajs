/**
 * LOA Framework - Core TypeScript Types
 * 
 * Defines all types needed for the framework to ensure
 * maximum type safety and developer experience.
 */

import { IncomingMessage, Server, ServerResponse } from 'http';
import { Readable } from 'stream';

export interface EventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): this;
  once(event: string, listener: (...args: unknown[]) => void): this;
  off(event: string, listener: (...args: unknown[]) => void): this;
  emit(event: string, ...args: unknown[]): boolean;
  removeAllListeners(event?: string): this;
}

// ============================================================================
// HTTP Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';

export type HttpStatusCode =
  | 200 | 201 | 204
  | 301 | 302 | 304 | 307 | 308
  | 400 | 401 | 403 | 404 | 405 | 408 | 409 | 413 | 422 | 429
  | 500 | 502 | 503 | 504;

export interface HttpHeaders {
  [key: string]: string | string[] | undefined;
}

// ============================================================================
// Request Types
// ============================================================================

export interface RequestParams {
  [key: string]: string;
}

export interface RequestQuery {
  [key: string]: string | string[] | undefined;
}

export interface RequestBody {
  [key: string]: unknown;
}

export interface ParsedCookies {
  [key: string]: string;
}

export interface RequestOptions {
  method: string;
  url: string;
  path: string;
  pathNormalized: string;
  headers: HttpHeaders;
  params: RequestParams;
  query: RequestQuery;
  body: RequestBody;
  cookies: ParsedCookies;
  ip: string;
  ips: string[];
  protocol: string;
  hostname: string;
  port?: number;
  secure: boolean;
  xhr: boolean;
  originalUrl: string;
  methodUpper: HttpMethod;
  httpVersion: string;
  readonly raw: IncomingMessage;
}

export interface LOARequest extends EventEmitter {
  readonly id: string;
  readonly params: RequestParams;
  readonly query: RequestQuery;
  readonly body: RequestBody;
  readonly headers: HttpHeaders;
  readonly cookies: ParsedCookies;
  readonly method: HttpMethod;
  readonly path: string;
  readonly url: string;
  readonly ip: string;
  readonly ips: string[];
  readonly protocol: string;
  readonly hostname: string;
  readonly port?: number;
  readonly secure: boolean;
  readonly xhr: boolean;
  readonly originalUrl: string;
  readonly httpVersion: string;
  readonly raw: IncomingMessage;

  header(name: string, value?: string): string | string[] | undefined;
  param(name: string, defaultValue?: string): string;
  cookie(name: string): string | undefined;
  setBody(body: RequestBody): void;
}

// ============================================================================
// Response Types
// ============================================================================

export interface CookieOptions {
  domain?: string;
  encode?: (val: string) => string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
}

export interface ResponseOptions {
  statusCode: number;
  headers: HttpHeaders;
  sent: boolean;
}

export interface LOAResponse extends EventEmitter {
  readonly statusCode: number;
  readonly headers: HttpHeaders;
  readonly sent: boolean;
  readonly raw: ServerResponse;

  status(code: number): this;
  writeHead(code: number, headers?: HttpHeaders): this;
  send(data?: unknown): this;
  json(data: unknown): this;
  html(data: string): this;
  redirect(url: string, status?: number): this;
  header(name: string, value: string): this;
  cookie(name: string, value: string, options?: CookieOptions): this;
  clearCookie(name: string, options?: CookieOptions): this;
  stream(stream: Readable): this;
  download(path: string, filename?: string): this;
  type(contentType: string): this;
}

// ============================================================================
// Handler Types
// ============================================================================

export type Handler = (req: LOARequest, res: LOAResponse) => unknown;

export type Middleware = (req: LOARequest, res: LOAResponse, next: NextFunction) => unknown;

export type ErrorHandler = (err: Error, req: LOARequest, res: LOAResponse, next: NextFunction) => unknown;

export type NextFunction = (error?: Error) => void;

// ============================================================================
// Route Types
// ============================================================================

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: Handler;
  middlewares: Middleware[];
  version?: string;
}

export interface DocsSecurityOptions {
  apiKeys?: string[];
  headerName?: string;
  storageKey?: string;
  allowPublicAccess?: boolean;
}

export interface DocsOptions {
  enabled?: boolean;
  path?: string;
  title?: string;
  version?: string;
  description?: string;
  security?: DocsSecurityOptions;
  apiKeys?: string[];
  tryIt?: boolean;
  maxRequestBytes?: number;
  maxResponseBytes?: number;
}

export interface DocsExample {
  summary?: string;
  value: unknown;
}

export interface DocsRequestModel {
  description?: string;
  contentType?: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  params?: Record<string, unknown>;
  body?: unknown;
  examples?: DocsExample[];
}

export interface DocsResponseModel {
  description?: string;
  headers?: Record<string, string>;
  body?: unknown;
  examples?: DocsExample[];
}

export interface DocsRoute {
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  request?: DocsRequestModel;
  responses?: Record<string, DocsResponseModel>;
  deprecated?: boolean;
  hidden?: boolean;
}

export interface RouteMatch {
  handler: Handler;
  middlewares: Middleware[];
  params: RequestParams;
}

// ============================================================================
// Middleware Types
// ============================================================================

export interface MiddlewareDefinition {
  handler: Middleware;
  global: boolean;
}

export interface MiddlewareStack {
  use(middleware: Middleware | Middleware[]): void;
  run(req: LOARequest, res: LOAResponse): Promise<void>;
}

// ============================================================================
// Plugin Types
// ============================================================================

export interface Plugin {
  name: string;
  version: string;
  register(app: LOAApp): Promise<void> | void;
}

export interface PluginManager {
  register(plugin: Plugin): Promise<void>;
  unregister(name: string): Promise<void>;
  get(name: string): Plugin | undefined;
  list(): Plugin[];
}

// ============================================================================
// Security Types
// ============================================================================

export interface SecurityOptions {
  enabled: boolean;
  helmet: HelmetOptions;
  rateLimit: RateLimitOptions;
  cors: CORSOptions;
  csrf: CSRFOptions;
  bodyLimit: string;
  timeout: number;
  trustedProxies: string[];
}

export interface HelmetOptions {
  contentSecurityPolicy: boolean | Record<string, string>;
  crossOriginEmbedderPolicy: boolean;
  crossOriginOpenerPolicy: boolean;
  crossOriginResourcePolicy: boolean | string;
  originAgentCluster: boolean;
  referrerPolicy: boolean | string;
  strictTransportSecurity: boolean | Record<string, string | number>;
  xContentTypeOptions: boolean;
  xDownloadOptions: boolean;
  xFrameOptions: boolean | string;
  xPermittedCrossDomainPolicies: boolean | string;
  xXSSProtection: boolean | string;
  permissionsPolicy: boolean | Record<string, string[]>;
}

export interface RateLimitOptions {
  enabled: boolean;
  windowMs: number;
  max: number;
  message: string | object;
  statusCode: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  storeLimit: number;
  keyGenerator: (req: LOARequest) => string;
  handler: (req: LOARequest, res: LOAResponse) => void;
}

export interface CORSOptions {
  enabled: boolean;
  origin: string | string[] | ((origin: string) => boolean) | undefined;
  methods: string[];
  allowedHeaders: (string | string[])[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
}

export interface CSRFOptions {
  enabled: boolean;
  cookie: boolean;
  secret: string;
  header: string;
  tokenGetter: (req: LOARequest) => string;
  cookieOptions: CookieOptions;
}

export interface SecurityConfig extends Partial<Omit<SecurityOptions, 'helmet' | 'rateLimit' | 'cors' | 'csrf'>> {
  helmet?: Partial<HelmetOptions>;
  rateLimit?: Partial<RateLimitOptions>;
  cors?: Partial<CORSOptions>;
  csrf?: Partial<CSRFOptions>;
}

// ============================================================================
// Validation Types
// ============================================================================

export type ValidationSchema = ZodSchema | object;

export interface ZodSchema {
  _def: unknown;
  safeParse: (data: unknown) => { success: boolean; data?: unknown; errors?: unknown[] };
}

export interface ValidationResult {
  success: boolean;
  data?: unknown;
  errors?: ValidationError[];
}

export interface ValidationError {
  path: string;
  message: string;
  code: string;
}

// ============================================================================
// Application Types
// ============================================================================

export interface AppOptions {
  port?: number;
  host?: string;
  dev?: boolean;
  debug?: boolean;
  security?: SecurityConfig;
  docs?: DocsOptions;
  router?: Partial<RouterOptions>;
  plugins?: Plugin[];
}

export interface RouterOptions {
  caseSensitive: boolean;
  cacheSize: number;
  ignoreTrailingSlash: boolean;
  ignoreDuplicateParams: boolean;
}

export interface LOAApp extends EventEmitter {
  // Route methods
  get(path: string, handler: Handler): this;
  post(path: string, handler: Handler): this;
  put(path: string, handler: Handler): this;
  patch(path: string, handler: Handler): this;
  delete(path: string, handler: Handler): this;
  options(path: string, handler: Handler): this;

  // Grouping
  group(prefix: string, callback: () => void): this;
  version(prefix: string, callback: () => void): this;

  // Middleware
  use(middleware: Middleware | Middleware[]): this;

  // Documentation
  docs(options?: DocsOptions): this;
  documentRoute(route: DocsRoute): this;

  // Error handling
  setErrorHandler(handler: ErrorHandler): this;

  // Lifecycle
  listen(port: number, hostname?: string): Promise<Server>;
  close(): Promise<void>;

  // Plugins
  plugin(plugin: Plugin): Promise<this>;
}

// ============================================================================
// Server Types
// ============================================================================

export interface ServerOptions {
  requestTimeout: number;
  connections: {
    highWaterMark: number;
  };
  keepAlive: boolean;
  keepAliveInitialDelay: number;
  maxHeadersSize: number;
}

export interface ServerConfig {
  port: number;
  host: string;
  options: ServerOptions;
}

// ============================================================================
// Events
// ============================================================================

export interface AppEvents {
  'request': (req: LOARequest, res: LOAResponse) => void;
  'response': (req: LOARequest, res: LOAResponse) => void;
  'error': (error: Error, req: LOARequest, res: LOAResponse) => void;
  'start': (server: Server) => void;
  'close': () => void;
  'route': (method: HttpMethod, path: string, handler: Handler) => void;
  'middleware': (middleware: Middleware) => void;
  'plugin': (plugin: Plugin) => void;
}

// ============================================================================
// Utilities
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Constructor<T = unknown> = new (...args: unknown[]) => T;

export type PromiseVoid = Promise<void> | void;

// ============================================================================
// Logger Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

export interface LoggerOptions {
  level: LogLevel;
  prefix?: string;
  timestamp: boolean;
}

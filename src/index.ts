/**
 * Servra - Main Export
 */

import { createApp, LOAApplication } from './core/application';

export { createApp, LOAApplication };

export type {
  HttpMethod,
  HttpStatusCode,
  HttpHeaders,
  RequestParams,
  RequestQuery,
  RequestBody,
  ParsedCookies,
  Handler,
  Middleware,
  ErrorHandler,
  NextFunction,
  AppOptions,
  LOAApp,
  ServraApp,
  ServraRequest,
  ServraResponse,
  DocsOptions,
  DocsSecurityOptions,
  DocsRoute,
  DocsRequestModel,
  DocsResponseModel,
  DocsExample,
  SecurityOptions,
  SecurityConfig,
  HelmetOptions,
  RateLimitOptions,
  CORSOptions,
  CSRFOptions,
  CookieOptions,
} from './core/types';

export { createRouter, Router } from './router/index';
export { createRequest } from './request/index';
export { createResponse } from './response/index';

export type { LOARequest } from './request/index';
export type { LOAResponse } from './response/index';

export { MiddlewareRunner } from './middleware/index';
export { bodyParser, queryParser, cors, timeout } from './middleware/runner';
export { proxyProtection, fileSizeLimit } from './middleware/advanced';

export { SecurityManager, helmet, rateLimit, sanitize, csrf, cors as securityCors } from './security/index';
export { DocsManager, createDocsManager } from './docs/index';

export { validator, createSchema } from './validation/index';

export { createLogger, createDefaultLogger } from './utils/index';
export type { Logger, LogLevel } from './utils/index';

export { PluginManager, openApiScalar } from './plugins/index';
export type { OpenApiScalarOptions } from './plugins/index';

export const name = 'servra';
export const version = '1.0.0';
export const description = 'Lightweight Optimized Application - Ultrafast, Secure, Modern backend framework';

export default {
  createApp,
  LOAApplication,
  name,
  version,
  description,
};

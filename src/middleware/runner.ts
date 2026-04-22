/**
 * LOA Framework - Middleware Runner
 * 
 * Executes middleware stack in order, with support for:
 * - Synchronous and async middlewares
 * - Error middleware
 * - Early exit (short-circuit)
 */

import type { Middleware, NextFunction, LOARequest, LOAResponse, ErrorHandler } from '../core/types';
import type { RequestBody } from '../core/types';
import type { IncomingMessage } from 'http';

function parseFormData(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// ============================================================================
// Middleware Runner
// ============================================================================

export class MiddlewareRunner {
  // Global middlewares
  readonly #global: Middleware[] = [];

  // Error handlers
  #errorHandlers: ErrorHandler[] = [];

  // ========================================================================
  // Registration
  // ========================================================================

  /**
   * Add global middleware
   */
  use(middleware: Middleware): void {
    this.#global.push(middleware);
  }

  /**
   * Add error handler
   */
  useErrorHandler(handler: ErrorHandler): void {
    this.#errorHandlers.push(handler);
  }

  // ========================================================================
  // Execution
  // ========================================================================

  /**
   * Run middlewares with completion callback
   * 
   * @performance Optimized for:
   * - No array copies in hot path
   * - Early exit on error
   * - Async/await for clean code
   */
  async runWithMiddlewares(
    req: LOARequest,
    res: LOAResponse,
    routeMiddlewares: Middleware[],
    finalHandler: () => Promise<void>
  ): Promise<void> {
    const globalLength = this.#global.length;
    const routeLength = routeMiddlewares.length;
    const totalLength = globalLength + routeLength;

    if (totalLength === 0) {
      await finalHandler();
      return;
    }

    // Create next function with error parameter
    const next: NextFunction = async (error?: Error) => {
      // Handle error
      if (error) {
        await this.#handleError(error, req, res);
        return;
      }

      // Get current index from request (stored as symbol)
      const index = (req as unknown as { [key: string]: number }).middlewareIndex ?? 0;

      // Check if all middlewares executed
      if (index >= totalLength) {
        // Call final handler
        await finalHandler();
        return;
      }

      // Execute next middleware
      const middleware = index < globalLength
        ? this.#global[index]
        : routeMiddlewares[index - globalLength];
      
      // Increment index for next call
      (req as unknown as { [key: string]: number }).middlewareIndex = index + 1;

      try {
        // Execute middleware
        const result = middleware(req, res, next);

        // Handle async middlewares
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        // Pass error to next
        await next(error as Error);
      }
    };

    // Start middleware execution
    await next();
  }

  /**
   * Run middlewares without route-specific middlewares
   */
  async run(req: LOARequest, res: LOAResponse): Promise<void> {
    const next: NextFunction = async (error?: Error) => {
      if (error) {
        await this.#handleError(error, req, res);
        return;
      }

      const index = (req as unknown as { [key: string]: number }).middlewareIndex ?? 0;

      if (index >= this.#global.length) {
        return;
      }

      const middleware = this.#global[index];
      (req as unknown as { [key: string]: number }).middlewareIndex = index + 1;

      try {
        await middleware(req, res, next);
      } catch (error) {
        await next(error as Error);
      }
    };

    await next();
  }

  // ========================================================================
  // Error Handling
  // ========================================================================

  async #handleError(error: Error, req: LOARequest, res: LOAResponse): Promise<void> {
    // Try error handlers in order
    for (const handler of this.#errorHandlers) {
      try {
        await handler(error, req, res, () => {});
      } catch {
        // Continue to next handler
      }
    }

    // If no error handlers, send generic error response
    if (!res.sent) {
      const statusCode = getErrorStatusCode(error);
      res.status(statusCode).json({
        error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
        message: statusCode >= 500 ? 'An error occurred' : error.message,
        statusCode,
        requestId: req.id,
      });
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  get middlewares(): Middleware[] {
    return [...this.#global];
  }

  get errorHandlers(): ErrorHandler[] {
    return [...this.#errorHandlers];
  }

  clear(): void {
    this.#global.length = 0;
    this.#errorHandlers.length = 0;
  }
}

// ============================================================================
// Common Middleware Factory Functions
// ============================================================================

/**
 * Creates body parser middleware
 */
export function bodyParser(options: {
  limit?: string;
  strict?: boolean;
} = {}): Middleware {
  return async (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    try {
      const contentType = req.header('content-type') ?? '';
      const bodyLimit = parseLimit(options.limit ?? '1mb');

      // Only parse JSON or form data
      if (!contentType.includes('application/json') && 
          !contentType.includes('application/x-www-form-urlencoded')) {
        next();
        return;
      }

      const contentLength = getHeaderValue(req.header('content-length'));
      if (contentLength && Number.parseInt(contentLength, 10) > bodyLimit) {
        res.status(413).json({
          error: 'Payload Too Large',
          message: `Request body exceeds maximum size of ${bodyLimit} bytes`,
          statusCode: 413,
          requestId: req.id,
        });
        return;
      }

      // Read body
      const body = await readStream(req.raw, bodyLimit);
      
      let parsed: unknown = {};

      if (contentType.includes('application/json')) {
        if (options.strict !== false && body.trim() &&
            !body.trim().startsWith('{') && !body.trim().startsWith('[')) {
          throw createHttpError(400, 'JSON body must be an object or array');
        }
        parsed = JSON.parse(body || '{}');
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        parsed = parseFormData(body || '');
      }

      req.setBody(parsed as RequestBody);
      next();
    } catch (error) {
      next(error as Error);
    }
  };
}

/**
 * Creates query parser middleware
 */
export function queryParser(): Middleware {
  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    // Query is already parsed lazily in request
    next();
  };
}

/**
 * Creates cors middleware
 */
export function cors(options: {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  credentials?: boolean;
} = {}): Middleware {
  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    const originHeader = req.header('origin');
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;

    // Handle preflight
    if (req.method === 'OPTIONS') {
      if (options.origin) {
        const allowedOrigin = Array.isArray(options.origin) 
          ? options.origin 
          : [options.origin];
        
        if (origin && allowedOrigin.includes(origin)) {
          res.header('Access-Control-Allow-Origin', origin);
        }
      }

      if (options.methods) {
        res.header('Access-Control-Allow-Methods', options.methods.join(','));
      }

      res.header('Access-Control-Max-Age', '86400');
      res.status(204).send();
      return;
    }

    // Set CORS headers
    if (options.origin && origin) {
      if (typeof options.origin === 'function') {
        if (options.origin(origin)) {
          res.header('Access-Control-Allow-Origin', origin);
        }
      } else {
        const allowedOrigins = Array.isArray(options.origin) 
          ? options.origin 
          : [options.origin];
        
        if (allowedOrigins.includes(origin)) {
          res.header('Access-Control-Allow-Origin', origin);
        }
      }
    }

    if (options.credentials) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    next();
  };
}

/**
 * Creates request timeout middleware
 */
export function timeout(timeout: number): Middleware {
  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    setTimeout(() => {
      if (!res.sent) {
        res.status(408).json({
          error: 'Request Timeout',
          message: `Request timed out after ${timeout}ms`,
          statusCode: 408,
        });
      }
    }, timeout);

    next();
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

function parseLimit(limit: string): number {
  const match = limit.match(/^(\d+)(b|kb|mb|gb)?$/i);
  if (!match) return 1024 * 1024;

  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'b').toLowerCase();

  switch (unit) {
    case 'kb': return value * 1024;
    case 'mb': return value * 1024 * 1024;
    case 'gb': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

async function readStream(stream: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;

    stream.on('data', (chunk: Buffer) => {
      if (done) return;

      chunks.push(chunk);
      total += chunk.length;
      
      if (total > limit) {
        done = true;
        stream.destroy();
        reject(createHttpError(413, 'Payload too large'));
      }
    });

    stream.on('end', () => {
      if (done) return;
      done = true;
      resolve(Buffer.concat(chunks).toString());
    });

    stream.on('error', (error) => {
      if (done) return;
      done = true;
      reject(error);
    });
  });
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function createHttpError(statusCode: number, message: string): Error {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

function getErrorStatusCode(error: Error): number {
  const candidate = error as Error & { statusCode?: number; status?: number };
  const statusCode = candidate.statusCode ?? candidate.status;

  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }

  return 500;
}

// ============================================================================
// Export
// ============================================================================

export default MiddlewareRunner;

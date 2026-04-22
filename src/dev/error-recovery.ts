/**
 * Servra - Error Recovery
 * 
 * Error recovery middleware with fallback handlers.
 */

import type { Middleware, Handler, LOARequest, LOAResponse } from '../core/types';

export interface ErrorRecoveryOptions {
  retries?: number;
  retryDelay?: number;
  exponentialBackoff?: boolean;
  fallback?: Handler;
  onError?: (error: Error, req: LOARequest) => void;
  logErrors?: boolean;
}

export interface RecoveryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 100;

export function withErrorRecovery(
  handler: Handler,
  options: ErrorRecoveryOptions = {}
): Handler {
  const opts = {
    retries: options.retries ?? DEFAULT_RETRIES,
    retryDelay: options.retryDelay ?? DEFAULT_RETRY_DELAY,
    exponentialBackoff: options.exponentialBackoff ?? true,
    fallback: options.fallback,
    onError: options.onError ?? (() => {}),
    logErrors: options.logErrors ?? true,
  };

  return async (req: LOARequest, res: LOAResponse): Promise<unknown> => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= opts.retries; attempt++) {
      try {
        const result = await handler(req, res);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (opts.logErrors) {
          opts.onError(lastError, req);
        }

        if (attempt < opts.retries) {
          const delay = opts.exponentialBackoff
            ? opts.retryDelay * Math.pow(2, attempt)
            : opts.retryDelay;

          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    if (opts.fallback) {
      try {
        return await opts.fallback(req, res);
      } catch (fallbackError) {
        throw fallbackError;
      }
    }

    throw lastError;
  };
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  errorMessage?: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(errorMessage || 'Operation timed out')),
        timeout
      )
    ),
  ]);
}

export function withFallback<T>(
  primary: () => T | Promise<T>,
  fallback: () => T | Promise<T>
): () => Promise<T> {
  return async (): Promise<T> => {
    try {
      return await primary();
    } catch {
      return fallback();
    }
  };
}

export function safeAsync<T>(
  fn: () => Promise<T>
): Promise<RecoveryResult<T>> {
  return fn()
    .then(value => ({ success: true, value }))
    .catch(error => ({ success: false, error: error as Error }));
}

export function safeSync<T>(fn: () => T): RecoveryResult<T> {
  try {
    return { success: true, value: fn() };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

export function createErrorBoundary(
  fallback: Handler
): Middleware {
  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    try {
      next();
    } catch (error) {
      fallback(req, res);
    }
  };
}

export function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const delay = options.delay ?? 100;
  const shouldRetry = options.shouldRetry ?? (() => true);

  return new Promise(async (resolve, reject) => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        resolve(result);
        return;
      } catch (error) {
        if (attempt === maxRetries || !shouldRetry(error as Error)) {
          reject(error);
          return;
        }

        await new Promise(r => setTimeout(r, delay * attempt));
      }
    }
  });
}

export default {
  withErrorRecovery,
  withTimeout,
  withFallback,
  safeAsync,
  safeSync,
  createErrorBoundary,
  withRetry,
};

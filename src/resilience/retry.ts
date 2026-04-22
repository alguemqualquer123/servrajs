/**
 * Servra - Retry with Exponential Backoff
 * 
 * Robust retry mechanism with backoff and jitter.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoff?: 'fixed' | 'exponential' | 'linear';
  jitter?: boolean;
  multiplier?: number;
  timeout?: number;
  shouldRetry?: (error: Error) => boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY = 100;
const DEFAULT_MAX_DELAY = 10000;
const DEFAULT_MULTIPLIER = 2;

function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  backoff: string,
  jitter: boolean
): number {
  let delay: number;

  switch (backoff) {
    case 'exponential':
      delay = initialDelay * Math.pow(multiplier, attempt);
      break;
    case 'linear':
      delay = initialDelay * attempt;
      break;
    default:
      delay = initialDelay;
  }

  delay = Math.min(delay, maxDelay);

  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }

  return Math.floor(delay);
}

const DEFAULT_RETRYABLE_ERRORS = [
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'EPIPE',
  'ECONNRESET',
  ' socket',
  'timeout',
  'EAI_AGAIN',
  'socket hang up',
];

function defaultShouldRetry(error: Error): boolean {
  const message = error.message.toLowerCase();
  return DEFAULT_RETRYABLE_ERRORS.some(e => message.includes(e.toLowerCase()));
}

export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts: Required<RetryOptions> = {
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    initialDelay: options.initialDelay ?? DEFAULT_INITIAL_DELAY,
    maxDelay: options.maxDelay ?? DEFAULT_MAX_DELAY,
    backoff: options.backoff ?? 'exponential',
    jitter: options.jitter ?? true,
    multiplier: options.multiplier ?? DEFAULT_MULTIPLIER,
    timeout: options.timeout ?? 0,
    shouldRetry: options.shouldRetry ?? defaultShouldRetry,
    onRetry: options.onRetry ?? (() => {}),
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      let result: T;

      if (opts.timeout > 0) {
        result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Operation timed out')),
              opts.timeout
            )
          ),
        ]);
      } else {
        result = await operation();
      }

      return {
        success: true,
        value: result,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries || !opts.shouldRetry(lastError)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
        };
      }

      opts.onRetry(attempt + 1, lastError);

      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.multiplier,
        opts.backoff,
        opts.jitter
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: opts.maxRetries + 1,
  };
}

export function retrySync<T>(
  operation: () => T,
  options: RetryOptions = {}
): RetryResult<T> {
  const opts = {
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    initialDelay: options.initialDelay ?? DEFAULT_INITIAL_DELAY,
    maxDelay: options.maxDelay ?? DEFAULT_MAX_DELAY,
    backoff: options.backoff ?? 'exponential',
    jitter: options.jitter ?? true,
    multiplier: options.multiplier ?? DEFAULT_MULTIPLIER,
    timeout: options.timeout ?? 0,
    shouldRetry: options.shouldRetry ?? (() => true),
    onRetry: options.onRetry ?? (() => {}),
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = operation();
      return {
        success: true,
        value: result,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxRetries || !opts.shouldRetry(lastError)) {
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
        };
      }

      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.multiplier,
        opts.backoff,
        opts.jitter
      );

      const start = Date.now();
      while (Date.now() - start < delay) {}
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: opts.maxRetries + 1,
  };
}

export default { retry, retrySync };

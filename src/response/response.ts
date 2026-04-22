/**
 * LOA Framework - Response Object
 */

import { ServerResponse, OutgoingHttpHeaders, validateHeaderName, validateHeaderValue } from 'http';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import type { Readable } from 'stream';
import { Emitter } from '../core/events';
import type {
  HttpHeaders,
  CookieOptions,
  Logger,
} from '../core/types';

export interface ResponseOptions {
  logger?: Logger;
}

export class LOAResponse extends Emitter {
  readonly raw: ServerResponse;
  
  #statusCode: number = 200;
  #sent: boolean = false;
  #headers: HttpHeaders = {};
  #cookies: Map<string, { value: string; options: CookieOptions }> = new Map();
  #logger: Logger;

  constructor(raw: ServerResponse, options: ResponseOptions = {}) {
    super();
    this.raw = raw;
    this.#logger = options.logger ?? getDefaultLogger();
  }

  get statusCode(): number {
    return this.#statusCode;
  }

  get sent(): boolean {
    return this.#sent;
  }

  get headers(): HttpHeaders {
    return this.#headers;
  }

  status(code: number): this {
    this.#statusCode = code;
    return this;
  }

  header(name: string, value: string): this {
    const headerName = normalizeHeaderName(name);
    const headerValue = sanitizeHeaderValue(value);
    validateHeaderName(headerName);
    validateHeaderValue(headerName, headerValue);
    this.#headers[headerName] = headerValue;
    return this;
  }

  getHeader(name: string): string | string[] | undefined {
    return this.#headers[name.toLowerCase()];
  }

  removeHeader(name: string): void {
    delete this.#headers[name.toLowerCase()];
  }

  writeHead(code?: number, headers?: HttpHeaders): this {
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        if (value === undefined) continue;
        const headerName = normalizeHeaderName(name);
        validateHeaderName(headerName);
        if (Array.isArray(value)) {
          const cleanValues = value.map(sanitizeHeaderValue);
          for (const item of cleanValues) {
            validateHeaderValue(headerName, item);
          }
          this.#headers[headerName] = cleanValues;
        } else {
          const cleanValue = sanitizeHeaderValue(value);
          validateHeaderValue(headerName, cleanValue);
          this.#headers[headerName] = cleanValue;
        }
      }
    }
    
    const statusCode = code ?? this.#statusCode;

    if (this.#cookies.size > 0) {
      const cookieHeader: string[] = [];
      for (const [name, { value, options }] of this.#cookies) {
        cookieHeader.push(this.#serializeCookie(name, value, options));
      }
      this.#headers['set-cookie'] = cookieHeader;
    }

    this.raw.writeHead(statusCode, this.#headers as OutgoingHttpHeaders);
    return this;
  }

  send(data?: unknown): this {
    if (this.#sent) return this;
    this.#sent = true;

    if (data === undefined) {
      this.raw.end();
      return this;
    }

    if (typeof data === 'string') {
      if (!this.#headers['content-type']) {
        this.#headers['content-type'] = 'text/plain; charset=utf-8';
      }
      this.writeHead();
      this.raw.end(data);
      return this;
    }

    if (Buffer.isBuffer(data)) {
      if (!this.#headers['content-type']) {
        this.#headers['content-type'] = 'application/octet-stream';
      }
      this.writeHead();
      this.raw.end(data);
      return this;
    }

    return this.json(data);
  }

  json(data: unknown): this {
    if (this.#sent) return this;
    this.#sent = true;

    this.#headers['content-type'] = 'application/json; charset=utf-8';

    let jsonString: string;
    try {
      jsonString = JSON.stringify(data);
    } catch {
      jsonString = '{}';
    }

    if (!jsonString || jsonString === '{}') {
      this.writeHead(204);
      this.raw.end();
      return this;
    }

    this.writeHead();
    this.raw.end(jsonString);

    return this;
  }

  html(data: string): this {
    if (this.#sent) return this;
    this.#sent = true;

    this.#headers['content-type'] = 'text/html; charset=utf-8';
    this.writeHead();
    this.raw.end(data);

    return this;
  }

  stream(stream: Readable): this {
    if (this.#sent) return this;
    this.#sent = true;

    this.#headers['content-type'] = 'application/octet-stream';
    this.writeHead();
    stream.pipe(this.raw);

    return this;
  }

  download(path: string, filename?: string): this {
    const filename_ = filename ?? basename(path);
    
    this.#headers['content-type'] = 'application/octet-stream';
    this.#headers['content-disposition'] = `attachment; filename="${sanitizeQuotedHeaderValue(filename_)}"`;

    const stream = createReadStream(path);
    return this.stream(stream);
  }

  redirect(url: string, status: number = 302): this {
    if (this.#sent) return this;
    this.#sent = true;

    this.#headers['location'] = sanitizeHeaderValue(url);
    this.writeHead(status);
    this.raw.end();

    return this;
  }

  cookie(name: string, value: string, options: CookieOptions = {}): this {
    this.#cookies.set(name, { value, options });
    return this;
  }

  clearCookie(name: string, options: CookieOptions = {}): this {
    return this.cookie(name, '', {
      ...options,
      expires: new Date(0),
      maxAge: 0,
    });
  }

  #serializeCookie(name: string, value: string, options: CookieOptions): string {
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) {
      throw new TypeError('Invalid cookie name');
    }

    const encode = options.encode ?? encodeURIComponent;
    let cookie = `${name}=${encode(sanitizeHeaderValue(value ?? ''))}`;

    if (options.domain) cookie += `; Domain=${sanitizeCookieAttribute(options.domain)}`;
    if (options.path) cookie += `; Path=${sanitizeCookieAttribute(options.path)}`;
    if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
    if (options.maxAge !== undefined) cookie += `; Max-Age=${Math.trunc(options.maxAge)}`;
    if (options.httpOnly) cookie += '; HttpOnly';
    if (options.secure) cookie += '; Secure';
    if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;

    return cookie;
  }

  type(contentType: string): this {
    this.header('Content-Type', contentType);
    return this;
  }

  ok(data?: unknown): this {
    return this.status(200).json(data ?? { ok: true });
  }

  created(data?: unknown): this {
    return this.status(201).json(data ?? { ok: true });
  }

  noContent(): this {
    return this.status(204).send();
  }

  badRequest(error?: unknown): this {
    return this.status(400).json(error ?? { error: 'Bad Request' });
  }

  unauthorized(error?: unknown): this {
    return this.status(401).json(error ?? { error: 'Unauthorized' });
  }

  forbidden(error?: unknown): this {
    return this.status(403).json(error ?? { error: 'Forbidden' });
  }

  notFound(error?: unknown): this {
    return this.status(404).json(error ?? { error: 'Not Found' });
  }

  internalError(error?: unknown): this {
    return this.status(500).json(error ?? { error: 'Internal Server Error' });
  }

  etag(etag: string): this {
    this.#headers['etag'] = etag;
    return this;
  }

  cache(cache: string): this {
    this.#headers['cache-control'] = cache;
    return this;
  }

  lastModified(date: Date): this {
    this.#headers['last-modified'] = date.toUTCString();
    return this;
  }

  gzip(): this {
    this.#headers['content-encoding'] = 'gzip';
    return this;
  }

  deflate(): this {
    this.#headers['content-encoding'] = 'deflate';
    return this;
  }
}

function normalizeHeaderName(name: string): string {
  return name.toLowerCase();
}

function sanitizeHeaderValue(value: string): string {
  return String(value).replace(/[\r\n\0]/g, '');
}

function sanitizeQuotedHeaderValue(value: string): string {
  return sanitizeHeaderValue(value).replace(/["\\]/g, '');
}

function sanitizeCookieAttribute(value: string): string {
  return sanitizeHeaderValue(value).replace(/[;]/g, '');
}

function getDefaultLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

export function createResponse(
  raw: ServerResponse,
  options: ResponseOptions = {}
): LOAResponse {
  return new LOAResponse(raw, options);
}

export default LOAResponse;

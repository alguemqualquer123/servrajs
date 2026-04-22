/**
 * LOA Framework - Request Object
 */

import { IncomingMessage } from 'http';
import { URLSearchParams } from 'url';
import { Emitter } from '../core/events';
import type {
  HttpMethod,
  RequestParams,
  RequestQuery,
  RequestBody,
  ParsedCookies,
  HttpHeaders,
  Logger,
} from '../core/types';

export interface RequestOptions {
  id: string;
  bodyLimit: string;
  trustedProxies: string[];
  logger?: Logger;
}

export class LOARequest extends Emitter {
  readonly id: string;
  readonly raw: IncomingMessage;
  
  #rawUrl: string;
  #path: string | null = null;
  #search: string | null = null;
  #hostname: string | null = null;
  #protocol: string | null = null;
  #port: number | null = null;
  #params: RequestParams = {};
  #query: RequestQuery = {};
  #headers: HttpHeaders = {};
  #cookies: ParsedCookies = {};
  #bodyPending: Promise<RequestBody> | null = null;
  #bodyResolved: RequestBody = {} as RequestBody;
  #bodyLimit: number;
  #trustedProxies: string[];
  #logger: Logger;

  constructor(raw: IncomingMessage, options: RequestOptions) {
    super();
    this.id = options.id;
    this.raw = raw;
    this.#rawUrl = raw.url ?? '/';
    this.#bodyLimit = this.#parseBodyLimit(options.bodyLimit);
    this.#trustedProxies = options.trustedProxies;
    this.#logger = options.logger ?? getDefaultLogger();
  }

  #parseBodyLimit(limit: string): number {
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

  #getSearch(): string {
    if (this.#search === null) {
      const queryIndex = this.#rawUrl.indexOf('?');
      this.#search = queryIndex === -1 ? '' : this.#rawUrl.slice(queryIndex);
    }

    return this.#search;
  }

  get method(): HttpMethod {
    return (this.raw.method?.toUpperCase() ?? 'GET') as HttpMethod;
  }

  get url(): string {
    return this.#rawUrl;
  }

  get path(): string {
    if (this.#path === null) {
      const queryIndex = this.#rawUrl.indexOf('?');
      this.#path = queryIndex === -1 ? this.#rawUrl : this.#rawUrl.slice(0, queryIndex);
      if (!this.#path) {
        this.#path = '/';
      }
    }

    return this.#path;
  }

  get originalUrl(): string {
    return this.#rawUrl;
  }

  get httpVersion(): string {
    return this.raw.httpVersion;
  }

  get headers(): HttpHeaders {
    if (!Object.keys(this.#headers).length) {
      this.#headers = this.raw.headers as HttpHeaders;
    }
    return this.#headers;
  }

  header(name: string): string | string[] | undefined {
    return this.headers[name.toLowerCase()];
  }

  #getRemoteAddress(): string {
    return normalizeIp(this.raw.socket?.remoteAddress ?? '127.0.0.1');
  }

  #canTrustForwardedHeaders(): boolean {
    return isTrustedIp(this.#getRemoteAddress(), this.#trustedProxies);
  }

  #getForwardedHeader(name: string): string | undefined {
    if (!this.#canTrustForwardedHeaders()) {
      return undefined;
    }

    const value = this.header(name);
    return Array.isArray(value) ? value[0] : value;
  }

  #getForwardedList(name: string): string[] {
    const value = this.#getForwardedHeader(name);
    if (!value) return [];

    return value
      .split(',')
      .map((item) => sanitizeHeaderValue(item).trim())
      .filter(Boolean);
  }

  get query(): RequestQuery {
    if (!Object.keys(this.#query).length) {
      const searchParams = new URLSearchParams(this.#getSearch());
      for (const [key, value] of searchParams) {
        this.#query[key] = value;
      }
    }
    return this.#query;
  }

  get params(): RequestParams {
    return this.#params;
  }

  setParams(params: RequestParams): void {
    this.#params = params;
  }

  param(name: string, defaultValue?: string): string {
    return this.#params[name] ?? defaultValue ?? '';
  }

  get body(): RequestBody {
    return this.#bodyResolved;
  }

  setBody(body: RequestBody): void {
    this.#bodyResolved = body;
  }

  get cookies(): ParsedCookies {
    if (!Object.keys(this.#cookies).length) {
      const cookieHeader = this.header('cookie');
      if (cookieHeader) {
        const cookieString = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
        const pairs = cookieString.split(';');
        for (const pair of pairs) {
          const [name, ...valueParts] = pair.trim().split('=');
          if (name) {
            this.#cookies[name] = valueParts.join('=');
          }
        }
      }
    }
    return this.#cookies;
  }

  cookie(name: string): string | undefined {
    return this.cookies[name];
  }

  get ip(): string {
    const forwarded = this.#getForwardedList('x-forwarded-for');
    if (forwarded.length > 0) {
      return normalizeIp(forwarded[0]);
    }

    return this.#getRemoteAddress();
  }

  get ips(): string[] {
    const forwarded = this.#getForwardedList('x-forwarded-for');
    if (forwarded.length > 0) {
      return forwarded.map(normalizeIp);
    }

    return [this.#getRemoteAddress()];
  }

  get protocol(): string {
    const proto = this.#getForwardedHeader('x-forwarded-proto');
    if (proto) {
      const value = sanitizeHeaderValue(proto).split(',')[0]?.trim().toLowerCase();
      if (value === 'https' || value === 'http') {
        return value;
      }
    }

    if (this.#protocol === null) {
      this.#protocol = (this.raw.socket as { encrypted?: boolean } | undefined)?.encrypted ? 'https' : 'http';
    }

    return this.#protocol;
  }

  get hostname(): string {
    if (this.#hostname === null) {
      const host = this.#getForwardedHeader('x-forwarded-host') ?? this.header('host');
      const hostValue = Array.isArray(host) ? host[0] : host;
      this.#hostname = sanitizeHostname(hostValue ?? 'localhost');
    }

    return this.#hostname;
  }

  get port(): number | undefined {
    const port = this.#getForwardedHeader('x-forwarded-port');
    if (port) {
      const parsed = parsePort(port);
      if (parsed !== undefined) return parsed;
    }

    if (this.#port === null) {
      const host = this.header('host');
      const hostValue = Array.isArray(host) ? host[0] : host;
      this.#port = parsePortFromHost(hostValue) ?? null;
    }

    return this.#port || undefined;
  }

  get secure(): boolean {
    return this.protocol === 'https';
  }

  get xhr(): boolean {
    const ua = this.header('user-agent');
    const uaStr = Array.isArray(ua) ? ua[0] : ua ?? '';
    return uaStr.toLowerCase().includes('xmlhttprequest');
  }
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n\0]/g, '');
}

function sanitizeHostname(value: string): string {
  const clean = sanitizeHeaderValue(value).trim();
  const hostname = clean.startsWith('[')
    ? clean.slice(1, clean.indexOf(']') > -1 ? clean.indexOf(']') : undefined)
    : clean.split(':')[0];

  return hostname || 'localhost';
}

function parsePort(value: string): number | undefined {
  const port = Number.parseInt(sanitizeHeaderValue(value), 10);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : undefined;
}

function parsePortFromHost(value?: string): number | undefined {
  if (!value) return undefined;

  const clean = sanitizeHeaderValue(value).trim();
  const bracketEnd = clean.indexOf(']');
  if (clean.startsWith('[') && bracketEnd > -1) {
    return clean[bracketEnd + 1] === ':' ? parsePort(clean.slice(bracketEnd + 2)) : undefined;
  }

  const separatorIndex = clean.lastIndexOf(':');
  if (separatorIndex === -1 || clean.indexOf(':') !== separatorIndex) {
    return undefined;
  }

  return parsePort(clean.slice(separatorIndex + 1));
}

function normalizeIp(ip: string): string {
  const clean = sanitizeHeaderValue(ip).trim();
  if (clean.startsWith('::ffff:')) {
    return clean.slice(7);
  }
  if (clean.startsWith('[') && clean.endsWith(']')) {
    return clean.slice(1, -1);
  }
  return clean || '127.0.0.1';
}

function isTrustedIp(ip: string, trustedProxies: string[]): boolean {
  const normalized = normalizeIp(ip);

  return trustedProxies.some((proxy) => {
    const trusted = normalizeIp(proxy);
    if (trusted.includes('/')) {
      return cidrContains(trusted, normalized);
    }
    return trusted === normalized;
  });
}

function cidrContains(cidr: string, ip: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const bits = Number.parseInt(bitsRaw ?? '', 10);

  if (!isValidIPv4(base) || !isValidIPv4(ip) || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }

  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipToNum(base) & mask) === (ipToNum(ip) & mask);
}

function ipToNum(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number.parseInt(octet, 10), 0) >>> 0;
}

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const value = Number.parseInt(part, 10);
    return value >= 0 && value <= 255;
  });
}

function getDefaultLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };
}

export function createRequest(
  raw: IncomingMessage,
  options: RequestOptions
): LOARequest {
  return new LOARequest(raw, options);
}

export default LOARequest;

/**
 * Servra - Request Validator
 * 
 * Advanced request validation with schema support.
 * Prevents malformed requests and payload attacks.
 */

import type { Middleware, LOARequest, LOAResponse, NextFunction } from '../core/types';

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'url' | 'ip' | 'uuid';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
}

export interface ValidationOptions {
  schema?: ValidationSchema;
  body?: ValidationSchema;
  query?: ValidationSchema;
  params?: ValidationSchema;
  headers?: ValidationSchema;
  stripUnknown?: boolean;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_REGEX = /^https?:\/\/.+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

interface ValidationError {
  field: string;
  message: string;
}

export function validate(options: ValidationOptions): Middleware {
  return (req: LOARequest, res: LOAResponse, next: NextFunction) => {
    const errors: ValidationError[] = [];

    if (options.params && Object.keys(options.params).length > 0) {
      const paramsErrors = validateObject(req.params, options.params, 'params');
      errors.push(...paramsErrors);
    }

    if (options.query && Object.keys(options.query).length > 0) {
      const queryErrors = validateObject(req.query, options.query, 'query');
      errors.push(...queryErrors);
    }

    if (options.body && Object.keys(options.body).length > 0) {
      const bodyErrors = validateObject(req.body, options.body, 'body');
      errors.push(...bodyErrors);
    }

    if (options.headers && Object.keys(options.headers).length > 0) {
      const headersErrors = validateObject(req.headers, options.headers, 'headers');
      errors.push(...headersErrors);
    }

    if (options.stripUnknown && req.body && typeof req.body === 'object') {
      let schema: ValidationSchema | undefined;
      if (options.body) {
        const validKeys = new Set(Object.keys(options.body));
        for (const key of Object.keys(req.body)) {
          if (!validKeys.has(key)) {
            delete req.body[key];
          }
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation Failed',
        message: 'Request validation failed',
        details: errors,
        statusCode: 400,
      });
      return;
    }

    next();
  };
}

function validateObject(
  obj: Record<string, unknown>,
  schema: ValidationSchema,
  source: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [field, rule] of Object.entries(schema)) {
    const value = obj[field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field: `${source}.${field}`, message: `${field} is required` });
      continue;
    }

    if (value === undefined || value === null) {
      continue;
    }

    if (!validateValue(value, rule)) {
      errors.push({ field: `${source}.${field}`, message: `Invalid ${field}` });
    }
  }

  return errors;
}

function validateValue(value: unknown, rule: ValidationRule): boolean {
  const type = rule.type;

  if (type === 'string' && typeof value !== 'string') return false;
  if (type === 'number' && typeof value !== 'number') return false;
  if (type === 'boolean' && typeof value !== 'boolean') return false;
  if (type === 'array' && !Array.isArray(value)) return false;
  if (type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) return false;

  if (type === 'email' && typeof value === 'string') {
    return EMAIL_REGEX.test(value);
  }

  if (type === 'url' && typeof value === 'string') {
    return URL_REGEX.test(value);
  }

  if (type === 'uuid' && typeof value === 'string') {
    return UUID_REGEX.test(value);
  }

  if (type === 'ip' && typeof value === 'string') {
    return IP_REGEX.test(value) && value.split('.').every(octet => {
      const n = parseInt(octet, 10);
      return n >= 0 && n <= 255;
    });
  }

  if (type === 'string' && typeof value === 'string') {
    if (rule.min !== undefined && value.length < rule.min) return false;
    if (rule.max !== undefined && value.length > rule.max) return false;
    if (rule.pattern && !rule.pattern.test(value)) return false;
    if (rule.enum && !rule.enum.includes(value)) return false;
  }

  if (type === 'number' && typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) return false;
    if (rule.max !== undefined && value > rule.max) return false;
    if (rule.enum && !rule.enum.includes(value)) return false;
  }

  if (rule.custom && !rule.custom(value)) return false;

  return true;
}

export default validate;

/**
 * Servra - Validator
 * 
 * Simple validation system with Zod support.
 * Works without Zod if not installed.
 */

import type { Middleware, LOARequest, LOAResponse } from '../core/types';

export interface ValidationSchema {
  [key: string]: {
    type: string;
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: unknown[];
    custom?: (value: unknown) => boolean;
  };
}

export interface ValidationResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: Array<{ path: string; message: string }>;
}

// ============================================================================
// Validator Middleware
// ============================================================================

export function validator(schema: ValidationSchema): Middleware {
  return (req: LOARequest, res: LOAResponse, next: () => void) => {
    const errors: Array<{ path: string; message: string }> = [];
    const data: Record<string, unknown> = {};

    // Validate body
    for (const [key, rules] of Object.entries(schema)) {
      const value = req.body[key as keyof typeof req.body];

      if (rules.required && (value === undefined || value === null)) {
        errors.push({ path: key, message: `${key} is required` });
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      // Type check
      if (!validateType(value, rules.type)) {
        errors.push({ path: key, message: `${key} must be ${rules.type}` });
        continue;
      }

      // String validation
      if (rules.type === 'string') {
        const strValue = value as string;

        if (rules.min !== undefined && strValue.length < rules.min) {
          errors.push({ path: key, message: `${key} must be at least ${rules.min} characters` });
        }

        if (rules.max !== undefined && strValue.length > rules.max) {
          errors.push({ path: key, message: `${key} must be at most ${rules.max} characters` });
        }

        if (rules.pattern && !rules.pattern.test(strValue)) {
          errors.push({ path: key, message: `${key} has invalid format` });
        }
      }

      // Number validation
      if (rules.type === 'number') {
        const numValue = value as number;

        if (rules.min !== undefined && numValue < rules.min) {
          errors.push({ path: key, message: `${key} must be at least ${rules.min}` });
        }

        if (rules.max !== undefined && numValue > rules.max) {
          errors.push({ path: key, message: `${key} must be at most ${rules.max}` });
        }
      }

      // Enum validation
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push({ path: key, message: `${key} must be one of: ${rules.enum.join(', ')}` });
      }

      // Custom validation
      if (rules.custom && !rules.custom(value)) {
        errors.push({ path: key, message: `${key} is invalid` });
      }

      data[key] = value;
    }

    // Send errors if any
    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation Failed',
        message: 'Request data validation failed',
        errors,
        statusCode: 400,
      });
      return;
    }

    // Attach validated data to request
    (req as unknown as { validated: Record<string, unknown> }).validated = data;

    next();
  };
}

// ============================================================================
// Type Validation
// ============================================================================

function validateType(value: unknown, type: string): boolean {
  switch (type) {
    case 'string': return typeof value === 'string';
    case 'number': return typeof value === 'number' && !isNaN(value);
    case 'boolean': return typeof value === 'boolean';
    case 'array': return Array.isArray(value);
    case 'object': return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'date': return value instanceof Date || !isNaN(Date.parse(value as string));
    default: return true;
  }
}

// ============================================================================
// Quick Validator Helpers
// ============================================================================

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function isUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isPhone(value: string): boolean {
  return /^\+?[\d\s\-()]+$/.test(value);
}

// ============================================================================
// Export
// ============================================================================

export default validator;

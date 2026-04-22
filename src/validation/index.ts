/**
 * Servra - Validation
 */

export { validator } from './validator';
export { createSchema } from './schema';

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

export interface ValidationError {
  path: string;
  message: string;
}

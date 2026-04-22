/**
 * Servra - Schema Builder
 */

export interface SchemaField {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';
  required?: boolean;
  min?: number;
  max?: number;
}

export interface SchemaDefinition {
  [key: string]: SchemaField;
}

export class Schema {
  fields: SchemaDefinition = {};

  addField(name: string, field: SchemaField): void {
    this.fields[name] = field;
  }

  build(): SchemaDefinition {
    return this.fields;
  }
}

export function createSchema(): Schema {
  return new Schema();
}

export default Schema;

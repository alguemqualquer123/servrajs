import { test, expect } from '../testkit.js';
import { createSchema } from '../../dist/index.js';

test('Schema builder composes a schema definition', () => {
  const schema = createSchema();
  schema.addField('name', { type: 'string', required: true, min: 2 });
  schema.addField('age', { type: 'number', min: 0 });

  const built = schema.build();
  expect(built.name.type).toBe('string');
  expect(built.name.required).toBe(true);
  expect(built.age.type).toBe('number');
});


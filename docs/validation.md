# Validation

Servra’s validation system is intentionally simple: it’s a small middleware that
validates `req.body` against a schema you define.

If you need richer validation (deep objects, unions, transforms), keep that in
application code and run it inside your handler or a custom middleware.

## The `validator(schema)` middleware

```ts
import { validator } from 'servra';

const createUser = validator({
  name: { type: 'string', required: true, min: 2, max: 100 },
  email: {
    type: 'string',
    required: true,
    pattern: /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/,
  },
});

app.post('/users', createUser, (req, res) => {
  // The middleware adds a `validated` property on the request object.
  const validated = (req as unknown as { validated: Record<string, unknown> }).validated;
  return res.status(201).json({ ok: true, data: validated });
});
```

### Supported rules

Each field supports:

- `type`: `string | number | boolean | array | object | date`
- `required`: boolean
- `min` / `max`: strings use length, numbers use numeric range
- `pattern`: RegExp (strings)
- `enum`: allowed values
- `custom`: `(value) => boolean`

### Error shape

On validation errors, the middleware responds with status `400`:

```json
{
  "error": "Validation Failed",
  "message": "Request data validation failed",
  "errors": [{ "path": "email", "message": "email is required" }],
  "statusCode": 400
}
```

## The schema builder helper

Servra exports a lightweight builder. It’s useful when you want to assemble
schemas across modules and keep one place responsible for structure.

```ts
import { createSchema, validator } from 'servra';

const schema = createSchema();
schema.addField('name', { type: 'string', required: true, min: 2 });
schema.addField('age', { type: 'number', required: false, min: 0 });

app.post('/profiles', validator(schema.build()), (req, res) => res.json({ ok: true }));
```


# Scalar

Scalar is a popular OpenAPI UI. Servra does not bundle Scalar, but it can
produce an OpenAPI JSON document that Scalar can render.

## Use Servra’s OpenAPI JSON

Start your app and point Scalar at:

- `http://localhost:3000/docs/openapi.json`

If your docs path is different, adjust accordingly.

## Common setup patterns

### Option 1: Host Scalar separately

Keep Servra focused on the API and host Scalar as a static site (or behind your
gateway). Configure Scalar to fetch the OpenAPI JSON from your service.

### Option 2: Serve a Scalar page from your app

If you prefer a single origin, you can serve an HTML page that loads Scalar and
references `/docs/openapi.json`. This is typically done by adding a route like:

```ts
app.get('/reference', (_req, res) => res.html('<!doctype html>...'));
```

The exact HTML depends on how you choose to include Scalar (CDN, bundler, or a
separate frontend build). The only Servra-specific part is the URL to the spec.

## Notes

Servra’s OpenAPI output is intentionally minimal today. If you use Scalar for
client generation or strict contract testing, consider enriching the OpenAPI
document during your build/deploy pipeline.


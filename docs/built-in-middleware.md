# Built-In Middleware

Servra has two categories of middleware:

1. **Framework middleware**: helper middleware you opt into (body parsing, limits).
2. **Security middleware**: enabled by default unless you disable it.

## The middleware model

A middleware function receives `(req, res, next)`. Call `next()` to continue the
chain or send a response to stop processing.

Middlewares can be synchronous or `async`.

## Framework middleware

### `bodyParser(options?)`

Parses:

- `application/json`
- `application/x-www-form-urlencoded`

The parsed result is assigned to `req.body`.

```ts
import { bodyParser } from 'servra';

app.use(bodyParser({ limit: '1mb' }));
```

### `queryParser()`

Servra parses `req.query` lazily; `queryParser()` is included mainly for parity
and as a clear “this service expects query strings” signal in your middleware
stack.

```ts
import { queryParser } from 'servra';

app.use(queryParser());
```

### `timeout(ms)`

Adds a timeout guard at the middleware layer (separate from the server-level
request timeout).

```ts
import { timeout } from 'servra';

app.use(timeout(10_000));
```

### `cors(options?)` (middleware runner)

This is a lightweight CORS middleware meant for simple cases. If you want
security defaults, configure `createApp({ security: { cors: ... } })` instead.

```ts
import { cors } from 'servra';

app.use(cors({ origin: ['https://app.example.com'], methods: ['GET', 'POST'] }));
```

### `fileSizeLimit({ maxFileSize })`

Rejects requests when `content-length` exceeds the configured limit.

```ts
import { fileSizeLimit } from 'servra';

app.use(fileSizeLimit({ maxFileSize: 5 * 1024 * 1024 }));
```

### `proxyProtection({ trustProxy, trustedProxies })`

Protects against spoofed forwarded headers when running behind proxies. Most
apps won't need to touch this unless they accept traffic through multiple hops.

```ts
import { proxyProtection } from 'servra';

app.use(proxyProtection({ trustProxy: true, trustedProxies: ['10.0.0.0/8'] }));
```

## Security middleware (enabled by default)

Security is wired automatically in `createApp()` via `SecurityManager`. You can
control it through `createApp({ security: { ... } })`.

The default pipeline is:

1. Security headers
2. Rate limiting
3. CORS handling
4. Optional CSRF validation (disabled by default)
5. Request sanitizing for query/params (and for bodies only if they are already parsed)

If you need to fully opt out (for example in a trusted internal environment),
use `createApp({ security: { enabled: false } })`.

In most apps you’ll parse JSON first and then sanitize it:

```ts
import { bodyParser, sanitize } from 'servra';

app.use([bodyParser(), sanitize()]);
```

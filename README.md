# Servra

<div align="center">

```
  ██████╗ ██╗   ██╗███████╗    ██████╗ ██╗   ██╗███████╗
  ██╔══██╗██║   ██║██╔════╝    ██╔══██╗██║   ██║██╔════╝
  ██████╔╝██║   ██║█████╗      ██████╔╝██║   ██║█████╗  
  ██╔═══╝ ██║   ██║██╔══╝      ██╔══██╗██║   ██║██╔══╝  
  ██║     ╚██████╔╝███████╗    ██║  ██║╚██████╔╝██║     
  ╚═╝      ╚═════╝ ╚══════╝    ╚═╝  ╚═╝ ╚═════╝ ╚═╝     
```

**Lightweight • Optimized • Application**

Ultrafast, Secure, Modern Backend Framework for Node.js

[![Node.js Version](https://img.shields.io/node/v/%40srvinix%2Fservra)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/npm/l/%40srvinix%2Fservra)](LICENSE)
[![npm version](https://img.shields.io/npm/v/%40srvinix%2Fservra)](https://www.npmjs.com/package/servra)
[![Build Status](https://img.shields.io/github/actions/workflow/status/alguemqualquer123/servra/ci-cd.yml)](https://github.com/alguemqualquer123/servrajs/actions)

</div>

## Links

- GitHub: https://github.com/alguemqualquer123/servrajs
- LinkedIn: https://linkedin.com/in/srvinix
- npm: https://www.npmjs.com/package/servra

## Features

| Feature | Description |
|---------|-------------|
| 🚀 **High Performance** | Radix Tree router with O(k) lookup |
| 🔒 **Security** | Built-in Helmet, CORS, CSRF, Rate Limiting |
| ⚡ **Fast** | Zero dependencies, optimized for speed |
| 📦 **TypeScript** | Full TypeScript support |
| 🔌 **Plugins** | Extendable plugin system |
| 🧩 **Middleware** | Flexible middleware pipeline |

## Installation

```bash
npm install servra
```

## Create an API template

```bash
npx servra create my-api
cd my-api
npm install
npm run dev
```

The generated API includes health checks, `/api/v1` routes, a user CRUD example,
secure defaults, request body limits, CORS allowlist support, rate limiting,
centralized error responses, and Node test examples.

## Quick Start

```typescript
import { createApp } from 'servra';

const app = createApp({
  security: {
    enabled: true,
    helmet: {
      contentSecurityPolicy: true,
      xFrameOptions: 'DENY',
    },
    rateLimit: {
      enabled: true,
      max: 100,
    },
  },
});

app.get('/', (req, res) => {
  res.json({ 
    message: 'Hello, Servra!',
    version: '1.0.0' 
  });
});

app.post('/api/data', (req, res) => {
  const { name, email } = req.body;
  res.json({ success: true, data: { name, email } });
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
```

## Security Features

```typescript
import { helmet, rateLimit, cors, csrf, sanitize } from 'servra';

// Security headers
app.use(helmet({
  contentSecurityPolicy: true,
  crossOriginResourcePolicy: 'same-origin',
  xFrameOptions: 'DENY',
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 60000,
  max: 100,
}));

// CORS
app.use(cors({
  origin: ['https://app.example.com'],
  methods: ['GET', 'POST'],
}));

// CSRF protection
app.use(csrf({
  cookie: true,
  secret: process.env.CSRF_SECRET,
}));

// Input sanitization
app.use(sanitize());
```

By default, Servra ships with hardened response headers, closed CORS, request IDs,
bounded body parsing, proxy-spoofing protection, in-memory rate limiting with
cleanup, and signed CSRF tokens when CSRF is enabled.

## Middleware

```typescript
import { bodyParser, queryParser, proxyProtection, fileSizeLimit } from 'servra';

// Parse request body
app.use(bodyParser({ limit: '1mb' }));

// Parse query string
app.use(queryParser());

// Protect against proxy spoofing
app.use(proxyProtection({
  trustProxy: true,
  trustedProxies: ['10.0.0.0/8', '172.16.0.0/12'],
}));

// Limit request size
app.use(fileSizeLimit({
  maxFileSize: 5 * 1024 * 1024, // 5MB
}));
```

## API Reference

### Core

| Function | Description |
|----------|-------------|
| `createApp(options?)` | Create a new Servra application |
| `createRouter()` | Create new router |
| `createRequest()` | Create request object |
| `createResponse()` | Create response object |

### Middleware

| Function | Description |
|----------|-------------|
| `bodyParser(options?)` | Parse JSON/form body |
| `queryParser()` | Parse query string |
| `cors(options?)` | CORS middleware |
| `timeout(ms)` | Request timeout |
| `proxyProtection(options?)` | Proxy protection |
| `fileSizeLimit(options?)` | File size limit |

### Security

| Function | Description |
|----------|-------------|
| `helmet(options?)` | Security headers |
| `rateLimit(options?)` | Rate limiting |
| `csrf(options?)` | CSRF protection |
| `sanitize()` | Input sanitization |

## Performance

```
Servra Benchmark
=======================

Router (10,000 routes):
  - Lookup: 0.001ms (avg)
  - Memory: ~2MB

Response Time:
  - Simple route: 0.5ms
  - With middleware: 1.2ms
```

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

**Developed by SR VINIX**

</div>

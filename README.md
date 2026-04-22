# LOA Framework

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

[![Node.js Version](https://img.shields.io/node/v/loa)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org)
[![License](https://img.shields.io/npm/l/@srvinix/loa)](LICENSE)
[![npm version](https://img.shields.io/npm/v/@srvinix/loa)](https://www.npmjs.com/package/@srvinix/loa)
[![Build Status](https://img.shields.io/github/actions/workflow/status/alguemqualquer123/loa_framework/ci-cd.yml)](https://github.com/alguemqualquer123/loa_framework/actions)

</div>

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
npm install @srvinix/loa
```

## Create an API template

```bash
npx @srvinix/loa create my-api
cd my-api
npm install
npm run dev
```

The generated API includes health checks, `/api/v1` routes, a user CRUD example,
secure defaults, request body limits, CORS allowlist support, rate limiting,
centralized error responses, and Node test examples.

## Quick Start

```typescript
import { createApp } from '@srvinix/loa';

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
    message: 'Hello, LOA Framework!',
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
import { helmet, rateLimit, cors, csrf, sanitize } from '@srvinix/loa';

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

By default, LOA ships with hardened response headers, closed CORS, request IDs,
bounded body parsing, proxy-spoofing protection, in-memory rate limiting with
cleanup, and signed CSRF tokens when CSRF is enabled.

## Middleware

```typescript
import { bodyParser, queryParser, proxyProtection, fileSizeLimit } from '@srvinix/loa';

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
| `createApp(options?)` | Create new LOA application |
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
LOA Framework Benchmark
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

**Built with ❤️ by LOA Team**

</div>

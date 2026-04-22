# Installation

Servra is published as `servra` and works on Node.js 18+.

## Requirements

- Node.js `>= 18`
- npm (or another package manager that supports npm packages)

## Install in an existing project

```bash
npm install servra
```

## Create a new API project (recommended)

The CLI ships with the package and can generate a small API template.

```bash
npx servrajs create my-api
cd my-api
npm install
npm run dev
```

What you get:

- A minimal service with `/health` and `/api/v1` routes
- Example CRUD-style user routes
- Docs at `/docs` with secure “try it” support
- A small test file you can run with `npm test`

## Running from source (contributors)

If you're hacking on Servra itself:

```bash
npm install
npm run build
npm test
```

For more details, see [Contributing](./contributing.md).


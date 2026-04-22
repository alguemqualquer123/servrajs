# Contributing

Servra is a small codebase and is easiest to work on when changes are narrow and
well-tested.

## Local setup

```bash
npm install
npm run build
npm test
```

Useful scripts from `package.json`:

- `npm run build` builds `dist/` using SWC
- `npm test` builds and runs `tests/index.js`
- `npm run typecheck` runs TypeScript without emitting

## Development notes

- Prefer changes that keep runtime dependencies at zero.
- If you add a public feature, update `docs/` and `README.md` together.
- Keep docs examples runnable; they should reflect the current exported API.

## Pull requests

When opening a PR:

- Explain the problem and why the approach is minimal.
- Include a test or a reproducible example when practical.
- Mention any behavior changes that might affect existing users.

## Release / publishing

Publishing is handled via GitHub Actions on release. See `.github/workflows/ci-cd.yml`
for the current pipeline.


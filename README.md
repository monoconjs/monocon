# monocon

A web-standard HTTP framework for TypeScript with typed, chainable routes and middleware-provided context inference.

Monocon is built on the web platform primitives (`Request` / `Response`), uses Zod for runtime validation, and generates type declarations that let middleware inject typed context into the routes they match.

## Install

```sh
npm install monocon
```

Requires Node.js 22 or later.

## Quick start

Define a route and export it. Then start the server with `start()` from a platform adapter.

```ts
// src/routes/users.ts
import { get } from 'monocon'
import { z } from 'zod'

export const getUser = get('/users/:id', {
  params: z.object({ id: z.coerce.number() }),
  response: z.object({ id: z.number(), name: z.string() }),
}).handle((ctx) => ({ id: ctx.params.id, name: 'Ada' }))
```

```ts
// src/configuration.ts
import type { ServerConfig } from 'monocon/node'

export default {
  port: 3000,
} satisfies ServerConfig
```

```ts
// src/index.ts
import { start } from 'monocon/node'

const server = await start()
console.log(`listening on http://localhost:${server.config.port}`)
```

Generate the registry, then run your app:

```sh
npx monocon gen tsx src/index.ts
```

The adapter's `start()` loads `configuration.ts` from the working directory (or its `src/` directory), discovers the generated registry at `.monocon/registry.mjs`, and starts an HTTP server. If no config file is found, it defaults to port `3000`.

## Routes

Use `get`, `post`, `put`, `patch`, `del`, `head`, `options`, or `all` to declare a route. Options are validated with Zod schemas for `params`, `query`, `body`, and `response`.

```ts
import { post } from 'monocon'
import { z } from 'zod'

export const createUser = post('/users', {
  body: z.object({ name: z.string() }),
  response: z.object({ id: z.number(), name: z.string() }),
  meta: { tags: ['Users'] },
}).handle((ctx) => ({ id: 1, name: ctx.body.name }))
```

Each route is a chain of lifecycle hooks:

- `onRequest(ctx)` — runs first; its return value is added to the context.
- `beforeHandle(ctx)` — runs before the handler; its return value is added to the context.
- `handle(ctx)` — the route handler (required); its return value is the response body.
- `afterHandle(ctx, result)` — transforms the handler result.
- `onResponse(ctx, response)` — transforms the final response.

```ts
const tracked = get('/users/:id')
  .onRequest(() => ({ traceId: 'trace-1' }))
  .beforeHandle((ctx) => ({ requestedBy: ctx.traceId }))
  .handle((ctx) => ({ requestedBy: ctx.requestedBy }))
  .afterHandle((_ctx, result) => result)
  .onResponse((_ctx, response) => response)
```

## Middleware

A middleware matches routes by path pattern and contributes typed context to them. Patterns accept a glob string or an `{ include, exclude }` object.

```ts
// src/middlewares/logger.ts
import { defineMiddleware } from 'monocon'

export const logger = defineMiddleware(
  {
    onRequest: () => ({ requestId: 'req-1' }),
  },
  '*',
)

// src/middlewares/auth.ts
export const auth = defineMiddleware(
  {
    onRequest: () => ({ user: 'alice', role: 'admin' as const }),
  },
  { include: ['/admin/*'], exclude: ['/admin/public/*'] },
)
```

Monocon generates a declaration (`.monocon/types.d.ts`) that maps each matched middleware to its route path. As a result, a handler can consume `ctx.requestId`, `ctx.user`, and `ctx.role` with full type safety — no manual context typing required.

## Configuration

### Startup configuration

`configuration.ts` (or any of `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`) holds runtime options and is loaded automatically by the adapter's `start()` from the working directory or `src/`.

```ts
import type { ServerConfig } from 'monocon/node'

export default {
  port: 3000,
  hostname: '0.0.0.0',
} satisfies ServerConfig
```

### CLI configuration

`monocon.config.ts` defines code generation for the CLI. Import `defineConfig` from `monocon/config`:

```ts
import { defineConfig } from 'monocon/config'

export default defineConfig({
  entry: ['src/**/*.ts'],
  build: {
    outDir: '.monocon-dist',
  },
})
```

## CLI

The `monocon` command is provided by the `monocon` package, powered by the bundled `@monocon/compiler`.

```sh
monocon gen [command...]   # generate .monocon declarations, then optionally run a command
monocon gen --watch [command...]  # regenerate on changes and restart the command
monocon build [command...] # compile sources to .monocon-dist, then optionally run a command
```

## Packages

- `monocon` — umbrella package; re-exports the runtime API (`get`, `post`, `middleware`, types).
- `@monocon/core` — platform-neutral core runtime with no `node:` dependencies.
- `@monocon/compiler` — code generation CLI (the `monocon` command).
- `@monocon/adapter` — platform adapters, exposed as `./node`, `./bun`, `./deno`, `./workers`.

## Exports

- `monocon` — runtime API (`get`, `post`, `middleware`, types).
- `monocon/node`, `monocon/bun`, `monocon/deno`, `monocon/workers` — `start()` for each platform.
- `monocon/global` — global type augmentations for middleware-derived context.
- `monocon/config` — `defineConfig` for CLI configuration.

## Development

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

## License

[MIT](./LICENSE)

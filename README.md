# monocon

A web-standard HTTP framework for TypeScript with typed, chainable routes and middleware-provided context inference.

Monocon is built on the web platform primitives (`Request` / `Response`), uses Zod for runtime validation, and generates type declarations that let middleware inject typed context into the routes they match.

## Install

```sh
npm install monocon
```

Requires Node.js 22 or later.

## Quick start

Define routes and middleware, export them in ordered arrays, then pass everything to `start()` explicitly.

```ts
// src/routes/users.ts
import { get } from 'monocon'
import { z } from 'zod'

export const getUser = get('/users/:id').handle((ctx) => ({ id: ctx.params.id, name: 'Ada' }), {
  params: z.object({ id: z.coerce.number() }),
  response: z.object({ id: z.number(), name: z.string() }),
})
```

```ts
// src/routes/index.ts
import { getUser } from './users.ts'

export default [getUser]
```

```ts
// src/middlewares/index.ts
import { defineMiddleware } from 'monocon'

export const logger = defineMiddleware({ onRequest: () => ({ requestId: 'req-1' }) }, '*')

export default [logger]
```

```ts
// src/index.ts
import { start } from 'monocon/node'

import middlewares from './middlewares/index.ts'
import routes from './routes/index.ts'

const server = await start({ routes, middlewares, port: 3000 })
console.log(`listening on http://localhost:${server.config.port}`)
```

Generate the declarations, then run your app:

```sh
npx monocon gen tsx src/index.ts
```

The compiler only writes declarations under `.monocon/`: `types.d.ts` imports `middlewares.d.ts`, `errors.d.ts` and `routes.d.ts`. `start()` does not read generated files or configuration files: routes, middlewares and `port` are supplied by your code.

## Routes

Use `get`, `post`, `put`, `patch`, `del`, `head`, `options`, or `all` to declare a route. The second argument is route meta. Schemas are declared on lifecycle hooks instead: pass `params`, `query`, `body`, or `headers` as the hook's second argument to validate before that stage runs. `response` is type-only and is never validated at runtime.

```ts
import { post } from 'monocon'
import { z } from 'zod'

export const createUser = post('/users', { tags: ['Users'] }).handle(
  (ctx) => ({ id: 1, name: ctx.body.name }),
  {
    body: z.object({ name: z.string() }),
    response: z.object({ id: z.number(), name: z.string() }),
  },
)
```

Each route is a chain of lifecycle hooks:

- `onRequest(ctx, schemas?)` — runs first; its return value is added to the context.
- `beforeHandle(ctx, schemas?)` — runs before the handler; its return value is added to the context.
- `handle(ctx, schemas?)` — the route handler (required); its return value is the response body.
- `afterHandle(ctx, result, schemas?)` — transforms the handler result; only `response` is allowed.
- `onResponse(ctx, response, schemas?)` — transforms the final response; only `response` is allowed.

Schemas accumulate forward: later stages see the schemas declared by earlier stages. If `response` is declared more than once, the first declaration wins.

```ts
const tracked = get('/users/:id')
  .onRequest(() => ({ traceId: 'trace-1' }), {
    headers: z.object({ authorization: z.string() }),
  })
  .beforeHandle((ctx) => ({ requestedBy: ctx.traceId }))
  .handle((ctx) => ({ requestedBy: ctx.requestedBy }), {
    params: z.object({ id: z.coerce.number() }),
  })
  .afterHandle((_ctx, result) => result)
  .onResponse((_ctx, response) => response)
```

## Route groups

Use `defineGroup(prefix, options?, meta?)` to share a path prefix, options, and meta across routes. Group methods behave like the top-level route factories: their second argument is route meta, and schemas are declared on lifecycle hooks.

```ts
import { defineGroup } from 'monocon'

const users = defineGroup('/users', { meta: { tags: ['Users'] } })

export const getUser = users.get('/:id').handle((ctx) => ({ id: ctx.params.id }))
export const listUsers = users.get('/').handle(() => [])
```

Groups can be nested, and route-level meta is merged over group-level meta. The compiler generates declarations using the final prefixed paths, so middleware context and route records stay in sync.

## Middleware

A middleware matches routes by path pattern and contributes typed context to them. Patterns accept a glob string or an `{ include, exclude }` object; omitting the pattern matches every route.

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

Monocon generates declarations under `.monocon/` that map each matched middleware to its route path. As a result, a handler can consume `ctx.requestId`, `ctx.user`, and `ctx.role` with full type safety — no manual context typing required.

## Startup options

Every adapter's `start()` takes the same options. Pass routes, middlewares and `port` yourself; nothing is discovered from generated files or `configuration.ts`.

```ts
import { start } from 'monocon/node'

const server = await start({
  routes,
  middlewares,
  port: 3000,
  hostname: '0.0.0.0',
})
```

Both `routes` and `middlewares` accept a namespace import or an ordered array. Order is significant for middlewares and is the source of truth for the generated context types.

## Compiler configuration

`monocon.config.ts` defines where the compiler looks for declarations. Import `defineConfig` from `monocon/config`:

```ts
import { defineConfig } from 'monocon/config'

export default defineConfig({
  entry: ['src/**/*.ts'],
  build: {
    outDir: '.monocon-dist',
  },
})
```

`entry` is a list of files or glob patterns to scan. Any scanned file may export a default array to fix declaration order. `build.outDir` is only used by `monocon build`; generation always writes to `.monocon/`.

## CLI

The `monocon` command is provided by the `monocon` package, powered by the bundled `@monocon/compiler`.

```sh
monocon gen [command...]   # write .monocon declarations, then optionally run a command
monocon gen --watch [command...]  # regenerate on changes and restart the command
monocon build [command...] # compile sources to .monocon-dist for bundlers, then optionally run a command
```

TypeScript 5.7 or later (before 6.0) is required by `@monocon/compiler` as a peer dependency.

`gen` only emits declarations. `build` is a plain TypeScript compile step for bundlers; it does not inject a registry or alter `start()` calls.

## Packages

- `monocon` — umbrella package; re-exports the runtime API (`get`, `post`, `middleware`, types).
- `@monocon/core` — platform-neutral core runtime with no `node:` dependencies.
- `@monocon/compiler` — declaration generator and CLI (the `monocon` command).
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

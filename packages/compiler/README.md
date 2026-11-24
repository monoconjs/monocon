# @monocon/compiler

The declaration generator and CLI for [monocon](https://www.npmjs.com/package/monocon). It scans your route and middleware declarations and generates type declarations that map middleware context onto matched routes. It can also compile sources for bundlers, but never participates in runtime wiring.

This package is bundled as a dependency of `monocon` and powers its `monocon` command. Installing `monocon` gives you the command; you can also install this package directly if you only need the tooling.

## Install

```sh
npm install -D @monocon/compiler typescript
```

Requires Node.js 22 or later and TypeScript 5.7 or later (before 6.0) as a peer dependency.

## Commands

```sh
monocon gen [command...]   # write .monocon declarations, then optionally run a command
monocon gen --watch [command...]  # regenerate on changes and restart the command
monocon build [command...] # compile sources to .monocon-dist for bundlers, then optionally run a command
```

### `monocon gen`

Scans the entry files configured in `monocon.config.ts` and writes four declaration files to `.monocon/`:

- `types.d.ts` — entry file that imports the three declaration files below.
- `middlewares.d.ts` — augments `RouteMiddlewareContext` with the middleware each route path provides.
- `errors.d.ts` — augments `ErrorMap` and `ErrorStatusMap` from your error factories.
- `routes.d.ts` — augments `RouteRecords` with each route's type by path and method.

No runtime files are generated. Routes, middlewares and server options are passed to `start()` by your application code.

If a command is appended, it runs after generation.

### Watch mode

Add `--watch` to keep the process running. Monocon watches your entry sources and `monocon.config.ts`; on a change it regenerates `.monocon/` and restarts the appended command:

```sh
monocon gen --watch tsx src/index.ts
```

Press Ctrl+C to stop the watcher and the command together. Since monocon already restarts the command, do not give the appended command its own watcher. `--watch` may also appear before `gen` (`monocon --watch gen tsx src/index.ts`).

### `monocon build`

Runs generation, then compiles the source files to `.monocon-dist/`. The output is a plain TypeScript compile: no registry import is injected and `start()` calls are left untouched. The result can be consumed by a bundler (for example `tsdown` with `entry: './.monocon-dist/index.js'`).

If a command is appended, it runs after the build completes — for example:

```sh
monocon build node dist/index.mjs
```

Monocon options (`--cwd`, `--config`) are still parsed whether they appear before or after `build`; everything else after `build` is passed to the appended command.

## Configuration

Create `monocon.config.ts` in your project root:

```ts
import { defineConfig } from '@monocon/compiler'

export default defineConfig({
  entry: ['src/**/*.ts'],
  build: {
    outDir: '.monocon-dist',
  },
})
```

- `entry` — files or glob patterns to scan; no specific entry names are required. A scanned file may export a default array to fix declaration order.
- `build.outDir` — output directory for `monocon build` (default `.monocon-dist`). Generation always writes to `.monocon/`.

Routes created with `defineGroup(...)` are recognized when the group is declared in the same scanned file. Their declarations use the final prefixed path, so middleware context and route records match runtime routing.

When using the bundled CLI from `monocon`, import `defineConfig` from `monocon/config` instead.

## License

[MIT](./LICENSE)

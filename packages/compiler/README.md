# @monocon/compiler

The code generation CLI for [monocon](https://www.npmjs.com/package/monocon). It scans your route and middleware declarations, generates type declarations that map middleware context onto matched routes, and compiles sources for bundlers.

This package is bundled as a dependency of `monocon`, so installing `monocon` gives you the `monocon` command. You can also install it directly if you only need the tooling.

## Install

```sh
npm install -D @monocon/compiler
```

Requires Node.js 22 or later.

## Commands

```sh
monocon gen [command...]   # generate .monocon declarations, then optionally run a command
monocon gen --watch [command...]  # regenerate on changes and restart the command
monocon build [command...] # compile sources to .monocon-dist, then optionally run a command
```

### `monocon gen`

Scans the entry files configured in `monocon.config.ts` and writes to `.monocon/`:

- `types.d.ts` — module augmentation that maps matched middleware to each route path, so handler contexts are typed with the values your middleware provides.
- `registry.mjs` / `registry.d.mts` — a barrel re-exporting all declarations, consumed by the adapter's `start()` at runtime.

If a command is appended, it runs after generation.

### Watch mode

Add `--watch` to keep the process running. Monocon watches your entry sources and `monocon.config.ts`; on a change it regenerates `.monocon/` and restarts the appended command:

```sh
monocon gen --watch tsx src/index.ts
```

Press Ctrl+C to stop the watcher and the command together. Since monocon already restarts the command, do not give the appended command its own watcher. `--watch` may also appear before `gen` (`monocon --watch gen tsx src/index.ts`).

### `monocon build`

Runs generation, then compiles the entry files to `.monocon-dist/`, injecting the generated registry import into `start()` calls (from any platform adapter). The result is consumed by a bundler (for example `tsdown` with `entry: './.monocon-dist/index.js'`).

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

- `entry` — glob patterns for files to scan (required).
- `build.outDir` — compiler output directory (default `.monocon-dist`).

When using the bundled CLI from `monocon`, import `defineConfig` from `monocon/config` instead.

## License

[MIT](./LICENSE)

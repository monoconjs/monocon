# @monocon/cli

The code generation CLI for [monocon](https://www.npmjs.com/package/monocon). It scans your endpoint and middleware declarations, generates type declarations that map middleware context onto matched endpoints, and compiles sources for bundlers.

This package is bundled as a dependency of `monocon`, so installing `monocon` gives you the `monocon` command. You can also install it directly if you only need the tooling.

## Install

```sh
npm install -D @monocon/cli
```

Requires Node.js 22 or later.

## Commands

```sh
monocon gen [command...]   # generate .monocon declarations, then optionally run a command
monocon build              # compile sources to .monocon-dist for bundlers
```

### `monocon gen`

Scans the entry files configured in `monocon.config.ts` and writes to `.monocon/`:

- `types.d.ts` — module augmentation that maps matched middleware to each endpoint path, so handler contexts are typed with the values your middleware provides.
- `registry.mjs` / `registry.d.mts` — a barrel re-exporting all declarations, consumed by `bootstrap()` at runtime.

If a command is appended, it runs after generation. This is useful for watching or dev servers:

```sh
monocon gen tsx watch src/index.ts
```

### `monocon build`

Runs generation, then compiles the entry files to `.monocon-dist/`, injecting the generated registry import into `bootstrap()` calls. The result is consumed by a bundler (for example `tsdown` with `entry: './.monocon-dist/index.js'`).

## Configuration

Create `monocon.config.ts` in your project root:

```ts
import { defineConfig } from '@monocon/cli'

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

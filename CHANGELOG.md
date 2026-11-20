# Changelog

All notable changes to `monocon` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-11-20

### Added

- Add `defineGroup(prefix, options?, meta?)` with all route methods, nested groups, and final prefixed paths in generated declarations.
- Support method-prefixed middleware patterns such as `GET /users/*` with method-specific generated context.
- Generate a global `RouteRecords` map keyed by path and method for each route type.
- Recognize default exports when collecting compiler declarations.

### Changed

- Require `start()` to receive routes, middlewares, and port explicitly as namespace objects or ordered arrays.
- Change `defineConfig.entry` to a string array of files and glob patterns with no fixed entry names.
- Split generated `.monocon` output into middleware, error, and route files imported by `types.d.ts`.
- Keep `monocon build` as a plain compile step without registry injection.
- Limit the `monocon` root entry to documented public API and types.

### Fixed

- Treat a middleware without a pattern as global so it matches every route.
- Recognize group route factories bound through object destructuring so generated context uses the prefixed path.

## [0.2.0] - 2026-11-19

### Added

- Allow `defineError()` with no arguments and accept a plain TypeScript type as its payload generic, so defining a validation schema is optional.

### Changed

- Make the error factory callable without a payload when the payload type has no required keys.

### Fixed

- Point generated global augmentation and its import at the public `monocon/global` subpath instead of the internal `@monocon/core/global`.

## [0.1.1] - 2026-11-18

### Added

- Provide the `monocon` command directly from the `monocon` package, so installing it alone is enough to use the CLI.
- Export the compiler CLI at `@monocon/compiler/cli`.

## [0.1.0] - 2026-11-18

### Added

- Add platform adapters as `monocon/node`, `monocon/bun`, `monocon/deno`, and `monocon/workers` subpaths, each exporting a `start()` entry.
- Allow `monocon build` to run an appended command after compilation.
- Allow error factories returned by `defineError()` to be called directly or constructed with `new`.

### Changed

- Split the project into four packages: `@monocon/core` (platform-neutral runtime), `@monocon/compiler` (codegen CLI), `@monocon/adapter` (platform adapters), and `monocon` (umbrella re-export).
- Replace `bootstrap()` with per-platform `start()` functions. Bun, Deno and Workers adapters are currently placeholders.
- Rename `middleware()` to `defineMiddleware(hooks, pattern)` with the pattern moved to the second argument.
- Rename `error()` to `defineError()`.
- Rename all `endpoint` terminology to `route` in the public API and generated types.
- Point generated global augmentation at `@monocon/core/global`.
- Move server contracts (`Adapter`, `ServerConfig`, `RunningServer`) into `@monocon/adapter`; keep `FetchHandler` in `@monocon/core`.

## [0.0.3] - 2026-11-17

### Added

- Add `onError` hooks with typed error contexts and named error payloads inferred from the generated error map.
- Add built-in error factories for validation, parse, not-found, no-handler, and internal errors.
- Add `monocon gen --watch` to regenerate `.monocon` declarations and restart the command on source or config changes (provided by the bundled CLI).

### Fixed

- Return 404 for unmatched routes with invalid bodies instead of a validation error.
- Run hooks on not-found routes so middleware and error handlers observe them.
- Correct `onError` dependency-list inference for the full error context.

### Changed

- Narrow the public exports of the main entry to the documented runtime API and types; internal helpers are no longer re-exported.

## [0.0.2] - 2026-11-16

Skipped to keep the version number in sync with `@monocon/compiler`.

## [0.0.1] - 2026-11-16

### Added

- Initial release: typed, chainable routes with middleware-provided context inference.
- Route matching, request execution, and `bootstrap()` server startup.
- Code generation CLI with `.monocon` type declarations and `monocon build` for bundler output.

[0.3.0]: https://github.com/monoconjs/monocon/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/monoconjs/monocon/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/monoconjs/monocon/compare/v0.1.0...v0.1.1
[0.0.3]: https://github.com/monoconjs/monocon/compare/v0.0.1...v0.0.3
[0.0.1]: https://github.com/monoconjs/monocon/releases/tag/v0.0.1

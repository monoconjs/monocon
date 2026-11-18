# Changelog

All notable changes to `monocon` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.0.3]: https://github.com/monoconjs/monocon/compare/v0.0.1...v0.0.3
[0.0.1]: https://github.com/monoconjs/monocon/releases/tag/v0.0.1

import type { Middleware, MiddlewareHooks, MiddlewarePattern } from './types/middleware.ts'

export interface RuntimeMiddleware {
  '~pattern': MiddlewarePattern
  '~hooks': MiddlewareHooks
}

export function middleware<
  const Pattern extends MiddlewarePattern,
  const Hooks extends MiddlewareHooks,
>(pattern: Pattern, hooks: Hooks): Middleware<Pattern, Hooks> {
  // The declared `~provided` is a phantom type derived from the hooks' return
  // values; at runtime it has no value, so a cast bridges runtime and type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { '~pattern': pattern, '~hooks': hooks } as unknown as Middleware<Pattern, Hooks>
}

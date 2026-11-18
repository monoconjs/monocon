import type { Middleware, MiddlewareHooks, MiddlewarePattern } from './types/middleware.ts'

export interface RuntimeMiddleware {
  '~pattern': MiddlewarePattern
  '~hooks': MiddlewareHooks
}

export function defineMiddleware<
  const Hooks extends MiddlewareHooks,
  const Pattern extends MiddlewarePattern,
>(hooks: Hooks, pattern: Pattern): Middleware<Pattern, Hooks> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return { '~pattern': pattern, '~hooks': hooks } as unknown as Middleware<Pattern, Hooks>
}

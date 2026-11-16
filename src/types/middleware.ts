import type { EndpointMiddlewareContext } from '../global.ts'

export type MiddlewareFor<Path extends string> = Path extends keyof EndpointMiddlewareContext
  ? EndpointMiddlewareContext[Path] extends object
    ? EndpointMiddlewareContext[Path]
    : {}
  : {}

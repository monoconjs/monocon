import { notFoundRoute } from './_not-found.ts'
import { execute } from './execute.ts'
import type { Matcher } from './matcher.ts'
import type { RuntimeMiddleware } from './middleware.ts'
import type { RuntimeRoute } from './route.ts'

export interface FetchHandler {
  (request: Request): Promise<Response>
}

export function createFetchHandler(
  matcher: Matcher,
  middlewares: readonly RuntimeMiddleware[],
): FetchHandler {
  return async (request) => {
    const url = new URL(request.url)
    const matched = matcher.match(request.method, url.pathname)
    const route = matched ?? notFoundRoute(url.pathname)

    return execute(route, request, {
      middlewares: [...middlewares],
      skipBody: matched === undefined,
    })
  }
}

export function isRoute(value: unknown): value is RuntimeRoute {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~method' in value &&
    '~path' in value &&
    '~hooks' in value &&
    '~handler' in value
  )
}

export function isMiddleware(value: unknown): value is RuntimeMiddleware {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~pattern' in value &&
    '~hooks' in value &&
    !('~path' in value)
  )
}

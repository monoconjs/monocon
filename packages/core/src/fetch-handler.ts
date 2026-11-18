import { notFoundRoute } from './_not-found.ts'
import { assignErrorName, isErrorFactory } from './errors/index.ts'
import { execute } from './execute.ts'
import type { Matcher } from './matcher.ts'
import type { RuntimeMiddleware } from './middleware.ts'
import type { RuntimeRoute } from './route.ts'

export interface FetchHandler {
  (request: Request): Promise<Response>
}

export interface CollectedDeclarations {
  readonly routes: RuntimeRoute[]
  readonly middlewares: RuntimeMiddleware[]
}

export function collectDeclarations(registry: object): CollectedDeclarations {
  const routes: RuntimeRoute[] = []
  const middlewares: RuntimeMiddleware[] = []

  for (const [exportName, value] of Object.entries(registry)) {
    if (isErrorFactory(value)) assignErrorName(value, exportName)
    else if (isRoute(value)) routes.push(value)
    else if (isMiddleware(value)) middlewares.push(value)
  }

  return { routes, middlewares }
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

function isRoute(value: unknown): value is RuntimeRoute {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~method' in value &&
    '~path' in value &&
    '~hooks' in value &&
    '~handler' in value
  )
}

function isMiddleware(value: unknown): value is RuntimeMiddleware {
  return (
    typeof value === 'object' &&
    value !== null &&
    '~pattern' in value &&
    '~hooks' in value &&
    !('~path' in value)
  )
}

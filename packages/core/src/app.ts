import { createContext, getResponseData, type RuntimeContext } from './context.ts'
import { getRoutes, type RegisteredRoute } from './registry.ts'
import { isRecord, mergeSchemaOptions, SchemaValidationError, validateSchema } from './schema.ts'
import type { AnyProvideHooks } from './types/provide.ts'

export interface AppOptions {
  readonly routes?: readonly RegisteredRoute[]
}

export interface App {
  readonly routes: readonly RegisteredRoute[]
  fetch(request: Request): Promise<Response>
}

interface PreparedHook {
  readonly name: string
  readonly hooks: AnyProvideHooks
}

export function createApp(options: AppOptions = {}): App {
  const routes = options.routes ?? getRoutes()

  return {
    routes,
    async fetch(request) {
      const url = new URL(request.url)
      const matched = matchRoute(routes, request.method, url.pathname)
      if (matched === undefined) return notFound()

      const hooks = resolveHooks(matched.route.injects, matched.route.options)
      const schemas = mergeSchemaOptions(
        hooks.map((item) => item.hooks.schema ?? {}),
        matched.route.options,
      )

      let context: RuntimeContext | undefined

      try {
        const runtimeContext = await createContext({
          request,
          url,
          params: matched.params,
          meta: isRecord(matched.route.options.meta) ? matched.route.options.meta : {},
          schemas,
        })
        context = runtimeContext

        let result: unknown
        let earlyResponse: Response | undefined

        await sequence(hooks, async (item) => {
          if (earlyResponse !== undefined || item.hooks.beforeHandle === undefined) return
          const value = await item.hooks.beforeHandle(runtimeContext)
          if (value instanceof Response) {
            earlyResponse = value
            return
          }
          if (isRecord(value)) Object.assign(runtimeContext, value)
        })

        if (earlyResponse !== undefined) result = earlyResponse

        if (result === undefined) {
          const handler: unknown = matched.route.handler
          if (typeof handler !== 'function') return internalError()
          result = await handler(runtimeContext)
        }

        await sequence(hooks.toReversed(), async (item) => {
          if (item.hooks.afterHandle === undefined) return
          const value = await item.hooks.afterHandle(runtimeContext, result)
          if (value !== undefined) result = value
        })

        const data = result instanceof Response ? getResponseData(result) : result
        if (data !== undefined) await validateSchema(schemas.response, data)
        return toResponse(result)
      } catch (error) {
        let errorResponse: Response | undefined

        await sequence(hooks.toReversed(), async (item) => {
          if (errorResponse !== undefined || item.hooks.onError === undefined) return
          const value = await item.hooks.onError(error, context)
          if (value instanceof Response) errorResponse = value
        })

        if (errorResponse !== undefined) return errorResponse

        if (error instanceof SchemaValidationError) {
          return Response.json({ error: error.message, issues: error.issues }, { status: 400 })
        }
        return internalError()
      }
    },
  }
}

function resolveHooks(
  injects: Record<string, unknown>,
  options: Record<string, unknown>,
): PreparedHook[] {
  const result: PreparedHook[] = []

  for (const [name, provider] of Object.entries(injects)) {
    if (name === '__global' || provider === undefined || options[name] === false) continue

    const hooks = typeof provider === 'function' ? provider() : provider
    if (isRecord(hooks)) result.push({ name, hooks })
  }

  return result
}

async function sequence<Value>(
  items: readonly Value[],
  run: (item: Value) => Promise<void>,
): Promise<void> {
  await items.reduce<Promise<void>>(async (previous, item) => {
    await previous
    await run(item)
  }, Promise.resolve())
}

interface MatchedRoute {
  readonly route: RegisteredRoute
  readonly params: Record<string, string>
  readonly score: number
}

function matchRoute(
  routes: readonly RegisteredRoute[],
  method: string,
  path: string,
): MatchedRoute | undefined {
  const methods: string[] = method === 'HEAD' ? ['HEAD', 'GET'] : [method]
  let best: MatchedRoute | undefined

  for (const route of routes) {
    if (route.method !== 'ALL' && !methods.includes(route.method)) continue
    const matched = matchPath(route.path, path)
    if (matched === undefined) continue
    if (best === undefined || matched.score > best.score) {
      best = { route, params: matched.params, score: matched.score }
    }
  }

  return best
}

function matchPath(
  pattern: string,
  path: string,
): { params: Record<string, string>; score: number } | undefined {
  const expected = pattern.split('/').filter(Boolean)
  const actual = path.split('/').filter(Boolean)
  const params: Record<string, string> = {}
  let score = 0

  for (const [index, segment] of expected.entries()) {
    if (segment === '*') {
      params.wildcard = actual.slice(index).map(decode).join('/')
      return { params, score }
    }

    const value = actual[index]
    if (value === undefined) return undefined

    if (segment.startsWith(':')) {
      params[segment.slice(1)] = decode(value)
      score += 1
      continue
    }

    if (segment !== value) return undefined
    score += 2
  }

  return expected.length === actual.length ? { params, score } : undefined
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) return result
  if (result === undefined) return new Response(null, { status: 204 })
  return Response.json(result)
}

function notFound(): Response {
  return new Response('404 Not Found', { status: 404 })
}

function internalError(): Response {
  return new Response('Internal Server Error', { status: 500 })
}

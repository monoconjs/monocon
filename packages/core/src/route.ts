import type { RouteMethod } from './types/http.ts'
import type { RouteBuilder, RouteFactory, RouteOptions, RouteState } from './types/route.ts'

export type RouteLifecycle = 'onRequest' | 'beforeHandle' | 'afterHandle' | 'onResponse' | 'onError'

type Hook = (...args: any[]) => any

export interface RuntimeRoute {
  '~method': RouteMethod
  '~path': string
  '~options': RouteOptions
  '~provided': object
  '~handler': Hook | undefined
  '~hooks': Record<RouteLifecycle, Hook[]>
}

interface Builder extends RuntimeRoute {
  onRequest: (hook: Hook) => Builder
  beforeHandle: (hook: Hook) => Builder
  handle: (handler: Hook) => Builder
  afterHandle: (hook: Hook) => Builder
  onResponse: (hook: Hook) => Builder
  onError: (hook: Hook) => Builder
}

function createBuilder<
  Method extends RouteMethod,
  Path extends string,
  Options extends RouteOptions,
>(
  method: Method,
  path: Path,
  options: RouteOptions,
): RouteBuilder<'onRequest', RouteState<Method, Path, Options>> {
  const hooks: Record<RouteLifecycle, Hook[]> = {
    onRequest: [],
    beforeHandle: [],
    afterHandle: [],
    onResponse: [],
    onError: [],
  }

  const builder: Builder = {
    '~method': method,
    '~path': path,
    '~options': options,
    '~provided': {},
    '~handler': undefined,
    '~hooks': hooks,
    onRequest(hook) {
      hooks.onRequest.push(hook)
      return builder
    },
    beforeHandle(hook) {
      hooks.beforeHandle.push(hook)
      return builder
    },
    handle(handler) {
      builder['~handler'] = handler
      return builder
    },
    afterHandle(hook) {
      hooks.afterHandle.push(hook)
      return builder
    },
    onResponse(hook) {
      hooks.onResponse.push(hook)
      return builder
    },
    onError(hook) {
      hooks.onError.push(hook)
      return builder
    },
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return builder as unknown as RouteBuilder<'onRequest', RouteState<Method, Path, Options>>
}

export function joinPath(prefix: string, path: string): string {
  const base = prefix === '/' ? '' : prefix.replace(/\/+$/, '')
  if (base === '') return path
  if (path === '/' || path === '') return base
  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

export function mergeRouteOptions(base: RouteOptions, override: RouteOptions): RouteOptions {
  const merged: RouteOptions = { ...base, ...override }
  if (base.meta !== undefined || override.meta !== undefined) {
    merged.meta = { ...base.meta, ...override.meta }
  }
  return merged
}

export function createRouteFactory<Method extends RouteMethod>(
  method: Method,
  prefix = '',
  options: RouteOptions = {},
): RouteFactory<Method> {
  return (path: string, routeOptions?: RouteOptions) =>
    createBuilder(method, joinPath(prefix, path), mergeRouteOptions(options, routeOptions ?? {}))
}

export const get: RouteFactory<'GET'> = createRouteFactory('GET')
export const post: RouteFactory<'POST'> = createRouteFactory('POST')
export const put: RouteFactory<'PUT'> = createRouteFactory('PUT')
export const patch: RouteFactory<'PATCH'> = createRouteFactory('PATCH')
export const del: RouteFactory<'DELETE'> = createRouteFactory('DELETE')
export const head: RouteFactory<'HEAD'> = createRouteFactory('HEAD')
export const options: RouteFactory<'OPTIONS'> = createRouteFactory('OPTIONS')
export const all: RouteFactory<'ALL'> = createRouteFactory('ALL')

export { del as delete }

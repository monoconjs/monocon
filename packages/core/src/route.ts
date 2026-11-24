import type { RouteMethod } from './types/http.ts'
import type {
  RouteBuilder,
  RouteFactory,
  RouteMeta,
  RouteOptions,
  RouteState,
  SchemaOptions,
} from './types/route.ts'

export type RouteLifecycle = 'onRequest' | 'beforeHandle' | 'afterHandle' | 'onResponse' | 'onError'

export type RouteValidationStage = 'onRequest' | 'beforeHandle' | 'handle'

type Hook = (...args: any[]) => any

export interface RuntimeRoute {
  '~method': RouteMethod
  '~path': string
  '~options': RouteOptions
  '~provided': object
  '~handler': Hook | undefined
  '~hooks': Record<RouteLifecycle, Hook[]>
  '~validations': Record<RouteValidationStage, SchemaOptions>
}

interface Builder extends RuntimeRoute {
  onRequest: (hook: Hook, schemas?: SchemaOptions) => Builder
  beforeHandle: (hook: Hook, schemas?: SchemaOptions) => Builder
  handle: (handler: Hook, schemas?: SchemaOptions) => Builder
  afterHandle: (hook: Hook, schemas?: SchemaOptions) => Builder
  onResponse: (hook: Hook, schemas?: SchemaOptions) => Builder
  onError: (hook: Hook) => Builder
}

function pickSchemas(options: RouteOptions): SchemaOptions {
  return {
    ...(options.params === undefined ? {} : { params: options.params }),
    ...(options.query === undefined ? {} : { query: options.query }),
    ...(options.body === undefined ? {} : { body: options.body }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
    ...(options.response === undefined ? {} : { response: options.response }),
  }
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

  const validations: Record<RouteValidationStage, SchemaOptions> = {
    onRequest: pickSchemas(options),
    beforeHandle: {},
    handle: {},
  }

  const builder: Builder = {
    '~method': method,
    '~path': path,
    '~options': options,
    '~provided': {},
    '~handler': undefined,
    '~hooks': hooks,
    '~validations': validations,
    onRequest(hook, schemas) {
      hooks.onRequest.push(hook)
      Object.assign(validations.onRequest, schemas)
      return builder
    },
    beforeHandle(hook, schemas) {
      hooks.beforeHandle.push(hook)
      Object.assign(validations.beforeHandle, schemas)
      return builder
    },
    handle(handler, schemas) {
      builder['~handler'] = handler
      Object.assign(validations.handle, schemas)
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
  const factory = (path: string, meta?: RouteMeta) =>
    createBuilder(method, joinPath(prefix, path), mergeRouteOptions(options, meta ? { meta } : {}))

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return factory as unknown as RouteFactory<Method>
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

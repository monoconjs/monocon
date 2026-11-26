import { isRecord } from './schema.ts'
import type { RouteMethod } from './types/http.ts'
import type { InjectRegistry } from './types/inject.ts'
import type { Meta } from './types/meta.ts'
import type { AnyProvideLike } from './types/provide.ts'
import type { RouteDefinition } from './types/route.ts'

export interface RegisteredRoute extends RouteDefinition {
  readonly id?: string
  readonly meta: Meta
  readonly injects: InjectRegistry
}

export interface ModuleRegistration {
  readonly id?: string
  readonly meta?: Meta
  readonly injects?: InjectRegistry
  readonly routes?: readonly RouteDefinition[]
}

export type RouteHandler = (ctx: any) => any

const METHODS: Record<string, RouteMethod> = {
  get: 'GET',
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  del: 'DELETE',
  delete: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
  all: 'ALL',
}

const registeredRoutes: RegisteredRoute[] = []
const registeredIds = new Set<string>()

export function createRouteBuilder(method: RouteMethod) {
  return (
    path: string,
    handler: RouteHandler,
    options: Record<string, unknown> = {},
  ): RouteDefinition => ({
    method,
    path,
    handler: handler as RouteDefinition['handler'],
    options,
  })
}

export function registerModule(definition: ModuleRegistration): readonly RegisteredRoute[] {
  if (definition.id !== undefined) {
    if (registeredIds.has(definition.id)) return getRoutes()
    registeredIds.add(definition.id)
  }

  const injects = filterInjects(definition.injects)
  const meta = definition.meta ?? {}

  for (const route of definition.routes ?? []) {
    registeredRoutes.push({
      ...route,
      method: normalizeMethod(route.method),
      path: joinPath(meta.prefix, route.path),
      id: definition.id,
      meta,
      injects,
    })
  }

  return getRoutes()
}

export function getRoutes(): readonly RegisteredRoute[] {
  return registeredRoutes
}

export function clearRoutes(): void {
  registeredRoutes.length = 0
  registeredIds.clear()
}

function filterInjects(injects: InjectRegistry | undefined): InjectRegistry {
  const result: InjectRegistry = {}
  for (const [key, value] of Object.entries(injects ?? {})) {
    if (key !== '__global' && isProviderLike(value)) result[key] = value
  }
  return result
}

function isProviderLike(value: unknown): value is AnyProvideLike | true {
  return value === true || typeof value === 'function' || isRecord(value)
}

function normalizeMethod(method: RouteMethod): RouteMethod {
  return METHODS[method] ?? method
}

function joinPath(prefix: string | undefined, path: string): string {
  if (prefix === undefined || prefix === '') return path
  const left = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  const right = path.startsWith('/') ? path : `/${path}`
  return `${left}${right}`
}

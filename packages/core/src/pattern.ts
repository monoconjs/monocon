import type { RuntimeMiddleware } from './middleware.ts'
import type { RouteMethod } from './types/http.ts'
import type { MiddlewarePattern } from './types/middleware.ts'

const METHOD_NAMES = new Set<string>([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'DELETE',
  'CONNECT',
  'OPTIONS',
  'TRACE',
  'PATCH',
  'ALL',
])

function isRouteMethod(value: string): value is RouteMethod {
  return METHOD_NAMES.has(value)
}

interface ParsedPattern {
  readonly method: RouteMethod | undefined
  readonly path: string
}

function parsePattern(glob: string): ParsedPattern {
  const space = glob.indexOf(' ')
  if (space > 0) {
    const head = glob.slice(0, space)
    if (isRouteMethod(head)) return { method: head, path: glob.slice(space + 1) }
  }
  return { method: undefined, path: glob }
}

function methodMatches(
  patternMethod: RouteMethod | undefined,
  routeMethod: RouteMethod | undefined,
): boolean {
  if (routeMethod === undefined || patternMethod === undefined) return true
  if (patternMethod === 'ALL' || routeMethod === 'ALL') return true
  return patternMethod === routeMethod
}

export function patternMatches(
  pattern: MiddlewarePattern,
  path: string,
  method?: RouteMethod,
): boolean {
  if (typeof pattern === 'string') return globPatternMatches(pattern, path, method)

  return (
    pattern.include.some((glob) => globPatternMatches(glob, path, method)) &&
    !pattern.exclude?.some((glob) => globPatternMatches(glob, path, method))
  )
}

function globPatternMatches(glob: string, path: string, method?: RouteMethod): boolean {
  const parsed = parsePattern(glob)
  return methodMatches(parsed.method, method) && globMatches(parsed.path, path)
}

export function matchMiddlewares(
  middlewares: RuntimeMiddleware[],
  path: string,
  method?: RouteMethod,
): RuntimeMiddleware[] {
  return middlewares.filter((middleware) => patternMatches(middleware['~pattern'], path, method))
}

const globCache = new Map<string, RegExp>()

function globMatches(glob: string, path: string): boolean {
  return globToRegExp(glob).test(path)
}

export function globToRegExp(glob: string): RegExp {
  const cached = globCache.get(glob)
  if (cached) return cached

  const compiled = compileGlob(glob)
  globCache.set(glob, compiled)
  return compiled
}

function compileGlob(glob: string): RegExp {
  let source = ''
  let index = 0

  while (index < glob.length) {
    const char = glob[index] ?? ''

    if (char === '*') {
      source += '.*'
      if (glob[index + 1] === '*') index += 2
      else index++
      continue
    }

    if (char === '?') {
      source += '.'
      index++
      continue
    }

    source += char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    index++
  }

  return new RegExp(`^${source}$`)
}

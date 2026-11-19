import type { MiddlewareDecl, Pattern } from './analyze.ts'

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

interface ParsedPattern {
  readonly method: string | undefined
  readonly path: string
}

function parsePattern(glob: string): ParsedPattern {
  const space = glob.indexOf(' ')
  if (space > 0) {
    const head = glob.slice(0, space)
    if (METHOD_NAMES.has(head)) return { method: head, path: glob.slice(space + 1) }
  }
  return { method: undefined, path: glob }
}

function methodMatches(
  patternMethod: string | undefined,
  routeMethod: string | undefined,
): boolean {
  if (routeMethod === undefined || patternMethod === undefined) return true
  if (patternMethod === 'ALL' || routeMethod === 'ALL') return true
  return patternMethod === routeMethod
}

export function patternMatches(pattern: Pattern, path: string, method?: string): boolean {
  if (pattern.kind === 'rules') {
    const included = pattern.include.some((glob) => globPatternMatches(glob, path, method))
    const excluded = pattern.exclude.some((glob) => globPatternMatches(glob, path, method))
    return included && !excluded
  }

  return globPatternMatches(pattern.value, path, method)
}

function globPatternMatches(glob: string, path: string, method?: string): boolean {
  const parsed = parsePattern(glob)
  return methodMatches(parsed.method, method) && globMatches(parsed.path, path)
}

export function matchMiddlewares(
  middlewares: MiddlewareDecl[],
  path: string,
  method?: string,
): MiddlewareDecl[] {
  return middlewares.filter((middleware) => patternMatches(middleware.pattern, path, method))
}

function globMatches(glob: string, path: string): boolean {
  return globToRegExp(glob).test(path)
}

function globToRegExp(glob: string): RegExp {
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

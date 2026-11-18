import type { RuntimeMiddleware } from './middleware.ts'
import type { MiddlewarePattern } from './types/middleware.ts'

export function patternMatches(pattern: MiddlewarePattern, path: string): boolean {
  if (typeof pattern === 'string') return globMatches(pattern, path)

  return (
    pattern.include.some((glob) => globMatches(glob, path)) &&
    !pattern.exclude?.some((glob) => globMatches(glob, path))
  )
}

export function matchMiddlewares(
  middlewares: RuntimeMiddleware[],
  path: string,
): RuntimeMiddleware[] {
  return middlewares.filter((middleware) => patternMatches(middleware['~pattern'], path))
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

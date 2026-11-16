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

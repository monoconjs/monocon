import type { MiddlewareDecl, Pattern } from './analyze.ts'

export function patternMatches(pattern: Pattern, path: string): boolean {
  if (pattern.kind === 'rules') {
    const included = pattern.include.some((glob) => globMatches(glob, path))
    const excluded = pattern.exclude.some((glob) => globMatches(glob, path))
    return included && !excluded
  }

  return globMatches(pattern.value, path)
}

export function matchMiddlewares(middlewares: MiddlewareDecl[], path: string): MiddlewareDecl[] {
  return middlewares.filter((middleware) => patternMatches(middleware.pattern, path))
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
